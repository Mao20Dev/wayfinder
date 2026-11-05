# Validación

## Enlace directo a Google Maps

La acción principal y los guardados ofrecen Open in Google Maps. Se retiró GPX de la interfaz y su código de exportación. El enlace contiene extremos y hasta tres puntos guía; el modo real solicita navegación y el ejemplo meteorológico abre una vista previa. La línea visible aclara que Maps puede cambiar la ruta y no recibe los datos del camión.

23 pruebas frontend pasan, incluidas la persistencia de un guardado de camión sin geometría GPX, puntos guía, navegación real frente a vista previa y bloqueo de rutas no elegibles. Compilación TypeScript/Vite y formato pasan. La prueba local de Opera también pasó con tres rutas reales Chicago–Detroit y tres Cúcuta–Bucaramanga, clima completo, puntos de Maps actualizados al segundo viaje y cero errores JavaScript. Las ventanas de Maps se interceptan antes de enviar coordenadas a Google.

Las secciones siguientes conservan los resultados de versiones anteriores; sus referencias a GPX no describen la interfaz actual.

## Perfil de ejemplo preseleccionado

El flujo inicial conserva origen, destino, salida y carga. Truck settings está cerrado y contiene un tractor-remolque de ejemplo con cinco ejes. La marca es opcional y no cambia medidas ni restricciones; se conserva como etiqueta. Custom permite editar los datos y mantiene validaciones.

La API también resuelve el perfil de ejemplo si no se envía vehículo. Sus supuestos se identifican en resultados, guardados y GPX; el peso por eje estimado se actualiza con la carga. Custom sigue exigiendo un peso por eje actualizado después de cambiar carga. No se presentan estos valores como datos de fabricante.

121 pruebas de backend y 23 de frontend pasan, además de compilación y formato. La prueba de navegador vigente comprueba inicio sin completar medidas, cambio opcional de marca sin alterar dimensiones, GPX identificado como ejemplo y comportamiento distinto de carga entre Example y Custom.

También pasó contra la URL pública tras la reconstrucción limpia de `5e84e57`: trece comprobaciones, tres rutas TomTom, clima completo, marca opcional y cero errores JavaScript. La versión se verificó por su bundle servido y su comportamiento, además del estado del panel de Render.

## Corrección de rutas de camión

TomTom Evaluation se comprobó con un perfil de prueba: 13.5 ft de alto, 8.5 ft de ancho, 70 ft de largo, 32,000 lb de peso vacío, 28,000 lb de carga, 17,000 lb en el eje más cargado y cinco ejes. La solicitud aplicó 60,000 lb de peso total, modo camión comercial y conversiones conservadoras de unidades; devolvió tres rutas reales. Estos valores son un caso de prueba, no medidas predeterminadas para un camión de Mauro.

La comprobación local `python scripts/check_truck_opera.py` pasó con clima real completo, tres rutas TomTom, guardado de perfil, geometría GPX completa, deslizador sin nuevas consultas, vista móvil sin desbordamiento y ausencia de navegación automática a Google Maps. Sin errores JavaScript. Cambiar carga invalida rutas y borra el dato de eje cargado. Los cambios de salida reales vuelven a consultar rutas.

119 pruebas de backend y 22 de frontend pasan. Se verifican perfil obligatorio, pesos coherentes, unidades, ausencia de respaldo de automóvil, bloqueo de exportación del ejemplo, protección del cambio de carga y nueva consulta al aplicar otra salida. Compilación TypeScript/Vite, Ruff y formato pasan. El aviso de tamaño de MapLibre sigue presente.

La misma prueba se ejecutó contra `https://wayfinder-w1d0.onrender.com` tras publicar `691d16a`: pasaron las doce comprobaciones, con tres rutas TomTom, clima completo y cero errores JavaScript. El despliegue y GitHub Actions constan en `DEPLOYMENT.md`. Un reporte adicional de TomTom confirmó los parámetros efectivos del camión, sin registrar la clave.

Los resultados siguientes describen la versión anterior de automóvil y sus verificaciones históricas; no certifican navegación de camiones. La cobertura de restricciones depende del proveedor y no sustituye señales, permisos ni normativa local.

## Verificaciones históricas

Fecha de trabajo: 4 de noviembre de 2026, Colombia. Estas comprobaciones no equivalen a una prueba de producción ni a una verificación de TomTom con cuenta real.

| Comprobación | Resultado observado |
|---|---|
| Backend · pytest | 102 pruebas aprobadas, sin avisos. |
| Ruff y formato Python | Sin errores. |
| Django `check` | Sin problemas. |
| Frontend | TypeScript y compilación de producción aprobados. |
| Vitest | 19 pruebas aprobadas. |
| Dependencias | Sin cambios de dependencias en esta revisión. El último `npm audit` del conjunto instalado reportó 0 vulnerabilidades. |
| Consulta real de API | Chicago–Detroit: tres rutas, cobertura meteorológica completa y 49 horas del corredor. Una ejecución inicial tardó aproximadamente 16,24 s; es una observación, no un SLA. |
| Opera instalado | Geometría coloreada, etiquetas de clima, selección, detalles de reglas, tabla, perspectiva y controles: comprobados. |
| Verificación visual | Se comprueban las dimensiones del canvas y píxeles del color de los tramos dentro del mapa, además de capturas. No basta con que exista el elemento HTML. |
| Cambio de carga | Reevalúa el pronóstico guardado mediante `/api/reassess/`, sin volver a `/api/analyze/` ni llamar al clima. |
| Dos referencias temporales | La exploración de +48 h no hace solicitudes al backend. La vista al paso recupera puntos y segmentos del viaje. |
| Idioma y flujo | Solo inglés, incluso con una preferencia antigua en español. Inicio sin consultas automáticas, un solo selector de rutas y muestreo desplegable. |
| Opera · viaje real | Búsqueda de Chicago y comparación desde el formulario: respuesta 200, tres rutas y datos completos. |
| Vista móvil de 390 px | Sin desbordamiento horizontal. El mapa se ajusta al cambiar el ancho. |
| Espacio del mapa | Canvas de 1440 × 1100 y 390 × 844: ocupa la ventana completa sin desplazamiento de página. Paneles flotantes ocultables. |
| Encuadre antes del análisis | Selección real de Seattle y Portland: extremos encuadrados sin llamar a `/api/analyze/`. |
| Búsqueda pendiente | Se retiene una solicitud en el navegador para verificar extremos enfocados, pulsos y tres tarjetas pendientes; luego se continúa contra el backend real. |
| Identidad de ruta | Best route señala la clasificación; Selected cambia al inspeccionar una alternativa. |
| Campo de pronóstico | Verificación de píxeles coloreados en una zona continua; cero riesgo permanece visible, huecos sin cobertura y datos desconocidos se distinguen. |
| Horas de salida | 25 opciones; se aplicó una con `/api/departure/` y UUID nuevo, sin otra llamada a `/api/analyze/`. Pruebas de riesgo, falta de datos, pasado y validación. |
| Guardar y Maps | Guardado persiste tras recargar. Popup de Maps interceptado y URL comprobada; no se envían coordenadas a Google durante la prueba. Start trip contiene intención de navegación. |
| Viaje de la captura de Mauro | Minneapolis–Detroit real: tres rutas, encuadre con margen adicional y campo de pronóstico en escritorio y móvil, sin errores JavaScript. |
| Pronóstico móvil y movimiento reducido | Abrir 48 horas cierra el panel inferior; capas y deslizador funcionan sin nuevas consultas. Con movimiento reducido no giran el indicador ni los pulsos. |
| JavaScript en recorrido probado | Sin errores de ejecución. |
| Mensaje de límite | Una respuesta 429 simulada, identificada como prueba, verifica la cuenta regresiva y conserva los resultados. |
| Compresión | Una prueba verifica gzip y una reducción por debajo del 30% del JSON original. |
| Secretos | `.env`, entorno virtual, artefactos y dependencias ignorados por Git. |

## Mejoras verificadas

- Los colores de carretera y las millas por riesgo comparten la función de clasificación de intervalos. Los segmentos conservan la geometría original y son continuos.
- La recomendación identifica el primer criterio que decide la comparación, su diferencia numérica y el tiempo extra frente a la opción elegible más rápida.
- Cada punto expone los factores y la regla estricta de carga que corresponde, sin sustituir una prohibición por una categoría menor.
- El ejemplo opcional respeta la salida indicada y se identifica como clima simulado. La vista principal utiliza tramos y puntos a su ETA; la capa de área se explora por separado en la vista de 48 horas.
- El cambio de carga actualiza puntos, segmentos, resúmenes, ambas vistas meteorológicas y recomendación con una copia del pronóstico guardado.
- La caché de análisis está separada, tiene UUID aleatorio, dura 15 minutos y conserva como máximo 24 resultados. Un viaje vencido responde con 410 y una instrucción para actualizarlo.
- El límite de análisis reales está separado de búsqueda de ciudades, demo y reevaluación de carga.
- El mapa y su CSS se cargan de forma diferida. Una regla explícita de dimensiones evita que el estilo de MapLibre deje un canvas vacío.
- La interfaz explica que los puntos de consulta no son paradas y que la exposición es estimada. La tabla de reglas se puede abrir desde la aplicación.
- Los valores cercanos a un umbral muestran decimales adicionales para no parecer que cruzan de categoría al redondear. Las reglas se aplican siempre con la precisión original.

## Límites pendientes

- No hay despliegue público ni repositorio GitHub remoto, por instrucción de Mauro.
- El Loom y la revisión personal de Mauro siguen pendientes.
- TomTom es opcional: tiene pruebas de contrato simuladas, sin verificación contra una clave real.
- AccuWeather no está integrado ni se ha validado una clave de Mauro. El pronóstico real continúa con Open-Meteo; no se contrató ningún plan.
- OSRM usa perfil de automóvil y puede generar alternativas por puntos intermedios explícitos, identificados en sus tarjetas.
- Los servicios gratuitos pueden limitar solicitudes o estar indisponibles. Su precisión y disponibilidad futura no quedan garantizadas por estas pruebas.
- `check --deploy` bajo configuración de Render muestra W021 intencional: no se solicita HSTS preload para un dominio todavía no definido. HTTPS sí se activa en esa configuración.
- La compilación informa de un chunk grande de MapLibre. Se carga de forma diferida y comprimida; no se oculta el aviso.

Capturas y reportes de navegador: `artifacts/planner-empty.png`, `artifacts/city-preview.png`, `artifacts/searching.png`, `artifacts/desktop.png`, `artifacts/perspective.png`, `artifacts/mobile.png`, `artifacts/mobile-forecast.png`, `artifacts/live-desktop.png`, `artifacts/risk-road.png`, `artifacts/browser-validation.json` y `artifacts/mobile-validation.json`. No se incluyen en Git. El recorrido completo incluye un viaje real; después se verificó por separado el ajuste final de espacio móvil y movimiento reducido. El único mensaje 429 se simula y las capturas de rutas se toman antes de esa simulación.

La revisión de pronóstico y planeación se reproduce con `python scripts/check_trip_planning_opera.py`. Reporte: `artifacts/trip-planning-validation.json`; capturas: `forecast-field.png`, `departure-applied.png`, `centered-minneapolis.png`, `live-forecast-field.png` y `mobile-forecast-field.png`, dentro de `artifacts/`. El enlace a Maps se intercepta para validar el traspaso sin transmitir datos a Google durante la prueba.


## Public verification on Render Free

Application commit `d7ae0c5` was deployed successfully on November 4, 2026. GitHub Actions passed. The public Opera smoke test passed all nine checks: continuous forecast coverage, 25 departure candidates, cached departure updates, route persistence across reloads, intercepted Maps handoff, Start trip URL, live Minneapolis?Detroit with three routes, 48-hour exploration without new API requests, and the mobile forecast. No JavaScript errors occurred.

A separate public Chicago?Detroit API check returned three routes with complete arrival-weather coverage and a recommendation. Root, compiled assets and the health endpoint returned HTTP 200.

The first deployment's weather requests failed with HTTP errors. After redeployment, both real-trip checks succeeded; the initial rejection could not be reproduced or assigned a confirmed cause. This is a verification result, not an uptime guarantee. Safe logs now include the provider HTTP status without request URLs or credentials. Missing forecasts remain unknown and cannot receive a safe-route recommendation.
