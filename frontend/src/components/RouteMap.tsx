import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, ImageSource, Map as MapInstance } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { FeatureCollection } from 'geojson'
import { Box, Compass, Layers2, Maximize2, Minus, Plus } from 'lucide-react'
import { Tooltip } from '@mui/material'
import type { Analysis, Checkpoint, Layer, Location, MapView } from '../types'
import type { MapPadding } from '../useMapLayout'
import { RISK_COLORS } from '../types'
import { forecastImage } from '../forecastField'
import {
  weatherNumber,
  copy,
  dominantWeather,
  fmt,
  riskNames,
  timeAt,
  type Language,
} from '../i18n'
import 'maplibre-gl/dist/maplibre-gl.css'
maplibregl.setWorkerUrl(workerUrl)
const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
const featureCollection = (features: FeatureCollection['features']): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
})
export default function RouteMap({
  data,
  origin,
  destination,
  loading,
  padding,
  selected,
  hour,
  layer,
  heatVisible,
  view,
  lang,
  focusedPoint,
  onSelect,
  onCheckpoint,
}: {
  data: Analysis | null
  origin: Location | null
  destination: Location | null
  loading: boolean
  padding: MapPadding
  selected: string
  hour: number
  layer: Layer
  heatVisible: boolean
  view: MapView
  lang: Language
  focusedPoint: Checkpoint | null
  onSelect: (id: string) => void
  onCheckpoint: (cp: Checkpoint) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapInstance | null>(null)
  const callbacks = useRef({ onSelect, onCheckpoint, data })
  callbacks.current = { onSelect, onCheckpoint, data }
  const [ready, setReady] = useState(false)
  const [mapError, setMapError] = useState('')
  const [threeD, setThreeD] = useState(false)
  const [compact, setCompact] = useState(false)
  const [cellInfo, setCellInfo] = useState<{
    coordinates: [number, number]
    text: string
  } | null>(null)
  const popup = useRef<maplibregl.Popup | null>(null)
  const pins = useRef<maplibregl.Marker[]>([])
  const previewPins = useRef<maplibregl.Marker[]>([])
  const t = copy[lang]
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    if (!container.current) return
    let instance: MapInstance
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/positron',
        center: [-85.4, 42.05],
        zoom: 6.3,
        attributionControl: { compact: true },
        maxPitch: 60,
        canvasContextAttributes: { antialias: true },
      })
    } catch {
      setMapError(
        'The map needs WebGL. Enable hardware acceleration in your browser; route details remain available below.',
      )
      return
    }
    map.current = instance
    instance.on('movestart', () => container.current?.setAttribute('aria-busy', 'true'))
    instance.on('moveend', () => container.current?.setAttribute('aria-busy', 'false'))
    instance.on('load', () => {
      if (instance.getLayer('building'))
        instance.setLayoutProperty('building', 'visibility', 'none')
      instance.addSource('routes', { type: 'geojson', data: empty })
      instance.addSource('risk-segments', { type: 'geojson', data: empty })
      instance.addSource('route-labels', { type: 'geojson', data: empty })
      instance.addSource('checkpoints', { type: 'geojson', data: empty })
      instance.addSource('cells', { type: 'geojson', data: empty })
      instance.addSource('endpoints', { type: 'geojson', data: empty })
      instance.addLayer({
        id: 'corridor-cells',
        type: 'fill',
        source: 'cells',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.005,
        },
      })
      instance.addLayer({
        id: 'routes-shadow',
        type: 'line',
        source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': ['case', ['==', ['get', 'selected'], true], 9, 6],
          'line-opacity': 0.95,
        },
      })
      instance.addLayer({
        id: 'routes-main',
        type: 'line',
        source: 'routes',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          'line-sort-key': ['case', ['==', ['get', 'selected'], true], 1, 0],
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['==', ['get', 'selected'], true], 5, 3],
          'line-opacity': ['case', ['==', ['get', 'selected'], true], 1, 0.65],
        },
      })
      instance.addLayer({
        id: 'checkpoint-halos',
        type: 'circle',
        source: 'checkpoints',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'selected'], true], 7, 4],
          'circle-color': 'white',
          'circle-opacity': 0.85,
        },
      })
      instance.addLayer(
        {
          id: 'risk-road',
          type: 'line',
          source: 'risk-segments',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': 1 },
        },
        'checkpoint-halos',
      )
      instance.addLayer({
        id: 'checkpoint-points',
        type: 'circle',
        source: 'checkpoints',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'selected'], true], 4.5, 2.5],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 0.8,
          'circle-stroke-color': '#ffffff',
        },
      })
      instance.addLayer({
        id: 'route-labels',
        type: 'symbol',
        source: 'route-labels',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 12,
          'text-font': ['Noto Sans Regular'],
          'text-padding': 7,
          'text-offset': [0, 1.6],
        },
        paint: { 'text-color': '#334d44', 'text-halo-color': '#fff', 'text-halo-width': 3 },
      })
      instance.addLayer({
        id: 'endpoints-base',
        type: 'circle',
        source: 'endpoints',
        paint: {
          'circle-radius': 12,
          'circle-color': '#244e43',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 3,
        },
      })
      instance.addLayer({
        id: 'endpoints-label',
        type: 'symbol',
        source: 'endpoints',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-font': ['Noto Sans Regular'],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#ffffff' },
      })
      instance.on('click', 'routes-main', (event) => {
        const id = event.features?.[0]?.properties?.id
        if (id) callbacks.current.onSelect(id)
      })
      instance.on('click', 'risk-road', (event) => {
        const feature = event.features?.[0]
        const route = callbacks.current.data?.routes.find(
          (route) => route.id === feature?.properties?.route_id,
        )
        if (!route) return
        const index = route.segments.findIndex((segment) => segment.id === feature?.properties?.id)
        callbacks.current.onSelect(route.id)
        callbacks.current.onCheckpoint(
          route.checkpoints[Math.min(index + 1, route.checkpoints.length - 1)],
        )
      })
      instance.on('click', 'checkpoint-points', (event) => {
        const id = event.features?.[0]?.properties?.id
        const cp = callbacks.current.data?.routes
          .flatMap((route) => route.checkpoints)
          .find((point) => point.id === id)
        if (cp) onCheckpointRef(cp)
      })
      const onCheckpointRef = (cp: Checkpoint) => {
        const route = callbacks.current.data?.routes.find((r) =>
          r.checkpoints.some((c) => c.id === cp.id),
        )
        if (route) callbacks.current.onSelect(route.id)
        callbacks.current.onCheckpoint(cp)
      }
      for (const id of ['routes-main', 'risk-road', 'checkpoint-points']) {
        instance.on('mouseenter', id, () => {
          instance.getCanvas().style.cursor = 'pointer'
        })
        instance.on('mouseleave', id, () => {
          instance.getCanvas().style.cursor = ''
        })
      }
      instance.on('click', 'corridor-cells', (event) => {
        if (
          instance.queryRenderedFeatures(event.point, {
            layers: ['checkpoint-points', 'routes-main', 'risk-road'],
          }).length
        )
          return
        const cell = event.features?.[0]
        if (cell)
          setCellInfo({
            coordinates: [event.lngLat.lng, event.lngLat.lat],
            text: String(cell.properties?.description ?? ''),
          })
      })
      setReady(true)
    })
    const resize = new ResizeObserver(() => {
      instance.resize()
      const width = container.current?.clientWidth ?? 0
      setCompact(width <= 980)
    })
    resize.observe(container.current)
    return () => {
      resize.disconnect()
      popup.current?.remove()
      pins.current.forEach((pin) => pin.remove())
      previewPins.current.forEach((pin) => pin.remove())
      instance.remove()
      map.current = null
      setReady(false)
    }
  }, [])
  useEffect(() => {
    if (!ready || !map.current) return
    const instance = map.current
    if (!data) {
      for (const source of ['routes', 'risk-segments', 'route-labels', 'checkpoints', 'cells'])
        (instance.getSource(source) as GeoJSONSource).setData(empty)
      popup.current?.remove()
      if (instance.getLayer('forecast-field'))
        instance.setLayoutProperty('forecast-field', 'visibility', 'none')
      return
    }
    const features: FeatureCollection['features'] = data.routes.map((route) => ({
      type: 'Feature',
      properties: {
        id: route.id,
        selected: route.id === selected,
        color: route.id === selected ? '#537a77' : '#a5adb7',
      },
      geometry: { type: 'LineString', coordinates: route.coordinates },
    }))
    ;(instance.getSource('routes') as GeoJSONSource).setData(featureCollection(features))
    const current = data.routes.find((route) => route.id === selected)
    ;(instance.getSource('risk-segments') as GeoJSONSource).setData(
      featureCollection(
        (current?.segments ?? []).map((segment) => ({
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: segment.coordinates },
          properties: {
            id: segment.id,
            route_id: segment.route_id,
            color: segment.risk === null ? '#798791' : RISK_COLORS[segment.risk],
          },
        })),
      ),
    )
    instance.setLayoutProperty('risk-road', 'visibility', view === 'arrival' ? 'visible' : 'none')
    ;(instance.getSource('route-labels') as GeoJSONSource).setData(
      featureCollection(
        data.routes.map((route, index) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: route.coordinates[Math.floor(route.coordinates.length * 0.58)],
          },
          properties: {
            label: `${copy[lang].route} ${index + 1}${data.recommendation.tied_route_ids.includes(route.id) || route.id === data.recommendation.route_id ? (data.recommendation.tied_route_ids.length > 1 ? ' · Joint best' : ' · Best') : ''}${route.id === selected ? ' · Selected' : ''}`,
          },
        })),
      ),
    )
    ;(instance.getSource('checkpoints') as GeoJSONSource).setData(
      featureCollection(
        data.routes.flatMap((route) =>
          route.checkpoints.map((cp) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: cp.coordinates },
            properties: {
              id: cp.id,
              selected: route.id === selected,
              color:
                view === 'forecast'
                  ? '#91a09b'
                  : cp.risk === null
                    ? '#7c8792'
                    : RISK_COLORS[cp.risk],
            },
          })),
        ),
      ),
    )
  }, [data, selected, ready, view, lang])

  useEffect(() => {
    if (!ready || !map.current) return
    const locations = [origin, destination]
    ;(map.current.getSource('endpoints') as GeoJSONSource).setData(
      featureCollection(
        data
          ? locations.flatMap((location, index) =>
              location
                ? [
                    {
                      type: 'Feature' as const,
                      properties: { label: index === 0 ? 'A' : 'B' },
                      geometry: {
                        type: 'Point' as const,
                        coordinates: [location.longitude, location.latitude],
                      },
                    },
                  ]
                : [],
            )
          : [],
      ),
    )
    previewPins.current.forEach((pin) => pin.remove())
    previewPins.current = []
    if (!data)
      locations.forEach((location, index) => {
        if (!location) return
        const marker = document.createElement('div')
        marker.className = `endpoint-preview ${loading ? 'searching' : ''}`
        marker.dataset.location = location.name
        for (let ring = 0; ring < 2; ring++) {
          const pulse = document.createElement('i')
          pulse.className = 'endpoint-ring'
          marker.append(pulse)
        }
        const dot = document.createElement('strong')
        dot.textContent = index === 0 ? 'A' : 'B'
        const name = document.createElement('span')
        name.className = 'endpoint-name'
        name.textContent = location.name.split(',')[0]
        marker.append(dot, name)
        previewPins.current.push(
          new maplibregl.Marker({ element: marker })
            .setLngLat([location.longitude, location.latitude])
            .addTo(map.current!),
        )
      })
    return () => {
      previewPins.current.forEach((pin) => pin.remove())
      previewPins.current = []
    }
  }, [ready, origin, destination, !!data, loading])

  function focusMap(duration = 900) {
    if (!map.current) return
    const coordinates: [number, number][] = data
      ? data.routes.flatMap((route) => route.coordinates)
      : [origin, destination].flatMap((location) =>
          location ? [[location.longitude, location.latitude] as [number, number]] : [],
        )
    if (!coordinates.length) return
    const bounds = new maplibregl.LngLatBounds()
    coordinates.forEach((coordinate) => bounds.extend(coordinate))
    map.current.fitBounds(bounds, {
      padding,
      duration: reduceMotion() ? 0 : duration,
      maxZoom: coordinates.length === 1 ? 10 : 9,
      linear: true,
      easing: (value) => 1 - Math.pow(1 - value, 3),
    })
  }
  useEffect(() => {
    if (!ready) return
    // Clearing a field while typing should not zoom into the other city. Move
    // as soon as both locations are selected, without waiting for analysis.
    if (!data && (!origin || !destination)) return
    focusMap()
    // Reframe for selected cities, new geometry or overlay dimensions, never
    // for cargo-only changes or weather-hour scrubbing. New moves interrupt old ones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    data?.analysis_id,
    origin?.latitude,
    origin?.longitude,
    destination?.latitude,
    destination?.longitude,
    padding.top,
    padding.left,
    padding.right,
    padding.bottom,
  ])
  useEffect(() => {
    if (!ready || !map.current || !data) return
    const cells: FeatureCollection['features'] = []
    for (const cell of data.corridor) {
      const arrival = cell.arrivals[selected]
      const sample = view === 'arrival' ? arrival : cell.hours[hour]
      if (!sample) continue
      const value =
        layer === 'risk'
          ? sample.risk
          : layer === 'wind'
            ? sample.wind_mph
            : layer === 'rain'
              ? sample.rain_in_hr
              : sample.snow_in_hr
      const max = { risk: 4, wind: 55, rain: 1, snow: 3 }[layer]
      const intensity = value === null ? 0 : Math.min(1, value / max)
      const color = value === null ? '#8a929b' : RISK_COLORS[Math.min(4, Math.floor(intensity * 4))]
      const [x0, y0, x1, y1] = cell.bounds
      const sampleTime =
        view === 'arrival' ? arrival.eta_epoch : data.forecast_reference_epoch + hour * 3600
      const description = `${view === 'arrival' ? t.arrival : t.forecast} · ${timeAt(sampleTime, data.origin.timezone, lang, true)}\n${t.wind}: ${fmt(sample.wind_mph, lang, 1)} mph\n${t.rain}: ${fmt(sample.rain_in_hr, lang, 2)} in/h\n${t.snow}: ${fmt(sample.snow_in_hr, lang, 2)} in/h\n${t.risk}: ${sample.risk === null ? t.unknown : riskNames[lang][sample.risk]}`
      cells.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [x0, y0],
              [x1, y0],
              [x1, y1],
              [x0, y1],
              [x0, y0],
            ],
          ],
        },
        properties: { color, description, unknown: value === null },
      })
    }
    ;(map.current.getSource('cells') as GeoJSONSource).setData(featureCollection(cells))
    if (heatVisible && view === 'forecast') {
      const field = forecastImage(data.corridor, hour, layer)
      if (field) {
        const source = map.current.getSource('forecast-field') as ImageSource | undefined
        if (source) source.updateImage(field)
        else {
          map.current.addSource('forecast-field', { type: 'image', ...field })
          map.current.addLayer(
            {
              id: 'forecast-field',
              type: 'raster',
              source: 'forecast-field',
              paint: {
                'raster-opacity': 0.8,
                'raster-fade-duration': 180,
                'raster-resampling': 'linear',
              },
            },
            'corridor-cells',
          )
        }
        map.current.setLayoutProperty('forecast-field', 'visibility', 'visible')
      }
    } else if (map.current.getLayer('forecast-field'))
      map.current.setLayoutProperty('forecast-field', 'visibility', 'none')
    map.current.setLayoutProperty('corridor-cells', 'visibility', heatVisible ? 'visible' : 'none')
    popup.current?.remove()
  }, [data, selected, hour, layer, heatVisible, ready, view, lang])
  useEffect(() => {
    pins.current.forEach((pin) => pin.remove())
    pins.current = []
    if (!map.current || !ready || !data || view !== 'arrival') return
    const route = data.routes.find((route) => route.id === selected)
    if (!route) return
    const maximum = compact ? 3 : 4
    const points = route.checkpoints.slice(1, -1)
    if (!points.length) return
    const worst = points.reduce(
      (best, point, index) => ((point.risk ?? -1) > (points[best].risk ?? -1) ? index : best),
      0,
    )
    // Always include the worst conditions, then fill the remaining slots across
    // the route. Keep a fixed label budget so the map stays readable on mobile.
    const indices = new Set<number>()
    for (let i = 0; i < maximum; i++)
      indices.add(Math.min(points.length - 1, Math.floor(((i + 0.5) * points.length) / maximum)))
    if (!indices.has(worst)) {
      const nearest = Array.from(indices).reduce((best, index) =>
        Math.abs(points[index].mile - points[worst].mile) <
        Math.abs(points[best].mile - points[worst].mile)
          ? index
          : best,
      )
      indices.delete(nearest)
      indices.add(worst)
    }
    const icons = {
      wind: '<path d="M3 8h11a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 17h5"/>',
      rain: '<path d="M6 14a5 5 0 1 1 9-7 4 4 0 1 1 1 7M8 17l-1 3m6-3-1 3m6-3-1 3"/>',
      snow: '<path d="M12 2v20M3 7l18 10M3 17 21 7M8 4l4 3 4-3M8 20l4-3 4 3"/>',
    }
    Array.from(indices)
      .sort((a, b) => a - b)
      .forEach((index, labelIndex) => {
        const point = points[index]
        const weather = dominantWeather(point)
        const button = document.createElement('button')
        button.type = 'button'
        button.className = `weather-pin ${focusedPoint?.id === point.id ? 'focused' : ''}`
        button.style.setProperty(
          '--pin-color',
          point.risk === null ? '#7c8792' : RISK_COLORS[point.risk],
        )
        button.setAttribute(
          'aria-label',
          `${t.atMile} ${fmt(point.mile, lang)} mi · ${t.pointDetail}`,
        )
        button.dataset.checkpointId = point.id
        const icon = document.createElement('span')
        icon.className = 'pin-icon'
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[weather.kind as keyof typeof icons]}</svg>`
        const value = document.createElement('strong')
        value.textContent = `${weatherNumber(weather.value, weather.kind, lang, weather.unit === 'mph' ? 0 : 2)} ${weather.unit}`
        const time = document.createElement('small')
        time.textContent = timeAt(point.eta_epoch, data.origin.timezone, lang)
        button.append(icon, value, time)
        button.addEventListener('click', (event) => {
          event.stopPropagation()
          callbacks.current.onCheckpoint(point)
        })
        pins.current.push(
          new maplibregl.Marker({
            element: button,
            anchor: compact && labelIndex % 2 ? 'top' : 'bottom',
            offset: [0, compact && labelIndex % 2 ? 9 : -9],
          })
            .setLngLat(point.coordinates)
            .addTo(map.current!),
        )
      })
    return () => {
      pins.current.forEach((pin) => pin.remove())
      pins.current = []
    }
  }, [data, selected, view, ready, lang, focusedPoint?.id, compact])
  useEffect(() => {
    if (!cellInfo || !map.current) return
    popup.current?.remove()
    const content = document.createElement('div')
    content.className = 'weather-popup'
    content.textContent = cellInfo.text
    popup.current = new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
      .setLngLat(cellInfo.coordinates)
      .setDOMContent(content)
      .addTo(map.current)
  }, [cellInfo])
  function fit() {
    focusMap(550)
  }
  function toggle3D() {
    if (!map.current) return
    map.current.easeTo({
      pitch: threeD ? 0 : 48,
      bearing: threeD ? 0 : -14,
      duration: reduceMotion() ? 0 : 550,
    })
    setThreeD(!threeD)
  }
  return (
    <div className="map-shell">
      <div className="map-canvas" ref={container} aria-label={t.step3} aria-busy="false" />
      {!ready && !mapError && (
        <div className="map-loading">
          <Compass size={28} />
          <span>{t.mapLoading}</span>
        </div>
      )}
      {mapError && (
        <div className="map-loading" role="alert">
          {t.mapUnavailable}
        </div>
      )}
      <div className="map-controls glass">
        <Tooltip title={t.zoomIn} placement="left">
          <button
            aria-label={t.zoomIn}
            onClick={() => map.current?.zoomIn({ duration: reduceMotion() ? 0 : 200 })}
          >
            <Plus size={18} />
          </button>
        </Tooltip>
        <Tooltip title={t.zoomOut} placement="left">
          <button
            aria-label={t.zoomOut}
            onClick={() => map.current?.zoomOut({ duration: reduceMotion() ? 0 : 200 })}
          >
            <Minus size={18} />
          </button>
        </Tooltip>
        <span className="control-separator" />
        <Tooltip title={t.fit} placement="left">
          <button aria-label={t.fit} onClick={fit}>
            <Maximize2 size={17} />
          </button>
        </Tooltip>
        <Tooltip title={t.perspective} placement="left">
          <button
            aria-label={t.perspective}
            aria-pressed={threeD}
            className={threeD ? 'active' : ''}
            onClick={toggle3D}
          >
            {threeD ? <Layers2 size={18} /> : <Box size={18} />}
          </button>
        </Tooltip>
      </div>
      <a
        className="fix-map"
        href="https://www.openstreetmap.org/fixthemap"
        target="_blank"
        rel="noreferrer"
      >
        {'Improve this map'} ↗
      </a>
    </div>
  )
}
