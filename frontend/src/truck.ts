import type { Truck } from './types'

export type TruckInputs = Record<Exclude<keyof Truck, 'non_hazardous'>, string> & {
  non_hazardous: boolean
}
export const EMPTY_TRUCK: TruckInputs = {
  empty_weight_lb: '',
  height_ft: '',
  width_ft: '',
  length_ft: '',
  max_axle_weight_lb: '',
  axles: '',
  non_hazardous: false,
}
export const TRUCK_FIELDS = [
  { key: 'height_ft', label: 'Height', unit: 'ft', min: 1, max: 30, step: '0.01' },
  { key: 'width_ft', label: 'Width', unit: 'ft', min: 1, max: 20, step: '0.01' },
  { key: 'length_ft', label: 'Total length', unit: 'ft', min: 1, max: 200, step: '0.01' },
  {
    key: 'empty_weight_lb',
    label: 'Empty truck + trailer',
    unit: 'lb',
    min: 1,
    max: 200000,
    step: '1',
  },
  { key: 'axles', label: 'Axle count', unit: '', min: 2, max: 20, step: '1' },
  {
    key: 'max_axle_weight_lb',
    label: 'Max loaded axle weight',
    unit: 'lb',
    min: 1,
    max: 100000,
    step: '1',
  },
] as const

export function parseTruck(input: TruckInputs, cargo: number): Truck | null {
  if (!input.non_hazardous || !Number.isFinite(cargo) || cargo < 0) return null
  for (const field of TRUCK_FIELDS) {
    const value = Number(input[field.key])
    if (
      !input[field.key].trim() ||
      !Number.isFinite(value) ||
      value < field.min ||
      value > field.max
    )
      return null
  }
  const truck: Truck = {
    empty_weight_lb: Number(input.empty_weight_lb),
    height_ft: Number(input.height_ft),
    width_ft: Number(input.width_ft),
    length_ft: Number(input.length_ft),
    max_axle_weight_lb: Number(input.max_axle_weight_lb),
    axles: Number(input.axles),
    non_hazardous: true,
  }
  const gross = truck.empty_weight_lb + cargo
  if (
    !Number.isInteger(truck.axles) ||
    truck.max_axle_weight_lb > gross ||
    truck.max_axle_weight_lb * truck.axles < gross
  )
    return null
  return truck
}
