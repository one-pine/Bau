import { motion, useDragControls } from 'framer-motion'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

/** 下からせり上がるパネル。デスクトップ幅では右下に浮かぶカードになる。 */
export default function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  const controls = useDragControls()
  return (
    <motion.section
      initial={{ y: '105%' }}
      animate={{ y: 0 }}
      exit={{ y: '105%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 80 || info.velocity.y > 500) onClose()
      }}
      className="absolute inset-x-0 bottom-0 z-30 max-h-[55vh] sm:max-h-[72vh] overflow-hidden border-t border-ink bg-paper text-ink sm:inset-x-auto sm:right-3 sm:bottom-20 sm:w-[380px] sm:border"
    >
      <div className="touch-none" onPointerDown={(e) => controls.start(e)}>
        <div className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-10 bg-ink/25" />
        </div>
        <div className="flex items-center justify-between border-b border-ink px-4 py-2">
          <h2 className="text-xs font-semibold tracking-[0.25em] uppercase">{title}</h2>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            className="-mr-2 flex h-10 w-10 items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="max-h-[calc(55vh-64px)] sm:max-h-[calc(72vh-64px)] overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </motion.section>
  )
}
