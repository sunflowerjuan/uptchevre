import type { AutomataData } from "@/hooks/useAutomataEditor";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FormalismPanelProps {
  data: AutomataData;
}

/** Estados agrupados por nombre (label): dos nodos con el mismo nombre se consideran el mismo estado en el formalismo. */
function useFormalismByLabel(data: AutomataData) {
  const { states, transitions } = data;
  const idToLabel = new Map(states.map((s) => [s.id, s.label]));

  const uniqueLabels = [...new Set(states.map((s) => s.label))].sort();

  const byLabel = new Map<
    string,
    { isInitial: boolean; isAccept: boolean; stateIds: string[] }
  >();
  for (const s of states) {
    const cur = byLabel.get(s.label);
    if (!cur) {
      byLabel.set(s.label, {
        isInitial: s.isInitial,
        isAccept: s.isAccept,
        stateIds: [s.id],
      });
    } else {
      cur.stateIds.push(s.id);
      cur.isInitial = cur.isInitial || s.isInitial;
      cur.isAccept = cur.isAccept || s.isAccept;
    }
  }

  const initialStateLabel =
    uniqueLabels.find((label) => byLabel.get(label)?.isInitial) ?? null;
  const acceptLabels = uniqueLabels.filter((label) => byLabel.get(label)?.isAccept);

  function getTargetLabels(fromLabel: string, symbol: string): string[] {
    const meta = byLabel.get(fromLabel);
    if (!meta) return [];
    const targetLabels = new Set<string>();
    for (const fromId of meta.stateIds) {
      for (const t of transitions) {
        if (t.from === fromId && t.symbol === symbol) {
          const toLabel = idToLabel.get(t.to) ?? "?";
          targetLabels.add(toLabel);
        }
      }
    }
    return [...targetLabels].sort();
  }

  return {
    uniqueLabels,
    initialStateLabel,
    acceptLabels,
    byLabel,
    getTargetLabels,
  };
}

export function FormalismPanel({ data }: FormalismPanelProps) {
  const { states, transitions } = data;
  const alphabet = [...new Set(transitions.map((t) => t.symbol))].sort();
  const {
    uniqueLabels,
    initialStateLabel,
    acceptLabels,
    byLabel,
    getTargetLabels,
  } = useFormalismByLabel(data);

  if (states.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-muted-foreground">
          Agrega estados al canvas para ver el formalismo aquí.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Definición Formal
        </h3>

        <p className="text-[11px] text-muted-foreground">
          Estados con el mismo nombre se consideran un único estado.
        </p>

        <div className="rounded-lg border bg-card p-3 space-y-3">
          {/* 5-tuple */}
          <p className="font-mono text-sm text-foreground">
            M = (Q, Σ, δ, q₀, F)
          </p>

          <div className="space-y-2 text-xs">
            <div>
              <span className="font-semibold text-primary">Q</span>
              <span className="text-muted-foreground"> = {"{"}</span>
              <span className="font-mono">
                {uniqueLabels.join(", ")}
              </span>
              <span className="text-muted-foreground">{"}"}</span>
            </div>

            <div>
              <span className="font-semibold text-primary">Σ</span>
              <span className="text-muted-foreground"> = {"{"}</span>
              <span className="font-mono">
                {alphabet.length > 0 ? alphabet.join(", ") : "∅"}
              </span>
              <span className="text-muted-foreground">{"}"}</span>
            </div>

            <div>
              <span className="font-semibold text-primary">q₀</span>
              <span className="text-muted-foreground"> = </span>
              <span className="font-mono">
                {initialStateLabel ?? "—"}
              </span>
            </div>

            <div>
              <span className="font-semibold text-primary">F</span>
              <span className="text-muted-foreground"> = {"{"}</span>
              <span className="font-mono">
                {acceptLabels.length > 0 ? acceptLabels.join(", ") : "∅"}
              </span>
              <span className="text-muted-foreground">{"}"}</span>
            </div>
          </div>
        </div>

        {/* Transition table */}
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tabla de Transiciones (δ)
          </h4>
          {alphabet.length > 0 && uniqueLabels.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-semibold text-primary">δ</th>
                    {alphabet.map((sym) => (
                      <th key={sym} className="px-3 py-2 text-center font-mono font-semibold">
                        {sym}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uniqueLabels.map((label) => {
                    const meta = byLabel.get(label)!;
                    return (
                      <tr key={label} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono font-medium">
                          {meta.isInitial && "→ "}
                          {meta.isAccept && "* "}
                          {label}
                        </td>
                        {alphabet.map((sym) => {
                          const targets = getTargetLabels(label, sym);
                          return (
                            <td key={sym} className="px-3 py-2 text-center font-mono">
                              {targets.length > 0 ? targets.join(", ") : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Agrega transiciones para ver la tabla.
            </p>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
