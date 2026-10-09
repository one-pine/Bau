import type { ReactNode } from 'react'
import { KANDINSKY } from '../engine/bauhaus'
import type { ShapeKind } from '../engine/types'

export function IconButton({
  label,
  active,
  disabled,
  onClick,
  children,
  wide,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex h-12 shrink-0 items-center justify-center gap-1.5 text-[11px] font-medium tracking-[0.12em] uppercase transition-colors',
        wide ? 'px-3' : 'w-[min(48px,11vw)]',
        active ? 'bg-ink text-paper ring-1 ring-inset ring-paper/30' : 'bg-paper text-ink hover:bg-ink/5',
        disabled ? 'opacity-30' : '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function ShapeGlyph({ kind, size = 22, color }: { kind: ShapeKind; size?: number; color?: string }) {
  const c = color ?? KANDINSKY[kind]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {kind === 'circle' && <circle cx="12" cy="12" r="10" fill={c} />}
      {kind === 'square' && <rect x="3" y="3" width="18" height="18" fill={c} />}
      {kind === 'triangle' && <polygon points="12,2.5 22.5,21 1.5,21" fill={c} />}
      {kind === 'line' && <line x1="2" y1="22" x2="22" y2="2" stroke={c} strokeWidth="3" />}
    </svg>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onStart,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onStart?: () => void
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between text-[11px] tracking-[0.14em] uppercase">
        <span>{label}</span>
        <span className="tabular-nums opacity-60">{format ? format(value) : Math.round(value)}</span>
      </div>
      <input
        type="range"
        className="bau-range w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onStart}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="grid border border-ink" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={[
            'flex h-10 items-center justify-center text-xs tracking-wider',
            i > 0 ? 'border-l border-ink' : '',
            o.value === value ? 'bg-ink text-paper' : 'bg-paper text-ink',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex w-full items-center justify-between gap-4 py-2 text-left">
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-[11px] leading-snug opacity-55">{hint}</span>}
      </span>
      <span className={['relative h-6 w-11 shrink-0 border border-ink transition-colors', value ? 'bg-ink' : 'bg-paper'].join(' ')}>
        <span
          className={['absolute top-0.5 h-4 w-4 transition-all', value ? 'left-[22px] bg-paper' : 'left-0.5 bg-ink'].join(' ')}
        />
      </span>
    </button>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-[10px] font-semibold tracking-[0.2em] uppercase opacity-55">{children}</h3>
}
