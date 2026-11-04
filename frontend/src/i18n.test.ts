import { describe, expect, it } from 'vitest'
import { copy, dominantWeather, pointExplanation, recommendationText, weatherNumber } from './i18n'
import type { Analysis, Checkpoint } from './types'

describe('clear trip explanations', () => {
  it('does not round a below-threshold wind up into the next visible band', () => {
    expect(weatherNumber(34.96, 'wind', 'en')).toBe('34.96')
    expect(weatherNumber(55, 'wind', 'en')).toBe('55.0')
  })
  it('keeps a just-above No Travel rain rate visibly above its strict limit', () => {
    expect(weatherNumber(1.001, 'rain', 'en')).toBe('1.001')
    expect(weatherNumber(0.099, 'rain', 'es')).toBe('0,099')
  })
  it('keeps missing weather visibly unknown', () => {
    expect(weatherNumber(null, 'snow', 'es')).toBe('—')
  })
  it('shows dangerous wind ahead of a trace of snow on the road label', () => {
    const point = {
      risk: 4,
      drivers: ['wind'],
      weather: { wind_mph: 56, rain_in_hr: 0, snow_in_hr: 0.01 },
    } as Checkpoint
    expect(dominantWeather(point)).toEqual({ kind: 'wind', value: 56, unit: 'mph' })
  })
  it('keeps both presentation languages complete', () => {
    expect(Object.keys(copy.es).sort()).toEqual(Object.keys(copy.en).sort())
  })
  it('explains the deciding risk difference against the actual runner-up', () => {
    const data = {
      routes: [{ id: 'route-1' }, { id: 'route-2' }],
      recommendation: {
        route_id: 'route-1',
        decision: { criterion: 'severe_miles', comparison_route_id: 'route-2', advantage: 25 },
      },
    } as Analysis
    expect(recommendationText(data, 'es')).toContain('25,0 millas menos de riesgo severo')
    expect(recommendationText(data, 'en')).toContain('Route 2')
  })
  it('does not claim a cargo override won when rain was the blocking factor', () => {
    const cp = {
      cargo_rule: 'wind_35_load_40000',
      risk: 4,
      drivers: ['rain'],
      weather: { wind_mph: 36, rain_in_hr: 1.2, snow_in_hr: 0 },
    } as Checkpoint
    expect(pointExplanation(cp, 45000, 'es')).toContain('lluvia')
    expect(pointExplanation(cp, 45000, 'es')).not.toContain('eleva el riesgo de alto')
  })
  it('explains unknown weather instead of labeling it safe', () => {
    expect(pointExplanation({ risk: null, cargo_rule: null } as Checkpoint, 0, 'es')).toContain(
      'Faltan datos',
    )
  })
})
