import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapInstance } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { FeatureCollection } from 'geojson'
import { Box, Compass, Layers2, Maximize2, Minus, Plus } from 'lucide-react'
import { Tooltip } from '@mui/material'
import type { Analysis, Checkpoint, Layer } from '../types'
import { RISK_COLORS, ROUTE_COLORS } from '../types'
import 'maplibre-gl/dist/maplibre-gl.css'

maplibregl.setWorkerUrl(workerUrl)

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
const featureCollection = (features: FeatureCollection['features']): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
})

export default function RouteMap({
  data,
  selected,
  hour,
  layer,
  heatVisible,
  onSelect,
  onCheckpoint,
}: {
  data: Analysis | null
  selected: string
  hour: number
  layer: Layer
  heatVisible: boolean
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
  const [cellInfo, setCellInfo] = useState<{ coordinates: [number, number]; text: string } | null>(
    null,
  )
  const popup = useRef<maplibregl.Popup | null>(null)
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
    instance.on('load', () => {
      if (instance.getLayer('building'))
        instance.setLayoutProperty('building', 'visibility', 'none')
      instance.addSource('routes', { type: 'geojson', data: empty })
      instance.addSource('checkpoints', { type: 'geojson', data: empty })
      instance.addSource('corridor', { type: 'geojson', data: empty })
      instance.addSource('cells', { type: 'geojson', data: empty })
      instance.addSource('endpoints', { type: 'geojson', data: empty })
      instance.addLayer({
        id: 'corridor-cells',
        type: 'fill',
        source: 'cells',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['get', 'unknown'], 0.15, 0.025],
        },
      })
      instance.addLayer({
        id: 'corridor-heat',
        type: 'heatmap',
        source: 'corridor',
        paint: {
          'heatmap-weight': ['get', 'intensity'],
          'heatmap-intensity': 1.35,
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 22, 7, 55, 10, 110],
          'heatmap-opacity': 0.55,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(48,153,139,0)',
            0.15,
            '#9fceb7',
            0.35,
            '#dce6a1',
            0.55,
            '#f3cd7c',
            0.75,
            '#e99477',
            1,
            '#bf5870',
          ],
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
      for (const id of ['routes-main', 'checkpoint-points']) {
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
            layers: ['checkpoint-points', 'routes-main'],
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
    const resize = new ResizeObserver(() => instance.resize())
    resize.observe(container.current)
    return () => {
      resize.disconnect()
      popup.current?.remove()
      instance.remove()
      map.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    if (!ready || !map.current || !data) return
    const instance = map.current
    const features: FeatureCollection['features'] = data.routes.map((route, i) => ({
      type: 'Feature',
      properties: { id: route.id, selected: route.id === selected, color: ROUTE_COLORS[i % 3] },
      geometry: { type: 'LineString', coordinates: route.coordinates },
    }))
    ;(instance.getSource('routes') as GeoJSONSource).setData(featureCollection(features))
    ;(instance.getSource('checkpoints') as GeoJSONSource).setData(
      featureCollection(
        data.routes.flatMap((route) =>
          route.checkpoints.map((cp) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: cp.coordinates },
            properties: {
              id: cp.id,
              selected: route.id === selected,
              color: cp.risk === null ? '#7c8792' : RISK_COLORS[cp.risk],
            },
          })),
        ),
      ),
    )
    ;(instance.getSource('endpoints') as GeoJSONSource).setData(
      featureCollection([
        {
          type: 'Feature',
          properties: { label: 'A' },
          geometry: { type: 'Point', coordinates: [data.origin.longitude, data.origin.latitude] },
        },
        {
          type: 'Feature',
          properties: { label: 'B' },
          geometry: {
            type: 'Point',
            coordinates: [data.destination.longitude, data.destination.latitude],
          },
        },
      ]),
    )
  }, [data, selected, ready])

  useEffect(() => {
    if (!ready || !map.current || !data) return
    const bounds = new maplibregl.LngLatBounds()
    data.routes.forEach((route) => route.coordinates.forEach((point) => bounds.extend(point)))
    map.current.fitBounds(bounds, {
      padding: { top: 100, left: 65, right: 65, bottom: 145 },
      duration: reduceMotion() ? 0 : 700,
      maxZoom: 10,
    })
  }, [data, ready])

  useEffect(() => {
    if (!ready || !map.current || !data) return
    const features: FeatureCollection['features'] = []
    const cells: FeatureCollection['features'] = []
    for (const cell of data.corridor) {
      const sample = cell.hours[hour]
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
      const description = `Corridor forecast · +${hour}h\nWind: ${sample.wind_mph?.toFixed(1) ?? '—'} mph\nRain: ${sample.rain_in_hr?.toFixed(2) ?? '—'} in/h\nSnow: ${sample.snow_in_hr?.toFixed(2) ?? '—'} in/h\nRisk: ${sample.risk === null ? 'Unknown' : ['Low', 'Moderate', 'High', 'Severe', 'No Travel'][sample.risk]}`
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: cell.coordinates },
        properties: { intensity },
      })
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
    ;(map.current.getSource('corridor') as GeoJSONSource).setData(featureCollection(features))
    ;(map.current.getSource('cells') as GeoJSONSource).setData(featureCollection(cells))
    for (const id of ['corridor-heat', 'corridor-cells'])
      map.current.setLayoutProperty(id, 'visibility', heatVisible ? 'visible' : 'none')
    popup.current?.remove()
  }, [data, hour, layer, heatVisible, ready])

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
    if (!map.current || !data) return
    const bounds = new maplibregl.LngLatBounds()
    data.routes.forEach((route) => route.coordinates.forEach((p) => bounds.extend(p)))
    map.current.fitBounds(bounds, { padding: 90, duration: reduceMotion() ? 0 : 500 })
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
      <div
        className="map-canvas"
        ref={container}
        aria-label="Interactive map of routes, weather corridor and checkpoints"
      />
      {!ready && !mapError && (
        <div className="map-loading">
          <Compass size={28} />
          <span>Opening your map…</span>
        </div>
      )}
      {mapError && (
        <div className="map-loading" role="alert">
          {mapError}
        </div>
      )}
      <div className="map-controls glass">
        <Tooltip title="Zoom in" placement="left">
          <button
            aria-label="Zoom in"
            onClick={() => map.current?.zoomIn({ duration: reduceMotion() ? 0 : 200 })}
          >
            <Plus size={18} />
          </button>
        </Tooltip>
        <Tooltip title="Zoom out" placement="left">
          <button
            aria-label="Zoom out"
            onClick={() => map.current?.zoomOut({ duration: reduceMotion() ? 0 : 200 })}
          >
            <Minus size={18} />
          </button>
        </Tooltip>
        <span className="control-separator" />
        <Tooltip title="Fit all routes" placement="left">
          <button aria-label="Fit all routes" onClick={fit}>
            <Maximize2 size={17} />
          </button>
        </Tooltip>
        <Tooltip title={threeD ? 'Flat map' : 'Perspective map'} placement="left">
          <button
            aria-label="Toggle perspective map"
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
        Improve this map ↗
      </a>
    </div>
  )
}
