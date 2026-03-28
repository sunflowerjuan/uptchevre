import { ScrollArea } from "@/components/ui/scroll-area";
import type { AutomataAnalysisResult } from "@/lib/automata-api";

interface FormalismPanelProps {
  hasStates: boolean;
  analysis?: AutomataAnalysisResult;
  isLoading: boolean;
  error?: string | null;
}

function getTransitionFormula(type: AutomataAnalysisResult["automatonType"]) {
  if (type === "DFA") return "delta: Q x Sigma -> Q";
  if (type === "NFA") return "delta: Q x Sigma -> P(Q)";
  return "delta: Q x (Sigma U {epsilon}) -> P(Q)";
}

function getExtendedFormula(type: AutomataAnalysisResult["automatonType"]) {
  if (type === "DFA") return "delta*: Q x Sigma* -> Q";
  return "delta*: Q x Sigma* -> P(Q)";
}

function getGroupedTransitions(analysis: AutomataAnalysisResult) {
  const grouped = new Map<string, string[]>();

  for (const transition of analysis.transitions) {
    const key = `${transition.fromName}::${transition.displaySymbol}`;
    const list = grouped.get(key) ?? [];
    list.push(transition.toName);
    grouped.set(key, Array.from(new Set(list)).sort());
  }

  return grouped;
}

export function FormalismPanel({
  hasStates,
  analysis,
  isLoading,
  error,
}: FormalismPanelProps) {
  if (!hasStates) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-muted-foreground">
          Agrega estados al canvas para ver el formalismo aqui.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-muted-foreground">
          Analizando el automata con el backend...
        </p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-destructive">
          No fue posible calcular el formalismo del automata.
        </p>
      </div>
    );
  }

  const transitionSymbols = analysis.supportsEpsilon
    ? [...analysis.alphabet, "epsilon"]
    : analysis.alphabet;
  const groupedTransitions = getGroupedTransitions(analysis);
  const initialNames = analysis.initialStates.map((state) => state.name);
  const acceptNames = analysis.acceptStates.map((state) => state.name);
  const q0Value =
    initialNames.length <= 1 ? initialNames[0] ?? "-" : `{${initialNames.join(", ")}}`;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-4">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Formalismos
          </h3>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm font-semibold text-foreground">
              Tipo identificado: {analysis.automatonType}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {getTransitionFormula(analysis.automatonType)}
            </p>
            <p className="text-xs text-muted-foreground">
              {getExtendedFormula(analysis.automatonType)}
            </p>
          </div>
        </div>

        <section className="space-y-3 rounded-lg border bg-card p-3">
          <p className="font-mono text-sm text-foreground">M = (Q, Sigma, delta, q0, F)</p>

          <div className="space-y-2 text-xs">
            <div>
              <span className="font-semibold text-primary">Q</span>
              <span className="text-muted-foreground"> = {"{"}</span>
              <span className="font-mono">{analysis.states.map((state) => state.name).join(", ")}</span>
              <span className="text-muted-foreground">{"}"}</span>
            </div>

            <div>
              <span className="font-semibold text-primary">Sigma</span>
              <span className="text-muted-foreground"> = {"{"}</span>
              <span className="font-mono">
                {analysis.alphabet.length > 0 ? analysis.alphabet.join(", ") : "-"}
              </span>
              <span className="text-muted-foreground">{"}"}</span>
            </div>

            <div>
              <span className="font-semibold text-primary">q0</span>
              <span className="text-muted-foreground"> = </span>
              <span className="font-mono">{q0Value}</span>
            </div>

            <div>
              <span className="font-semibold text-primary">F</span>
              <span className="text-muted-foreground"> = {"{"}</span>
              <span className="font-mono">{acceptNames.length > 0 ? acceptNames.join(", ") : "-"}</span>
              <span className="text-muted-foreground">{"}"}</span>
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border bg-card p-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Funcion de transicion delta</p>
            <p className="text-xs text-muted-foreground">
              {analysis.automatonType === "DFA"
                ? "Cada par estado-simbolo tiene a lo sumo un destino."
                : "Los destinos se representan como subconjuntos de Q."}
            </p>
          </div>

          {transitionSymbols.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-semibold text-primary">delta</th>
                    {transitionSymbols.map((symbol) => (
                      <th key={symbol} className="px-3 py-2 text-center font-mono font-semibold">
                        {symbol === "epsilon" ? "epsilon" : symbol}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analysis.states.map((state) => (
                    <tr key={state.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono font-medium">
                        {state.isInitial ? "-> " : ""}
                        {state.isAccept ? "* " : ""}
                        {state.name}
                      </td>
                      {transitionSymbols.map((symbol) => {
                        const displaySymbol = symbol === "epsilon" ? "epsilon" : symbol;
                        const targets = groupedTransitions.get(`${state.name}::${displaySymbol}`) ?? [];
                        return (
                          <td key={`${state.id}-${symbol}`} className="px-3 py-2 text-center font-mono">
                            {targets.length > 0 ? `{${targets.join(", ")}}` : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Agrega simbolos y transiciones para completar la funcion delta.
            </p>
          )}
        </section>

        {analysis.supportsEpsilon && (
          <section className="space-y-3 rounded-lg border bg-card p-3">
            <div>
              <p className="text-sm font-semibold text-foreground">e-closure</p>
              <p className="text-xs text-muted-foreground">
                e-closure(q) reune todos los estados alcanzables desde q usando solo transiciones epsilon.
              </p>
            </div>

            <div className="space-y-2">
              {analysis.eClosures.map((closure) => (
                <div key={closure.stateId} className="rounded-md border px-3 py-2 text-xs">
                  <span className="font-mono font-semibold text-foreground">
                    e-closure({closure.stateName})
                  </span>
                  <span className="text-muted-foreground"> = </span>
                  <span className="font-mono">{`{${closure.closureNames.join(", ")}}`}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3 rounded-lg border bg-card p-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Funcion extendida delta*</p>
            <p className="text-xs text-muted-foreground">
              delta*(q, epsilon) = q para DFA, y delta*(S, epsilon) = S para NFA/NFA-E.
            </p>
            <p className="text-xs text-muted-foreground">
              Para una palabra wa, primero se calcula delta* con el prefijo w y luego se aplica delta con el siguiente simbolo a.
            </p>
            {analysis.supportsEpsilon && (
              <p className="text-xs text-muted-foreground">
                En NFA-E, cada avance usa move y despues la e-closure del conjunto alcanzado.
              </p>
            )}
          </div>
        </section>

        {analysis.determinismIssues.length > 0 && (
          <section className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Evidencia de no determinismo</p>
              <p className="text-xs text-muted-foreground">
                El backend encontro multiples destinos para al menos una pareja estado-simbolo.
              </p>
            </div>

            <div className="space-y-2">
              {analysis.determinismIssues.map((issue, index) => (
                <div key={`${issue.stateId}-${issue.symbol}-${index}`} className="rounded-md border px-3 py-2 text-xs">
                  <span className="font-mono">{issue.stateName}</span>
                  <span className="text-muted-foreground"> con </span>
                  <span className="font-mono">{issue.displaySymbol}</span>
                  <span className="text-muted-foreground"> alcanza </span>
                  <span className="font-mono">{`{${issue.targets.join(", ")}}`}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </ScrollArea>
  );
}
