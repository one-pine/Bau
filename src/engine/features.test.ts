import { beforeEach, describe, expect, it } from 'vitest'
import { activityRate, clearActivity, idleMs, recentActivity, recordActivity, repetition } from '../state/activity'
import { computeFeatures } from './features'
import type { RGB, ShapeKind, Visual } from './types'

const v = (x: number, y: number, size: number, color: RGB = [30, 79, 160]): Visual => ({ x, y, size, rotation: 0, color, alpha: 1, apex: 60 })
const item = (kind: ShapeKind, x: number, y: number, size = 40, color?: RGB) => ({ kind, v: v(x, y, size, color) })

describe('computeFeatures', () => {
  it('counts kinds and shares', () => {
    const f = computeFeatures([item('circle', 100, 100), item('circle', 300, 100), item('line', 200, 300)], 400, 400)
    expect(f.count).toBe(3)
    expect(f.byKind.circle).toBe(2)
    expect(f.shares.line).toBeCloseTo(1 / 3)
  })

  it('diversity is 0 for one kind and 1 for all kinds equally', () => {
    expect(computeFeatures([item('square', 0, 0), item('square', 50, 50)], 400, 400).diversity).toBe(0)
    const all = (['circle', 'triangle', 'square', 'line', 'trapezoid', 'spherical', 'ellipse'] as const).map((k, i) => item(k, i * 50, 100))
    expect(computeFeatures(all, 400, 400).diversity).toBeCloseTo(1)
  })

  it('triad is 1 when circle, triangle and square are equal', () => {
    const f = computeFeatures([item('circle', 50, 50), item('triangle', 150, 50), item('square', 250, 50)], 400, 400)
    expect(f.triad).toBe(1)
    expect(computeFeatures([item('circle', 50, 50), item('circle', 150, 50), item('square', 250, 50)], 400, 400).triad).toBeLessThan(1)
  })

  it('measures overlap, density, colours and centre offset', () => {
    const f = computeFeatures(
      [item('circle', 100, 100, 80, [255, 0, 0]), item('circle', 110, 100, 80, [0, 0, 255])],
      400,
      400,
    )
    expect(f.overlap).toBe(1)
    expect(f.density).toBeGreaterThan(0)
    expect(f.colors).toBe(2)
    expect(f.centerOffset).toBeGreaterThan(0.2)
  })

  it('tension is positive when the heavy shape is low', () => {
    const f = computeFeatures([item('circle', 200, 350, 120), item('circle', 200, 50, 20)], 400, 400)
    expect(f.tension).toBeGreaterThan(0)
  })

  it('handles an empty canvas', () => {
    const f = computeFeatures([], 400, 400)
    expect(f.count).toBe(0)
    expect(f.diversity).toBe(0)
  })
})

describe('activity log', () => {
  beforeEach(clearActivity)

  it('tracks rate, idle time and repetition', () => {
    const t0 = 1_000_000
    for (let i = 0; i < 10; i++) recordActivity('add', t0 + i * 1000)
    expect(recentActivity(5000, t0 + 9000)).toHaveLength(6)
    expect(activityRate(60_000, t0 + 9000)).toBe(10)
    expect(idleMs(t0 + 20_000)).toBe(11_000)
    expect(repetition()).toBe(1)
    recordActivity('undo', t0 + 10_000)
    recordActivity('mode', t0 + 11_000)
    expect(repetition()).toBeLessThan(1)
  })
})
