import { useSyncExternalStore } from 'react'
import { FIB, PALETTE } from '../engine/bauhaus'
import { DEFAULT_WEIGHTS } from '../engine/rules'
import { familyIds, homageRelations, reflectPoint, reflectRotation, segmentsToRelations, sideOf, walkPath } from '../engine/groups'
import type { Settings, Shape, ShapeKind, ToolKind, View } from '../engine/types'
import { recordActivity, type ActivityType } from './activity'

export interface AppState {
  shapes: Shape[]
  settings: Settings
  tool: ToolKind
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
  contrastMode: 'none',
  tone: 'color',
  flowStyle: 'energy',
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

export const isShapeKind = (t: ToolKind): t is ShapeKind => t !== 'homage' && t !== 'fold' && t !== 'walker'

/** 折りで写した図形が、どの図形の位置から動き出すか（描画側が一度だけ読む） */
export const spawnFrom = new Map<string, string>()

function newShape(p: Partial<Shape> & Pick<Shape, 'kind' | 'x' | 'y'>): Shape {
  return {
    size: 55,
    rotation: 0,
    apex: 60,
    color: PALETTE[Math.floor(Math.random() * 4)],
    colorLocked: false,
    alpha: 1,
    contrast: 0,
    seed: Math.floor(Math.random() * 2 ** 31),
    ...p,
    id: uid(),
  }
}

/** 親とその子孫を、新しい id で複製する。transform は親にだけ適用し、子は新しい親を指す */
function cloneFamily(shapes: Shape[], rootId: string, transform: (root: Shape) => Shape): Shape[] {
  const ids = familyIds(shapes, rootId)
  const map = new Map(ids.map((id) => [id, uid()]))
  return ids.map((id, i) => {
    const s = shapes.find((x) => x.id === id)!
    const base = i === 0 ? transform(s) : { ...s }
    return { ...base, id: map.get(id)!, parent: s.parent ? map.get(s.parent) : undefined, seed: s.seed + 7919 }
  })
}

/** 連続して起きる操作（ドラッグ・スライダー・ズーム）は 0.4 秒に 1 回だけ記録する */
const log = (type: ActivityType, continuous = false) => recordActivity(type, Date.now(), continuous ? 400 : 0)

/** 変更前のスナップショットを履歴に積む（ドラッグ開始時など、1 操作につき 1 回呼ぶ） */
export function checkpoint() {
  set({ past: [...state.past.slice(-60), state.shapes], future: [] })
}

export const actions = {
  setTool: (tool: ToolKind) => set({ tool }),

  addShape(p: Partial<Shape> & Pick<Shape, 'x' | 'y'>): string {
    checkpoint()
    const kind: ShapeKind = p.kind ?? (isShapeKind(state.tool) ? state.tool : 'circle')
    const shape: Shape = {
      size: FIB[3 + Math.floor(Math.random() * 3)],
      rotation: 0,
      apex: 60,
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
    const family = new Set(familyIds(state.shapes, id))
    set({
      shapes: state.shapes.filter((s) => !family.has(s.id)),
      selectedId: null,
      editorOpen: false,
      anchorId: null,
    })
  },

  duplicate(id: string) {
    const s = state.shapes.find((x) => x.id === id)
    if (!s) return
    checkpoint()
    const copies = cloneFamily(state.shapes, id, (root) => ({ ...root, x: root.x + 0.08, y: root.y + 0.06 }))
    set({ shapes: [...state.shapes, ...copies], anchorId: copies[0].id, selectedId: copies[0].id })
    log('add')
  },

  bringToFront(id: string) {
    if (!state.shapes.some((x) => x.id === id)) return
    checkpoint()
    const family = new Set(familyIds(state.shapes, id))
    set({ shapes: [...state.shapes.filter((x) => !family.has(x.id)), ...state.shapes.filter((x) => family.has(x.id))] })
  },

  /** アルバース「正方形へのオマージュ」：入れ子の 4 重の正方形 */
  addHomage(x: number, y: number, size = 89) {
    checkpoint()
    const root = newShape({ kind: 'square', x, y, size })
    const kids = homageRelations().map((rel) => newShape({ kind: 'square', x, y, size, parent: root.id, rel }))
    set({ shapes: [...state.shapes, root, ...kids], anchorId: root.id, selectedId: null })
    log('add')
  },

  /**
   * クレー「線を散歩に連れ出す」：引いた向きから線が自分で歩いて伸びていく。
   * 最初の線分を親にして、残りの線分を少しずつ足していく（伸びていく様子を見せる）。
   */
  addWalker(ax: number, ay: number, angleDeg: number, W: number, H: number) {
    checkpoint()
    const u = Math.min(W, H) / 400
    const seed = Math.floor(Math.random() * 2 ** 31)
    const segs = walkPath(ax, ay, angleDeg, u, seed)
    const rels = segmentsToRelations(segs)
    const first = segs[0]
    const root = newShape({ kind: 'line', x: first.x / W, y: first.y / H, size: first.length / u, rotation: first.rotation, seed })
    set({ shapes: [...state.shapes, root], anchorId: root.id, selectedId: null })
    log('add')
    rels.forEach((rel, i) => {
      setTimeout(() => {
        if (!state.shapes.some((s) => s.id === root.id)) return
        // 子の線分も自分の向きを持つ（線の温度で色が決まるため）
        const rotation = root.rotation + rel.rot
        const kid = newShape({ kind: 'line', x: root.x, y: root.y, size: root.size, rotation, parent: root.id, rel, seed: seed + i + 1 })
        set({ shapes: [...state.shapes, kid] })
      }, 110 * (i + 1))
    })
  },

  /**
   * アルバースの予備課程の「折り」：線 a→b で画面を紙のように折り、図形の多い側を反対側へ鏡像として写す。
   * 写した図形は元の図形の位置から動き出す（spawnFrom）ので、折り返される様子が見える。
   */
  fold(a: { x: number; y: number }, b: { x: number; y: number }, W: number, H: number): number {
    const roots = state.shapes.filter((s) => !s.parent)
    const side = (s: Shape) => sideOf(s.x * W, s.y * H, a.x, a.y, b.x, b.y)
    const left = roots.filter((s) => side(s) < 0)
    const right = roots.filter((s) => side(s) > 0)
    const source = left.length >= right.length ? left : right
    if (!source.length) return 0
    checkpoint()
    const lineDeg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
    const copies: Shape[] = []
    for (const s of source) {
      const family = cloneFamily(state.shapes, s.id, (root) => {
        const p = reflectPoint(root.x * W, root.y * H, a.x, a.y, b.x, b.y)
        return { ...root, x: p.x / W, y: p.y / H, rotation: reflectRotation(root.rotation, lineDeg) }
      })
      // 鏡に映すと、子の親に対する左右と回転の向きが反転する
      for (const c of family.slice(1)) if (c.rel) c.rel = { ...c.rel, dx: -c.rel.dx, rot: -c.rel.rot }
      spawnFrom.set(family[0].id, s.id)
      copies.push(...family)
    }
    set({ shapes: [...state.shapes, ...copies], anchorId: null, selectedId: null })
    log('add')
    return copies.length
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
