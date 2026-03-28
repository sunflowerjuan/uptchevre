import { useState, useCallback, useEffect, useRef } from "react";
import { EPSILON_SYMBOL, normalizeSymbol } from "@/lib/automata";

export interface AutomataState {
  id: string;
  label: string;
  x: number;
  y: number;
  isInitial: boolean;
  isAccept: boolean;
}

export interface AutomataTransition {
  id: string;
  from: string;
  to: string;
  symbol: string;
}

export interface AutomataData {
  states: AutomataState[];
  transitions: AutomataTransition[];
  alphabet: string[];
}

export type EditorTool = "select" | "addState" | "addTransition" | "delete";

/** Parse multi-symbol notation: "1+0", "1|0", "1,0" → ["1","0"] */
export function parseSymbols(input: string): string[] {
  if (input.trim().length === 0) {
    return [EPSILON_SYMBOL];
  }

  return input
    .split(/[+|,]/)
    .map((s) => normalizeSymbol(s))
    .filter((s) => s.length > 0 || s === EPSILON_SYMBOL);
}

const MAX_HISTORY = 80;

export function useAutomataEditor() {
  const [data, setData] = useState<AutomataData>({
    states: [],
    transitions: [],
    alphabet: [],
  });
  const [selectedTool, setSelectedTool] = useState<EditorTool>("select");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [transitionStart, setTransitionStart] = useState<string | null>(null);
  const [stateCounter, setStateCounter] = useState(0);

  // Undo / Redo
  const historyRef = useRef<AutomataData[]>([]);
  const futureRef = useRef<AutomataData[]>([]);
  const skipHistoryRef = useRef(false);

  const pushHistory = useCallback((prev: AutomataData) => {
    if (skipHistoryRef.current) return;
    historyRef.current = [...historyRef.current.slice(-MAX_HISTORY), prev];
    futureRef.current = [];
  }, []);

  const setDataWithHistory = useCallback(
    (updater: AutomataData | ((prev: AutomataData) => AutomataData)) => {
      setData((prev) => {
        pushHistory(prev);
        return typeof updater === "function" ? updater(prev) : updater;
      });
    },
    [pushHistory]
  );

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setData((current) => {
      futureRef.current = [...futureRef.current, current];
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    setData((current) => {
      historyRef.current = [...historyRef.current, current];
      return next;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  const addState = useCallback(
    (x: number, y: number) => {
      const id = `q${stateCounter}`;
      const newState: AutomataState = {
        id,
        label: `q${stateCounter}`,
        x,
        y,
        isInitial: data.states.length === 0,
        isAccept: false,
      };
      setDataWithHistory((prev) => ({
        ...prev,
        states: [...prev.states, newState],
      }));
      setStateCounter((c) => c + 1);
    },
    [stateCounter, data.states.length, setDataWithHistory]
  );

  const moveState = useCallback((id: string, x: number, y: number) => {
    // Move doesn't push history (too noisy during drag)
    setData((prev) => ({
      ...prev,
      states: prev.states.map((s) => (s.id === id ? { ...s, x, y } : s)),
    }));
  }, []);

  const commitMove = useCallback((snapshot: AutomataData) => {
    // Called on mouseUp after drag — push the pre-drag snapshot
    historyRef.current = [...historyRef.current.slice(-MAX_HISTORY), snapshot];
    futureRef.current = [];
  }, []);

  const toggleAccept = useCallback(
    (id: string) => {
      setDataWithHistory((prev) => ({
        ...prev,
        states: prev.states.map((s) =>
          s.id === id ? { ...s, isAccept: !s.isAccept } : s
        ),
      }));
    },
    [setDataWithHistory]
  );

  const setInitial = useCallback(
    (id: string) => {
      setDataWithHistory((prev) => ({
        ...prev,
        states: prev.states.map((s) => ({ ...s, isInitial: s.id === id })),
      }));
    },
    [setDataWithHistory]
  );

  const renameState = useCallback(
    (id: string, newLabel: string) => {
      if (!newLabel.trim()) return;
      setDataWithHistory((prev) => ({
        ...prev,
        states: prev.states.map((s) =>
          s.id === id ? { ...s, label: newLabel.trim() } : s
        ),
      }));
    },
    [setDataWithHistory]
  );

  const addTransition = useCallback(
    (from: string, to: string, symbolInput: string) => {
      const symbols = parseSymbols(symbolInput);
      if (symbols.length === 0) return;
      setDataWithHistory((prev) => {
        const newTransitions = [...prev.transitions];
        for (const symbol of symbols) {
          const normalized = normalizeSymbol(symbol);
          const symbolKey = normalized === EPSILON_SYMBOL ? "epsilon" : normalized;
          const id = `t_${from}_${to}_${symbolKey}`;
          const exists = newTransitions.some(
            (t) => t.from === from && t.to === to && normalizeSymbol(t.symbol) === normalized
          );
          if (!exists) {
            newTransitions.push({ id, from, to, symbol: normalized });
          }
        }
        return { ...prev, transitions: newTransitions };
      });
    },
    [setDataWithHistory]
  );

  const editTransitionSymbols = useCallback(
    (from: string, to: string, oldSymbols: string[], newInput: string) => {
      const newSymbols = parseSymbols(newInput);
      if (newSymbols.length === 0) return;
      setDataWithHistory((prev) => {
        // Remove old transitions for this pair
        let transitions = prev.transitions.filter(
          (t) => !(t.from === from && t.to === to && oldSymbols.includes(t.symbol))
        );
        // Add new
        for (const symbol of newSymbols) {
          const normalized = normalizeSymbol(symbol);
          const symbolKey = normalized === EPSILON_SYMBOL ? "epsilon" : normalized;
          const id = `t_${from}_${to}_${symbolKey}`;
          if (!transitions.some((t) => t.id === id)) {
            transitions.push({ id, from, to, symbol: normalized });
          }
        }
        return { ...prev, transitions };
      });
    },
    [setDataWithHistory]
  );

  const deleteState = useCallback(
    (id: string) => {
      setDataWithHistory((prev) => ({
        ...prev,
        states: prev.states.filter((s) => s.id !== id),
        transitions: prev.transitions.filter(
          (t) => t.from !== id && t.to !== id
        ),
      }));
    },
    [setDataWithHistory]
  );

  const deleteTransition = useCallback(
    (id: string) => {
      setDataWithHistory((prev) => ({
        ...prev,
        transitions: prev.transitions.filter((t) => t.id !== id),
      }));
    },
    [setDataWithHistory]
  );

  const clearAll = useCallback(() => {
    setDataWithHistory(() => ({
      states: [],
      transitions: [],
      alphabet: [],
    }));
    setStateCounter(0);
    setSelectedNode(null);
    setTransitionStart(null);
  }, [setDataWithHistory]);

  const loadAutomaton = useCallback(
    (nextData: AutomataData) => {
      setDataWithHistory({
        states: nextData.states.map((state) => ({ ...state })),
        transitions: nextData.transitions.map((transition) => ({ ...transition })),
        alphabet: [...nextData.alphabet],
      });

      const nextCounter = nextData.states.reduce((maxCounter, state) => {
        const match = /^q(\d+)$/.exec(state.id);
        if (!match) return maxCounter;
        return Math.max(maxCounter, Number(match[1]) + 1);
      }, 0);

      setStateCounter(nextCounter);
      setSelectedNode(null);
      setTransitionStart(null);
    },
    [setDataWithHistory]
  );

  return {
    data,
    selectedTool,
    setSelectedTool,
    selectedNode,
    setSelectedNode,
    transitionStart,
    setTransitionStart,
    addState,
    moveState,
    commitMove,
    toggleAccept,
    setInitial,
    renameState,
    addTransition,
    editTransitionSymbols,
    deleteState,
    deleteTransition,
    clearAll,
    loadAutomaton,
    undo,
    redo,
    canUndo: historyRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
