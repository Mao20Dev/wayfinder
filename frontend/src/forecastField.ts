import type { CorridorCell, Layer } from './types'

export const FORECAST_SCALES = {
  risk: {
    ticks: [0, 1, 2, 3, 4],
    labels: ['Low', 'Moderate', 'High', 'Severe', 'No Travel'],
    unit: '',
  },
  wind: { ticks: [0, 25, 35, 45, 55], labels: ['0', '25', '35', '45', '55+'], unit: 'mph' },
  rain: { ticks: [0, 0.1, 0.25, 0.5, 1], labels: ['0', '.10', '.25', '.50', '1+'], unit: 'in/h' },
  snow: { ticks: [0, 0.5, 1, 2, 3], labels: ['0', '.5', '1', '2', '3+'], unit: 'in/h' },
}
const COLORS = [
  [64, 166, 133],
  [212, 185, 68],
  [231, 139, 65],
  [211, 82, 79],
  [146, 47, 84],
]
export const forecastValue = (cell: CorridorCell, hour: number, layer: Layer) => {
  const sample = cell.hours[hour]
  if (!sample) return null
  return layer === 'risk'
    ? sample.risk
    : layer === 'wind'
      ? sample.wind_mph
      : layer === 'rain'
        ? sample.rain_in_hr
        : sample.snow_in_hr
}

export function forecastColor(
  value: number | null,
  layer: Layer,
): [number, number, number, number] {
  if (value === null || !Number.isFinite(value)) return [125, 134, 146, 120]
  const ticks = FORECAST_SCALES[layer].ticks
  const index = Math.max(0, Math.min(3, ticks.findIndex((tick, i) => i > 0 && value < tick) - 1))
  const lower = value >= ticks[4] ? 4 : index
  const upper = Math.min(4, lower + 1)
  const fraction =
    upper === lower
      ? 0
      : Math.max(0, Math.min(1, (value - ticks[lower]) / (ticks[upper] - ticks[lower])))
  return [0, 1, 2]
    .map((channel) =>
      Math.round(
        COLORS[lower][channel] + (COLORS[upper][channel] - COLORS[lower][channel]) * fraction,
      ),
    )
    .concat(150) as [number, number, number, number]
}

// Smooth a regular forecast grid in geographic space, not point density. A
// zero-risk sample remains visible. An absent or unknown cell is never filled
// with a nearby forecast: smoothing is confined to cells with observed data.
export function createForecastField(cells: CorridorCell[], hour: number, layer: Layer) {
  if (!cells.length) return null
  const west = Math.min(...cells.map((cell) => cell.bounds[0]))
  const south = Math.min(...cells.map((cell) => cell.bounds[1]))
  const east = Math.max(...cells.map((cell) => cell.bounds[2]))
  const north = Math.max(...cells.map((cell) => cell.bounds[3]))
  const dx = cells[0].bounds[2] - cells[0].bounds[0]
  const dy = cells[0].bounds[3] - cells[0].bounds[1]
  const nx = Math.round((east - west) / dx)
  const ny = Math.round((north - south) / dy)
  const grid = new Map(
    cells.map((cell) => [
      `${Math.round((cell.bounds[0] - west) / dx)},${Math.round((cell.bounds[1] - south) / dy)}`,
      cell,
    ]),
  )
  const width = Math.min(768, Math.max(96, nx * 16))
  const height = Math.min(768, Math.max(96, ny * 16))
  const pixels = new Uint8ClampedArray(width * height * 4)
  const mercator = (latitude: number) =>
    Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360))
  const top = mercator(north),
    bottom = mercator(south)
  for (let y = 0; y < height; y++) {
    const latitude =
      ((2 * Math.atan(Math.exp(top + ((bottom - top) * (y + 0.5)) / height)) - Math.PI / 2) * 180) /
      Math.PI
    const gy = (latitude - south) / dy
    for (let x = 0; x < width; x++) {
      const gx = ((x + 0.5) / width) * nx
      const owner = grid.get(`${Math.floor(gx)},${Math.min(ny - 1, Math.floor(gy))}`)
      if (!owner) continue
      const ownValue = forecastValue(owner, hour, layer)
      let value = ownValue
      if (ownValue !== null) {
        const x0 = Math.floor(gx - 0.5),
          y0 = Math.floor(gy - 0.5)
        const fx = gx - 0.5 - x0,
          fy = gy - 0.5 - y0
        let sum = 0,
          weights = 0
        for (let iy = 0; iy <= 1; iy++)
          for (let ix = 0; ix <= 1; ix++) {
            const neighbor = grid.get(`${x0 + ix},${y0 + iy}`)
            const sample = neighbor ? forecastValue(neighbor, hour, layer) : null
            if (sample === null) continue
            const weight = (ix ? fx : 1 - fx) * (iy ? fy : 1 - fy)
            sum += sample * weight
            weights += weight
          }
        if (weights > 0) value = sum / weights
      }
      const color = forecastColor(value, layer)
      if (ownValue !== null) {
        // Fade only inside the known domain, rounding the edge of the grid
        // without painting forecasts over unsampled territory.
        const column = Math.floor(gx),
          row = Math.floor(gy)
        let edgeDistance = 1
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) {
            if (grid.has(`${column + ox},${row + oy}`)) continue
            const horizontal = Math.max(column + ox - gx, 0, gx - column - ox - 1)
            const vertical = Math.max(row + oy - gy, 0, gy - row - oy - 1)
            edgeDistance = Math.min(edgeDistance, Math.hypot(horizontal, vertical))
          }
        const fade = Math.min(1, edgeDistance / 0.45)
        color[3] = Math.max(1, Math.round(color[3] * fade))
      }
      pixels.set(color, (y * width + x) * 4)
    }
  }
  return {
    width,
    height,
    pixels,
    coordinates: [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ] as [[number, number], [number, number], [number, number], [number, number]],
  }
}

export function forecastImage(cells: CorridorCell[], hour: number, layer: Layer) {
  const field = createForecastField(cells, hour, layer)
  if (!field) return null
  const canvas = document.createElement('canvas')
  canvas.width = field.width
  canvas.height = field.height
  const context = canvas.getContext('2d')
  if (!context) return null
  const bitmap = context.createImageData(field.width, field.height)
  bitmap.data.set(field.pixels)
  context.putImageData(bitmap, 0, 0)
  return { url: canvas.toDataURL(), coordinates: field.coordinates }
}
