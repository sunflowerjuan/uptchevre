import express from "express";
import cors from "cors";
import { areAutomataEquivalent } from "./automata-equivalence.js";
import type { AutomataData } from "./types.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "uptchevre-backend" });
});

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

