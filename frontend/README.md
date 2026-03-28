# Frontend

Aplicación React + Vite encargada del editor visual y de la presentación de resultados formales.

## Responsabilidades

- Editar autómatas en el canvas.
- Mantener el modelo visual de estados y transiciones.
- Solicitar análisis y simulación.
- Mostrar:
  - 5-tupla
  - matriz de transición
  - definiciones explícitas de `δ`
  - clausura-ε
  - desarrollo visible de `δ*`
  - trazas de aceptación y rechazo

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run test
```

## Archivos clave

- `src/hooks/useAutomataEditor.ts`
  Modelo base del editor y operaciones sobre estados/transiciones.

- `src/lib/automata.ts`
  Convenciones de símbolos y snapshot teórico.

- `src/lib/automata-api.ts`
  Cliente HTTP y tipos serializados.

- `src/components/FormalismPanel.tsx`
  Presentación del formalismo del autómata.

- `src/components/StringSimulator.tsx`
  Presentación de `δ*` y de las trazas.

- `src/pages/Index.tsx`
  Orquestación general de editor, paneles y consultas.

## Flujo técnico

1. El usuario construye un autómata en el editor.
2. El frontend genera un snapshot teórico sin coordenadas.
3. Se consulta el análisis cuando cambian elementos formales relevantes.
4. La simulación se ejecuta sobre una palabra concreta.
5. La interfaz representa los resultados y las trazas visuales.

## Notas de mantenimiento

- Las coordenadas del canvas no forman parte del cálculo formal.
- El símbolo `ε` se muestra visualmente, pero internamente se normaliza a `""`.
- El botón `Paso` revela de manera progresiva `δ*` y las trazas.
