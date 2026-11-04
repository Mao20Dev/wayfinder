import { ArrowLeft, ArrowRight, CloudRain, Clock3, Snowflake, Wind, X } from 'lucide-react'
import {
  weatherNumber,
  copy,
  dominantWeather,
  fmt,
  pointExplanation,
  timeAt,
  type Language,
} from '../i18n'
import type { Analysis, Checkpoint, Route } from '../types'
import { RISK_COLORS } from '../types'
import RiskBadge from './RiskBadge'

export function WeatherIcon({ kind, size = 18 }: { kind: string; size?: number }) {
  return kind === 'snow' ? (
    <Snowflake size={size} />
  ) : kind === 'rain' ? (
    <CloudRain size={size} />
  ) : (
    <Wind size={size} />
  )
}

export default function JourneyDetails({
  data,
  route,
  point,
  lang,
  onPoint,
  onClose,
}: {
  data: Analysis
  route: Route
  point: Checkpoint | null
  lang: Language
  onPoint: (p: Checkpoint) => void
  onClose: () => void
}) {
  const t = copy[lang]
  const zone = data.origin.timezone
  const index = point ? route.checkpoints.findIndex((cp) => cp.id === point.id) : -1
  const stops = Array.from(
    new Set([
      0,
      Math.round((route.checkpoints.length - 1) / 3),
      Math.round((2 * (route.checkpoints.length - 1)) / 3),
      route.checkpoints.length - 1,
    ]),
  ).map((i) => route.checkpoints[i])
  return (
    <section className="journey-details" id="weather-detail" aria-label={t.graphTitle}>
      {point ? (
        <div className="point-detail">
          <div className="point-heading">
            <div>
              <span className="section-kicker">{t.pointDetail}</span>
              <h3>
                {t.atMile} {fmt(point.mile, lang, 1)} mi <RiskBadge risk={point.risk} lang={lang} />
              </h3>
            </div>
            <button className="icon-button" aria-label={t.close} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <p className="point-arrival">
            <Clock3 size={14} />
            {t.arrivalTime}: <strong>{timeAt(point.eta_epoch, zone, lang, true)}</strong>
            <span>{zone}</span>
          </p>
          <div className="point-columns">
            <div className="point-weather">
              {[
                {
                  kind: 'wind',
                  label: t.wind,
                  value: point.weather.wind_mph,
                  unit: 'mph',
                  digits: 1,
                },
                {
                  kind: 'rain',
                  label: t.rain,
                  value: point.weather.rain_in_hr,
                  unit: 'in/h',
                  digits: 2,
                },
                {
                  kind: 'snow',
                  label: t.snow,
                  value: point.weather.snow_in_hr,
                  unit: 'in/h',
                  digits: 2,
                },
              ].map((v) => (
                <div key={v.kind}>
                  <WeatherIcon kind={v.kind} />
                  <span>{v.label}</span>
                  <strong>
                    {weatherNumber(v.value, v.kind, lang)} <small>{v.unit}</small>
                  </strong>
                </div>
              ))}
            </div>
            <div className="point-rule">
              <strong>{t.ruleApplied}</strong>
              <p>{pointExplanation(point, data.load_lb, lang)}</p>
              {!point.complete && point.risk !== null && <p>{t.dataWarning}</p>}
            </div>
          </div>
          <div className="point-navigation">
            <button disabled={index <= 0} onClick={() => onPoint(route.checkpoints[index - 1])}>
              <ArrowLeft size={14} />
              {t.previousPoint}
            </button>
            <span>
              {index + 1} / {route.checkpoints.length}
            </span>
            <button
              disabled={index < 0 || index >= route.checkpoints.length - 1}
              onClick={() => onPoint(route.checkpoints[index + 1])}
            >
              {t.nextPoint}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="section-title">
            <h3>{t.graphTitle}</h3>
            <span>
              {fmt(data.load_lb, lang)} lb · {data.spacing_miles} mi
            </span>
          </div>
          <p className="detail-intro">{t.graphHelp}</p>
          <div className="journey-road" aria-label={t.exposure}>
            {route.segments.map((segment, i) => (
              <button
                key={segment.id}
                style={{
                  flex: segment.end_mile - segment.start_mile,
                  background: segment.risk === null ? '#85919c' : RISK_COLORS[segment.risk],
                }}
                onClick={() =>
                  onPoint(route.checkpoints[Math.min(i + 1, route.checkpoints.length - 1)])
                }
                aria-label={`${t.atMile} ${fmt(segment.start_mile, lang)}–${fmt(segment.end_mile, lang)} mi`}
              />
            ))}
          </div>
          <div className="journey-milestones">
            {stops.map((cp) => {
              const w = dominantWeather(cp)
              return (
                <button key={cp.id} onClick={() => onPoint(cp)}>
                  <span>{fmt(cp.mile, lang)} mi</span>
                  <strong>
                    <WeatherIcon kind={w.kind} size={14} />
                    {weatherNumber(w.value, w.kind, lang, w.unit === 'mph' ? 0 : 2)} {w.unit}
                  </strong>
                  <small>{timeAt(cp.eta_epoch, zone, lang)}</small>
                </button>
              )
            })}
          </div>
          <p className="approximation-note">{t.approximation}</p>
        </>
      )}
    </section>
  )
}
