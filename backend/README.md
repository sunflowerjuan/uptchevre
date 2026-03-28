# Backend

Servicio Node.js + Express encargado del cálculo formal del proyecto.

## Responsabilidades

- Clasificar autómatas como `DFA`, `NFA` o `NFA_EPSILON`.
- Calcular estructuras formales derivadas.
- Simular palabras usando `δ*`.
- Comparar equivalencia entre autómatas deterministas.

## Scripts

```bash
npm run dev
npm run build
npm run start
```

## Endpoints

- `GET /api/health`
- `POST /api/automata/analyze`
- `POST /api/automata/simulate`
- `POST /api/automata/equivalent`

## Archivos clave

- `src/types.ts`
  Contratos compartidos del modelo formal y de las respuestas.

- `src/automata-analysis.ts`
  Normalización de símbolos, clasificación, `move` y clausura-ε.

- `src/automata-simulation.ts`
  Construcción de `δ*` y enumeración de trazas.

- `src/automata-utils.ts`
  Utilidades deterministas usadas por equivalencia.

- `src/automata-equivalence.ts`
  Comparación de equivalencia mediante producto de estados.

- `src/server.ts`
  Exposición HTTP de las operaciones formales.

## Flujo técnico

1. El cliente envía un `AutomataData`.
2. El backend normaliza símbolos y clasifica el autómata.
3. Según el endpoint:
   - `analyze` devuelve descripción formal.
   - `simulate` devuelve `δ*`, aceptación y trazas.
   - `equivalent` devuelve equivalencia y contraejemplo si existe.

## Notas de mantenimiento

- `""` representa `ε` en la capa de cálculo.
- La lógica formal vive separada de la exposición HTTP.
- Las rutas serverless `api/*` reutilizan este mismo motor.
