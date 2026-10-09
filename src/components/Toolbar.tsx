import { PenLine, Redo2, Trash2, Undo2 } from 'lucide-react'
import type { ShapeKind } from '../engine/types'
import { actions, useStore } from '../state/store'
import { IconButton, ShapeGlyph } from './ui'

const TOOLS: { kind: ShapeKind; label: string }[] = [
  { kind: 'circle', label: '円' },
  { kind: 'triangle', label: '三角' },
  { kind: 'square', label: '四角' },
  { kind: 'line', label: '直線' },
]

export default function Toolbar() {
  const tool = useStore((s) => s.tool)
  const selectedId = useStore((s) => s.selectedId)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const empty = useStore((s) => s.shapes.length === 0)

  return (
    <nav className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex divide-x divide-ink border border-ink bg-paper ring-1 ring-paper/50">
        {TOOLS.map((t) => (
          <IconButton key={t.kind} label={t.label} active={tool === t.kind} onClick={() => actions.setTool(t.kind)}>
            <span className={tool === t.kind ? 'rounded-full bg-paper p-1' : 'p-1'}>
              <ShapeGlyph kind={t.kind} size={20} />
            </span>
          </IconButton>
        ))}
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
