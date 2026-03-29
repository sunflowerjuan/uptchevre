import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { AutomataData } from "@/hooks/useAutomataEditor";
import type { AutomataAnalysisResult } from "@/lib/automata-api";
import { analyzeAutomatonRequest, transformNfaToDfaRequest } from "@/lib/automata-api";
import { getTheorySnapshot } from "@/lib/automata";
import { FormalismPanel } from "@/components/FormalismPanel";
import { TransformationStepsSheet } from "@/components/TransformationStepsSheet";

interface TransformationPanelProps {
  data: AutomataData;
  analysis?: AutomataAnalysisResult;
  analysisLoading: boolean;
  onLoadDfa: (dfa: AutomataData) => void;
}

const EPSILON = "\u03b5";

function TypeBadge({ type }: { type: string }) {
  const label = type === "NFA_EPSILON" ? `NFA-${EPSILON}` : type;
  return (
    <span className="rounded border px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
      {label}
    </span>
  );
}

const formalismConversionProps = {
  embedded: true as const,
  omitEmptyTransitionDefinitions: true,
  hideTransitionFormulaLines: true,
  transitionSectionBeforeMatrix: true as const,
};

export function TransformationPanel({
  data,
  analysis,
  analysisLoading,
  onLoadDfa,
}: TransformationPanelProps) {
  const transformationMutation = useMutation({
    mutationFn: () => transformNfaToDfaRequest(data),
  });
  const [stepsOpen, setStepsOpen] = useState(false);

  const dfaFromTransform = transformationMutation.data?.dfa;
  const transformDfaAnalysisQuery = useQuery({
    queryKey: ["transform-dfa-analysis", dfaFromTransform ? getTheorySnapshot(dfaFromTransform) : ""],
    queryFn: () => analyzeAutomatonRequest(dfaFromTransform!),
    enabled: Boolean(dfaFromTransform && dfaFromTransform.states.length > 0),
    refetchOnWindowFocus: false,
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
            <p className="text-xs text-muted-foreground">Construcción de subconjuntos</p>
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

        {analysis && (
          <FormalismPanel
            automatonName="M"
            hasStates={data.states.length > 0}
            analysis={analysis}
            isLoading={false}
            error={null}
            {...formalismConversionProps}
          />
        )}

        {transformationMutation.data && (
          <>
            <FormalismPanel
              automatonName="M′"
              hasStates={transformationMutation.data.dfa.states.length > 0}
              analysis={transformDfaAnalysisQuery.data}
              isLoading={transformDfaAnalysisQuery.isLoading}
              error={
                transformDfaAnalysisQuery.error instanceof Error
                  ? transformDfaAnalysisQuery.error.message
                  : transformDfaAnalysisQuery.error
                    ? String(transformDfaAnalysisQuery.error)
                    : null
              }
              tupleLabels={{ q: "Q′", delta: "δ′", q0: "q₀′", f: "F′" }}
              {...formalismConversionProps}
            />

            <div className="flex flex-col gap-2 px-0 pb-2">
              <Button size="sm" className="w-full" onClick={() => setStepsOpen(true)}>
                Mostrar paso a paso
              </Button>
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

      {transformationMutation.data && (
        <TransformationStepsSheet
          open={stepsOpen}
          onOpenChange={setStepsOpen}
          result={transformationMutation.data}
        />
      )}
    </ScrollArea>
  );
}
