import { useSyncExternalStore } from 'react'
import { FIB, PALETTE } from '../engine/bauhaus'
import { DEFAULT_WEIGHTS } from '../engine/rules'
import type { Settings, Shape, ShapeKind, View } from '../engine/types'
import { recordActivity, type ActivityType } from './activity'

export interface AppState {
  shapes: Shape[]
  settings: Settings
  tool: ShapeKind
  selectedId: string | null
  /** 直前に追加・変更された図形。重心調整で固定される。 */
  anchorId: string | null
  editorOpen: boolean
  settingsOpen: boolean
  view: View
  past: Shape[][]
  future: Shape[][]
}

const STORAGE_KEY = 'bau:v1'

const defaultSettings: Settings = {
  mode: 'order',
  grid: '8',
  showGrid: true,
  correspondence: true,
  background: '#f2eee3',
  blend: 'multiply',
  symmetry: false,
  folds: 4,
  mirror: true,
  flow: false,
  chaosSeed: 1,
  weights: DEFAULT_WEIGHTS,
  dynamism: 0.4,
  tension: -0.3,
}

export const defaultView: View = { zoom: 1, rotation: 0, panX: 0, panY: 0 }

function load(): Pick<AppState, 'shapes' | 'settings'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      const settings = { ...defaultSettings, ...p.settings }
      settings.weights = { ...DEFAULT_WEIGHTS, ...p.settings?.weights }
      return { shapes: Array.isArray(p.shapes) ? p.shapes : [], settings }
    }
  } catch {
    /* プライベートモード等では保存なしで動かす */
  }
  return { shapes: [], settings: defaultSettings }
}

let state: AppState = {
  ...load(),
  tool: 'circle',
  selectedId: null,
  anchorId: null,
  editorOpen: false,
  settingsOpen: false,
  view: defaultView,
  past: [],
  future: [],
}

const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | undefined

function set(patch: Partial<AppState>) {
  const prev = state
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
  if (prev.shapes !== state.shapes || prev.settings !== state.settings) {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ shapes: state.shapes, settings: state.settings }))
      } catch {
        /* ignore */
      }
    }, 300)
  }
}

export const store = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export function useStore<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => sel(state))
}

const uid = () => Math.random().toString(36).slice(2, 10)

/** 連続して起きる操作（ドラッグ・スライダー・ズーム）は 0.4 秒に 1 回だけ記録する */
const log = (type: ActivityType, continuous = false) => recordActivity(type, Date.now(), continuous ? 400 : 0)

/** 変更前のスナップショットを履歴に積む（ドラッグ開始時など、1 操作につき 1 回呼ぶ） */
export function checkpoint() {
  set({ past: [...state.past.slice(-60), state.shapes], future: [] })
}

export const actions = {
  setTool: (tool: ShapeKind) => set({ tool }),

  addShape(p: Partial<Shape> & Pick<Shape, 'x' | 'y'>): string {
    checkpoint()
    const kind = p.kind ?? state.tool
    const shape: Shape = {
      size: FIB[3 + Math.floor(Math.random() * 3)],
      rotation: 0,
      color: PALETTE[Math.floor(Math.random() * 4)],
      colorLocked: false,
      alpha: 1,
      contrast: 0,
      seed: Math.floor(Math.random() * 2 ** 31),
      ...p,
      id: uid(),
      kind,
    }
    set({ shapes: [...state.shapes, shape], anchorId: shape.id, selectedId: null })
    log('add')
    return shape.id
  },

  /** 履歴を積まずに更新（ドラッグ中・スライダー操作中） */
  updateShape(id: string, patch: Partial<Shape>) {
    log('x' in patch || 'y' in patch ? 'move' : 'edit', true)
    set({
      shapes: state.shapes.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      anchorId: id,
    })
  },

  removeShape(id: string) {
    log('remove')
    checkpoint()
    set({
      shapes: state.shapes.filter((s) => s.id !== id),
      selectedId: null,
      editorOpen: false,
      anchorId: null,
    })
  },

  duplicate(id: string) {
    const s = state.shapes.find((x) => x.id === id)
    if (!s) return
    const nid = actions.addShape({ ...s, x: s.x + 0.08, y: s.y + 0.06, seed: s.seed + 7919 })
    set({ selectedId: nid })
  },

  bringToFront(id: string) {
    const s = state.shapes.find((x) => x.id === id)
    if (!s) return
    checkpoint()
    set({ shapes: [...state.shapes.filter((x) => x.id !== id), s] })
  },

  select: (id: string | null) => set({ selectedId: id, editorOpen: id ? state.editorOpen : false }),
  openEditor: (id: string) => set({ selectedId: id, editorOpen: true, settingsOpen: false }),
  closeEditor: () => set({ editorOpen: false }),
  toggleSettings: () => set({ settingsOpen: !state.settingsOpen, editorOpen: false }),

  setSettings(patch: Partial<Settings>) {
    log('symmetry' in patch ? 'symmetry' : 'flow' in patch ? 'flow' : 'mode' in patch ? 'mode' : 'settings', true)
    set({ settings: { ...state.settings, ...patch }, anchorId: null })
  },

  toggleMode() {
    const order = state.settings.mode === 'order'
    actions.setSettings({
      mode: order ? 'chaos' : 'order',
      chaosSeed: order ? Math.floor(Math.random() * 2 ** 31) : state.settings.chaosSeed,
    })
  },

  setView(view: View) {
    log('zoom', true)
    set({ view })
  },

  clear() {
    if (!state.shapes.length) return
    log('clear')
    checkpoint()
    set({ shapes: [], selectedId: null, editorOpen: false, anchorId: null })
  },

  undo() {
    const prev = state.past[state.past.length - 1]
    if (!prev) return
    log('undo')
    set({
      shapes: prev,
      past: state.past.slice(0, -1),
      future: [state.shapes, ...state.future],
      selectedId: null,
      editorOpen: false,
      anchorId: null,
    })
  },

  redo() {
    const next = state.future[0]
    if (!next) return
    log('redo')
    set({ shapes: next, past: [...state.past, state.shapes], future: state.future.slice(1), anchorId: null })
  },
}
