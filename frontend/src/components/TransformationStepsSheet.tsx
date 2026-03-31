import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { NfaToDfaTransformationResult } from "@/lib/automata-api";

interface TransformationStepsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: NfaToDfaTransformationResult;
}

const EMPTY_SET = "\u2205";
const INITIAL_ARROW = "\u2192";

function fmt(names: string[]): string {
  if (names.length === 0) return EMPTY_SET;
  return `{${names.join(", ")}}`;
}

function StepTable({
  result,
  processedUpTo,
  highlightRow,
  stepLabel,
}: {
  result: NfaToDfaTransformationResult;
  processedUpTo: number;
  highlightRow: number;
  stepLabel: string;
}) {
  const { transformationTable, dfa } = result;
  const alphabet = dfa.alphabet;

  const idToSubset = new Map(
    transformationTable.map((r) => [r.dfaStateId, r.nfaStateNames]),
  );

  // Filas visibles: las procesadas + las descubiertas por sus transiciones
  const discoveredIds = new Set<string>();
  for (let i = 0; i <= processedUpTo && i < transformationTable.length; i++) {
    discoveredIds.add(transformationTable[i].dfaStateId);
    for (const t of transformationTable[i].transitions) {
      if (t.targetDfaStateId) discoveredIds.add(t.targetDfaStateId);
    }
  }
  const visibleRows = transformationTable.filter((r) => discoveredIds.has(r.dfaStateId));

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {stepLabel}
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-2 py-1.5 text-left font-semibold text-primary">Estado</th>
              {alphabet.map((sym) => (
                <th key={sym} className="px-2 py-1.5 text-center font-mono font-semibold">
                  {sym}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const rowIndex = transformationTable.indexOf(row);
              const isProcessed = rowIndex <= processedUpTo;
              const isHighlighted = rowIndex === highlightRow;

              return (
                <tr
                  key={row.dfaStateId}
                  className={`border-b last:border-0 ${isHighlighted ? "bg-primary/5" : ""}`}
                >
                  <td className="px-2 py-1.5 font-mono font-semibold whitespace-nowrap">
                    <span className="font-normal text-muted-foreground">
                      {row.isInitial ? INITIAL_ARROW : ""}
                      {row.isAccept ? "*" : ""}
                    </span>
                    {fmt(row.nfaStateNames)}
                  </td>
                  {isProcessed
                    ? row.transitions.map((t) => {
                        const targetSubset = t.targetDfaStateId
                          ? idToSubset.get(t.targetDfaStateId) ?? []
                          : [];
                        const cell = t.targetDfaStateId ? fmt(targetSubset) : EMPTY_SET;
                        return (
                          <td key={t.symbol} className="px-2 py-1.5 text-center font-mono">
                            {cell === EMPTY_SET ? (
                              <span className="text-muted-foreground">{EMPTY_SET}</span>
                            ) : (
                              cell
                            )}
                          </td>
                        );
                      })
                    : alphabet.map((sym) => (
                        <td key={sym} className="px-2 py-1.5 text-center font-mono text-muted-foreground/40">
                          —
                        </td>
                      ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinalTable({ result }: { result: NfaToDfaTransformationResult }) {
  const { transformationTable, dfa } = result;
  const alphabet = dfa.alphabet;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        AFD resultante
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-2 py-1.5 text-left font-semibold text-primary">Estado</th>
              {alphabet.map((sym) => (
                <th key={sym} className="px-2 py-1.5 text-center font-mono font-semibold">
                  {sym}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transformationTable.map((row) => (
              <tr key={row.dfaStateId} className="border-b last:border-0">
                <td className="px-2 py-1.5 font-mono font-semibold whitespace-nowrap">
                  <span className="font-normal text-muted-foreground">
                    {row.isInitial ? INITIAL_ARROW : ""}
                    {row.isAccept ? "*" : ""}
                  </span>
                  {row.dfaStateName}
                </td>
                {row.transitions.map((t) => (
                  <td key={t.symbol} className="px-2 py-1.5 text-center font-mono">
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
    </div>
  );
}

function MapeoTable({ result }: { result: NfaToDfaTransformationResult }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Mapeo de estados
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th
                className="px-2 py-1.5 text-left font-semibold text-primary"
                title="Marcas junto al nombre: flecha = estado inicial, asterisco = estado final"
              >
                Estado AFD
              </th>
              <th className="px-2 py-1.5 text-left font-semibold">Subconjunto AFND</th>
            </tr>
          </thead>
          <tbody>
            {result.stateMapping.map((row) => {
              const isInitial = result.dfa.states.find((s) => s.id === row.dfaStateId)?.isInitial;
              const isAccept = result.dfa.states.find((s) => s.id === row.dfaStateId)?.isAccept;
              return (
                <tr key={row.dfaStateId} className="border-b last:border-0">
                  <td className="px-2 py-1.5 font-mono font-semibold whitespace-nowrap">
                    <span className="font-normal text-muted-foreground">
                      {isInitial ? INITIAL_ARROW : ""}
                      {isAccept ? "*" : ""}
                    </span>
                    {row.dfaStateName}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-muted-foreground">
                    {fmt(row.nfaStateNames)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TransformationStepsSheet({
  open,
  onOpenChange,
  result,
}: TransformationStepsSheetProps) {
  const { transformationTable } = result;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="text-base">Paso a paso — Construcción de subconjuntos</SheetTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Cada tabla muestra el progreso de la construcción al terminar de procesar un estado.
            Las celdas con — aún no han sido calculadas.
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-8">

            {transformationTable.map((row, i) => (
              <StepTable
                key={row.dfaStateId}
                result={result}
                processedUpTo={i}
                highlightRow={i}
                stepLabel={`Paso ${i + 1} — procesando ${fmt(row.nfaStateNames)}`}
              />
            ))}

            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="flex-1 border-t border-dashed" />
              <span className="text-xs font-mono">renombrar estados</span>
              <div className="flex-1 border-t border-dashed" />
            </div>

            <FinalTable result={result} />
            <MapeoTable result={result} />

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
