import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PanelRightOpen, Plus, Sigma, Trash2, Workflow } from "lucide-react";
import type { AutomataData } from "@/hooks/useAutomataEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  analyzeEquivalentGrammarRequest,
  analyzeManualGrammarRequest,
  type GrammarAutomatonAnalysisResult,
  type GrammarDefinition,
  type GrammarDerivationStep,
  type GrammarManualAnalysisResult,
  type GrammarProductionInput,
  type GrammarWordAnalysis,
} from "@/lib/automata-api";
import { EPSILON_DISPLAY, getTheorySnapshot } from "@/lib/automata";

interface GrammarPanelProps {
  data: AutomataData;
}

interface GeneralTreeNode {
  id: string;
  label: string;
  type: "nonTerminal" | "production";
  children: GeneralTreeNode[];
}

interface ProductionDraft extends GrammarProductionInput {
  id: string;
}

function createProductionDraft(): ProductionDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    left: "",
    rule: "",
  };
}

function parseSymbolList(input: string) {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function getStartSymbol(nonTerminalsInput: string) {
  return parseSymbolList(nonTerminalsInput)[0] ?? "";
}

function formatRule(tokens: string[]) {
  return tokens.length > 0 ? tokens.join(" ") : EPSILON_DISPLAY;
}

function groupProductions(grammar: GrammarDefinition) {
  return grammar.nonTerminals
    .map((nonTerminal) => ({
      nonTerminal,
      productions: grammar.productions.filter((production) => production.left === nonTerminal),
    }))
    .filter((group) => group.productions.length > 0);
}

function buildGeneralTree(grammar: GrammarDefinition): GeneralTreeNode {
  const grouped = new Map(
    groupProductions(grammar).map((entry) => [entry.nonTerminal, entry.productions]),
  );
  const visitCounter = new Map<string, number>();

  const visit = (nonTerminal: string, depth: number): GeneralTreeNode => {
    const count = (visitCounter.get(nonTerminal) ?? 0) + 1;
    visitCounter.set(nonTerminal, count);

    const productions = grouped.get(nonTerminal) ?? [];
    const canExpand = depth < 4 && count <= 2;

    return {
      id: `nt-${nonTerminal}-${depth}-${count}`,
      label: nonTerminal,
      type: "nonTerminal",
      children: productions.map((production, index) => {
        const nextNonTerminal = production.rightTokens.find((token) =>
          grammar.nonTerminals.includes(token),
        );

        return {
          id: `prod-${production.id}-${index}`,
          label: formatRule(production.rightTokens),
          type: "production",
          children: canExpand && nextNonTerminal ? [visit(nextNonTerminal, depth + 1)] : [],
        };
      }),
    };
  };

  return visit(grammar.startSymbol, 0);
}

function FormalismSet({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

function FormalismSection({ grammar }: { grammar: GrammarDefinition }) {
  const productionGroups = groupProductions(grammar);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Formalismo</p>
        <p className="font-mono text-base text-foreground">G = (V, Σ, P, S)</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <FormalismSet label="V" value={`{${grammar.nonTerminals.join(", ") || EPSILON_DISPLAY}}`} />
        <FormalismSet label="Σ" value={`{${grammar.terminals.join(", ") || EPSILON_DISPLAY}}`} />
        <FormalismSet label="S" value={grammar.startSymbol} />
      </div>

      <div className="rounded-xl border bg-background/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Producciones
        </p>
        <div className="mt-3 space-y-2">
          {productionGroups.map((group) => (
            <div key={group.nonTerminal} className="rounded-lg border bg-card p-3">
              {group.productions.map((production) => (
                <p key={production.id} className="font-mono text-sm text-foreground">
                  {production.left} → {formatRule(production.rightTokens)}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AutomatonTransformationSection({ grammar }: { grammar: GrammarDefinition }) {
  const stateMapping = grammar.stateMapping ?? [];
  const stateNameByNonTerminal = new Map(
    stateMapping.map((item) => [item.nonTerminal, item.stateName]),
  );
  const transitionProductions = grammar.productions.filter((production) => production.rightTokens.length > 0);
  const epsilonProductions = grammar.productions.filter((production) => production.rightTokens.length === 0);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Transformacion desde automata</p>
        <p className="text-xs text-muted-foreground">
          Primero se renombran los estados, luego las transiciones se vuelven reglas y al final queda la gramatica equivalente.
        </p>
      </div>

      <div className="rounded-xl border bg-background/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          1. Estados a simbolos
        </p>
        <div className="mt-3 grid gap-2">
          {stateMapping.map((item) => (
            <p key={item.stateId} className="rounded-lg border bg-card p-3 font-mono text-sm text-foreground">
              {item.stateName} → {item.nonTerminal}
              {item.isInitial ? " [inicial]" : ""}
              {item.isAccept ? " [final]" : ""}
            </p>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-background/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          2. Funciones a reglas
        </p>
        <div className="mt-3 space-y-2">
          {transitionProductions.map((production) => {
            const terminal = production.rightTokens[0] ?? "";
            const targetNonTerminal = production.rightTokens[1] ?? "";
            const fromState = stateNameByNonTerminal.get(production.left) ?? production.left;
            const targetState = stateNameByNonTerminal.get(targetNonTerminal) ?? targetNonTerminal;

            return (
              <div key={production.id} className="rounded-lg border bg-card p-3">
                <p className="font-mono text-sm text-foreground">
                  δ({fromState}, {terminal}) = {targetState} ⇒ {production.left} →{" "}
                  {formatRule(production.rightTokens)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {epsilonProductions.length > 0 && (
        <div className="rounded-xl border bg-background/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            3. Estados de aceptacion
          </p>
          <div className="mt-3 space-y-2">
            {epsilonProductions.map((production) => {
              const stateName = stateNameByNonTerminal.get(production.left) ?? production.left;

              return (
                <div key={production.id} className="rounded-lg border bg-card p-3">
                  <p className="font-mono text-sm text-foreground">
                    {stateName} es final ⇒ {production.left} → {EPSILON_DISPLAY}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-background/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          4. Gramatica resultante
        </p>
        <p className="mt-3 font-mono text-sm text-foreground">
          G = ({`{${grammar.nonTerminals.join(", ")}}`}, {`{${grammar.terminals.join(", ")}}`}, P,{" "}
          {grammar.startSymbol})
        </p>
      </div>
    </section>
  );
}

function TreeNodeCard({ node }: { node: GeneralTreeNode; depth?: number }) {
  const cardClass =
    node.type === "nonTerminal"
      ? "border-primary/30 bg-primary/5 text-primary"
      : "border-border bg-card text-foreground";

  return (
    <div className="space-y-3">
      <div
        className={`inline-flex min-w-28 items-center justify-center rounded-2xl border px-4 py-3 font-mono text-sm font-semibold shadow-sm ${cardClass}`}
      >
        {node.label}
      </div>

      {node.children.length > 0 && (
        <div className="ml-6 space-y-4 border-l border-dashed border-border/80 pl-6">
          {node.children.map((child) => (
            <div key={child.id} className="relative">
              <span className="absolute -left-6 top-5 h-px w-6 bg-border/80" />
              <TreeNodeCard node={child} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GeneralTreeSection({ grammar }: { grammar: GrammarDefinition }) {
  const tree = useMemo(() => buildGeneralTree(grammar), [grammar]);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Arbol general</p>
        <p className="text-xs text-muted-foreground">
          Muestra la estructura abstracta de derivacion desde el simbolo inicial.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-gradient-to-b from-background to-background/70 p-5">
        <TreeNodeCard node={tree} />
      </div>
    </section>
  );
}

function DerivationTreeSection({ analysis }: { analysis: GrammarWordAnalysis }) {
  const visibleSteps = analysis.particularDerivation.slice(1);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Arbol particular</p>
        <p className="text-xs text-muted-foreground">
          Se construye con la cadena validada cuando existe una derivacion aceptante.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-gradient-to-b from-background to-background/70 p-5">
        <div className="space-y-4">
          <div className="inline-flex min-w-28 items-center justify-center rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 font-mono text-sm font-semibold text-primary shadow-sm">
            {analysis.particularDerivation[0]?.sententialLabel ?? "S"}
          </div>

          {visibleSteps.map((step, index) => (
            <div key={step.id} className="ml-6 flex items-start gap-4">
              <div className="flex flex-col items-center">
                <span className="h-6 w-px bg-border" />
                <span className="rounded-full border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {index + 1}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {step.consumedSymbol && (
                  <span className="rounded-full border border-amber-300/50 bg-amber-100/60 px-3 py-1 font-mono text-xs font-semibold text-amber-900">
                    {step.consumedSymbol}
                  </span>
                )}
                {step.nextNonTerminal && (
                  <span className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 font-mono text-sm font-semibold text-primary shadow-sm">
                    {step.nextNonTerminal}
                  </span>
                )}
                {!step.nextNonTerminal && step.production?.rightTokens.length === 0 && (
                  <span className="rounded-2xl border border-emerald-300/50 bg-emerald-100/60 px-4 py-3 font-mono text-sm font-semibold text-emerald-900 shadow-sm">
                    {EPSILON_DISPLAY}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DerivationSequenceSection({ steps }: { steps: GrammarDerivationStep[] }) {
  const sequence = steps.map((step) => step.sententialLabel);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Derivacion escrita paso a paso</p>
        <p className="text-xs text-muted-foreground">
          Secuencia completa de derivacion para la cadena ingresada.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-background/50 p-4">
        {sequence.map((item, index) => (
          <div key={`${item}-${index}`} className="flex items-center gap-2">
            <span className="rounded-full border bg-card px-3 py-2 font-mono text-sm text-foreground">
              {item}
            </span>
            {index < sequence.length - 1 && (
              <span className="text-sm font-semibold text-muted-foreground">→</span>
            )}
          </div>
        ))}
        {sequence.length > 0 && (
          <span className="rounded-full bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            ✓
          </span>
        )}
      </div>
    </section>
  );
}

function ConclusionSection({
  analysis,
  wordInput,
}: {
  analysis: GrammarWordAnalysis;
  wordInput: string;
}) {
  const trimmedWord = wordInput.trim() || EPSILON_DISPLAY;

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Conclusion</p>
          <p className="text-sm text-muted-foreground">{analysis.reason}</p>
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            analysis.accepted
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {analysis.accepted ? `${trimmedWord} ∈ L(G)` : `${trimmedWord} ∉ L(G)`}
        </div>
      </div>
    </section>
  );
}

function IssuesPanel({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;

  return (
    <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-semibold text-destructive">La gramatica necesita ajustes</p>
      <ul className="mt-2 space-y-1 text-sm text-destructive">
        {messages.map((message) => (
          <li key={message}>• {message}</li>
        ))}
      </ul>
    </section>
  );
}

function ProductionRowEditor({
  production,
  onChange,
  onRemove,
  disableRemove,
}: {
  production: GrammarProductionInput;
  onChange: (next: GrammarProductionInput) => void;
  onRemove: () => void;
  disableRemove: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-lg border bg-background/40 p-3 md:grid-cols-[150px_1fr_auto]">
      <Input
        value={production.left}
        onChange={(event) => onChange({ ...production, left: event.target.value })}
        placeholder="S"
      />
      <Input
        value={production.rule}
        onChange={(event) => onChange({ ...production, rule: event.target.value })}
        placeholder="0A | 1 o A0 | 1"
      />
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={disableRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ValidationWorkspace({
  onValidate,
  isLoading,
}: {
  onValidate: (word: string) => void;
  isLoading: boolean;
}) {
  const [wordInput, setWordInput] = useState("");

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Validacion</p>
        <p className="text-xs text-muted-foreground">
          Ingresa una cadena para construir el arbol particular, la derivacion paso a paso y su pertenencia.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Input
          value={wordInput}
          onChange={(event) => setWordInput(event.target.value)}
          placeholder="Ejemplo: 01, ab o ε"
        />
        <Button type="button" onClick={() => onValidate(wordInput)} disabled={isLoading}>
          {isLoading ? "Validando..." : "Validar"}
        </Button>
      </div>
    </section>
  );
}

function ManualGrammarWorkspace() {
  const [terminalsInput, setTerminalsInput] = useState("");
  const [nonTerminalsInput, setNonTerminalsInput] = useState("");
  const [productions, setProductions] = useState<ProductionDraft[]>([createProductionDraft()]);

  const startSymbol = getStartSymbol(nonTerminalsInput);
  const normalizedProductions = useMemo<GrammarProductionInput[]>(
    () => productions.map(({ left, rule }) => ({ left, rule })),
    [productions],
  );

  const previewQuery = useQuery<GrammarManualAnalysisResult>({
    queryKey: ["manual-grammar-preview", terminalsInput, nonTerminalsInput, normalizedProductions],
    queryFn: () =>
      analyzeManualGrammarRequest({
        terminals: parseSymbolList(terminalsInput),
        nonTerminals: parseSymbolList(nonTerminalsInput),
        startSymbol,
        productions: normalizedProductions,
        word: "",
      }),
    refetchOnWindowFocus: false,
  });

  const validateMutation = useMutation({
    mutationFn: (word: string) =>
      analyzeManualGrammarRequest({
        terminals: parseSymbolList(terminalsInput),
        nonTerminals: parseSymbolList(nonTerminalsInput),
        startSymbol,
        productions: normalizedProductions,
        word,
      }),
  });

  useEffect(() => {
    validateMutation.reset();
  }, [terminalsInput, nonTerminalsInput, normalizedProductions, startSymbol]);

  const validation = previewQuery.data?.validation;
  const grammar = validation?.grammar;
  const analysis = validateMutation.data?.analysis;
  const validatedWord = typeof validateMutation.variables === "string" ? validateMutation.variables : "";

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-xl border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Variables / no terminales
            </label>
            <Input
              value={nonTerminalsInput}
              onChange={(event) => setNonTerminalsInput(event.target.value)}
              placeholder="S, A, B"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Alfabeto de terminales
            </label>
            <Input
              value={terminalsInput}
              onChange={(event) => setTerminalsInput(event.target.value)}
              placeholder="0, 1"
            />
          </div>
        </div>

        <div className="rounded-xl border bg-background/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Producciones
              </p>
              <p className="text-xs text-muted-foreground">
                Puedes escribir reglas pegadas, por ejemplo <span className="font-mono">Aa</span>,{" "}
                <span className="font-mono">0A</span> o separar alternativas con{" "}
                <span className="font-mono">|</span>.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setProductions((current) => [...current, createProductionDraft()])}
            >
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          </div>

          <div className="mt-3 space-y-3">
            {productions.map((production, index) => (
              <ProductionRowEditor
                key={production.id}
                production={production}
                onChange={(next) =>
                  setProductions((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, ...next } : item,
                    ),
                  )
                }
                onRemove={() =>
                  setProductions((current) => current.filter((_, itemIndex) => itemIndex !== index))
                }
                disableRemove={productions.length === 1}
              />
            ))}
          </div>
        </div>
      </section>

      {previewQuery.error instanceof Error && (
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {previewQuery.error.message}
        </section>
      )}

      <IssuesPanel messages={validation?.issues.map((issue) => issue.message) ?? []} />

      {grammar && (
        <>
          <FormalismSection grammar={grammar} />
          <GeneralTreeSection grammar={grammar} />
        </>
      )}

      <ValidationWorkspace
        onValidate={(word) => validateMutation.mutate(word)}
        isLoading={validateMutation.isPending}
      />

      {validateMutation.error instanceof Error && (
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {validateMutation.error.message}
        </section>
      )}

      {analysis && (
        <>
          <DerivationTreeSection analysis={analysis} />
          <DerivationSequenceSection steps={analysis.particularDerivation} />
          <ConclusionSection analysis={analysis} wordInput={validatedWord} />
        </>
      )}
    </div>
  );
}

function AutomatonGrammarWorkspace({ data }: { data: AutomataData }) {
  const previewQuery = useQuery<GrammarAutomatonAnalysisResult>({
    queryKey: ["equivalent-grammar-preview", getTheorySnapshot(data)],
    queryFn: () => analyzeEquivalentGrammarRequest(data, ""),
    enabled: data.states.length > 0,
    refetchOnWindowFocus: false,
  });

  const validateMutation = useMutation({
    mutationFn: (word: string) => analyzeEquivalentGrammarRequest(data, word),
  });

  useEffect(() => {
    validateMutation.reset();
  }, [data]);

  if (data.states.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          Dibuja un automata para construir su gramatica equivalente.
        </p>
      </section>
    );
  }

  const validation = previewQuery.data?.validation;
  const grammar = validation?.grammar;
  const analysis = validateMutation.data?.analysis;
  const validatedWord = typeof validateMutation.variables === "string" ? validateMutation.variables : "";

  return (
    <div className="space-y-4">
      <IssuesPanel messages={validation?.issues.map((issue) => issue.message) ?? []} />

      {grammar && (
        <>
          <AutomatonTransformationSection grammar={grammar} />
          <FormalismSection grammar={grammar} />
          <GeneralTreeSection grammar={grammar} />
        </>
      )}

      <ValidationWorkspace
        onValidate={(word) => validateMutation.mutate(word)}
        isLoading={validateMutation.isPending}
      />

      {analysis && (
        <>
          <DerivationTreeSection analysis={analysis} />
          <DerivationSequenceSection steps={analysis.particularDerivation} />
          <ConclusionSection analysis={analysis} wordInput={validatedWord} />
        </>
      )}
    </div>
  );
}

export function GrammarPanel({ data }: GrammarPanelProps) {
  return (
    <div className="border-t p-2">
      <Sheet>
        <SheetTrigger asChild>
          <Button type="button" variant="secondary" className="w-full justify-center gap-2">
            <PanelRightOpen className="h-4 w-4" />
            GRAMATICAS
          </Button>
        </SheetTrigger>

        <SheetContent side="right" className="w-full p-0 sm:max-w-5xl">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>GRAMATICAS</SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-92px)]">
            <div className="px-6 py-5">
              <Tabs defaultValue="manual" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual" className="gap-2">
                    <Sigma className="h-4 w-4" />
                    Construir gramatica
                  </TabsTrigger>
                  <TabsTrigger value="automaton" className="gap-2">
                    <Workflow className="h-4 w-4" />
                    Equivalencia desde automata
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-4">
                  <ManualGrammarWorkspace />
                </TabsContent>

                <TabsContent value="automaton" className="space-y-4">
                  <AutomatonGrammarWorkspace data={data} />
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
