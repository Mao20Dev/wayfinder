# Preparación del Loom · Mauro graba personalmente

Duración objetivo: 8 minutos. Usar ejemplos que puedas explicar y ejecutar. El video no se ha grabado automáticamente.

| Minuto | Qué mostrar | Qué debes poder explicar |
|---|---|---|
| 0:00–0:45 | Pantalla principal y problema | Comparar clima a lo largo del tiempo de un viaje, no sólo en origen/destino. |
| 0:45–2:00 | Demo Chicago–Detroit, tres tarjetas, recomendación | La geometría y los tiempos están registrados de OSRM. El clima del demo es simulado. Mostrar exposición Severe/High, promedio y duración. |
| 2:00–3:00 | Un punto y la tabla de puntos | Distancia sobre la ruta, ETA acumulada, unidades y peor condición. |
| 3:00–4:00 | Cambiar carga y volver a analizar | Una regla concreta: 45 mph y más de 30,000 lb prohíbe viajar. La hora, ruta y clima deben ser visibles para afirmar que el ejemplo activa la regla. |
| 4:00–5:00 | Heatmap +0/+24/+48 y perspectiva | Hora común del corredor frente a ETA individual de cada punto. La perspectiva es visual, sin elevación real. |
| 5:00–6:00 | Modo real | Consultar sólo una vez si la caché está fría; explicar que puede tardar. No fingir una tormenta en datos reales. |
| 6:00–7:15 | `risk.py`, un test de límites y arquitectura | Reglas puras, comparación por prioridades, datos desconocidos y API keys sólo en backend. |
| 7:15–8:00 | Limitaciones y ejecución | Perfil car de OSRM, TomTom opcional, ausencia de descansos, servicios gratuitos y cómo arrancar. |

## Frases precisas

- “En esta demostración, las rutas vienen de una API real y el clima es un escenario sintético identificado en pantalla.”
- “La ruta recomendada minimiza primero las millas Severe; no intercambio seguridad por minutos mediante una puntuación inventada.”
- “El promedio es una escala ordinal ponderada por distancia, no una probabilidad de accidente.”
- “El mismo servicio entrega React compilado y atiende la API de Django.”
- “Usé asistencia de Codex para preparar la implementación. Revisé [mencionar sólo lo que realmente revisaste] y puedo explicar [mencionar sólo lo que puedas explicar].”

## Antes de grabar

1. Revisar `ARCHITECTURE.md` y `RISK_RULES.md` juntos.
2. Ejecutar las pruebas y leer al menos una prueba de cada regla de carga.
3. Practicar con un punto cuyo clima active la condición elegida; no memorizar un resultado que cambie con la hora real.
4. Cerrar o evitar mostrar ventanas privadas. Mostrar sólo el proyecto y la aplicación.
5. No mostrar `.env`, claves, correo del reclutador ni el enlace privado del cuestionario.
6. Comprobar la política de ayuda externa si Spotter la aclara. No aceptar afirmaciones de autoría exclusiva falsas.
7. El video y el envío siguen pendientes de Mauro; no se han generado enlaces ficticios.
