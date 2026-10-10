import { AnimatePresence, motion } from 'framer-motion'
import { PenLine, Redo2, Shapes, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ShapeKind, ToolKind } from '../engine/types'
import { actions, useStore } from '../state/store'
import { IconButton, SHAPE_LABELS, ShapeGlyph, TOOL_LABELS, ToolGlyph } from './ui'

/** 基本の 4 つ（カンディンスキーの三原形と線）はいつも見せ、イッテンの残り 3 形は「その他の形」から選ぶ */
const PRIMARY: ShapeKind[] = ['circle', 'triangle', 'square', 'line']
const SECONDARY: ShapeKind[] = ['trapezoid', 'spherical', 'ellipse']
/** 道具：アルバースの正方形へのオマージュと折り、クレーの散歩する線 */
const TOOLS = ['homage', 'fold', 'walker'] as const
const TOOL_HINT = {
  homage: 'タップで入れ子の正方形（余白 1 : 2 : 3）',
  fold: '線を引いて画面を折る。図形の多い側が反対側へ写る',
  walker: 'スワイプした向きへ、線が自分で歩いていく',
} as const

export default function Toolbar() {
  const tool = useStore((s) => s.tool)
  const selectedId = useStore((s) => s.selectedId)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const empty = useStore((s) => s.shapes.length === 0)

  const [moreOpen, setMoreOpen] = useState(false)
  const pick = (t: ToolKind) => {
    actions.setTool(t)
    setMoreOpen(false)
  }
  const secondaryActive = !(PRIMARY as string[]).includes(tool)
  const activeTool = (TOOLS as readonly string[]).includes(tool) ? (tool as (typeof TOOLS)[number]) : null

  return (
    <nav className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="pointer-events-auto grid grid-cols-3 border-t border-l border-ink bg-paper ring-1 ring-paper/50"
          >
            {SECONDARY.map((k) => (
              <MoreButton key={k} label={SHAPE_LABELS[k]} active={tool === k} onClick={() => pick(k)}>
                <ShapeGlyph kind={k} size={20} />
              </MoreButton>
            ))}
            {TOOLS.map((t) => (
              <MoreButton key={t} label={TOOL_LABELS[t]} active={tool === t} onClick={() => pick(t)}>
                <ToolGlyph tool={t} size={20} />
              </MoreButton>
            ))}
          </motion.div>
        )}
        {!moreOpen && activeTool && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border border-ink bg-paper px-2 py-1 text-[11px] ring-1 ring-paper/50"
          >
            {TOOL_HINT[activeTool]}
          </motion.p>
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
        <IconButton label="形と道具" active={secondaryActive || moreOpen} onClick={() => setMoreOpen((v) => !v)}>
          {secondaryActive ? (
            <span className="rounded-full bg-paper p-1">
              {activeTool ? <ToolGlyph tool={activeTool} size={20} /> : <ShapeGlyph kind={tool as ShapeKind} size={20} />}
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

function MoreButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={[
        'flex h-11 items-center gap-2 border-r border-b border-ink px-3 text-[12px]',
        active ? 'bg-ink text-paper' : 'bg-paper text-ink',
      ].join(' ')}
    >
      {children}
      <span>{label}</span>
    </button>
  )
}
