import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AutomataData } from "@/hooks/useAutomataEditor";
import type {
  AutomataAnalysisResult,
  DfaDistinguishabilityCell,
  DfaDistinguishabilityIteration,
  DfaEquivalenceClass,
  DfaMinimizationResult,
  DfaMinimizedTransitionRow,
} from "@/lib/automata-api";
import { minimizeDfaRequest } from "@/lib/automata-api";
import { getTheorySnapshot } from "@/lib/automata";
import type { RichReason, SymbolComparison } from "@/lib/dfa-minimization";
import { RICH_REASON_PREFIX } from "@/lib/dfa-minimization";

interface DfaMinimizationPanelProps {
  data: AutomataData;
  analysis?: AutomataAnalysisResult;
  analysisLoading: boolean;
  onLoadMinimizedDfa: (dfa: AutomataData) => void;
}

const EMPTY_SET = "\u2205";

function setLabel(values: string[]) {
  return values.length > 0 ? `{${values.join(", ")}}` : EMPTY_SET;
}

function getIterationMarkClass(iteration?: number) {
  const palette = [
    "text-red-600",
    "text-blue-600",
    "text-emerald-600",
    "text-fuchsia-600",
    "text-amber-700",
    "text-cyan-700",
    "text-violet-700",
    "text-rose-700",
  ];

  if (iteration === undefined || iteration < 0) {
    return "text-red-600";
  }

  return palette[iteration % palette.length];
}

function decodeRichReason(reason: string | undefined): RichReason | null {
  if (!reason?.startsWith(RICH_REASON_PREFIX)) return null;
  try {
    return JSON.parse(reason.slice(RICH_REASON_PREFIX.length)) as RichReason;
  } catch {
    return null;
  }
}

function SymbolComparisonTable({
  pA,
  pB,
  rich,
  markedIteration,
}: {
  pA: string;
  pB: string;
  rich: RichReason;
  markedIteration?: number;
}) {
  const isBase = rich.markType === "base";
  const markColorClass = getIterationMarkClass(markedIteration);

  return (
    <div className="mt-2 space-y-2 rounded-lg border bg-muted/10 p-3">
      <p className="font-mono text-xs font-semibold text-foreground">
        Par ({pA}, {pB})
      </p>

      {isBase ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground">{rich.summary}</span>
          <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${markColorClass}`}>
            MARCA
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1 text-left font-semibold text-muted-foreground">
                  Símbolo
                </th>
                <th className="px-2 py-1 text-center font-semibold text-muted-foreground">
                  δ({pA}, ·)
                </th>
                <th className="px-2 py-1 text-center font-semibold text-muted-foreground">
                  δ({pB}, ·)
                </th>
                <th className="px-2 py-1 text-center font-semibold text-muted-foreground">
                  Par destino marcado
                </th>
                <th className="px-2 py-1 text-center font-semibold text-muted-foreground">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody>
              {rich.comparisons.map((comp: SymbolComparison) => {
                const sameTarget = comp.targetA === comp.targetB;
                return (
                  <tr key={comp.symbol} className="border-b last:border-0">
                    <td className="px-2 py-1 text-center font-mono font-semibold">
                      {comp.symbol}
                    </td>
                    <td className="px-2 py-1 text-center font-mono">
                      {comp.targetA}
                    </td>
                    <td className="px-2 py-1 text-center font-mono">
                      {comp.targetB}
                    </td>
                    <td className="px-2 py-1 text-center">
                      {sameTarget ? (
                        <span className="text-muted-foreground">no</span>
                      ) : comp.pairAlreadyMarked ? (
                        <span className={`font-semibold ${markColorClass}`}>✗</span>
                      ) : (
                        <span className="text-muted-foreground">no</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-center">
                      {comp.marks ? (
                        <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${markColorClass}`}>
                          MARCA
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          NO MARCA
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BaseMarkedPairsGrid({
  cells,
}: {
  cells: DfaDistinguishabilityCell[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {cells.map((cell) => (
        <div
          key={`${cell.rowStateId}-${cell.columnStateId}`}
          className="rounded-lg border bg-muted/20 p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-sm font-semibold text-foreground">
              ({cell.rowStateName}, {cell.columnStateName})
            </p>
            <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
              MARCA
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {decodeRichReason(cell.reason)?.summary ?? cell.reason}
          </p>
        </div>
      ))}
    </div>
  );
}

function DistinguishabilityMatrix({
  stateNames,
  cells,
}: {
  stateNames: string[];
  cells: DfaDistinguishabilityCell[];
}) {
  const cellMap = new Map(
    cells.map((cell) => [`${cell.rowStateId}::${cell.columnStateId}`, cell]),
  );
  const idByName = new Map(
    cells.flatMap((cell) => [
      [cell.rowStateName, cell.rowStateId],
      [cell.columnStateName, cell.columnStateId],
    ]),
  );

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-semibold text-primary">
              Estado
            </th>
            {stateNames.slice(0, -1).map((name) => (
              <th
                key={name}
                className="px-3 py-2 text-center font-mono font-semibold"
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stateNames.slice(1).map((rowName, rowIndex) => (
            <tr key={rowName} className="border-b last:border-0">
              <td className="px-3 py-2 font-mono font-medium">{rowName}</td>
              {stateNames.slice(0, rowIndex + 1).map((columnName) => {
                const rowId = idByName.get(rowName) ?? "";
                const columnId = idByName.get(columnName) ?? "";
                const cell =
                  cellMap.get(`${rowId}::${columnId}`) ??
                  cellMap.get(`${columnId}::${rowId}`);
                const label =
                  cell?.status === "distinguishable"
                    ? "✗"
                    : cell?.status === "equivalent"
                      ? "≡"
                      : "?";
                const colorClass =
                  cell?.status === "distinguishable"
                    ? getIterationMarkClass(cell.markedInIteration)
                    : cell?.status === "equivalent"
                      ? "text-emerald-600"
                      : "text-muted-foreground";
                return (
                  <td
                    key={columnName}
                    className={`px-3 py-2 text-center font-semibold ${colorClass}`}
                    title={
                      decodeRichReason(cell?.reason)?.summary ?? cell?.reason
                    }
                  >
                    {label}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DistinguishabilityBlock({
  stateNames,
  iterations,
}: {
  stateNames: string[];
  iterations: DfaDistinguishabilityIteration[];
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Tabla de distinguibilidad (Myhill-Nerode)
        </p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>✗ = distinguible   ≡ = equivalente   ? = aún no marcado</p>
          <p>Marcado base: p ∈ F, q ∉ F</p>
          <p>Propagación: si (δ(p, a), δ(q, a)) ya es ✗, entonces (p, q) también</p>
        </div>
      </div>

      <div className="space-y-4">
        {iterations.map((iteration, index) => (
          <div
            key={iteration.iteration}
            className="space-y-3 rounded-lg border p-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {iteration.iteration === 0
                ? "Iteración 0  marcado base (p ∈ F, q ∉ F)"
                : index === iterations.length - 1
                  ? `Iteración ${iteration.iteration}  sin nuevas marcas (estable)`
                  : `Iteración ${iteration.iteration}  propagación`}
            </p>

            <DistinguishabilityMatrix
              stateNames={stateNames}
              cells={iteration.cells}
            />

            <div className="space-y-3">
              {(() => {
                const markedCells = iteration.cells.filter(
                  (cell) =>
                    cell.status === "distinguishable" &&
                    cell.markedInIteration === iteration.iteration,
                );

                if (iteration.iteration === 0) {
                  return <BaseMarkedPairsGrid cells={markedCells} />;
                }

                return markedCells.map((cell) => {
                  const rich = decodeRichReason(cell.reason);
                  return (
                    <div key={`${cell.rowStateId}-${cell.columnStateId}`}>
                      {rich ? (
                        <SymbolComparisonTable
                          pA={cell.rowStateName}
                          pB={cell.columnStateName}
                          rich={rich}
                          markedIteration={cell.markedInIteration}
                        />
                      ) : (
                        <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                          ({cell.rowStateName}, {cell.columnStateName}) ✗{" "}
                          {cell.reason}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}

              {index === iterations.length - 1 && (
                <p className="text-xs text-muted-foreground">
                  Los pares sin marca (≡) forman las clases de equivalencia del
                  DFA minimizado.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EquivalenceClassesBlock({
  classes,
}: {
  classes: DfaEquivalenceClass[];
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Identificación de estados equivalentes
        </p>
        <p className="text-xs text-muted-foreground">
          Clases de equivalencia finales. Cada clase se convierte en un estado
          de A''.
        </p>
      </div>

      <div className="space-y-3">
        {classes.map((ec) => (
          <div key={ec.className} className="space-y-1 rounded-lg border p-3">
            <p className="font-mono text-sm font-semibold text-foreground">
              {ec.className} = {setLabel(ec.stateNames)}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {ec.explanation}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MinimizedTransitionTable({
  rows,
}: {
  rows: DfaMinimizedTransitionRow[];
}) {
  const alphabet = rows[0]?.transitions.map((t) => t.symbol) ?? [];
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-semibold text-primary">
              Estado
            </th>
            {alphabet.map((symbol) => (
              <th
                key={symbol}
                className="px-3 py-2 text-center font-mono font-semibold"
              >
                {symbol}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.className} className="border-b last:border-0">
              <td className="px-3 py-2 font-mono font-medium">
                {row.isInitial && (
                  <span className="mr-1 text-muted-foreground">→</span>
                )}
                {row.isAccept && (
                  <span className="mr-1 text-muted-foreground">*</span>
                )}
                {row.className}
              </td>
              {row.transitions.map((transition) => (
                <td
                  key={transition.symbol}
                  className="px-3 py-2 text-center font-mono"
                >
                  {transition.targetClassName}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MinimizedFormalismBlock({
  result,
}: {
  result: DfaMinimizationResult;
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Formalismo DFA minimizado
        </p>
        <p className="font-mono text-sm text-foreground">
          A'' = (Q'', Σ, δ'', q₀'', F'')
        </p>
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <span className="font-semibold text-primary">Q''</span>
          <span className="text-muted-foreground"> = </span>
          <span className="font-mono">
            {setLabel(result.minimizedFormalism.states)}
          </span>
        </div>
        <div>
          <span className="font-semibold text-primary">Σ</span>
          <span className="text-muted-foreground"> = </span>
          <span className="font-mono">
            {setLabel(result.minimizedFormalism.alphabet)}
          </span>
        </div>
        <div>
          <span className="font-semibold text-primary">q₀''</span>
          <span className="text-muted-foreground"> = </span>
          <span className="font-mono">
            {result.minimizedFormalism.initialState || EMPTY_SET}
          </span>
        </div>
        <div>
          <span className="font-semibold text-primary">F''</span>
          <span className="text-muted-foreground"> = </span>
          <span className="font-mono">
            {setLabel(result.minimizedFormalism.acceptStates)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Matriz de transición
          </p>
        </div>
        <MinimizedTransitionTable rows={result.minimizedTransitionTable} />
      </div>
    </section>
  );
}

function DfaMinimizationStepsSheet({
  open,
  onOpenChange,
  result,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: DfaMinimizationResult;
}) {
  const stateNames = useMemo(
    () => result.originalFormalism.states,
    [result.originalFormalism.states],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-4xl"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle className="text-base">
            Paso a paso  Minimización DFA (Myhill-Nerode)
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Tabla de distinguibilidad   Clases de equivalencia   A''.
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 px-6 py-5">
            <DistinguishabilityBlock
              stateNames={stateNames}
              iterations={result.distinguishabilityIterations}
            />
            <EquivalenceClassesBlock classes={result.equivalenceClasses} />
            <MinimizedFormalismBlock result={result} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function DfaMinimizationPanel({
  data,
  analysis,
  analysisLoading,
  onLoadMinimizedDfa,
}: DfaMinimizationPanelProps) {
  const [stepsOpen, setStepsOpen] = useState(false);

  const minimizationQuery = useQuery({
    queryKey: ["automata-minimize", getTheorySnapshot(data)],
    queryFn: () => minimizeDfaRequest(data),
    enabled:
      data.states.length > 0 &&
      !analysisLoading &&
      analysis?.automatonType === "DFA",
    refetchOnWindowFocus: false,
  });

  if (data.states.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-muted-foreground">
          Agrega un DFA al canvas para ejecutar la minimización.
        </p>
      </div>
    );
  }

  if (analysisLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-muted-foreground">
          Analizando el autómata...
        </p>
      </div>
    );
  }

  if (analysis?.automatonType !== "DFA") {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          Esta herramienta solo minimiza DFA completos. Si el autómata actual es
          AFN o AFN-ε, usa primero la transformación correspondiente y luego
          vuelve aquí.
        </div>
      </div>
    );
  }

  if (minimizationQuery.isPending) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-muted-foreground">
          Calculando particiones y clases de equivalencia...
        </p>
      </div>
    );
  }

  if (minimizationQuery.isError || !minimizationQuery.data) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-destructive">
          {minimizationQuery.error instanceof Error
            ? minimizationQuery.error.message
            : "No fue posible minimizar el DFA."}
        </div>
      </div>
    );
  }

  const result = minimizationQuery.data;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <EquivalenceClassesBlock classes={result.equivalenceClasses} />
        <MinimizedFormalismBlock result={result} />

        <div className="flex flex-col gap-2 px-0 pb-2">
          <Button
            size="sm"
            className="w-full"
            onClick={() => setStepsOpen(true)}
          >
            Mostrar paso a paso completo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => onLoadMinimizedDfa(result.minimizedDfa)}
          >
            Cargar A'' en el editor
          </Button>
        </div>
      </div>

      <DfaMinimizationStepsSheet
        open={stepsOpen}
        onOpenChange={setStepsOpen}
        result={result}
      />
    </ScrollArea>
  );
}
