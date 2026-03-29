import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  GitBranch,
  PanelRightOpen,
  Plus,
  Sigma,
  Trash2,
  Workflow,
} from "lucide-react";
import type { AutomataData } from "@/hooks/useAutomataEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analyzeEquivalentGrammarRequest, analyzeManualGrammarRequest, type GrammarAutomatonAnalysisResult, type GrammarDefinition, type GrammarManualAnalysisResult, type GrammarProductionInput, type GrammarWordAnalysis } from "@/lib/automata-api";
import { EPSILON_DISPLAY, getTheorySnapshot } from "@/lib/automata";

interface GrammarPanelProps {
  data: AutomataData;
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

function formatRule(tokens: string[]) {
  return tokens.length > 0 ? tokens.join(" ") : EPSILON_DISPLAY;
}

function SymbolSet({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="space-y-1 rounded-lg border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="font-mono text-sm text-foreground">
        {values.length > 0 ? `{${values.join(", ")}}` : "∅"}
      </p>
    </div>
  );
}

function GrammarTuple({ grammar, title }: { grammar: GrammarDefinition; title: string }) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="font-mono text-sm text-foreground">G = (ΣT, ΣNT, S, P)</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SymbolSet title="ΣT" values={grammar.terminals} />
        <SymbolSet title="ΣNT" values={grammar.nonTerminals} />
      </div>

      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Símbolo inicial</p>
          <p className="mt-1 font-mono text-sm text-foreground">{grammar.startSymbol}</p>
        </div>

        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Producciones</p>
          <div className="mt-2 overflow-hidden rounded-lg border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 font-semibold text-primary">No terminal</th>
                  <th className="px-3 py-2 font-semibold text-primary">Regla</th>
                </tr>
              </thead>
              <tbody>
                {grammar.productions.map((production) => (
                  <tr key={production.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-foreground">{production.left}</td>
                    <td className="px-3 py-2 font-mono text-foreground">{formatRule(production.rightTokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function IssuesPanel({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;

  return (
    <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-semibold text-destructive">La gramática necesita ajustes</p>
      <ul className="mt-2 space-y-1 text-sm text-destructive">
        {messages.map((message) => (
          <li key={message}>• {message}</li>
        ))}
      </ul>
    </section>
  );
}

function DiagramBlock({ title, description, lines }: { title: string; description: string; lines: string[] }) {
  return (
    <section className="space-y-2 rounded-lg border bg-background/40 p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <pre className="overflow-x-auto rounded-lg border bg-card p-3 font-mono text-xs leading-6 text-foreground">
        {lines.join("\n")}
      </pre>
    </section>
  );
}

function MembershipSection({
  grammar,
  analysis,
  wordInput,
  showThreadDiagram,
}: {
  grammar: GrammarDefinition;
  analysis: GrammarWordAnalysis;
  wordInput: string;
  showThreadDiagram: boolean;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Derivación particular y pertenencia</p>
          <p className="text-xs text-muted-foreground">
            La palabra se evalúa sobre la gramática activa y la derivación se resume como diagrama.
          </p>
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            analysis.accepted
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {analysis.accepted ? "Pertenece al lenguaje" : "No pertenece al lenguaje"}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
        <div className="rounded-lg border bg-background/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Palabra</p>
          <p className="mt-1 font-mono text-sm text-foreground">{wordInput.trim() || EPSILON_DISPLAY}</p>
        </div>
        <div className="rounded-lg border bg-background/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gramática activa</p>
          <p className="mt-1 text-sm text-foreground">
            {grammar.source === "manual" ? "Construida manualmente" : "Equivalente desde autómata"}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{analysis.reason}</p>

      <DiagramBlock
        title="Árbol de derivación"
        description="Vista compacta de la derivación aceptante, sin expandir paso a paso."
        lines={analysis.derivationTreeLines}
      />

      {showThreadDiagram && analysis.threadDiagramLines.length > 0 && (
        <DiagramBlock
          title="Diagrama de hilos"
          description="Muestra cómo cambian los estados/no terminales cuando se consumen los símbolos."
          lines={analysis.threadDiagramLines}
        />
      )}
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
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          No terminal
        </label>
        <Input
          value={production.left}
          onChange={(event) => onChange({ ...production, left: event.target.value })}
          placeholder="S"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Regla
        </label>
        <Input
          value={production.rule}
          onChange={(event) => onChange({ ...production, rule: event.target.value })}
          placeholder={`a A o ${EPSILON_DISPLAY}`}
        />
      </div>

      <div className="flex items-end">
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={disableRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ManualGrammarWorkspace() {
  const [terminalsInput, setTerminalsInput] = useState("a, b");
  const [nonTerminalsInput, setNonTerminalsInput] = useState("S, A, B");
  const [startSymbol, setStartSymbol] = useState("S");
  const [wordInput, setWordInput] = useState("ab");
  const [productions, setProductions] = useState<GrammarProductionInput[]>([
    { left: "S", rule: "a A" },
    { left: "A", rule: "b B" },
    { left: "B", rule: EPSILON_DISPLAY },
  ]);

  const query = useQuery<GrammarManualAnalysisResult>({
    queryKey: [
      "manual-grammar-analysis",
      terminalsInput,
      nonTerminalsInput,
      startSymbol,
      wordInput,
      productions,
    ],
    queryFn: () =>
      analyzeManualGrammarRequest({
        terminals: parseSymbolList(terminalsInput),
        nonTerminals: parseSymbolList(nonTerminalsInput),
        startSymbol,
        productions,
        word: wordInput,
      }),
    refetchOnWindowFocus: false,
  });

  const validation = query.data?.validation;
  const grammar = validation?.grammar;
  const analysis = query.data?.analysis;

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-xl border bg-card p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Construir gramática</p>
          <p className="text-xs text-muted-foreground">
            Define terminales, no terminales y producciones usando un formato estándar: no terminal a la izquierda y regla a la derecha.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Símbolos terminales
            </label>
            <Input value={terminalsInput} onChange={(event) => setTerminalsInput(event.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Símbolos no terminales
            </label>
            <Input value={nonTerminalsInput} onChange={(event) => setNonTerminalsInput(event.target.value)} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Símbolo inicial
            </label>
            <Input value={startSymbol} onChange={(event) => setStartSymbol(event.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Producciones
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setProductions((current) => [...current, { left: "", rule: "" }])}
              >
                <Plus className="h-4 w-4" />
                Agregar producción
              </Button>
            </div>

            <div className="space-y-3">
              {productions.map((production, index) => (
                <ProductionRowEditor
                  key={`${index}-${production.left}-${production.rule}`}
                  production={production}
                  onChange={(next) =>
                    setProductions((current) => current.map((item, itemIndex) => (itemIndex === index ? next : item)))
                  }
                  onRemove={() =>
                    setProductions((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                  disableRemove={productions.length === 1}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Palabra a validar
          </label>
          <Input
            value={wordInput}
            onChange={(event) => setWordInput(event.target.value)}
            placeholder="abba o a b b a"
          />
        </div>
      </section>

      {query.isLoading && (
        <section className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Analizando la gramática...
        </section>
      )}

      {query.error instanceof Error && (
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {query.error.message}
        </section>
      )}

      <IssuesPanel messages={validation?.issues.map((issue) => issue.message) ?? []} />

      {grammar && <GrammarTuple grammar={grammar} title="Parámetros básicos" />}

      {grammar && analysis && (
        <MembershipSection
          grammar={grammar}
          analysis={analysis}
          wordInput={wordInput}
          showThreadDiagram={false}
        />
      )}
    </div>
  );
}

function TransformationRules({ result }: { result: GrammarAutomatonAnalysisResult }) {
  if (result.transformationRules.length === 0) return null;

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Reglas de transformación</p>
        <p className="text-xs text-muted-foreground">
          Estas reglas se aplican según el tipo del autómata actual para construir la gramática equivalente.
        </p>
      </div>

      <div className="space-y-2">
        {result.transformationRules.map((rule) => (
          <div key={rule.title} className="rounded-lg border bg-background/40 p-3">
            <p className="text-sm font-semibold text-foreground">{rule.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{rule.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StateMappingSection({ grammar }: { grammar: GrammarDefinition }) {
  if (!grammar.stateMapping || grammar.stateMapping.length === 0) return null;

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Conversión de estados</p>
        <p className="text-xs text-muted-foreground">
          Cada estado del autómata se convierte en una variable/no terminal.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {grammar.stateMapping.map((item) => (
          <div key={item.stateId} className="rounded-lg border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-sm font-semibold text-foreground">{item.nonTerminal}</p>
              <span className="font-mono text-xs text-muted-foreground">{item.stateName}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {item.isInitial ? "Estado inicial" : "Estado interno"}
              {item.isAccept ? " · estado de aceptación" : ""}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AutomatonGrammarWorkspace({ data }: { data: AutomataData }) {
  const [wordInput, setWordInput] = useState("");

  const query = useQuery<GrammarAutomatonAnalysisResult>({
    queryKey: ["equivalent-grammar-analysis", getTheorySnapshot(data), wordInput],
    queryFn: () => analyzeEquivalentGrammarRequest(data, wordInput),
    enabled: data.states.length > 0,
    refetchOnWindowFocus: false,
  });

  if (data.states.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          Dibuja un autómata para construir su gramática equivalente.
        </p>
      </section>
    );
  }

  const validation = query.data?.validation;
  const grammar = validation?.grammar;
  const analysis = query.data?.analysis;

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border bg-primary/5 p-4 text-sm text-primary">
        <div className="flex items-center gap-2 font-semibold">
          <GitBranch className="h-4 w-4" />
          Equivalencia desde autómata
        </div>
        <p className="text-sm text-primary/90">
          Aquí no se usan reglas de construcción manual. La gramática se obtiene directamente desde el autómata según sea DFA, NFA o NFA-ε.
        </p>
      </section>

      {query.isLoading && (
        <section className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Construyendo la gramática equivalente...
        </section>
      )}

      {query.error instanceof Error && (
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {query.error.message}
        </section>
      )}

      {query.data && <TransformationRules result={query.data} />}

      <IssuesPanel messages={validation?.issues.map((issue) => issue.message) ?? []} />

      {grammar && <GrammarTuple grammar={grammar} title="Gramática equivalente" />}

      {grammar && <StateMappingSection grammar={grammar} />}

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Palabra a validar</p>
          <p className="text-xs text-muted-foreground">
            La palabra se evalúa sobre la gramática equivalente y el diagrama de hilos resume cómo cambian los estados.
          </p>
        </div>

        <Input
          value={wordInput}
          onChange={(event) => setWordInput(event.target.value)}
          placeholder="abba o a b b a"
        />
      </section>

      {grammar && analysis && (
        <MembershipSection
          grammar={grammar}
          analysis={analysis}
          wordInput={wordInput}
          showThreadDiagram
        />
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
            Gramáticas
          </Button>
        </SheetTrigger>

        <SheetContent side="right" className="w-full p-0 sm:max-w-5xl">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Panel de gramáticas</SheetTitle>
            <SheetDescription>
              Construye una gramática regular con formato estándar o genera su equivalencia desde el autómata actual.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-92px)]">
            <div className="px-6 py-5">
              <Tabs defaultValue="manual" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual" className="gap-2">
                    <Sigma className="h-4 w-4" />
                    Construir gramática
                  </TabsTrigger>
                  <TabsTrigger value="automaton" className="gap-2">
                    <Workflow className="h-4 w-4" />
                    Equivalencia desde autómata
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
