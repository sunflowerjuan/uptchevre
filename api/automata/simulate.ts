import { simulateAutomaton } from "../../backend/src/automata-simulation.js";
import type { AutomataData } from "../../backend/src/types.js";

type RequestLike = {
  method?: string;
  body?: { automaton?: AutomataData; word?: string };
};

type ResponseLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { json: (body: unknown) => void };
};

export default function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.status(200).json({ ok: true });
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Metodo no permitido." });
    return;
  }

  if (!request.body?.automaton || typeof request.body.word !== "string") {
    response.status(400).json({ ok: false, error: "Debes enviar un automata y una palabra en el body." });
    return;
  }

  const result = simulateAutomaton(request.body.automaton, request.body.word);
  response.status(200).json({ ok: true, result });
}
