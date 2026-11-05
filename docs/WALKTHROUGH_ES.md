# Preparación del Loom · Mauro graba personalmente

Duración objetivo: unos 3 minutos de voz, más las pausas al interactuar. Mostrar solo la aplicación, sin código. Chicago–Detroit primero, después Cúcuta–Bucaramanga. El video no se ha grabado automáticamente.

| Minuto | Qué mostrar | Qué debes poder explicar |
|---|---|---|
| 0:00–0:25 | Ciudades, salida y carga; Truck settings puede quedarse cerrado | Está preseleccionado un perfil de ejemplo de cinco ejes, con supuestos visibles. La marca es opcional. Para un vehículo real se ajustan medidas y peso por eje en Custom. Peso total = vacío + carga. |
| 0:25–1:10 | Compare truck routes, tarjetas y un punto | TomTom recibe perfil de camión; Open-Meteo aporta clima a la ETA. Severe miles, High miles, promedio ponderado y duración deciden, en ese orden. No Travel o datos faltantes excluyen la recomendación. |
| 1:10–1:50 | 48-hour forecast y capas | Toda el área usa una hora común; el deslizador trabaja con datos cargados y no modifica salida ni recomendación. |
| 1:50–2:20 | Best time to leave, Save route y Open in Google Maps | El slider explora un horario común; aplicar otra salida recalcula el viaje. Maps recibe puntos guía y puede modificar el recorrido. |
| 2:20–2:50 | Cúcuta–Bucaramanga | Un ejemplo personal de Mauro. Enseñar la ruta real sin inventar el motivo por el cual una alternativa no aparece. |
| 2:50–3:20 | Cierre sobre el mapa | React, API Django, reglas separadas, caché, validación, claves y pruebas. Más detalles en README. |

## Guion en inglés

**Chicago–Detroit**

Hi, I'm Mauro, and this is Wayfinder. Let's plan our first trip, from Chicago to Detroit.

I choose when I want to leave and how much cargo I'm carrying. There's already an example truck loaded. I can change its details here, because every truck is different. Those measurements go to TomTom to plan routes for that truck.

The app then checks the weather along each route for the time I'm expected to arrive.

**Resultados y un punto del mapa**

The app uses wind, rain, snow and the cargo rules to calculate risk. Then it compares Severe miles, High miles and average risk, in that order. If those are equal, the faster trip wins. No Travel or missing weather means we can't recommend that route.

I can select another route or click a point to see its arrival time and weather.

**Pronóstico y otra salida**

This slider lets me explore the next 48 hours. The data is already loaded, so moving it doesn't call the server again.

If the best time to leave doesn't work for me, I can choose another departure. Applying it recalculates the trip, so I can check what conditions I'd meet along the way.

Once I've chosen, I can save the route or open it in Google Maps with points from my selected route.

**Cúcuta–Bucaramanga**

I also wanted to show Cúcuta to Bucaramanga. I travel to Bucaramanga a lot, and I have family in Cúcuta, so this one is personal.

These are roads I know. A truck can't use every road a car can, which is why the truck details matter. I can also check around what time I'd reach a point near Pamplona and what weather to expect there.

**Construcción y cierre**

The interface is built with React, and Django runs the API. The backend brings together the routes, weather and risk results.

I kept the risk rules separate from the API calls so they're easier to test. I also validate inputs, keep API keys on the server, and reuse weather data to avoid unnecessary requests. Automated tests cover the main rules.

The README has more detail about the setup and decisions.

I built this for a truck driver, so the goal was to keep it clear and easy to use. Thanks for watching.

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
