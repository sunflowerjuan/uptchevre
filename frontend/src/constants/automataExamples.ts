import type { AutomataData } from "@/hooks/useAutomataEditor";

export interface AutomataExample {
  id: string;
  title: string;
  description: string;
  tryWords: string[];
  data: AutomataData;
}

export const AUTOMATA_EXAMPLES: AutomataExample[] = [
  {
    id: "ends-with-1",
    title: "Palabras binarias que terminan en 1",
    description:
      "AFD basico para explorar estados, transiciones y simulacion con un criterio de aceptacion sencillo.",
    tryWords: ["1", "101", "100"],
    data: {
      alphabet: ["0", "1"],
      states: [
        { id: "q0", label: "q0", x: 180, y: 180, isInitial: true, isAccept: false },
        { id: "q1", label: "q1", x: 380, y: 180, isInitial: false, isAccept: true },
      ],
      transitions: [
        { id: "t_q0_q0_0", from: "q0", to: "q0", symbol: "0" },
        { id: "t_q0_q1_1", from: "q0", to: "q1", symbol: "1" },
        { id: "t_q1_q0_0", from: "q1", to: "q0", symbol: "0" },
        { id: "t_q1_q1_1", from: "q1", to: "q1", symbol: "1" },
      ],
    },
  },
  {
    id: "even-zeros",
    title: "Cantidad par de 0s",
    description:
      "Ejemplo util para practicar simulacion paso a paso y confirmar como cambia el estado de aceptacion.",
    tryWords: ["", "11", "1010", "100"],
    data: {
      alphabet: ["0", "1"],
      states: [
        { id: "q0", label: "par", x: 180, y: 220, isInitial: true, isAccept: true },
        { id: "q1", label: "impar", x: 400, y: 220, isInitial: false, isAccept: false },
      ],
      transitions: [
        { id: "t_q0_q1_0", from: "q0", to: "q1", symbol: "0" },
        { id: "t_q0_q0_1", from: "q0", to: "q0", symbol: "1" },
        { id: "t_q1_q0_0", from: "q1", to: "q0", symbol: "0" },
        { id: "t_q1_q1_1", from: "q1", to: "q1", symbol: "1" },
      ],
    },
  },
];
