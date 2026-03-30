import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, PanelRightOpen, Plus, Trash2 } from "lucide-react";
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
  type GrammarValidationSettings,
  type GrammarWordAnalysis,
} from "@/lib/automata-api";
import { EPSILON_DISPLAY, getTheorySnapshot } from "@/lib/automata";
import { exportSvgElementAsSvg } from "@/lib/automata-export";
import { toast } from "@/hooks/use-toast";

interface GrammarPanelProps {
  data: AutomataData;
  validationSettings: GrammarValidationSettings;
}

interface ProductionDraft extends GrammarProductionInput {
  id: string;
}

interface TreeDiagramNode {
  id: string;
  label: string;
  tokens: string[];
  children: TreeDiagramNode[];
  isTerminalLeaf: boolean;
  isPendingLeaf: boolean;
}

interface PositionedTreeNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isTerminalLeaf: boolean;
  isPendingLeaf: boolean;
}

interface TreeEdge {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

interface TreeDiagramLayout {
  width: number;
  height: number;
  nodes: PositionedTreeNode[];
  edges: TreeEdge[];
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

function findFirstNonTerminal(tokens: string[], nonTerminalSet: Set<string>) {
  return tokens.findIndex((token) => nonTerminalSet.has(token));
}

function hasReachableRecursiveCycle(grammar: GrammarDefinition) {
  const adjacency = new Map<string, string[]>();

  grammar.productions.forEach((production) => {
    const next = production.rightTokens.filter((token) => grammar.nonTerminals.includes(token));
    adjacency.set(production.left, [...(adjacency.get(production.left) ?? []), ...next]);
  });

  const visited = new Set<string>();
  const active = new Set<string>();

  const visit = (symbol: string): boolean => {
    if (active.has(symbol)) return true;
    if (visited.has(symbol)) return false;

    visited.add(symbol);
    active.add(symbol);

    for (const next of adjacency.get(symbol) ?? []) {
      if (visit(next)) return true;
    }

    active.delete(symbol);
    return false;
  };

  return visit(grammar.startSymbol);
}

function buildGeneralTree(grammar: GrammarDefinition): {
  root: TreeDiagramNode;
  isInfinite: boolean;
  maxDepthUsed: number | null;
} {
  const nonTerminalSet = new Set(grammar.nonTerminals);
  const isInfinite = hasReachableRecursiveCycle(grammar);
  const maxDepthUsed = isInfinite ? 5 : null;

  const expand = (tokens: string[], depth: number, path: string): TreeDiagramNode => {
    const nonTerminalIndex = findFirstNonTerminal(tokens, nonTerminalSet);
    const pending = maxDepthUsed !== null && depth >= maxDepthUsed && nonTerminalIndex >= 0;
    const isTerminalLeaf = nonTerminalIndex < 0;

    if (isTerminalLeaf || pending) {
      return {
        id: path,
        label: formatRule(tokens),
        tokens,
        children: [],
        isTerminalLeaf,
        isPendingLeaf: pending,
      };
    }

    const target = tokens[nonTerminalIndex]!;
    const prefix = tokens.slice(0, nonTerminalIndex);
    const suffix = tokens.slice(nonTerminalIndex + 1);
    const children = grammar.productions
      .filter((production) => production.left === target)
      .map((production, index) =>
        expand([...prefix, ...production.rightTokens, ...suffix], depth + 1, `${path}-${production.id}-${index}`),
      );

    return {
      id: path,
      label: formatRule(tokens),
      tokens,
      children,
      isTerminalLeaf: false,
      isPendingLeaf: false,
    };
  };

  return {
    root: expand([grammar.startSymbol], 0, "root"),
    isInfinite,
    maxDepthUsed,
  };
}

function buildParticularTree(
  analysis: GrammarWordAnalysis,
  grammar: GrammarDefinition,
): TreeDiagramNode | null {
  if (analysis.particularDerivation.length === 0) return null;
  const nonTerminalSet = new Set(grammar.nonTerminals);

  const buildPath = (steps: GrammarDerivationStep[], index: number): TreeDiagramNode => {
    const step = steps[index]!;
    const isLeaf = index === steps.length - 1;

    return {
      id: step.id,
      label: step.sententialLabel,
      tokens: step.sententialForm,
      children: isLeaf ? [] : [buildPath(steps, index + 1)],
      isTerminalLeaf: isLeaf && !step.sententialForm.some((token) => nonTerminalSet.has(token)),
      isPendingLeaf: false,
    };
  };

  return buildPath(analysis.particularDerivation, 0);
}

function measureTextWidth(label: string, scale: number) {
  return Math.max(96, label.length * 10 * scale + 28);
}

function buildTreeLayout(root: TreeDiagramNode, scale: number): TreeDiagramLayout {
  const nodeHeight = 42 * scale;
  const siblingGap = 24 * scale;
  const levelGap = 82 * scale;
  const positionedNodes: PositionedTreeNode[] = [];
  const edges: TreeEdge[] = [];

  const measure = (node: TreeDiagramNode): number => {
    const ownWidth = measureTextWidth(node.label, scale);
    if (node.children.length === 0) return ownWidth;
    const totalChildrenWidth =
      node.children.reduce((sum, child) => sum + measure(child), 0) +
      siblingGap * Math.max(0, node.children.length - 1);
    return Math.max(ownWidth, totalChildrenWidth);
  };

  const layout = (
    node: TreeDiagramNode,
    left: number,
    top: number,
  ): { width: number; centerX: number; bottomY: number } => {
    const ownWidth = measureTextWidth(node.label, scale);
    const childWidths = node.children.map((child) => measure(child));
    const totalChildrenWidth =
      childWidths.reduce((sum, value) => sum + value, 0) + siblingGap * Math.max(0, childWidths.length - 1);
    const subtreeWidth = Math.max(ownWidth, totalChildrenWidth);
    const nodeX = left + subtreeWidth / 2 - ownWidth / 2;
    const nodeCenterX = nodeX + ownWidth / 2;
    const nodeY = top;

    positionedNodes.push({
      id: node.id,
      label: node.label,
      x: nodeX,
      y: nodeY,
      width: ownWidth,
      height: nodeHeight,
      isTerminalLeaf: node.isTerminalLeaf,
      isPendingLeaf: node.isPendingLeaf,
    });

    let currentLeft = left + (subtreeWidth - totalChildrenWidth) / 2;
    let deepest = nodeY + nodeHeight;

    node.children.forEach((child, index) => {
      const childLayout = layout(child, currentLeft, top + nodeHeight + levelGap);
      edges.push({
        fromX: nodeCenterX,
        fromY: nodeY + nodeHeight,
        toX: childLayout.centerX,
        toY: top + nodeHeight + levelGap,
      });
      currentLeft += childWidths[index]! + siblingGap;
      deepest = Math.max(deepest, childLayout.bottomY);
    });

    return { width: subtreeWidth, centerX: nodeCenterX, bottomY: deepest };
  };

  const result = layout(root, 24, 24);
  return {
    width: result.width + 48,
    height: result.bottomY + 32,
    nodes: positionedNodes,
    edges,
  };
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
  const stateNameByNonTerminal = new Map(stateMapping.map((item) => [item.nonTerminal, item.stateName]));
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
                  δ({fromState}, {terminal}) = {targetState} ⇒ {production.left} → {formatRule(production.rightTokens)}
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
          G = ({`{${grammar.nonTerminals.join(", ")}}`}, {`{${grammar.terminals.join(", ")}}`}, P, {grammar.startSymbol})
        </p>
      </div>
    </section>
  );
}

function TreeDiagramSection({
  title,
  description,
  root,
  exportName,
  note,
}: {
  title: string;
  description: string;
  root: TreeDiagramNode;
  exportName: string;
  note?: string;
}) {
  const [scale, setScale] = useState(1);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const layout = useMemo(() => buildTreeLayout(root, scale), [root, scale]);

  const handleExport = () => {
    if (!svgRef.current) return;
    exportSvgElementAsSvg(svgRef.current, exportName);
    toast({
      title: "Arbol exportado",
      description: "Se descargo el arbol como SVG.",
    });
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-background/50 p-4 md:flex-row md:items-center md:justify-between">
        <label className="flex items-center gap-3 text-sm text-foreground">
          <span>Tamano</span>
          <input
            type="range"
            min="0.6"
            max="1.8"
            step="0.1"
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
          />
          <span className="font-mono text-xs text-muted-foreground">{scale.toFixed(1)}x</span>
        </label>

        <Button type="button" variant="outline" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Exportar SVG
        </Button>
      </div>

      <div className="overflow-auto rounded-xl border bg-gradient-to-b from-background to-background/70 p-4">
        <svg
          ref={svgRef}
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          {layout.edges.map((edge, index) => (
            <line
              key={`edge-${index}`}
              x1={edge.fromX}
              y1={edge.fromY}
              x2={edge.toX}
              y2={edge.toY}
              stroke="currentColor"
              strokeOpacity="0.28"
              strokeWidth={1.5}
            />
          ))}

          {layout.nodes.map((node) => (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx={16}
                fill={
                  node.isPendingLeaf
                    ? "rgba(245, 158, 11, 0.15)"
                    : node.isTerminalLeaf
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(59, 130, 246, 0.08)"
                }
                stroke={
                  node.isPendingLeaf
                    ? "rgba(245, 158, 11, 0.65)"
                    : node.isTerminalLeaf
                      ? "rgba(16, 185, 129, 0.65)"
                      : "rgba(59, 130, 246, 0.35)"
                }
                strokeDasharray={node.isPendingLeaf ? "6 4" : undefined}
              />
              <text
                x={node.x + node.width / 2}
                y={node.y + node.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="monospace"
                fontSize={13 * scale}
                fill="currentColor"
              >
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

function GeneralTreeSection({ grammar }: { grammar: GrammarDefinition }) {
  const tree = useMemo(() => buildGeneralTree(grammar), [grammar]);
  const note = tree.isInfinite
    ? `Se detecto recursion alcanzable desde ${grammar.startSymbol}; por eso el arbol se corto en n = ${tree.maxDepthUsed}. Los nodos pendientes quedan marcados con borde discontinuo.`
    : "No se detecto recursion alcanzable desde el simbolo inicial, asi que el arbol se construyo completo.";

  return (
    <TreeDiagramSection
      title="Arbol general"
      description="Expande todas las producciones posibles desde S y arrastra el prefijo acumulado antes del no terminal expandido."
      root={tree.root}
      exportName="arbol-general-gramatica"
      note={note}
    />
  );
}

function DerivationTreeSection({
  analysis,
  grammar,
}: {
  analysis: GrammarWordAnalysis;
  grammar: GrammarDefinition;
}) {
  const root = useMemo(() => buildParticularTree(analysis, grammar), [analysis, grammar]);

  if (!root) return null;

  return (
    <TreeDiagramSection
      title="Arbol particular"
      description="Sigue la derivacion aceptante encontrada para la cadena validada usando el mismo arrastre de prefijo."
      root={root}
      exportName="arbol-particular-gramatica"
    />
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
            {index < sequence.length - 1 && <span className="text-sm font-semibold text-muted-foreground">→</span>}
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

function ManualGrammarWorkspace({ validationSettings }: { validationSettings: GrammarValidationSettings }) {
  const [terminalsInput, setTerminalsInput] = useState("");
  const [nonTerminalsInput, setNonTerminalsInput] = useState("");
  const [productions, setProductions] = useState<ProductionDraft[]>([createProductionDraft()]);

  const startSymbol = getStartSymbol(nonTerminalsInput);
  const normalizedProductions = useMemo<GrammarProductionInput[]>(
    () => productions.map(({ left, rule }) => ({ left, rule })),
    [productions],
  );

  const previewQuery = useQuery<GrammarManualAnalysisResult>({
    queryKey: [
      "manual-grammar-preview",
      terminalsInput,
      nonTerminalsInput,
      normalizedProductions,
      validationSettings,
    ],
    queryFn: () =>
      analyzeManualGrammarRequest({
        terminals: parseSymbolList(terminalsInput),
        nonTerminals: parseSymbolList(nonTerminalsInput),
        startSymbol,
        productions: normalizedProductions,
        word: "",
        validationSettings,
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
        validationSettings,
      }),
  });

  useEffect(() => {
    validateMutation.reset();
  }, [terminalsInput, nonTerminalsInput, normalizedProductions, startSymbol, validationSettings]);

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
                Puedes escribir reglas pegadas, por ejemplo <span className="font-mono">Aa</span>, <span className="font-mono">0A</span> o separar alternativas con <span className="font-mono">|</span>.
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

      {analysis && grammar && (
        <>
          <DerivationTreeSection analysis={analysis} grammar={grammar} />
          <DerivationSequenceSection steps={analysis.particularDerivation} />
          <ConclusionSection analysis={analysis} wordInput={validatedWord} />
        </>
      )}
    </div>
  );
}

function AutomatonGrammarWorkspace({
  data,
  validationSettings,
}: {
  data: AutomataData;
  validationSettings: GrammarValidationSettings;
}) {
  const previewQuery = useQuery<GrammarAutomatonAnalysisResult>({
    queryKey: ["equivalent-grammar-preview", getTheorySnapshot(data), validationSettings],
    queryFn: () => analyzeEquivalentGrammarRequest(data, "", validationSettings),
    enabled: data.states.length > 0,
    refetchOnWindowFocus: false,
  });

  const validateMutation = useMutation({
    mutationFn: (word: string) => analyzeEquivalentGrammarRequest(data, word, validationSettings),
  });

  useEffect(() => {
    validateMutation.reset();
  }, [data, validationSettings]);

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

      {analysis && grammar && (
        <>
          <DerivationTreeSection analysis={analysis} grammar={grammar} />
          <DerivationSequenceSection steps={analysis.particularDerivation} />
          <ConclusionSection analysis={analysis} wordInput={validatedWord} />
        </>
      )}
    </div>
  );
}

export function GrammarPanel({ data, validationSettings }: GrammarPanelProps) {
  return (
    <div className="border-t p-2">
      <Sheet>
        <SheetTrigger asChild>
          <Button type="button" variant="secondary" className="w-full justify-center gap-2">
            <PanelRightOpen className="h-4 w-4" />
            GRAMATICAS
          </Button>
        </SheetTrigger>

        <SheetContent side="right" className="w-full p-0 sm:max-w-6xl">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>GRAMATICAS</SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-92px)]">
            <div className="px-6 py-5">
              <Tabs defaultValue="manual" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual">Construir gramatica</TabsTrigger>
                  <TabsTrigger value="automaton">Equivalencia desde automata</TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-4">
                  <ManualGrammarWorkspace validationSettings={validationSettings} />
                </TabsContent>

                <TabsContent value="automaton" className="space-y-4">
                  <AutomatonGrammarWorkspace data={data} validationSettings={validationSettings} />
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
