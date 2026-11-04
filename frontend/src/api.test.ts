import { describe, expect, it } from 'vitest'
import { clock, duration, localDateTime } from './api'

describe('trip presentation', () => {
  it('rolls a rounded minute into the next hour', () => {
    expect(duration(3599)).toBe('1h 00m')
  })
  it('preserves minutes on multi-hour drives', () => {
    expect(duration(5 * 3600 + 13 * 60)).toBe('5h 13m')
  })
  it('formats a single instant in an explicit zone across a day boundary', () => {
    const epoch = Date.parse('2026-11-04T02:30:00Z') / 1000
    expect(clock(epoch, 'America/Bogota', true)).toContain('Nov 3')
  })
  it('produces a valid local datetime input', () => {
    expect(localDateTime(new Date('2026-11-04T12:30:00Z'))).toMatch(/^2026-11-04T\d{2}:30$/)
  })
})
