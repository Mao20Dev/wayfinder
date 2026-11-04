import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

export type MapPadding = { top: number; right: number; bottom: number; left: number }

// Camera insets reserve the actual space occupied by floating controls. The
// canvas still fills the viewport; the roads fit into the unobstructed area.
export default function useMapLayout(
  plannerOpen: boolean,
  routesOpen: boolean,
  mobilePanel: 'trip' | 'routes' | null,
  forecast: boolean,
) {
  const frame = useRef<HTMLElement>(null)
  const planner = useRef<HTMLDivElement>(null)
  const routes = useRef<HTMLDivElement>(null)
  const dock = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(() => window.innerWidth <= 980)
  const plannerVisible = plannerOpen && (!compact || mobilePanel === 'trip')
  const routesVisible = routesOpen && (!compact || mobilePanel === 'routes')
  const [padding, setPadding] = useState<MapPadding>({
    top: 128,
    right: 64,
    bottom: 100,
    left: 384,
  })

  useLayoutEffect(() => {
    function measure() {
      if (!frame.current) return
      const { width, height } = frame.current.getBoundingClientRect()
      const mobile = width <= 980
      setCompact(mobile)
      const plannerBox = plannerVisible ? planner.current?.getBoundingClientRect() : null
      const routeBox = routesVisible ? routes.current?.getBoundingClientRect() : null
      const dockHeight = forecast ? (dock.current?.getBoundingClientRect().height ?? 150) : 0
      const sheetHeight = mobile ? Math.max(plannerBox?.height ?? 0, routeBox?.height ?? 0) : 0
      const next = {
        top: mobile ? 180 : 130,
        left: mobile ? 40 : (plannerBox?.width ?? 0) + 60,
        right: mobile ? 80 : (routeBox?.width ?? 0) + (routeBox ? 60 : 80),
        bottom: mobile
          ? Math.min(height - 250, Math.max(sheetHeight + 76, dockHeight + 100, 110))
          : Math.max(110, dockHeight + 105),
      }
      next.bottom = Math.max(50, next.bottom)
      setPadding((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      )
    }
    const observer = new ResizeObserver(measure)
    for (const element of [frame.current, planner.current, routes.current, dock.current]) {
      if (element) observer.observe(element)
    }
    measure()
    return () => observer.disconnect()
  }, [plannerVisible, routesVisible, forecast, compact])

  const style = {
    '--map-left': `${compact ? 16 : padding.left - 24}px`,
    '--map-right': `${compact ? 16 : padding.right - 24}px`,
    '--sheet-height': `${compact && (plannerVisible || routesVisible) ? Math.max(0, padding.bottom - 76) : 0}px`,
  } as CSSProperties
  return { frame, planner, routes, dock, padding, compact, style, plannerVisible, routesVisible }
}
