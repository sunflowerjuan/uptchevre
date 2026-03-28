import express from "express";
import cors from "cors";
import { analyzeAutomaton } from "./automata-analysis.js";
import { areAutomataEquivalent } from "./automata-equivalence.js";
import { simulateAutomaton } from "./automata-simulation.js";
import type { AutomataData } from "./types.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));





app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "uptchevre-backend" });
});
//describe la estructura del autómata, su tipo (DFA, NFA o NFA-e) y su alfabeto.
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

/** aplica FTE a una palabra dada un autómata, y devuelve la traza completa 
 de estados alcanzados en cada paso, incluyendo los estados */
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


//compara dos DFA mediante producto de estados
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

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});

