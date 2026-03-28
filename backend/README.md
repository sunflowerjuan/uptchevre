# UPTCHEVERE - backend

Backend Node.js + Express encargado del calculo formal del proyecto.

Este servicio recibe automatas finitos construidos en la interfaz y ejecuta sobre ellos operaciones teoricas como clasificacion, simulacion mediante la funcion de transicion extendida y equivalencia entre automatas deterministas.

## Objetivo

El backend centraliza la logica formal para que la interfaz no tenga que reimplementar:

- clasificacion de automatas: `DFA`, `NFA`, `NFA_EPSILON`
- construccion de alfabeto de entrada
- calculo de `move`
- calculo de clausura-`ε`
- construccion paso a paso de `delta*`
- trazas de aceptacion y rechazo
- equivalencia entre DFA mediante producto de estados

## Arquitectura del proyecto

La arquitectura del backend esta organizada por responsabilidad teorica:

- `src/server.ts`
  Punto de entrada HTTP. Configura Express, `cors`, parsing JSON, validacion minima del body y serializacion de respuestas.

- `src/types.ts`
  Contratos del dominio. Define estados, transiciones, automatas, resultados de analisis, pasos de `delta*`, trazas y respuestas.

- `src/automata-analysis.ts`
  Nucleo del analisis estructural. Implementa normalizacion de simbolos, deteccion de `ε`, alfabeto de entrada, indexacion de transiciones, `move`, clausura-`ε` y clasificacion del automata.

- `src/automata-simulation.ts`
  Nucleo de simulacion. Construye la funcion de transicion extendida `delta*`, calcula aceptacion y enumera trazas concretas de caminos aceptados y rechazados.

- `src/automata-utils.ts`
  Utilidades para el caso determinista. Prepara estructuras compactas para trabajar con `δ` cuando el automata debe comportarse como DFA.

- `src/automata-equivalence.ts`
  Compara dos DFA por medio de un recorrido BFS del producto de estados y produce una palabra testigo cuando no son equivalentes.

### Capas internas

- Capa HTTP
  Vive en `src/server.ts`. Recibe requests, valida los datos minimos y responde JSON.

- Capa de analisis formal
  Vive principalmente en `src/automata-analysis.ts`. Interpreta `Q`, `Σ`, `δ`, `q0`, `F`, `ε`, `move` y clausura-`ε`.

- Capa de simulacion
  Vive en `src/automata-simulation.ts`. Aplica `δ*` a una palabra y devuelve la evolucion paso a paso.

- Capa de utilidades deterministas
  Vive en `src/automata-utils.ts` y `src/automata-equivalence.ts`. Prepara `δ` y ejecuta equivalencia.

## Flujo interno

1. El cliente envia un `AutomataData`.
2. El servidor valida la forma minima del body.
3. La capa formal normaliza simbolos y detecta si hay `ε`.
4. Se determina si el automata es `DFA`, `NFA` o `NFA_EPSILON`.
5. Segun el endpoint:
   - `analyze` genera descripcion formal.
   - `simulate` aplica `delta*` a una palabra.
   - `equivalent` compara dos DFA y produce un contraejemplo si no son equivalentes.

## Modelo de datos

### `AutomataState`

Representa un estado del automata.

Campos relevantes:

- `id`
  Identificador tecnico interno.

- `label`
  Nombre visible del estado.

- `isInitial`
  Indica pertenencia al conjunto de estados iniciales.

- `isAccept`
  Indica pertenencia al conjunto `F`.

### `AutomataTransition`

Representa una transicion dirigida.

Campos relevantes:

- `from`
  Estado origen.

- `to`
  Estado destino.

- `symbol`
  Simbolo consumido.

Convencion importante:

- `""` representa `ε`.
- cualquier otro string representa un simbolo ordinario del alfabeto.

### `AutomataData`

Representa el automata completo:

- `states`
  Conjunto `Q`.

- `transitions`
  Relacion operativa a partir de la cual se construye `δ`.

- `alphabet`
  Alfabeto `Σ`.

Ejemplo minimo:

```json
{
  "states": [
    {
      "id": "q0",
      "label": "q0",
      "x": 100,
      "y": 100,
      "isInitial": true,
      "isAccept": false
    },
    {
      "id": "q1",
      "label": "q1",
      "x": 260,
      "y": 100,
      "isInitial": false,
      "isAccept": true
    }
  ],
  "transitions": [
    {
      "id": "t1",
      "from": "q0",
      "to": "q1",
      "symbol": "a"
    }
  ],
  "alphabet": ["a"]
}
```

## Scripts

```bash
npm run dev
npm run build
npm run start
```

## Endpoints

Todos los endpoints JSON aceptan y responden con `application/json`.

Base URL local:

```text
http://localhost:4000
```

### `GET /api/health`

Verifica que el servicio este arriba.

#### Headers

- ninguno obligatorio

#### Body

- no aplica

#### Response 200

```json
{
  "ok": true,
  "service": "uptchevre-backend"
}
```

Uso tipico:

```http
GET /api/health
```

---

### `POST /api/automata/analyze`

Analiza la estructura formal de un automata.

#### Headers

```http
Content-Type: application/json
Accept: application/json
```

#### Body

Forma del body:

```ts
{
  automaton: AutomataData
}
```

Ejemplo:

```json
{
  "automaton": {
    "states": [
      {
        "id": "q0",
        "label": "q0",
        "x": 100,
        "y": 100,
        "isInitial": true,
        "isAccept": false
      }
    ],
    "transitions": [
      {
        "id": "t1",
        "from": "q0",
        "to": "q1",
        "symbol": "a"
      }
    ],
    "alphabet": ["a"]
  }
}
```

#### Response 200

Forma de la respuesta:

```ts
{
  ok: true
  result: AutomataAnalysisResult
}
```

Ejemplo:

```json
{
  "ok": true,
  "result": {
    "automatonType": "DFA",
    "alphabet": ["a"],
    "states": [],
    "initialStates": [],
    "acceptStates": [],
    "transitions": [],
    "determinismIssues": [],
    "eClosures": [],
    "supportsEpsilon": false
  }
}
```

Campos importantes de `result`:

- `automatonType`
  Tipo identificado: `DFA`, `NFA` o `NFA_EPSILON`.

- `alphabet`
  Alfabeto de entrada sin `ε`.

- `states`
  Estados preparados para la vista formal.

- `initialStates`
  Subconjunto de estados iniciales.

- `acceptStates`
  Subconjunto `F`.

- `transitions`
  Lista normalizada de transiciones, incluyendo `displaySymbol`.

- `determinismIssues`
  Conflictos que impiden tratar el automata como DFA.

- `eClosures`
  Clausura-`ε` por estado.

#### Response 400

```json
{
  "ok": false,
  "error": "Debes enviar un automata en el body."
}
```

---

### `POST /api/automata/simulate`

Aplica la funcion de transicion extendida `delta*` sobre una palabra.

#### Headers

```http
Content-Type: application/json
Accept: application/json
```

#### Body

Forma del body:

```ts
{
  automaton: AutomataData
  word: string
}
```

Ejemplo:

```json
{
  "automaton": {
    "states": [],
    "transitions": [],
    "alphabet": []
  },
  "word": "abba"
}
```

#### Response 200

Forma de la respuesta:

```ts
{
  ok: true
  result: AutomataSimulationResult
}
```

Ejemplo:

```json
{
  "ok": true,
  "result": {
    "automatonType": "NFA",
    "accepted": true,
    "word": "abba",
    "deltaStar": [],
    "acceptedPaths": [],
    "rejectedPaths": []
  }
}
```

Campos importantes de `result`:

- `automatonType`
  Tipo identificado antes de simular.

- `accepted`
  Veredicto final sobre la palabra.

- `word`
  Cadena procesada.

- `deltaStar`
  Secuencia serializada de `delta*`.

- `acceptedPaths`
  Caminos concretos que terminan en aceptacion.

- `rejectedPaths`
  Caminos concretos que terminan en rechazo.

#### Response 400

```json
{
  "ok": false,
  "error": "Debes enviar un automata y una palabra en el body."
}
```

---

### `POST /api/automata/equivalent`

Compara dos automatas deterministas.

#### Headers

```http
Content-Type: application/json
Accept: application/json
```

#### Body

Forma del body:

```ts
{
  automatonA: AutomataData
  automatonB: AutomataData
}
```

Ejemplo:

```json
{
  "automatonA": {
    "states": [],
    "transitions": [],
    "alphabet": []
  },
  "automatonB": {
    "states": [],
    "transitions": [],
    "alphabet": []
  }
}
```

#### Response 200

Forma de la respuesta:

```ts
{
  ok: true
  result: {
    equivalent: boolean
    counterExampleWord?: string
    error?: string
  }
}
```

Ejemplo:

```json
{
  "ok": true,
  "result": {
    "equivalent": false,
    "counterExampleWord": "ab"
  }
}
```

#### Error funcional

Si alguno de los automatas no es determinista o falta estado inicial, el endpoint responde `200` con `ok: true`, pero `result.error` explica por que no pudo ejecutarse la comparacion formal.

Ejemplo:

```json
{
  "ok": true,
  "result": {
    "equivalent": false,
    "error": "Al menos uno de los automatas no es determinista."
  }
}
```

#### Response 400

```json
{
  "ok": false,
  "error": "Debes enviar autómata A y autómata B en el body."
}
```

## Archivos clave

### `src/types.ts`

Concentra la taxonomia de tipos del dominio. Es el mejor punto de entrada para entender:

- que estructura tiene un estado
- que estructura tiene una transicion
- como se representa un automata completo
- como se serializan `delta*`, trazas y resultados

### `src/automata-analysis.ts`

Define la lectura teorica del automata. Aqui se implementan:

- `ε` como transicion vacia
- `Σ` como alfabeto sin epsilon
- `move(S, a)`
- clausura-`ε`
- deteccion de no determinismo
- clasificacion del automata

### `src/automata-simulation.ts`

Implementa el procesamiento de palabras:

- construccion de `delta*`
- actualizacion de conjuntos alcanzables por prefijo
- aceptacion final
- enumeracion de caminos concretos

### `src/automata-utils.ts`

Agrupa utilidades pensadas para el caso determinista:

- validacion de determinismo
- construccion de estructura compacta para `δ`
- soporte a equivalencia

### `src/automata-equivalence.ts`

Implementa el algoritmo de equivalencia de DFA:

- producto de estados
- BFS sobre pares `(qA, qB)`
- deteccion de divergencia de aceptacion
- reconstruccion de palabra testigo

### `src/server.ts`

Expone la API HTTP del servicio:

- `GET /api/health`
- `POST /api/automata/analyze`
- `POST /api/automata/simulate`
- `POST /api/automata/equivalent`

## Metodos clave

### `getInputAlphabet`

Archivo: `src/automata-analysis.ts`

Responsabilidad:

- construir `Σ`
- excluir `ε` del alfabeto de entrada
- inferir simbolos desde las transiciones si no llega un alfabeto explicito

### `buildTransitionMap`

Archivo: `src/automata-analysis.ts`

Responsabilidad:

- indexar transiciones por pareja `(estado, simbolo)`
- facilitar la implementacion de `δ`, `move` y clausura-`ε`

### `epsilonClosure`

Archivo: `src/automata-analysis.ts`

Responsabilidad:

- calcular el conjunto de estados alcanzables usando solo `ε`
- servir como base del caso `NFA_EPSILON`

### `move`

Archivo: `src/automata-analysis.ts`

Responsabilidad:

- calcular el conjunto de estados alcanzables consumiendo exactamente un simbolo

### `detectAutomatonType`

Archivo: `src/automata-analysis.ts`

Responsabilidad:

- decidir si el automata es `DFA`, `NFA` o `NFA_EPSILON`

Regla usada:

1. Si aparece `ε`, el tipo es `NFA_EPSILON`.
2. Si no aparece `ε` pero hay no determinismo, el tipo es `NFA`.
3. En cualquier otro caso, el tipo es `DFA`.

### `analyzeAutomaton`

Archivo: `src/automata-analysis.ts`

Responsabilidad:

- producir el objeto formal que consume la interfaz
- devolver componentes importantes de la 5-tupla
- devolver transiciones y clausuras necesarias para la visualizacion

Salida principal:

- `automatonType`
- `alphabet`
- `states`
- `initialStates`
- `acceptStates`
- `transitions`
- `determinismIssues`
- `eClosures`
- `supportsEpsilon`

### `buildDeltaStar`

Archivo: `src/automata-simulation.ts`

Responsabilidad:

- construir paso a paso la evolucion de `delta*`
- registrar prefijos consumidos
- separar `reachable` y `closure`

Observacion:

- para `DFA`, `reachable` y `closure` convergen a un unico estado
- para `NFA`, `closure` coincide con `reachable` porque no hay `ε`
- para `NFA_EPSILON`, `closure` representa el resultado despues de expandir por `ε`

### `enumeratePaths`

Archivo: `src/automata-simulation.ts`

Responsabilidad:

- construir recorridos concretos de aceptacion y rechazo
- complementar la lectura de `delta*`
- explicar visualmente la ramificacion en `NFA` y `NFA_EPSILON`

### `simulateAutomaton`

Archivo: `src/automata-simulation.ts`

Responsabilidad:

- integrar clasificacion, `delta*`, aceptacion y trazas
- devolver un resultado listo para simulacion visual

Secuencia interna:

1. analiza el automata
2. construye `delta*` para la palabra
3. toma el ultimo conjunto alcanzado
4. verifica interseccion con `F`
5. enumera caminos concretos para explicacion visual

### `checkDeterminism`

Archivo: `src/automata-utils.ts`

Responsabilidad:

- verificar si una pareja `(estado, simbolo)` tiene mas de un destino
- decidir si el automata puede tratarse como DFA

### `buildDfaStructure`

Archivo: `src/automata-utils.ts`

Responsabilidad:

- serializar `δ` como mapa compacto
- preparar el automata para el algoritmo de equivalencia

### `areAutomataEquivalent`

Archivo: `src/automata-equivalence.ts`

Responsabilidad:

- comparar dos DFA mediante BFS sobre el producto de estados
- reconstruir una palabra testigo si encuentra diferencia de aceptacion

Restriccion:

- este metodo asume comportamiento determinista; si el automata no cumple las condiciones, devuelve un error funcional en `result`

## Headers y consideraciones generales

- `Content-Type: application/json`
  Obligatorio en los `POST`.

- `Accept: application/json`
  Recomendado para clientes HTTP.

- `cors()`
  El servicio permite consumo desde la interfaz en desarrollo y despliegue.

- `express.json({ limit: "1mb" })`
  El body JSON tiene limite de 1 MB.

## Convenciones importantes del proyecto

- epsilon se representa como `""` en calculo y como `ε` en visualizacion
- el servicio puede trabajar con automatas incompletos
- la equivalencia esta pensada para DFA
- `delta*` se devuelve como estructura serializada para ser explicada paso a paso en la interfaz

## Recomendacion de lectura

Si entras por primera vez al backend, lee en este orden:

1. `src/types.ts`
2. `src/automata-analysis.ts`
3. `src/automata-simulation.ts`
4. `src/automata-utils.ts`
5. `src/automata-equivalence.ts`
6. `src/server.ts`
