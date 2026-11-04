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

La vista inicial muestra **clima durante el viaje**. La carretera seleccionada está dividida en tramos de la geometría original del proveedor y coloreada con la misma regla de riesgo que se usa para sumar millas. Los límites se cortan exactamente en los puntos de consulta; no se dibujan atajos rectos entre puntos distantes.

El clima cercano se consulta en las coordenadas de cada celda, a la ETA del punto de ruta más próximo. Esa referencia temporal aproximada se explica en la interfaz. No significa que el camión viaje por las celdas laterales ni que sepamos la hora exacta de cada fenómeno entre puntos.

La vista separada **Explorar próximas 48 h** recorre 49 instantes: desde la referencia horaria actual redondeada hasta +48 h. Cada celda usa una hora común. Mover el control no recalcula la recomendación ni altera la salida. En esta vista la carretera queda neutral para no confundir riesgo al paso con clima de una hora común.

La capa difuminada es intensidad relativa, afectada por suavizado y escala. Sus colores no son categorías certificadas. Los puntos y las ventanas de detalle muestran valores y categorías exactos. Los huecos se representan como desconocidos y se notifican.

## Recalcular carga

Cambiar solamente la carga vuelve a aplicar las reglas en el backend usando el mismo pronóstico y salida. Se actualizan puntos, segmentos, exposición, celdas al paso, las 49 horas y la recomendación. No hay nuevas llamadas al clima ni a rutas. La caché dura 15 minutos, con un máximo de 24 análisis y un identificador aleatorio por viaje. Su vencimiento se informa y requiere comparar de nuevo.

## Fuentes técnicas

- [Open-Meteo: variables, unidades, tiempo y horizonte](https://open-meteo.com/en/docs)
- [OSRM: rutas, anotaciones y alternativas](https://project-osrm.org/docs/v5.24.0/api/)
- [TomTom: rutas y tiempos acumulados](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route)
