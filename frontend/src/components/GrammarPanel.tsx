import { useMemo, useState } from "react";
import { GitBranch, PanelRightOpen, Sigma, Workflow } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeWordWithGrammar,
  buildGrammarOverview,
  deriveGrammarFromAutomaton,
  parseProductionsBlock,
  parseSymbolList,
  type GrammarDefinition,
  type GrammarWordAnalysis,
  validateRegularGrammar,
} from "@/lib/grammar";
import { EPSILON_DISPLAY } from "@/lib/automata";

interface GrammarPanelProps {
  data: AutomataData;
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
          <div className="mt-2 space-y-1 font-mono text-xs text-foreground">
            {grammar.productions.map((production) => (
              <p key={production.id}>
                {production.left} {"->"} {production.rightTokens.length > 0 ? production.rightTokens.join(" ") : EPSILON_DISPLAY}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function GrammarOverview({ grammar }: { grammar: GrammarDefinition }) {
  const overview = buildGrammarOverview(grammar);

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Árbol general de producciones</p>
        <p className="text-xs text-muted-foreground">
          Vista estructural de cada no terminal y sus derivaciones inmediatas.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {overview.map((branch) => (
          <div key={branch.nonTerminal} className="rounded-lg border bg-background/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-1 font-mono text-xs font-semibold text-primary">
                {branch.nonTerminal}
              </span>
              <span className="text-xs text-muted-foreground">expande hacia</span>
            </div>
            <div className="space-y-2">
              {branch.productions.map((production) => (
                <div key={production.id} className="rounded-md border px-3 py-2">
                  <p className="font-mono text-xs text-foreground">{production.label}</p>
                  {production.note && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{production.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ParticularDerivation({ analysis }: { analysis: GrammarWordAnalysis }) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Árbol de derivación particular</p>
        <p className="text-xs text-muted-foreground">
          Se muestra la primera derivación aceptante encontrada para la palabra.
        </p>
      </div>

      {analysis.particularDerivation.length > 0 ? (
        <div className="space-y-3">
          {analysis.particularDerivation.map((snapshot, index) => (
            <div key={snapshot.id} className="rounded-lg border bg-background/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Paso {index}
                </p>
                <span className="font-mono text-xs text-primary">{snapshot.sententialLabel}</span>
              </div>
              {snapshot.viaProduction && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Aplicando {snapshot.viaProduction.left} {"->"}{" "}
                  {snapshot.viaProduction.rightTokens.length > 0
                    ? snapshot.viaProduction.rightTokens.join(" ")
                    : EPSILON_DISPLAY}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No apareció una derivación aceptante para la palabra ingresada.
        </p>
      )}
    </section>
  );
}

function ThreadTrace({ analysis }: { analysis: GrammarWordAnalysis }) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Trazas δ* y diagrama de hilos</p>
        <p className="text-xs text-muted-foreground">
          Cada nivel corresponde a un paso de derivación BFS. Los hilos incompatibles con el prefijo
          de la palabra se podan automáticamente.
        </p>
      </div>

      <div className="space-y-3">
        {analysis.exploredLevels.map((level) => (
          <div key={level.depth} className="rounded-lg border bg-background/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nivel {level.depth}
            </p>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {level.snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className={`rounded-md border px-3 py-2 ${
                    snapshot.isAccepted ? "border-primary bg-primary/5" : "bg-card"
                  }`}
                >
                  <p className="font-mono text-xs text-foreground">{snapshot.sententialLabel}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Prefijo consumido:{" "}
                    <span className="font-mono">
                      {snapshot.terminalPrefix.length > 0 ? snapshot.terminalPrefix.join(" ") : "∅"}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MembershipResult({
  grammar,
  analysis,
  wordInput,
}: {
  grammar: GrammarDefinition;
  analysis: GrammarWordAnalysis;
  wordInput: string;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Pertenencia</p>
            <p className="text-xs text-muted-foreground">
              Evaluación de la palabra con derivación por la izquierda.
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

        <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_1fr]">
          <div className="rounded-lg border bg-background/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Palabra</p>
            <p className="mt-1 font-mono text-sm text-foreground">
              {wordInput.trim() || "∅"}
            </p>
          </div>
          <div className="rounded-lg border bg-background/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gramática activa</p>
            <p className="mt-1 text-sm text-foreground">
              {grammar.source === "manual" ? "Manual" : "Derivada del autómata"}
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">{analysis.reason}</p>
      </section>

      <ParticularDerivation analysis={analysis} />
      <GrammarOverview grammar={grammar} />
      <ThreadTrace analysis={analysis} />
    </div>
  );
}

function ManualGrammarWorkspace() {
  const [terminalsInput, setTerminalsInput] = useState("a, b");
  const [nonTerminalsInput, setNonTerminalsInput] = useState("S, A, B");
  const [startSymbol, setStartSymbol] = useState("S");
  const [productionsInput, setProductionsInput] = useState(
    "S -> a A | b B\nA -> a A | b\nB -> b B | a",
  );
  const [wordInput, setWordInput] = useState("ab");

  const validation = useMemo(
    () =>
      validateRegularGrammar({
        terminals: parseSymbolList(terminalsInput),
        nonTerminals: parseSymbolList(nonTerminalsInput),
        startSymbol,
        productions: parseProductionsBlock(productionsInput, "manual"),
        source: "manual",
      }),
    [nonTerminalsInput, productionsInput, startSymbol, terminalsInput],
  );

  const analysis = useMemo(
    () => (validation.grammar ? analyzeWordWithGrammar(validation.grammar, wordInput) : null),
    [validation.grammar, wordInput],
  );

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-xl border bg-card p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Gramática manual</p>
          <p className="text-xs text-muted-foreground">
            Ingresa ΣT, ΣNT, símbolo inicial y producciones. La validación actual trabaja con
            gramáticas regulares por la derecha.
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
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Producciones
            </label>
            <Textarea
              value={productionsInput}
              onChange={(event) => setProductionsInput(event.target.value)}
              className="min-h-40 font-mono text-sm"
            />
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

        {validation.issues.length > 0 ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive">La gramática necesita ajustes</p>
            <ul className="mt-2 space-y-1 text-sm text-destructive">
              {validation.issues.map((issue) => (
                <li key={issue.message}>• {issue.message}</li>
              ))}
            </ul>
          </div>
        ) : validation.grammar ? (
          <GrammarTuple grammar={validation.grammar} title="Parámetros básicos" />
        ) : null}
      </section>

      {validation.grammar && analysis && (
        <MembershipResult grammar={validation.grammar} analysis={analysis} wordInput={wordInput} />
      )}
    </div>
  );
}

function AutomatonGrammarWorkspace({ data }: { data: AutomataData }) {
  const [wordInput, setWordInput] = useState("");

  const grammar = useMemo(() => {
    if (data.states.length === 0) return null;
    return deriveGrammarFromAutomaton(data);
  }, [data]);

  const validation = useMemo(
    () => (grammar ? validateRegularGrammar(grammar) : { issues: [] }),
    [grammar],
  );

  const resolvedGrammar = validation.grammar;
  const analysis = useMemo(
    () => (resolvedGrammar ? analyzeWordWithGrammar(resolvedGrammar, wordInput) : null),
    [resolvedGrammar, wordInput],
  );

  if (data.states.length === 0 || !grammar) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          Dibuja un autómata para generar su gramática equivalente.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <GrammarTuple grammar={grammar} title="Gramática equivalente derivada del autómata" />

      {grammar.stateMapping && (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Conversión de estados</p>
            <p className="text-xs text-muted-foreground">
              Cada estado del autómata se convierte en un no terminal. Los estados de aceptación
              además producen {EPSILON_DISPLAY}.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {grammar.stateMapping.map((item) => (
              <div key={item.stateId} className="rounded-lg border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm font-semibold text-foreground">{item.nonTerminal}</p>
                  <span className="text-[11px] text-muted-foreground">{item.stateName}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.isInitial ? "Estado inicial" : "Estado interno"}
                  {item.isAccept ? " · estado de aceptación" : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {validation.issues.length > 0 ? (
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-semibold text-destructive">
            La gramática derivada requiere revisión
          </p>
          <ul className="mt-2 space-y-1 text-sm text-destructive">
            {validation.issues.map((issue) => (
              <li key={issue.message}>• {issue.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Validar palabra con la gramática derivada</p>
          <p className="text-xs text-muted-foreground">
            Puedes usar la misma lógica de derivación para revisar pertenencia desde la gramática equivalente.
          </p>
        </div>

        <Input
          value={wordInput}
          onChange={(event) => setWordInput(event.target.value)}
          placeholder="abba o a b b a"
        />
      </section>

      {resolvedGrammar && analysis && (
        <MembershipResult grammar={resolvedGrammar} analysis={analysis} wordInput={wordInput} />
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
              Ingresa una gramática regular manualmente o deriva una equivalente desde el autómata actual.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-92px)]">
            <div className="px-6 py-5">
              <Tabs defaultValue="manual" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual" className="gap-2">
                    <Sigma className="h-4 w-4" />
                    Manual
                  </TabsTrigger>
                  <TabsTrigger value="automaton" className="gap-2">
                    <Workflow className="h-4 w-4" />
                    Desde autómata
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-4">
                  <ManualGrammarWorkspace />
                </TabsContent>

                <TabsContent value="automaton" className="space-y-4">
                  <div className="flex items-center gap-2 rounded-xl border bg-primary/5 px-4 py-3 text-sm text-primary">
                    <GitBranch className="h-4 w-4" />
                    La gramática equivalente se construye directamente a partir de los estados y transiciones del editor.
                  </div>
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
