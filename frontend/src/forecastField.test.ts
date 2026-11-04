import { describe, expect, it } from 'vitest'
import { createForecastField, forecastColor } from './forecastField'
import type { CorridorCell } from './types'

const cell = (x: number, value: number | null) =>
  ({
    bounds: [x, 0, x + 1, 1],
    hours: [{ risk: value, wind_mph: value, rain_in_hr: value, snow_in_hr: value }],
  }) as CorridorCell
describe('geographic forecast coverage', () => {
  it('shows a low-risk forecast rather than hiding zero values', () => {
    const field = createForecastField([cell(0, 0)], 0, 'risk')!
    expect(field.pixels[3]).toBeGreaterThan(0)
    expect(forecastColor(0, 'risk')).toEqual([64, 166, 133, 150])
  })
  it('does not invent coverage in gaps between sampled cells', () => {
    const field = createForecastField([cell(0, 0), cell(2, 3)], 0, 'risk')!
    const center = (Math.floor(field.height / 2) * field.width + Math.floor(field.width / 2)) * 4
    expect(field.pixels[center + 3]).toBe(0)
  })
  it('keeps unknown owner cells gray despite adjacent complete data', () => {
    const field = createForecastField([cell(0, null), cell(1, 3)], 0, 'risk')!
    const index = (Math.floor(field.height / 2) * field.width + 5) * 4
    expect(Array.from(field.pixels.slice(index, index + 4))).toEqual([125, 134, 146, 120])
  })
  it('uses fixed units across time instead of normalizing each frame', () => {
    expect(forecastColor(55, 'wind')).toEqual(forecastColor(100, 'wind'))
    expect(forecastColor(0, 'wind')).not.toEqual(forecastColor(35, 'wind'))
  })
})
