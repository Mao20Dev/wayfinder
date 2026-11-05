# Preparación del Loom · Mauro graba personalmente

Duración objetivo: 2–3 minutos. Mostrar solo la aplicación, sin código, hablando en inglés sencillo. Las notas están en español. El video no se ha grabado automáticamente.

| Minuto | Qué mostrar | Qué debes poder explicar |
|---|---|---|
| 0:00–0:25 | Ciudades, salida y carga; Truck settings puede quedarse cerrado | Está preseleccionado un perfil de ejemplo de cinco ejes, con supuestos visibles. La marca es opcional. Para un vehículo real se ajustan medidas y peso por eje en Custom. Peso total = vacío + carga. |
| 0:25–1:10 | Compare truck routes, tarjetas y un punto | TomTom recibe perfil de camión; Open-Meteo aporta clima a la ETA. Severe miles, High miles, promedio ponderado y duración deciden, en ese orden. No Travel o datos faltantes excluyen la recomendación. |
| 1:10–1:50 | 48-hour forecast y capas | Toda el área usa una hora común; el deslizador trabaja con datos cargados y no modifica salida ni recomendación. |
| 1:50–2:20 | Best time to leave, Save route y Export GPX | Comparación meteorológica sobre carreteras actuales. Aplicar otra hora real comprueba rutas de nuevo. El GPX es planificación; no impone restricciones. |
| 2:20–2:45 | Cierre sobre el mapa | Caché, consultas agrupadas, pruebas y README, sin mostrar código. Revisar señales y normativa. Google Maps solo es vista previa de automóvil. |

## Frases precisas

- “En modo real usamos TomTom para camiones y pronóstico real. El ejemplo meteorológico usa carreteras de automóvil y clima sintético, y no sirve para navegar un camión.”
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
