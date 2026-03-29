import type { GrammarProductionInput } from "../../backend/src/types.js";

type RequestLike = {
  method?: string;
  body?: {
    terminals?: string[];
    nonTerminals?: string[];
    startSymbol?: string;
    productions?: GrammarProductionInput[];
    word?: string;
  };
};

type ResponseLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { json: (body: unknown) => void };
};

export default async function handler(request: RequestLike, response: ResponseLike) {
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

  if (
    !Array.isArray(request.body?.terminals) ||
    !Array.isArray(request.body?.nonTerminals) ||
    typeof request.body?.startSymbol !== "string" ||
    !Array.isArray(request.body?.productions) ||
    typeof request.body?.word !== "string"
  ) {
    response.status(400).json({
      ok: false,
      error: "Debes enviar terminales, no terminales, simbolo inicial, producciones y palabra.",
    });
    return;
  }

  const { analyzeManualGrammar } = await import("../../backend/src/grammar-analysis.js");
  const result = analyzeManualGrammar({
    terminals: request.body.terminals,
    nonTerminals: request.body.nonTerminals,
    startSymbol: request.body.startSymbol,
    productions: request.body.productions,
    word: request.body.word,
  });

  response.status(200).json({ ok: true, result });
}
