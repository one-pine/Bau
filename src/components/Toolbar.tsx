import { AnimatePresence, motion } from 'framer-motion'
import { PenLine, Redo2, Shapes, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import type { ShapeKind } from '../engine/types'
import { actions, useStore } from '../state/store'
import { IconButton, SHAPE_LABELS, ShapeGlyph } from './ui'

/** 基本の 4 つ（カンディンスキーの三原形と線）はいつも見せ、イッテンの残り 3 形は「その他の形」から選ぶ */
const PRIMARY: ShapeKind[] = ['circle', 'triangle', 'square', 'line']
const SECONDARY: ShapeKind[] = ['trapezoid', 'spherical', 'ellipse']

export default function Toolbar() {
  const tool = useStore((s) => s.tool)
  const selectedId = useStore((s) => s.selectedId)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const empty = useStore((s) => s.shapes.length === 0)

  const [moreOpen, setMoreOpen] = useState(false)
  const secondaryActive = SECONDARY.includes(tool)

  return (
    <nav className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="pointer-events-auto flex divide-x divide-ink border border-ink bg-paper ring-1 ring-paper/50"
          >
            {SECONDARY.map((k) => (
              <IconButton
                key={k}
                label={SHAPE_LABELS[k]}
                active={tool === k}
                wide
                onClick={() => {
                  actions.setTool(k)
                  setMoreOpen(false)
                }}
              >
                <ShapeGlyph kind={k} size={20} />
                <span className="tracking-normal normal-case">{SHAPE_LABELS[k]}</span>
              </IconButton>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="pointer-events-auto flex divide-x divide-ink border border-ink bg-paper ring-1 ring-paper/50">
        {PRIMARY.map((k) => (
          <IconButton key={k} label={SHAPE_LABELS[k]} active={tool === k} onClick={() => actions.setTool(k)}>
            <span className={tool === k ? 'rounded-full bg-paper p-1' : 'p-1'}>
              <ShapeGlyph kind={k} size={20} />
            </span>
          </IconButton>
        ))}
        <IconButton label="その他の形" active={secondaryActive || moreOpen} onClick={() => setMoreOpen((v) => !v)}>
          {secondaryActive ? (
            <span className="rounded-full bg-paper p-1">
              <ShapeGlyph kind={tool} size={20} />
            </span>
          ) : (
            <Shapes size={18} />
          )}
        </IconButton>
        <IconButton label="加工" disabled={!selectedId} onClick={() => selectedId && actions.openEditor(selectedId)}>
          <PenLine size={18} />
        </IconButton>
        <IconButton label="元に戻す" disabled={!canUndo} onClick={actions.undo}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="やり直す" disabled={!canRedo} onClick={actions.redo}>
          <Redo2 size={18} />
        </IconButton>
        <IconButton label="すべて消去" disabled={empty} onClick={actions.clear}>
          <Trash2 size={18} />
        </IconButton>
      </div>
    </nav>
  )
}
