import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clipboard, Download, Minus, PanelRightOpen, Plus, RotateCcw, Sigma, Trash2, Workflow } from "lucide-react";
import type { AutomataData } from "@/hooks/useAutomataEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { copySvgElementAsPngToClipboard, exportSvgElementAsSvg } from "@/lib/automata-export";
import { toast } from "@/hooks/use-toast";
import type { ReactNode } from "react";

interface GrammarPanelProps {
  data: AutomataData;
  strictGrammarRules: boolean;
  trigger?: ReactNode;
}

interface GeneralTreeNode {
  id: string;
  label: string;
  tokens: string[];
  children: GeneralTreeNode[];
  isPendingLeaf: boolean;
  isTerminalLeaf: boolean;
}

interface GeneralTreeBuildResult {
  root: GeneralTreeNode;
  isInfinite: boolean;
  maxDepth: number | null;
}

interface PositionedTreeNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isPendingLeaf: boolean;
  isTerminalLeaf: boolean;
}

interface TreeEdge {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

interface TreeLayout {
  width: number;
  height: number;
  nodes: PositionedTreeNode[];
  edges: TreeEdge[];
}

interface ProductionDraft extends GrammarProductionInput {
  id: string;
}

interface ManualGrammarDraftState {
  terminalsInput: string;
  nonTerminalsInput: string;
  productions: ProductionDraft[];
}

function createProductionDraft(): ProductionDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    left: "",
    rule: "",
  };
}

function createManualGrammarDraftState(): ManualGrammarDraftState {
  return {
    terminalsInput: "",
    nonTerminalsInput: "",
    productions: [createProductionDraft()],
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

function findFirstNonTerminalIndex(tokens: string[], nonTerminalSet: Set<string>) {
  return tokens.findIndex((token) => nonTerminalSet.has(token));
}

function hasReachableRecursion(grammar: GrammarDefinition) {
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

function buildGeneralTree(grammar: GrammarDefinition): GeneralTreeBuildResult {
  const productionsByLeft = new Map(
    grammar.nonTerminals.map((nonTerminal) => [
      nonTerminal,
      grammar.productions.filter((production) => production.left === nonTerminal),
    ]),
  );
  const nonTerminalSet = new Set(grammar.nonTerminals);
  const isInfinite = hasReachableRecursion(grammar);
  const maxDepth = isInfinite ? 5 : null;

  const visit = (tokens: string[], depth: number, id: string): GeneralTreeNode => {
    const nextIndex = findFirstNonTerminalIndex(tokens, nonTerminalSet);
    const isTerminalLeaf = nextIndex < 0;
    const isPendingLeaf = !isTerminalLeaf && maxDepth !== null && depth >= maxDepth;

    if (isTerminalLeaf || isPendingLeaf) {
      return {
        id,
        label: formatRule(tokens),
        tokens,
        children: [],
        isPendingLeaf,
        isTerminalLeaf,
      };
    }

    const target = tokens[nextIndex]!;
    const prefix = tokens.slice(0, nextIndex);
    const suffix = tokens.slice(nextIndex + 1);
    const children = (productionsByLeft.get(target) ?? []).map((production, index) =>
      visit(
        [...prefix, ...production.rightTokens, ...suffix],
        depth + 1,
        `${id}-${production.id}-${index}`,
      ),
    );

    return {
      id,
      label: formatRule(tokens),
      tokens,
      children,
      isPendingLeaf: false,
      isTerminalLeaf: false,
    };
  };

  return {
    root: visit([grammar.startSymbol], 0, "root"),
    isInfinite,
    maxDepth,
  };
}

function getNodeWidth(label: string) {
  const baseWidth = 160;
  const dynamicWidth = label.length <= 10
    ? label.length * 14 + 64
    : label.length <= 24
      ? label.length * 16 + 72
      : label.length * 18 + 96;

  return Math.max(baseWidth, dynamicWidth);
}

function buildTreeLayout(root: GeneralTreeNode): TreeLayout {
  const nodeHeight = 42;
  const siblingGap = 24;
  const levelGap = 84;
  const nodes: PositionedTreeNode[] = [];
  const edges: TreeEdge[] = [];

  const measure = (node: GeneralTreeNode): number => {
    const ownWidth = getNodeWidth(node.label);
    if (node.children.length === 0) return ownWidth;

    const childrenWidth =
      node.children.reduce((sum, child) => sum + measure(child), 0) +
      siblingGap * Math.max(0, node.children.length - 1);

    return Math.max(ownWidth, childrenWidth);
  };

  const place = (
    node: GeneralTreeNode,
    left: number,
    top: number,
  ): { width: number; centerX: number; bottomY: number } => {
    const ownWidth = getNodeWidth(node.label);
    const childWidths = node.children.map((child) => measure(child));
    const totalChildrenWidth =
      childWidths.reduce((sum, width) => sum + width, 0) +
      siblingGap * Math.max(0, childWidths.length - 1);
    const subtreeWidth = Math.max(ownWidth, totalChildrenWidth);
    const x = left + subtreeWidth / 2 - ownWidth / 2;
    const centerX = x + ownWidth / 2;

    nodes.push({
      id: node.id,
      label: node.label,
      x,
      y: top,
      width: ownWidth,
      height: nodeHeight,
      isPendingLeaf: node.isPendingLeaf,
      isTerminalLeaf: node.isTerminalLeaf,
    });

    let currentLeft = left + (subtreeWidth - totalChildrenWidth) / 2;
    let bottomY = top + nodeHeight;

    node.children.forEach((child, index) => {
      const childLayout = place(child, currentLeft, top + nodeHeight + levelGap);
      edges.push({
        fromX: centerX,
        fromY: top + nodeHeight,
        toX: childLayout.centerX,
        toY: top + nodeHeight + levelGap,
      });
      currentLeft += childWidths[index]! + siblingGap;
      bottomY = Math.max(bottomY, childLayout.bottomY);
    });

    return { width: subtreeWidth, centerX, bottomY };
  };

  const result = place(root, 24, 24);
  return {
    width: result.width + 48,
    height: result.bottomY + 32,
    nodes,
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
          Primero se renombran los estados, luego las transiciones se vuelven reglas y, si aplica, los estados finales producen {EPSILON_DISPLAY}.
        </p>
      </div>

      <Accordion type="single" collapsible defaultValue="transformation" className="rounded-xl border bg-background/50 px-4">
        <AccordionItem value="transformation">
          <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline">
            Ver pasos de transformacion
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pb-1">
              <div className="rounded-xl border bg-background/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  1. Estados a simbolos
                </p>
                <div className="mt-3 grid gap-2">
                  {stateMapping.map((item) => (
                    <p key={item.stateId} className="rounded-lg border bg-card p-3 font-mono text-sm text-foreground">
                      {item.stateName} {"->"} {item.nonTerminal}
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
                      <div
                        key={production.id}
                        className="rounded-lg border bg-card p-3"
                      >
                        <p className="font-mono text-sm text-foreground">
                          d({fromState}, {terminal}) = {targetState} {"⇒"}{" "}
                          {production.left} {"->"}{" "}
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
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}

function GeneralTreeSection({ grammar }: { grammar: GrammarDefinition }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 960, height: 384 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 24, y: 24 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, offsetX: 24, offsetY: 24 });
  const tree = useMemo(() => buildGeneralTree(grammar), [grammar]);
  const layout = useMemo(() => buildTreeLayout(tree.root), [tree]);
  const maxZoom = useMemo(() => {
    const sizeFactor = Math.max(layout.width / 1200, layout.height / 700);
    return Math.min(24, Math.max(4, Math.ceil(sizeFactor * 4)));
  }, [layout.height, layout.width]);
  const panSpeedFactor = useMemo(() => {
    const normalizedWidth = layout.width / 1400;
    const normalizedHeight = layout.height / 820;
    const sizeFactor = Math.max(normalizedWidth, normalizedHeight, 1);
    const aggressiveSizeBoost = sizeFactor <= 1.25 ? 1 : Math.pow(sizeFactor, 1.35);
    const zoomFactor = Math.max(0.5, 1.55 / Math.max(scale, 0.3));
    return Math.min(12, Math.max(1.15, aggressiveSizeBoost * zoomFactor));
  }, [layout.height, layout.width, scale]);
  const initialViewport = useMemo(() => {
    const isVeryLargeDiagram =
      layout.width > viewportSize.width * 1.5 || layout.height > viewportSize.height * 1.8;

    if (!isVeryLargeDiagram || maxZoom <= 5) {
      return {
        scale: 1,
        offset: { x: 24, y: 24 },
      };
    }

    const halfMaxZoom = Math.max(0.22, maxZoom / 2);

    return {
      scale: halfMaxZoom,
      offset: {
        x: viewportSize.width / (2 * halfMaxZoom) - layout.width / 2,
        y: viewportSize.height / (2 * halfMaxZoom) - layout.height / 2,
      },
    };
  }, [layout.height, layout.width, maxZoom, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateViewportSize = () => {
      setViewportSize({
        width: viewport.clientWidth || 960,
        height: viewport.clientHeight || 384,
      });
    };

    updateViewportSize();

    const observer = new ResizeObserver(updateViewportSize);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setScale(initialViewport.scale);
    setOffset(initialViewport.offset);
  }, [grammar, initialViewport]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();

      const direction = event.deltaY > 0 ? -1 : 1;
      setScale((current) => {
        const next = current + direction * 0.12;
        return Math.min(Math.max(next, 0.2), maxZoom);
      });
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      svg.removeEventListener("wheel", handleWheel);
    };
  }, [maxZoom]);

  const handleExport = () => {
    if (!svgRef.current) return;
    exportSvgElementAsSvg(svgRef.current, "arbol-general-gramatica");
    toast({
      title: "Arbol exportado",
      description: "El arbol general se descargo como SVG.",
    });
  };

  const handleCopy = async () => {
    if (!svgRef.current) return;

    try {
      await copySvgElementAsPngToClipboard(svgRef.current);
      toast({
        title: "Arbol copiado",
        description: "El arbol general se copio al portapapeles como PNG.",
      });
    } catch (error) {
      toast({
        title: "No se pudo copiar",
        description: error instanceof Error ? error.message : "No fue posible copiar el arbol.",
        variant: "destructive",
      });
    }
  };

  const handleMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    setIsPanning(true);
    panStart.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning) return;
    setOffset({
      x: panStart.current.offsetX + (event.clientX - panStart.current.x) * panSpeedFactor,
      y: panStart.current.offsetY + (event.clientY - panStart.current.y) * panSpeedFactor,
    });
  };

  const stopPanning = () => {
    setIsPanning(false);
  };

  const zoomPercentage = Math.round(scale * 100);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Arbol general</p>
        <p className="text-xs text-muted-foreground">
          Expande todas las producciones posibles desde S, arrastrando el prefijo terminal antes del no terminal expandido.
        </p>
        <p className="text-xs text-muted-foreground">
          {tree.isInfinite
            ? `Se detecto recursion alcanzable; el arbol se limita a n = ${tree.maxDepth}. Las hojas pendientes se marcan con borde discontinuo.`
            : "No se detecto recursion alcanzable desde el simbolo inicial, asi que el arbol se construye completo."}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-background/50 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={() => setScale((current) => Math.max(current - 0.1, 0.2))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="w-14 text-center font-mono text-xs text-muted-foreground">{zoomPercentage}%</div>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={() => setScale((current) => Math.min(current + 0.1, maxZoom))}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => {
              setScale(initialViewport.scale);
              setOffset(initialViewport.offset);
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={handleCopy}>
            <Clipboard className="h-4 w-4" />
            Copiar
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Exportar SVG
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="min-w-0 rounded-xl border bg-gradient-to-b from-background to-background/70 p-5">
        <div ref={viewportRef} className="h-[24rem] w-full overflow-hidden rounded-lg border bg-background/60">
          <svg
            ref={svgRef}
            className={`h-full w-full ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
            viewBox={`0 0 ${Math.max(layout.width, 1200)} ${Math.max(layout.height, 900)}`}
            xmlns="http://www.w3.org/2000/svg"
            style={{ userSelect: "none" }}
            onDragStart={(event) => event.preventDefault()}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={stopPanning}
            onMouseLeave={stopPanning}
          >
            <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`} pointerEvents="none">
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
                    fontSize={13}
                    fill="currentColor"
                  >
                    {node.label}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}

function DerivationTreeSection({
  analysis,
  wordInput,
}: {
  analysis: GrammarWordAnalysis;
  wordInput: string;
}) {
  const visibleSteps = analysis.particularDerivation.slice(1);
  const trimmedWord = wordInput.trim() || EPSILON_DISPLAY;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Arbol particular</p>
          <p className="text-sm text-muted-foreground">{analysis.reason}</p>
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            analysis.accepted
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {analysis.accepted ? `${trimmedWord} in L(G)` : `${trimmedWord} not in L(G)`}
        </div>
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

function ManualGrammarWorkspace({
  strictGrammarRules,
  draft,
  onDraftChange,
  onReset,
}: {
  strictGrammarRules: boolean;
  draft: ManualGrammarDraftState;
  onDraftChange: (next: ManualGrammarDraftState) => void;
  onReset: () => void;
}) {
  const { terminalsInput, nonTerminalsInput, productions } = draft;
  const startSymbol = getStartSymbol(nonTerminalsInput);
  const normalizedProductions = useMemo<GrammarProductionInput[]>(
    () => productions.map(({ left, rule }) => ({ left, rule })),
    [productions],
  );

  const previewQuery = useQuery<GrammarManualAnalysisResult>({
    queryKey: ["manual-grammar-preview", terminalsInput, nonTerminalsInput, normalizedProductions, strictGrammarRules],
    queryFn: () =>
      analyzeManualGrammarRequest({
        terminals: parseSymbolList(terminalsInput),
        nonTerminals: parseSymbolList(nonTerminalsInput),
        startSymbol,
        productions: normalizedProductions,
        word: "",
        strictRules: strictGrammarRules,
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
        strictRules: strictGrammarRules,
      }),
  });

  useEffect(() => {
    validateMutation.reset();
  }, [terminalsInput, nonTerminalsInput, normalizedProductions, startSymbol, strictGrammarRules]);

  const validation = previewQuery.data?.validation;
  const grammar = validation?.grammar;
  const analysis = validateMutation.data?.analysis;
  const validatedWord = typeof validateMutation.variables === "string" ? validateMutation.variables : "";

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
          >
            Reset
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Variables / no terminales
            </label>
            <Input
              value={nonTerminalsInput}
              onChange={(event) => onDraftChange({ ...draft, nonTerminalsInput: event.target.value })}
              placeholder="S, A, B"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Alfabeto de terminales
            </label>
            <Input
              value={terminalsInput}
              onChange={(event) => onDraftChange({ ...draft, terminalsInput: event.target.value })}
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
              onClick={() =>
                onDraftChange({
                  ...draft,
                  productions: [...productions, createProductionDraft()],
                })
              }
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
                  onDraftChange({
                    ...draft,
                    productions: productions.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, ...next } : item,
                    ),
                  })
                }
                onRemove={() =>
                  onDraftChange({
                    ...draft,
                    productions: productions.filter((_, itemIndex) => itemIndex !== index),
                  })
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
          <DerivationTreeSection analysis={analysis} wordInput={validatedWord} />
          <DerivationSequenceSection steps={analysis.particularDerivation} />
        </>
      )}
    </div>
  );
}

function AutomatonGrammarWorkspace({
  data,
  strictGrammarRules,
}: {
  data: AutomataData;
  strictGrammarRules: boolean;
}) {
  const previewQuery = useQuery<GrammarAutomatonAnalysisResult>({
    queryKey: ["equivalent-grammar-preview", getTheorySnapshot(data), strictGrammarRules],
    queryFn: () => analyzeEquivalentGrammarRequest(data, "", strictGrammarRules),
    enabled: data.states.length > 0,
    refetchOnWindowFocus: false,
  });

  const validateMutation = useMutation({
    mutationFn: (word: string) => analyzeEquivalentGrammarRequest(data, word, strictGrammarRules),
  });

  useEffect(() => {
    validateMutation.reset();
  }, [data, strictGrammarRules]);

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
          <DerivationTreeSection analysis={analysis} wordInput={validatedWord} />
          <DerivationSequenceSection steps={analysis.particularDerivation} />
        </>
      )}
    </div>
  );
}

export function GrammarPanel({ data, strictGrammarRules, trigger }: GrammarPanelProps) {
  const [manualDraft, setManualDraft] = useState<ManualGrammarDraftState>(() => createManualGrammarDraftState());

  return (
    <div className={trigger ? undefined : "border-t p-2"}>
      <Sheet>
        <SheetTrigger asChild>
          {trigger ?? (
            <Button type="button" variant="secondary" className="w-full justify-center gap-2">
              <PanelRightOpen className="h-4 w-4" />
              GRAMATICAS
            </Button>
          )}
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
                  <ManualGrammarWorkspace
                    strictGrammarRules={strictGrammarRules}
                    draft={manualDraft}
                    onDraftChange={setManualDraft}
                    onReset={() => setManualDraft(createManualGrammarDraftState())}
                  />
                </TabsContent>

                <TabsContent value="automaton" className="space-y-4">
                  <AutomatonGrammarWorkspace data={data} strictGrammarRules={strictGrammarRules} />
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
