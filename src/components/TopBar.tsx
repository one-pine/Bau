import { AnimatePresence, motion } from 'framer-motion'
import { Download, FileCode2, Grid3x3, ImageDown, Shuffle, SlidersHorizontal, Snowflake, Wind } from 'lucide-react'
import { useState } from 'react'
import { exportPng, exportSvg } from '../engine/export'
import { actions, store, useStore } from '../state/store'
import { stageRuntime } from './CanvasStage'
import { IconButton } from './ui'

export default function TopBar() {
  const settings = useStore((s) => s.settings)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const [exportOpen, setExportOpen] = useState(false)
  const order = settings.mode === 'order'

  const doExport = (kind: 'png' | 'svg') => {
    setExportOpen(false)
    const { ops, W, H } = stageRuntime
    const s = store.get().settings
    if (kind === 'png') void exportPng(ops, s, W, H)
    else exportSvg(ops, s, W, H)
  }

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="pointer-events-auto flex h-12 items-center gap-2 border border-ink bg-paper px-3 ring-1 ring-paper/50">
        <Logo />
        <span className="text-sm font-semibold tracking-[0.3em]">BAU</span>
      </div>

      <div className="pointer-events-auto relative flex divide-x divide-ink border border-ink bg-paper ring-1 ring-paper/50">
        <IconButton label={order ? '秩序（理論適用）→ カオスへ' : 'カオス → 秩序へ'} onClick={actions.toggleMode} wide active={!order}>
          {order ? <Grid3x3 size={18} /> : <Shuffle size={18} />}
          <span className="hidden sm:inline">{order ? 'Order' : 'Chaos'}</span>
        </IconButton>
        <IconButton label="万華鏡（シンメトリー）" active={settings.symmetry} onClick={() => actions.setSettings({ symmetry: !settings.symmetry })}>
          <Snowflake size={18} />
        </IconButton>
        <IconButton label="Auto Flow" active={settings.flow} onClick={() => actions.setSettings({ flow: !settings.flow })}>
          <Wind size={18} />
        </IconButton>
        <IconButton label="書き出し" active={exportOpen} onClick={() => setExportOpen((v) => !v)}>
          <Download size={18} />
        </IconButton>
        <IconButton label="設定" active={settingsOpen} onClick={actions.toggleSettings}>
          <SlidersHorizontal size={18} />
        </IconButton>

        <AnimatePresence>
          {exportOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute top-[calc(100%+6px)] right-[-1px] w-56 divide-y divide-ink border border-ink bg-paper text-sm"
            >
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3 hover:bg-ink/5" onClick={() => doExport('png')}>
                <ImageDown size={18} /> PNG（高解像度 ×4）
              </button>
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3 hover:bg-ink/5" onClick={() => doExport('svg')}>
                <FileCode2 size={18} /> SVG（ベクター）
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}

function Logo() {
  return (
    <svg width="34" height="14" viewBox="0 0 34 14" aria-hidden>
      <polygon points="5,0 10,14 0,14" fill="#f2c230" />
      <rect x="12" y="2" width="10" height="10" fill="#d7261e" />
      <circle cx="29" cy="7" r="5" fill="#1e4fa0" />
    </svg>
  )
}
