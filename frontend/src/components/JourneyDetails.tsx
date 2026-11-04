import { ArrowLeft, ArrowRight, CloudRain, Snowflake, Wind, X } from 'lucide-react'
import { weatherNumber, fmt, pointExplanation, timeAt, type Language } from '../i18n'
import type { Analysis, Checkpoint, Route } from '../types'
import RiskBadge from './RiskBadge'

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
  point: Checkpoint
  lang: Language
  onPoint: (point: Checkpoint) => void
  onClose: () => void
}) {
  const index = route.checkpoints.findIndex((cp) => cp.id === point.id)
  return (
    <section className="point-detail glass" aria-label="Weather point details">
      <div className="point-heading">
        <h3>
          Mile {fmt(point.mile, lang, 1)} <RiskBadge risk={point.risk} lang={lang} />
        </h3>
        <button className="icon-button" aria-label="Close point details" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <p className="point-arrival">
        Arrival {timeAt(point.eta_epoch, data.origin.timezone, lang, true)} · {data.origin.timezone}
      </p>
      <div className="point-weather">
        <div>
          <Wind size={16} />
          <span>Wind</span>
          <strong>
            {weatherNumber(point.weather.wind_mph, 'wind', lang)} <small>mph</small>
          </strong>
        </div>
        <div>
          <CloudRain size={16} />
          <span>Rain</span>
          <strong>
            {weatherNumber(point.weather.rain_in_hr, 'rain', lang)} <small>in/h</small>
          </strong>
        </div>
        <div>
          <Snowflake size={16} />
          <span>Snow</span>
          <strong>
            {weatherNumber(point.weather.snow_in_hr, 'snow', lang)} <small>in/h</small>
          </strong>
        </div>
      </div>
      <div className="point-rule">
        <p>{pointExplanation(point, data.load_lb, lang)}</p>
        {!point.complete && point.risk !== null && (
          <p>Some forecasts are missing. Unknown conditions are not assumed safe.</p>
        )}
      </div>
      <div className="point-navigation">
        <button disabled={index <= 0} onClick={() => onPoint(route.checkpoints[index - 1])}>
          <ArrowLeft size={14} />
          Previous
        </button>
        <span>
          {index + 1} / {route.checkpoints.length}
        </span>
        <button
          disabled={index < 0 || index >= route.checkpoints.length - 1}
          onClick={() => onPoint(route.checkpoints[index + 1])}
        >
          Next
          <ArrowRight size={14} />
        </button>
      </div>
    </section>
  )
}
