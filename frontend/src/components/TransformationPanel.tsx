import { useMutation } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { AutomataData } from "@/hooks/useAutomataEditor";
import type { AutomataAnalysisResult, NfaToDfaTransformationResult } from "@/lib/automata-api";
import { transformNfaToDfaRequest } from "@/lib/automata-api";

interface TransformationPanelProps {
  data: AutomataData;
  analysis?: AutomataAnalysisResult;
  analysisLoading: boolean;
  onLoadDfa: (dfa: AutomataData) => void;
}

const EMPTY_SET = "\u2205";
const SIGMA = "\u03a3";
const DELTA = "\u03b4";

function TypeBadge({ type }: { type: string }) {
  const label = type === "NFA_EPSILON" ? "NFA-\u03b5" : type;
  return (
    <span className="rounded border px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
      {label}
    </span>
  );
}

function MapeoTable({ result }: { result: NfaToDfaTransformationResult }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Mapeo de estados</p>
        <p className="text-xs text-muted-foreground">
          Correspondencia entre cada estado del AFD y el subconjunto de estados del AFND que
          representa.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-semibold text-primary">Estado AFD</th>
              <th className="px-3 py-2 text-left font-semibold">Subconjunto AFND</th>
              <th className="px-3 py-2 text-center font-semibold">→</th>
              <th className="px-3 py-2 text-center font-semibold">*</th>
            </tr>
          </thead>
          <tbody>
            {result.stateMapping.map((row) => {
              const subset =
                row.nfaStateNames.length === 0
                  ? EMPTY_SET
                  : `{${row.nfaStateNames.join(", ")}}`;
              const isInitial = result.dfa.states.find((s) => s.id === row.dfaStateId)?.isInitial;
              const isAccept = result.dfa.states.find((s) => s.id === row.dfaStateId)?.isAccept;
              return (
                <tr key={row.dfaStateId} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono font-semibold">{row.dfaStateName}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{subset}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {isInitial ? "\u2192" : ""}
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {isAccept ? "*" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FormalismoSection({ result }: { result: NfaToDfaTransformationResult }) {
  const { dfa, stateMapping } = result;

  const allStateLabels = stateMapping.map((r) => r.dfaStateName);
  const initialState = dfa.states.find((s) => s.isInitial);
  const initialLabel =
    stateMapping.find((r) => r.dfaStateId === initialState?.id)?.dfaStateName ?? EMPTY_SET;
  const acceptLabels = stateMapping
    .filter((r) => dfa.states.find((s) => s.id === r.dfaStateId)?.isAccept)
    .map((r) => r.dfaStateName);

  return (
    <section className="space-y-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">AFD</p>
        <p className="font-mono text-sm text-foreground">
          M' = (Q', {SIGMA}, {DELTA}', q₀', F')
        </p>
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <span className="font-semibold text-primary">Q'</span>
          <span className="text-muted-foreground"> = {"{"}</span>
          <span className="font-mono">{allStateLabels.join(", ")}</span>
          <span className="text-muted-foreground">{"}"}</span>
        </div>
        <div>
          <span className="font-semibold text-primary">{SIGMA}</span>
          <span className="text-muted-foreground"> = {"{"}</span>
          <span className="font-mono">
            {dfa.alphabet.length > 0 ? dfa.alphabet.join(", ") : EMPTY_SET}
          </span>
          <span className="text-muted-foreground">{"}"}</span>
        </div>
        <div>
          <span className="font-semibold text-primary">q₀'</span>
          <span className="text-muted-foreground"> = </span>
          <span className="font-mono">{initialLabel}</span>
        </div>
        <div>
          <span className="font-semibold text-primary">F'</span>
          <span className="text-muted-foreground"> = {"{"}</span>
          <span className="font-mono">
            {acceptLabels.length > 0 ? acceptLabels.join(", ") : EMPTY_SET}
          </span>
          <span className="text-muted-foreground">{"}"}</span>
        </div>
      </div>
    </section>
  );
}

function MatrizTable({ result }: { result: NfaToDfaTransformationResult }) {
  const { transformationTable, dfa } = result;
  const alphabet = dfa.alphabet;

  return (
    <section className="space-y-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Matriz de transición</p>
        <p className="font-mono text-xs text-muted-foreground">
          {DELTA}': Q' × {SIGMA} → Q'
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-semibold text-primary">Estado</th>
              {alphabet.map((sym) => (
                <th key={sym} className="px-3 py-2 text-center font-mono font-semibold">
                  {sym}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transformationTable.map((row) => (
              <tr key={row.dfaStateId} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono font-medium">
                  {row.isInitial ? "\u2192" : ""}
                  {row.isAccept ? "*" : ""}
                  {row.dfaStateName}
                </td>
                {row.transitions.map((t) => (
                  <td key={t.symbol} className="px-3 py-2 text-center font-mono">
                    {t.targetDfaStateName === EMPTY_SET ? (
                      <span className="text-muted-foreground">{EMPTY_SET}</span>
                    ) : (
                      t.targetDfaStateName
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TablaTransformacion({ result }: { result: NfaToDfaTransformationResult }) {
  const { transformationTable, dfa } = result;
  const alphabet = dfa.alphabet;

  return (
    <section className="space-y-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Tabla de transformación</p>
        <p className="text-xs text-muted-foreground">
          Construcción de subconjuntos: cada fila muestra el subconjunto AFND y las transiciones
          del estado AFD resultante.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-semibold text-primary">Estado</th>
              <th className="px-3 py-2 text-left font-semibold">Subconjunto AFND</th>
              {alphabet.map((sym) => (
                <th key={sym} className="px-3 py-2 text-center font-mono font-semibold">
                  {sym}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transformationTable.map((row) => {
              const subset =
                row.nfaStateNames.length === 0
                  ? EMPTY_SET
                  : `{${row.nfaStateNames.join(", ")}}`;
              return (
                <tr key={row.dfaStateId} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono font-medium">
                    {row.isInitial ? "\u2192" : ""}
                    {row.isAccept ? "*" : ""}
                    {row.dfaStateName}
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{subset}</td>
                  {row.transitions.map((t) => (
                    <td key={t.symbol} className="px-3 py-2 text-center font-mono">
                      {t.targetDfaStateName === EMPTY_SET ? (
                        <span className="text-muted-foreground">{EMPTY_SET}</span>
                      ) : (
                        t.targetDfaStateName
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TransformationPanel({
  data,
  analysis,
  analysisLoading,
  onLoadDfa,
}: TransformationPanelProps) {
  const transformationMutation = useMutation({
    mutationFn: () => transformNfaToDfaRequest(data),
  });

  if (data.states.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-muted-foreground">
          Agrega estados al canvas para transformar el autómata.
        </p>
      </div>
    );
  }

  if (analysisLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-muted-foreground">Analizando el autómata...</p>
      </div>
    );
  }

  if (analysis?.automatonType === "DFA") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6">
        <p className="text-center text-sm text-muted-foreground">
          El autómata ya es un{" "}
          <span className="font-mono font-semibold text-foreground">AFD</span>. No se necesita
          transformación.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <section className="space-y-3 rounded-lg border bg-card p-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">AFND → AFD</p>
            <p className="text-xs text-muted-foreground">
              Construcción de subconjuntos
            </p>
          </div>

          {analysis && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Tipo detectado:</span>
              <TypeBadge type={analysis.automatonType} />
            </div>
          )}

          <Button
            size="sm"
            className="w-full"
            disabled={transformationMutation.isPending}
            onClick={() => transformationMutation.mutate()}
          >
            {transformationMutation.isPending ? "Transformando..." : "Transformar a AFD"}
          </Button>

          {transformationMutation.isError && (
            <p className="text-xs text-destructive">
              {transformationMutation.error instanceof Error
                ? transformationMutation.error.message
                : "No fue posible completar la transformación."}
            </p>
          )}
        </section>

        {transformationMutation.data && (
          <>
            <section className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
              <TypeBadge type={transformationMutation.data.originalType} />
              <span>→</span>
              <TypeBadge type="DFA" />
              <span className="ml-auto">
                <span className="font-semibold text-foreground">{data.states.length}</span>{" "}
                estados originales →{" "}
                <span className="font-semibold text-foreground">
                  {transformationMutation.data.dfa.states.length}
                </span>{" "}
                estados en el AFD
              </span>
            </section>

            <MapeoTable result={transformationMutation.data} />
            <FormalismoSection result={transformationMutation.data} />
            <MatrizTable result={transformationMutation.data} />
            <TablaTransformacion result={transformationMutation.data} />

            <div className="px-0 pb-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => onLoadDfa(transformationMutation.data!.dfa)}
              >
                Cargar AFD en el editor
              </Button>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
