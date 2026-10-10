import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import CanvasStage from './components/CanvasStage'
import EditSheet from './components/EditSheet'
import SettingsSheet from './components/SettingsSheet'
import Toolbar from './components/Toolbar'
import TopBar from './components/TopBar'
import type { ShapeKind } from './engine/types'
import { actions, store, useStore } from './state/store'

const GRID_LABEL = { '8': '8×8', '12': '12×12', golden: 'φ' } as const
const CONTRAST_LABEL = {
  none: '',
  hue: 'HUE',
  lightDark: 'LIGHT–DARK',
  coldWarm: 'COLD–WARM',
  complementary: 'COMPLEMENT',
  simultaneous: 'SIMULTANEOUS',
  saturation: 'SATURATION',
  extension: 'EXTENSION',
} as const
const KEY_TOOLS: Record<string, ShapeKind> = {
  '1': 'circle',
  '2': 'triangle',
  '3': 'square',
  '4': 'line',
  '5': 'trapezoid',
  '6': 'spherical',
  '7': 'ellipse',
}

export default function App() {
  const empty = useStore((s) => s.shapes.length === 0)
  const editorOpen = useStore((s) => s.editorOpen && !!s.selectedId)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const settings = useStore((s) => s.settings)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const st = store.get()
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) actions.redo()
        else actions.undo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && st.selectedId) {
        actions.removeShape(st.selectedId)
      } else if (e.key === 'Escape') {
        if (st.editorOpen) actions.closeEditor()
        else if (st.settingsOpen) actions.toggleSettings()
        else actions.select(null)
      } else if (KEY_TOOLS[e.key]) {
        actions.setTool(KEY_TOOLS[e.key])
      } else if (e.key === 'o') {
        actions.toggleMode()
      } else if (e.key === 'k') {
        actions.setSettings({ symmetry: !st.settings.symmetry })
      } else if (e.key === 'f') {
        actions.setSettings({ flow: !st.settings.flow })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.background)
  }, [settings.background])

  const status = [
    settings.mode === 'order' ? `ORDER ${GRID_LABEL[settings.grid]}` : 'CHAOS',
    settings.mode === 'order' && settings.correspondence && 'KANDINSKY',
    settings.symmetry && `SYM ${settings.folds}${settings.mirror ? 'm' : ''}`,
    settings.flow && (settings.flowStyle === 'chess' ? 'FLOW CHESS' : 'FLOW'),
    settings.mode === 'order' && settings.contrastMode !== 'none' && `ITTEN ${CONTRAST_LABEL[settings.contrastMode]}`,
    settings.tone !== 'color' && (settings.tone === 'mono' ? 'MONO' : 'MONO+1'),
  ].filter(Boolean)

  return (
    <main className="relative h-dvh w-full overflow-hidden" style={{ background: settings.background }}>
      <CanvasStage />
      <TopBar />

      <div className="pointer-events-none absolute top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] left-3 z-10 flex flex-wrap gap-1">
        {status.map((s) => (
          <span key={String(s)} className="border border-ink bg-paper px-1.5 py-0.5 text-[9px] font-medium tracking-[0.18em]">
            {s}
          </span>
        ))}
      </div>

      <AnimatePresence>
        {empty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-8"
          >
            <div className="max-w-xs border border-ink bg-paper/90 p-5 text-center">
              <p className="mb-3 text-xs font-semibold tracking-[0.3em] uppercase">Form follows function</p>
              <ul className="space-y-1 text-[13px] leading-relaxed">
                <li>タップ — 図形を置く</li>
                <li>スワイプ — 大きさと向きを描く</li>
                <li>図形をドラッグ — 移動（グリッドへ吸着）</li>
                <li>長押し — 加工メニュー</li>
                <li>2本指 — 拡大・回転</li>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toolbar />

      <AnimatePresence>
        {editorOpen && <EditSheet key="edit" />}
        {settingsOpen && <SettingsSheet key="settings" />}
      </AnimatePresence>
    </main>
  )
}
