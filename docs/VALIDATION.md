# Validación de la versión local

Fecha de trabajo: 3 de noviembre de 2026, Colombia. No representa una prueba de producción ni de TomTom con cuenta real.

| Comprobación | Resultado observado |
|---|---|
| Backend · pytest | 78 pruebas aprobadas, sin avisos en la ejecución final. |
| Ruff | Sin errores. |
| Django `check` | Sin problemas. |
| Frontend | TypeScript y compilación de producción aprobados. |
| Vitest | 4 pruebas aprobadas. |
| npm audit completo | 0 vulnerabilidades tras actualizar MapLibre a 6.16.0 y Vitest a 5.1.0. |
| Consulta real de API | Chicago–Detroit: tres rutas, 13/13/15 puntos, 110 celdas y 49 horas por celda. Todos los puntos tuvieron datos completos. Una ejecución inicial tardó aproximadamente 16,24 s; es una observación, no un SLA. |
| Opera instalado | Demo, mapa, selección, tabla de puntos, control temporal con teclado, perspectiva, capas y diálogo: aprobados. |
| Opera · viaje real | Búsqueda de Chicago y análisis desde el formulario: respuesta 200, tres rutas y cobertura completa. |
| Vista móvil de 390 px | Sin desbordamiento horizontal. |
| JavaScript en recorrido probado | Sin errores de ejecución. |
| Compresión de respuestas | Prueba verifica gzip y reducción por debajo del 30% del JSON original. |
| Secretos | `.env`, entorno virtual, artefactos y dependencias ignorados por Git. |

## Incidencias corregidas durante la verificación

- Se corrigió la edición de una ciudad preseleccionada para conservar el texto mientras se buscan nuevas opciones.
- Se verificaron intervalos meteorológicos, carga estricta, datos desconocidos y conservación de prohibiciones conocidas.
- Se añadieron validación de unidades/series del proveedor, control de valores no finitos y rechazo de tiempos negativos.
- Se actualizaron dependencias con avisos de seguridad y se repitieron compilación y comprobaciones del mapa.
- Se separó el worker de MapLibre siguiendo su integración actual con Vite.

## Límites pendientes

- No hay despliegue público ni repositorio GitHub remoto, por instrucción de Mauro.
- No se ha grabado el Loom. La guía está en `WALKTHROUGH_ES.md`.
- TomTom permanece opcional, con pruebas de contrato simuladas y sin verificación contra una clave real.
- Los límites de servicios públicos y la disponibilidad futura no pueden garantizarse con pruebas locales.
- `check --deploy` bajo configuración de Render muestra únicamente el aviso intencional W021: no se solicita HSTS preload para un dominio aún no definido. HTTPS sí se activa en esa configuración.
- La compilación informa de un chunk grande de MapLibre. Se entrega por separado y comprimido; no se ocultó el aviso. El mapa WebGL y su worker son la dependencia principal del frontend.

Las capturas de escritorio, perspectiva, móvil y modo real se guardan en `artifacts/`, que está excluido del repositorio.

## Correcci?n del l?mite de solicitudes

Se separ? el contador de an?lisis reales del contador de b?squeda de ciudades. El demo no consume cuota de an?lisis reales ni se bloquea al explorar. El l?mite de cuatro an?lisis reales por minuto permanece, con un mensaje legible y segundos de espera. Dos pruebas verifican el aislamiento de los contadores y que el demo siga disponible despu?s de agotar la cuota real. Se comprobaron seis an?lisis demo consecutivos con respuesta 200 en el servidor local.
