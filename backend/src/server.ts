import express from "express";
import cors from "cors";
import { analyzeAutomaton } from "./automata-analysis.js";
import { areAutomataEquivalent } from "./automata-equivalence.js";
import { simulateAutomaton } from "./automata-simulation.js";
import type { AutomataData } from "./types.js";

/**
 * Servidor HTTP del backend local.
 *
 * Propósito:
 * Exponer el motor lógico de teoría formal mediante una API simple durante
 * desarrollo local. En despliegue, esta misma lógica puede publicarse a través
 * de funciones serverless, pero este servidor sigue siendo la puerta de
 * entrada directa para pruebas y desarrollo.
 */
const app = express();
const PORT = Number(process.env.PORT ?? 4000);

/**
 * Middleware base.
 *
 * - `cors()` permite llamadas desde el frontend en desarrollo.
 * - `express.json()` habilita el parseo del body JSON y limita su tamaño para
 *   evitar cargas desproporcionadas.
 */
app.use(cors());
app.use(express.json({ limit: "1mb" }));

/**
 * Endpoint de salud.
 *
 * Propósito:
 * Confirmar que el proceso del backend está levantado y respondiendo.
 */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "uptchevre-backend" });
});

/**
 * Analiza la estructura formal de un autómata.
 *
 * Flujo:
 * - valida que el body incluya `automaton`;
 * - delega el análisis al motor formal;
 * - devuelve un resultado serializable consumible por la interfaz.
 */
app.post("/api/automata/analyze", (req, res) => {
  const body = req.body as { automaton?: AutomataData };
  if (!body?.automaton) {
    res.status(400).json({
      ok: false,
      error: "Debes enviar un automata en el body.",
    });
    return;
  }

  const result = analyzeAutomaton(body.automaton);
  res.json({ ok: true, result });
});

/**
 * Simula una palabra sobre un autómata.
 *
 * Flujo:
 * - valida autómata y palabra;
 * - ejecuta la simulación con función de transición extendida;
 * - devuelve trazas y veredicto de aceptación.
 */
app.post("/api/automata/simulate", (req, res) => {
  const body = req.body as { automaton?: AutomataData; word?: string };
  if (!body?.automaton || typeof body.word !== "string") {
    res.status(400).json({
      ok: false,
      error: "Debes enviar un automata y una palabra en el body.",
    });
    return;
  }

  const result = simulateAutomaton(body.automaton, body.word);
  res.json({ ok: true, result });
});

/**
 * Compara dos autómatas deterministas por equivalencia de lenguaje.
 *
 * Flujo:
 * - valida que ambos autómatas vengan en el body;
 * - delega al algoritmo de producto de estados;
 * - devuelve equivalencia o palabra contraejemplo.
 */
app.post("/api/automata/equivalent", (req, res) => {
  const body = req.body as { automatonA?: AutomataData; automatonB?: AutomataData };
  if (!body?.automatonA || !body?.automatonB) {
    res.status(400).json({
      ok: false,
      error: "Debes enviar autómata A y autómata B en el body.",
    });
    return;
  }

  const result = areAutomataEquivalent(body.automatonA, body.automatonB);
  res.json({ ok: true, result });
});

/**
 * Arranca el servidor HTTP.
 *
 * Efecto secundario:
 * - Abre un puerto local y deja el proceso escuchando solicitudes.
 */
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});
