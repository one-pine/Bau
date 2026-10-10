/**
 * 操作の記録（端末内のみ・保存しない）
 *
 * 指揮者が「飽きのサイン」「夢中のサイン」を読み取るための材料（docs/roadmap.md §2-5 ルール D）。
 * 直近の操作だけをリングバッファに持つ。
 */
export type ActivityType =
  | 'add'
  | 'move'
  | 'edit'
  | 'remove'
  | 'undo'
  | 'redo'
  | 'clear'
  | 'mode' // カオス ⇄ 秩序
  | 'symmetry'
  | 'flow'
  | 'settings'
  | 'zoom'
  | 'resume' // アプリが背面から戻った

export interface Activity {
  t: number
  type: ActivityType
}

const CAPACITY = 500
const buf: Activity[] = []
const lastOf = new Map<ActivityType, number>()

/**
 * 操作を記録する。minGapMs を指定すると、同じ種類の操作はその間隔より細かく記録しない
 * （ドラッグやスライダーのように連続して起きる操作が、回数を水増ししないように）。
 */
export function recordActivity(type: ActivityType, t = Date.now(), minGapMs = 0) {
  const last = lastOf.get(type)
  if (minGapMs > 0 && last !== undefined && t - last < minGapMs) return
  lastOf.set(type, t)
  buf.push({ t, type })
  if (buf.length > CAPACITY) buf.splice(0, buf.length - CAPACITY)
}

/** 直近 windowMs ミリ秒の操作 */
export function recentActivity(windowMs: number, now = Date.now()): Activity[] {
  const from = now - windowMs
  let i = buf.length
  while (i > 0 && buf[i - 1].t >= from) i--
  return buf.slice(i)
}

/** 直近 windowMs あたりの操作回数（1 分あたり） */
export function activityRate(windowMs: number, now = Date.now()): number {
  return (recentActivity(windowMs, now).length / windowMs) * 60_000
}

/** 最後の操作からの経過ミリ秒（操作がなければ Infinity） */
export function idleMs(now = Date.now()): number {
  return buf.length ? now - buf[buf.length - 1].t : Infinity
}

/** 直近 n 回の操作のうち、最も多い種類が占める割合（同じことの繰り返し度） */
export function repetition(n = 12): number {
  const last = buf.slice(-n)
  if (last.length < 4) return 0
  const counts = new Map<ActivityType, number>()
  for (const a of last) counts.set(a.type, (counts.get(a.type) ?? 0) + 1)
  return Math.max(...counts.values()) / last.length
}

/** テスト用 */
export function clearActivity() {
  buf.length = 0
  lastOf.clear()
}
