# Validación de la versión local

Fecha de trabajo: 3 de noviembre de 2026, Colombia. Estas comprobaciones no equivalen a una prueba de producción ni a una verificación de TomTom con cuenta real.

| Comprobación | Resultado observado |
|---|---|
| Backend · pytest | 92 pruebas aprobadas, sin avisos. |
| Ruff y formato Python | Sin errores. |
| Django `check` | Sin problemas. |
| Frontend | TypeScript y compilación de producción aprobados. |
| Vitest | 12 pruebas aprobadas. |
| Dependencias | Sin cambios de dependencias en esta revisión. El último `npm audit` del conjunto instalado reportó 0 vulnerabilidades. |
| Consulta real de API | Chicago–Detroit: tres rutas, cobertura meteorológica completa y 49 horas del corredor. Una ejecución inicial tardó aproximadamente 16,24 s; es una observación, no un SLA. |
| Opera instalado | Geometría coloreada, etiquetas de clima, selección, detalles de reglas, tabla, perspectiva y controles: comprobados. |
| Verificación visual | Se comprueban las dimensiones del canvas y píxeles del color de los tramos dentro del mapa, además de capturas. No basta con que exista el elemento HTML. |
| Cambio de carga | Reevalúa el pronóstico guardado mediante `/api/reassess/`, sin volver a `/api/analyze/` ni llamar al clima. |
| Dos referencias temporales | La exploración de +48 h no hace solicitudes al backend. La vista al paso recupera puntos y segmentos del viaje. |
| Idiomas | Español e inglés, con la misma tabla y explicaciones de riesgo. |
| Opera · viaje real | Búsqueda de Chicago y comparación desde el formulario: respuesta 200, tres rutas y datos completos. |
| Vista móvil de 390 px | Sin desbordamiento horizontal. El mapa se ajusta al cambiar el ancho. |
| JavaScript en recorrido probado | Sin errores de ejecución. |
| Mensaje de límite | Una respuesta 429 simulada, identificada como prueba, verifica la cuenta regresiva y conserva los resultados. |
| Compresión | Una prueba verifica gzip y una reducción por debajo del 30% del JSON original. |
| Secretos | `.env`, entorno virtual, artefactos y dependencias ignorados por Git. |

## Mejoras verificadas

- Los colores de carretera y las millas por riesgo comparten la función de clasificación de intervalos. Los segmentos conservan la geometría original y son continuos.
- La recomendación identifica el primer criterio que decide la comparación, su diferencia numérica y el tiempo extra frente a la opción elegible más rápida.
- Cada punto expone los factores y la regla estricta de carga que corresponde, sin sustituir una prohibición por una categoría menor.
- El demo respeta la salida indicada. Las consultas del corredor al paso usan la ETA del punto cercano y lo explican como aproximación.
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

Capturas y reporte de navegador: `artifacts/desktop.png`, `artifacts/perspective.png`, `artifacts/mobile.png`, `artifacts/live-desktop.png`, `artifacts/risk-road.png` y `artifacts/browser-validation.json`. No se incluyen en Git. Las capturas reales se toman antes de simular el mensaje 429.
