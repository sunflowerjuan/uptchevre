import { areAutomataEquivalent } from "../../backend/src/automata-equivalence.js";
import type { AutomataData } from "../../backend/src/types.js";

type RequestLike = {
  method?: string;
  body?: { automatonA?: AutomataData; automatonB?: AutomataData };
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

  if (!request.body?.automatonA || !request.body?.automatonB) {
    response.status(400).json({
      ok: false,
      error: "Debes enviar automata A y automata B en el body.",
    });
    return;
  }

  const result = areAutomataEquivalent(request.body.automatonA, request.body.automatonB);
  response.status(200).json({ ok: true, result });
}
