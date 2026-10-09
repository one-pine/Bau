import { ArrowUpToLine, Copy, Lock, Trash2, Unlock } from 'lucide-react'
import { PALETTE, resolveColor, snapFib } from '../engine/bauhaus'
import type { ShapeKind } from '../engine/types'
import { actions, checkpoint, useStore } from '../state/store'
import Sheet from './Sheet'
import { SectionTitle, ShapeGlyph, Slider } from './ui'

const KINDS: ShapeKind[] = ['circle', 'triangle', 'square', 'line']

export default function EditSheet() {
  const id = useStore((s) => s.selectedId)
  const shape = useStore((s) => s.shapes.find((x) => x.id === s.selectedId))
  const settings = useStore((s) => s.settings)
  if (!shape || !id) return null

  const shown = resolveColor(shape, settings)
  const update = (patch: Parameters<typeof actions.updateShape>[1]) => actions.updateShape(id, patch)
  const fibHint = settings.mode === 'order' ? ` → φ ${snapFib(shape.size)}` : ''

  return (
    <Sheet title="加工 / Edit" onClose={actions.closeEditor}>
      <div className="space-y-5">
        <div>
          <SectionTitle>形態 Form</SectionTitle>
          <div className="grid grid-cols-4 border border-ink">
            {KINDS.map((k, i) => (
              <button
                key={k}
                type="button"
                aria-label={k}
                onClick={() => {
                  checkpoint()
                  update({ kind: k })
                }}
                className={[
                  'flex h-12 items-center justify-center',
                  i > 0 ? 'border-l border-ink' : '',
                  shape.kind === k ? 'bg-ink' : '',
                ].join(' ')}
              >
                <ShapeGlyph kind={k} color={shape.kind === k ? '#f2eee3' : undefined} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle>色彩 Colour</SectionTitle>
            {settings.correspondence && (
              <button
                type="button"
                className="flex items-center gap-1 text-[11px] tracking-wide opacity-70"
                onClick={() => {
                  checkpoint()
                  update({ colorLocked: !shape.colorLocked })
                }}
              >
                {shape.colorLocked ? <Lock size={12} /> : <Unlock size={12} />}
                {shape.colorLocked ? '固定色' : 'カンディンスキー対応'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => {
                  checkpoint()
                  update({ color: c, colorLocked: true })
                }}
                className={['aspect-square border', shown === c ? 'border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'border-ink/30'].join(' ')}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <Slider label={`サイズ Size${fibHint}`} value={shape.size} min={5} max={260} onStart={checkpoint} onChange={(v) => update({ size: v })} />
        <Slider
          label="回転 Rotation"
          value={((shape.rotation % 360) + 360) % 360}
          min={0}
          max={359}
          format={(v) => `${Math.round(v)}°`}
          onStart={checkpoint}
          onChange={(v) => update({ rotation: v })}
        />
        <Slider
          label="透過 Opacity"
          value={shape.alpha}
          min={0.1}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onStart={checkpoint}
          onChange={(v) => update({ alpha: v })}
        />
        <Slider
          label="対比 Contrast（イッテン）"
          value={shape.contrast}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onStart={checkpoint}
          onChange={(v) => update({ contrast: v })}
        />

        <div className="grid grid-cols-3 divide-x divide-ink border border-ink text-xs">
          <button type="button" className="flex h-11 items-center justify-center gap-2" onClick={() => actions.duplicate(id)}>
            <Copy size={15} /> 複製
          </button>
          <button type="button" className="flex h-11 items-center justify-center gap-2" onClick={() => actions.bringToFront(id)}>
            <ArrowUpToLine size={15} /> 最前面
          </button>
          <button type="button" className="flex h-11 items-center justify-center gap-2 text-[#d7261e]" onClick={() => actions.removeShape(id)}>
            <Trash2 size={15} /> 削除
          </button>
        </div>
      </div>
    </Sheet>
  )
}
