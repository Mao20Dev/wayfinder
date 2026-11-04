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

Se comparan 25 salidas: la original y sus siguientes 24 horas, con paso de una hora. La ventana permanece anclada a la salida original incluso al aplicar una alternativa; sus extremos se muestran en pantalla. Cada opción evalúa el clima a la nueva ETA de todos los puntos de la ruta. Usa la misma clasificación por carga y exposición conservadora. Dentro de una ruta se comparan millas Severe, millas High y promedio ponderado; la geometría y duración son constantes. No se añade un peso arbitrario por esperar. En empate se propone la primera hora elegible y se muestran las horas empatadas.

Los pronósticos horarios originales permanecen en la caché del servidor y no salen en el JSON público. No hay nuevas consultas al proveedor al comparar, aplicar otra salida o cambiar la carga. Faltas de cobertura y No Travel excluyen la opción. Las salidas reales pasadas o fuera de los cuatro días admitidos no son elegibles. Aplicar una hora actualiza todos los puntos, ETAs, tramos y recomendación; genera un identificador nuevo sin modificar el análisis anterior. La exploración de 48 horas conserva su referencia independiente. No se predicen cambios de tráfico, descansos ni nuevas alternativas de carreteras para cada hora.

## Recalcular carga

Cambiar solamente la carga vuelve a aplicar las reglas en el backend usando el mismo pronóstico y salida. Se actualizan puntos, segmentos, exposición, celdas al paso, las 49 horas y la recomendación. No hay nuevas llamadas al clima ni a rutas. La caché dura 15 minutos, con un máximo de 24 análisis y un identificador aleatorio por viaje. Su vencimiento se informa y requiere comparar de nuevo.

## Fuentes técnicas

- [Open-Meteo: variables, unidades, tiempo y horizonte](https://open-meteo.com/en/docs)
- [OSRM: rutas, anotaciones y alternativas](https://project-osrm.org/docs/v5.24.0/api/)
- [TomTom: rutas y tiempos acumulados](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route)
