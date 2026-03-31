import express from "express";
import cors from "cors";
import { analyzeAutomaton } from "./automata-analysis.js";
import { areAutomataEquivalent } from "./automata-equivalence.js";
import { minimizeDfa } from "./automata-minimization.js";
import { simulateAutomaton } from "./automata-simulation.js";
import { transformNfaToDfa } from "./automata-transformation.js";
import { analyzeAutomatonEquivalentGrammar, analyzeManualGrammar } from "./grammar-analysis.js";
import type { AutomataData, GrammarProductionInput } from "./types.js";

/**
 * Servidor HTTP del backend local.
 *
 * Propósito:
 * Exponer el motor lógico de teoría formal mediante una API simple durante
 * desarrollo local. En despliegue, esta misma lógica puede publicarse a través
 * de funciones serverless, pero este servidor sigue siendo la puerta de
 * entrada directa para pruebas, depuración e integración local con el
 * frontend.
 */
const app = express();
const PORT = Number(process.env.PORT ?? 4000);

/**
 * Middleware base del servidor.
 *
 * Responsabilidades:
 * - habilitar CORS para permitir consumo desde el frontend en desarrollo;
 * - parsear cuerpos JSON con un límite razonable para evitar payloads
 *   desproporcionados.
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
 * Convierte un AFND (`NFA` o `NFA_EPSILON`) a un AFD mediante construcción
 * de subconjuntos.
 *
 * Flujo:
 * - valida la presencia del autómata en el body;
 * - delega al algoritmo de determinización;
 * - devuelve el AFD resultante y la tabla explicativa de construcción.
 */
app.post("/api/automata/transform", (req, res) => {
  const body = req.body as { automaton?: AutomataData };
  if (!body?.automaton) {
    res.status(400).json({
      ok: false,
      error: "Debes enviar un automata en el body.",
    });
    return;
  }

  const result = transformNfaToDfa(body.automaton);
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
 * Minimiza un DFA completo.
 *
 * Flujo:
 * - valida la presencia del autómata;
 * - delega al algoritmo de minimización;
 * - captura errores de precondiciones como no determinismo o transiciones
 *   faltantes y los devuelve al cliente.
 */
app.post("/api/automata/minimize", (req, res) => {
  const body = req.body as { automaton?: AutomataData };
  if (!body?.automaton) {
    res.status(400).json({
      ok: false,
      error: "Debes enviar un automata en el body.",
    });
    return;
  }

  try {
    const result = minimizeDfa(body.automaton);
    res.json({ ok: true, result });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible minimizar el DFA.",
    });
  }
});

/**
 * Analiza una gramática regular ingresada manualmente.
 *
 * Flujo:
 * - valida terminales, no terminales, símbolo inicial, producciones y palabra;
 * - delega la validación y análisis al motor de gramáticas;
 * - devuelve validación y, si aplica, la derivación de la palabra.
 */
app.post("/api/grammar/manual", (req, res) => {
  const body = req.body as {
    terminals?: string[];
    nonTerminals?: string[];
    startSymbol?: string;
    productions?: GrammarProductionInput[];
    word?: string;
    strictRules?: boolean;
  };

  if (
    !Array.isArray(body?.terminals) ||
    !Array.isArray(body?.nonTerminals) ||
    typeof body?.startSymbol !== "string" ||
    !Array.isArray(body?.productions) ||
    typeof body?.word !== "string"
  ) {
    res.status(400).json({
      ok: false,
      error: "Debes enviar terminales, no terminales, simbolo inicial, producciones y palabra.",
    });
    return;
  }

  const result = analyzeManualGrammar({
    terminals: body.terminals,
    nonTerminals: body.nonTerminals,
    startSymbol: body.startSymbol,
    productions: body.productions,
    word: body.word,
    strictRules: body.strictRules,
  });

  res.json({ ok: true, result });
});

/**
 * Deriva la gramática regular equivalente a un autómata y analiza una palabra.
 *
 * Flujo:
 * - valida que lleguen autómata y palabra;
 * - genera la gramática equivalente desde el autómata;
 * - analiza la palabra sobre la gramática resultante.
 */
app.post("/api/grammar/equivalent", (req, res) => {
  const body = req.body as { automaton?: AutomataData; word?: string; strictRules?: boolean };

  if (!body?.automaton || typeof body.word !== "string") {
    res.status(400).json({
      ok: false,
      error: "Debes enviar un automata y la palabra a evaluar.",
    });
    return;
  }

  const result = analyzeAutomatonEquivalentGrammar({
    automaton: body.automaton,
    word: body.word,
    strictRules: body.strictRules,
  });

  res.json({ ok: true, result });
});

/**
 * Arranca el servidor HTTP local.
 */
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});
