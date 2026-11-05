# Reglas, unidades y supuestos

Las reglas de origen son las del PDF del ejercicio. Las decisiones añadidas se identifican explícitamente.

## Umbrales continuos elegidos

| Riesgo | Viento mph | Lluvia in/h | Nieve in/h |
|---|---|---|---|
| Low | `<25` | `<0.10` | `<0.5` |
| Moderate | `25 <= x < 35` | `0.10 <= x < 0.25` | `0.5 <= x < 1` |
| High | `35 <= x < 45` | `0.25 <= x < 0.50` | `1 <= x < 2` |
| Severe | `45 <= x < 55` | `0.50 <= x <= 1.00` | `2 <= x <= 3` |
| No Travel | `>=55` | `>1.00` | `>3` |

**Decisión propuesta:** los rangos enteros de viento se interpretan como intervalos continuos sin huecos. Los extremos compartidos de lluvia y nieve pasan al nivel superior, manteniendo los `>` expresos de No Travel. No se redondea antes de clasificar.

## Carga

- Viento `>=55 mph`: No Travel para cualquier carga.
- Viento `45 <= mph <55` y carga **estrictamente mayor de 30,000 lb**: No Travel.
- Viento `35 <= mph <45` y carga **estrictamente mayor de 40,000 lb**: Severe.
- Exactamente 30,000 y 40,000 lb no activan sus respectivas condiciones de carga.
- El resultado combinado del punto es el máximo del viento ajustado, lluvia y nieve. Una condición menor nunca reduce otra mayor.

## Unidades y tiempo

El adaptador solicita unidades métricas explícitas y valida las unidades recibidas:

- `wind_speed_10m`: km/h → mph dividiendo por `1.609344`. Se interpola entre instantes horarios.
- `rain + showers`: mm en una hora → in/h dividiendo por `25.4`.
- `snowfall`: cm en una hora → in/h dividiendo por `2.54`.
- No usar `precipitation` como lluvia: contiene nieve equivalente en agua.
- Los acumulados marcados con hora `t` representan `(t - 1h, t]`. Se toma el intervalo que contiene la ETA, sin interpolar acumulados. Para una ETA exactamente en `t`, se toma el acumulado marcado `t`.
- Se utiliza velocidad del viento a 10 m, no ráfagas. El PDF no aclara cuál debe usarse; se documenta como supuesto.
- UTC/epoch para cálculo. El formulario real indica la zona del navegador; los resultados indican la zona del origen. Esto evita asumir que la hora de Bogotá es la de Chicago.

## Tramos, promedio y clasificación de rutas

**Decisión propuesta:** cada intervalo toma el mayor riesgo de sus dos puntos extremos. Su longitud real se añade a la categoría correspondiente. El último tramo parcial se cuenta una sola vez.

El promedio es `sum(longitud_del_tramo * puntuación_del_tramo) / distancia_total`, con Low=0, Moderate=1, High=2, Severe=3, No Travel=4. Se usa precisión completa para ordenar; los números mostrados están redondeados.

Antes de ordenar, se excluyen rutas con No Travel o con variables meteorológicas ausentes. Los valores nulos, negativos o no finitos no son cero. Una prohibición conocida sigue bloqueando la ruta aunque falte otra variable. Si no hay rutas elegibles, se explica y no se selecciona una recomendación artificial.

Entre rutas elegibles se minimiza la tupla:

```text
(millas Severe, millas High, riesgo promedio ponderado, tiempo en segundos)
```

Los empates exactos se muestran como tales. Un identificador estable elige únicamente qué tarjeta se enfoca primero; no se utiliza para inventar una ventaja.

## Corredor y control temporal

Tras comparar un viaje, **Along the route** muestra su clima. La carretera seleccionada está dividida en tramos de la geometría original del proveedor y coloreada con la misma regla de riesgo que se usa para sumar millas. Los límites se cortan exactamente en los puntos de consulta; no se dibujan atajos rectos entre puntos distantes. Las etiquetas y el detalle de cada punto muestran su pronóstico a la ETA.

La API también conserva consultas en las celdas cercanas a la ETA del punto de ruta más próximo. Es una aproximación; no significa que el camión viaje por las celdas laterales ni que sepamos la hora exacta de cada fenómeno entre puntos. La interfaz mantiene el mapa principal centrado en los tramos y puntos del viaje; la capa espacial se muestra en la vista de 48 horas.

La vista separada **48-hour forecast** recorre 49 instantes: desde la referencia horaria actual redondeada hasta +48 h. Cada celda usa una hora común. Mover el control no recalcula la recomendación ni altera la salida. En esta vista la carretera queda neutral para no confundir riesgo al paso con clima de una hora común.

El campo espacial usa escalas fijas: riesgo 0–4, viento 0–55+ mph, lluvia 0–1+ in/h y nieve 0–3+ in/h. Se interpola dentro de las celdas consultadas para mostrar una estimación continua, sin normalizar cada hora ni confundir densidad de puntos con intensidad. Riesgo cero se pinta en verde; una celda sin datos es gris y el territorio no consultado permanece transparente. Los bordes se atenúan dentro del dominio conocido. El mapa no es radar ni delimita tormentas con exactitud; los detalles de cada celda exponen su muestra real.

## Comparar horas de salida

Se comparan 25 salidas: la del análisis y sus siguientes 24 horas, con paso de una hora. Sus extremos se muestran en pantalla. Aplicar una salida real crea un análisis nuevo y una ventana nueva, porque las rutas pueden cambiar. Cada opción evalúa el clima a la ETA de todos los puntos con la misma clasificación por carga y exposición conservadora. Dentro de esta comparación meteorológica la geometría y duración son constantes. No se añade un peso arbitrario por esperar. En empate se propone la primera hora elegible y se muestran las horas empatadas.

Los pronósticos horarios originales permanecen en la caché privada. Comparar las 25 horas no consulta proveedores y solo representa clima sobre la geometría y duración actuales. Aplicar una salida real sí solicita nuevas rutas de camión: restricciones horarias y tráfico pueden cambiar. Solo el ejemplo aplica otra hora sin proveedores. Datos desconocidos y No Travel excluyen la opción; tampoco son elegibles salidas reales pasadas o fuera de cuatro días. Se genera un resultado nuevo sin modificar el anterior; la exploración de 48 horas conserva su referencia independiente. No se incluyen descansos.

## Recalcular carga

Las reglas meteorológicas usan exclusivamente la carga, como exige la prueba. La selección de carreteras usa el peso total: vehículo y remolque vacíos más carga. Por eso cambiar carga real invalida la ruta, borra el peso de eje cargado y exige comparar otra vez con datos actualizados. `/api/reassess/` rechaza ese cambio con 409. Solo el ejemplo meteorológico recalcula carga sobre carreteras fijas sin proveedores. La caché dura 15 minutos, con un máximo de 24 análisis y un identificador aleatorio por viaje.

## Fuentes técnicas

- [Open-Meteo: variables, unidades, tiempo y horizonte](https://open-meteo.com/en/docs)
- [OSRM: rutas, anotaciones y alternativas](https://project-osrm.org/docs/v5.24.0/api/)
- [TomTom: rutas y tiempos acumulados](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route)
