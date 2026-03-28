import type { AutomataWorkspaceDocument } from "@/lib/automata-workspace";
import { createJkautFile } from "@/lib/automata-workspace";
import type { AutomataAnalysisResult, AutomataSimulationResult } from "@/lib/automata-api";
import { EPSILON_DISPLAY, displayWord } from "@/lib/automata";

const SIGMA = "\u03a3";
const DELTA = "\u03b4";
const EMPTY_SET = "\u2205";

function sanitizeFileName(name: string) {
  const normalized = name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "-");
  return normalized.length > 0 ? normalized : "automata";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadText(content: string, fileName: string, contentType = "text/plain;charset=utf-8") {
  downloadBlob(new Blob([content], { type: contentType }), fileName);
}

function inlineComputedStyles(source: SVGElement, target: SVGElement) {
  const computedStyle = window.getComputedStyle(source);
  const styleProperties = [
    "fill",
    "stroke",
    "stroke-width",
    "opacity",
    "font-family",
    "font-size",
    "font-weight",
    "letter-spacing",
    "paint-order",
    "dominant-baseline",
    "text-anchor",
  ];

  const inlineStyle = styleProperties
    .map((property) => `${property}:${computedStyle.getPropertyValue(property)};`)
    .join("");

  if (inlineStyle.length > 0) {
    target.setAttribute("style", `${target.getAttribute("style") ?? ""}${inlineStyle}`);
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);

  sourceChildren.forEach((child, index) => {
    const targetChild = targetChildren[index];
    if (child instanceof SVGElement && targetChild instanceof SVGElement) {
      inlineComputedStyles(child, targetChild);
    }
  });
}

function formatStateSet(names: string[]) {
  return names.length > 0 ? `{${names.join(", ")}}` : EMPTY_SET;
}

function getAutomatonTypeLabel(type: AutomataAnalysisResult["automatonType"]) {
  return type === "NFA_EPSILON" ? "NFA-ε" : type;
}

function getTransitionDefinitionTarget(
  type: AutomataAnalysisResult["automatonType"],
  names: string[],
) {
  if (names.length === 0) return EMPTY_SET;
  if (type === "DFA") return names[0] ?? EMPTY_SET;
  return formatStateSet(names);
}

function buildGroupedTransitions(analysis: AutomataAnalysisResult) {
  const grouped = new Map<string, string[]>();

  for (const transition of analysis.transitions) {
    const key = `${transition.fromName}::${transition.displaySymbol}`;
    const list = grouped.get(key) ?? [];
    list.push(transition.toName);
    grouped.set(key, Array.from(new Set(list)).sort());
  }

  return grouped;
}

function getTransitionSymbols(analysis: AutomataAnalysisResult) {
  return analysis.supportsEpsilon
    ? [...analysis.alphabet, EPSILON_DISPLAY]
    : analysis.alphabet;
}

export function exportWorkspaceAsJkaut(document: AutomataWorkspaceDocument) {
  const file = createJkautFile(document);
  downloadText(
    JSON.stringify(file, null, 2),
    `${sanitizeFileName(document.name)}.jkaut`,
    "application/json;charset=utf-8",
  );
}

export async function exportSvgElementAsPng(svgElement: SVGSVGElement, fileBaseName: string) {
  const clonedSvg = svgElement.cloneNode(true);
  if (!(clonedSvg instanceof SVGSVGElement)) {
    throw new Error("No fue posible clonar el diagrama.");
  }

  inlineComputedStyles(svgElement, clonedSvg);
  clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const serializedSvg = new XMLSerializer().serializeToString(clonedSvg);
  const svgBlob = new Blob([serializedSvg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    image.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No fue posible renderizar el diagrama como imagen."));
      image.src = svgUrl;
    });

    const rect = svgElement.getBoundingClientRect();
    const width = Math.max(Math.round(rect.width), 1200);
    const height = Math.max(Math.round(rect.height), 800);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("No fue posible inicializar el canvas de exportacion.");
    }

    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--background")
      ? `hsl(${getComputedStyle(document.documentElement).getPropertyValue("--background")})`
      : "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${sanitizeFileName(fileBaseName)}-diagrama.png`;
    link.click();
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export function exportFormalismAsMarkdown(
  document: AutomataWorkspaceDocument,
  analysis: AutomataAnalysisResult,
) {
  const groupedTransitions = buildGroupedTransitions(analysis);
  const transitionSymbols = getTransitionSymbols(analysis);
  const q0Value =
    analysis.automatonType === "DFA"
      ? analysis.initialStates[0]?.name ?? EMPTY_SET
      : formatStateSet(analysis.initialStates.map((state) => state.name));

  const transitionDefinitions = analysis.states.flatMap((state) =>
    transitionSymbols.map((symbol) => {
      const targets = groupedTransitions.get(`${state.name}::${symbol}`) ?? [];
      return `${DELTA}(${state.name}, ${symbol}) = ${getTransitionDefinitionTarget(
        analysis.automatonType,
        targets,
      )}`;
    }),
  );

  const matrixHeader = ["Estado", ...transitionSymbols].join(" | ");
  const matrixSeparator = ["---", ...transitionSymbols.map(() => "---")].join(" | ");
  const matrixRows = analysis.states.map((state) => {
    const stateLabel = `${state.isInitial ? "→" : ""}${state.isAccept ? "*" : ""}${state.name}`;
    const values = transitionSymbols.map((symbol) =>
      getTransitionDefinitionTarget(
        analysis.automatonType,
        groupedTransitions.get(`${state.name}::${symbol}`) ?? [],
      ),
    );
    return [stateLabel, ...values].join(" | ");
  });

  const content = [
    `# Formalismo de ${document.name}`,
    "",
    `Tipo: ${getAutomatonTypeLabel(analysis.automatonType)}`,
    "",
    "## 5-tupla",
    "",
    `${document.name} = (Q, ${SIGMA}, ${DELTA}, q₀, F)`,
    "",
    `- Q = ${formatStateSet(analysis.states.map((state) => state.name))}`,
    `- ${SIGMA} = ${formatStateSet(analysis.alphabet)}`,
    `- q₀ = ${q0Value}`,
    `- F = ${formatStateSet(analysis.acceptStates.map((state) => state.name))}`,
    "",
    "## Funcion de transicion",
    "",
    "```text",
    `${DELTA} = {`,
    ...transitionDefinitions.map((definition) => `  ${definition}`),
    "}",
    "```",
    "",
    "## Matriz de transicion",
    "",
    `| ${matrixHeader} |`,
    `| ${matrixSeparator} |`,
    ...matrixRows.map((row) => `| ${row} |`),
  ];

  if (analysis.supportsEpsilon) {
    content.push(
      "",
      "## Clausura-ε",
      "",
      ...analysis.eClosures.map(
        (closure) => `- Clausura-ε(${closure.stateName}) = ${formatStateSet(closure.closureNames)}`,
      ),
    );
  }

  downloadText(content.join("\n"), `${sanitizeFileName(document.name)}-formalismo.md`, "text/markdown;charset=utf-8");
}

export function exportSimulationAsMarkdown(
  document: AutomataWorkspaceDocument,
  analysis: AutomataAnalysisResult,
  simulation: AutomataSimulationResult,
) {
  const lastStep = simulation.deltaStar[simulation.deltaStar.length - 1];
  const finalResult =
    analysis.automatonType === "DFA"
      ? `${DELTA}*(q₀, ${displayWord(simulation.word)}) = ${lastStep?.closureStateNames[0] ?? EMPTY_SET}`
      : `${DELTA}*(q₀, ${displayWord(simulation.word)}) = ${formatStateSet(lastStep?.closureStateNames ?? [])}`;
  const verification =
    analysis.automatonType === "DFA"
      ? simulation.accepted
        ? `${lastStep?.closureStateNames[0] ?? EMPTY_SET} ∈ F`
        : `${lastStep?.closureStateNames[0] ?? EMPTY_SET} ∉ F`
      : simulation.accepted
        ? `${formatStateSet(lastStep?.closureStateNames ?? [])} ∩ F ≠ ∅`
        : `${formatStateSet(lastStep?.closureStateNames ?? [])} ∩ F = ∅`;

  const pathLines = (paths: AutomataSimulationResult["acceptedPaths"], label: string) => [
    `## ${label}`,
    "",
    ...(paths.length > 0
      ? paths.flatMap((path, index) => [
          `### Traza ${index + 1}`,
          ...path.steps.map(
            (step) => `- (${step.fromName}, ${step.displaySymbol}, ${step.toName})`,
          ),
          "",
        ])
      : ["- Sin trazas registradas.", ""]),
  ];

  const content = [
    `# Simulacion de ${document.name}`,
    "",
    `Tipo: ${getAutomatonTypeLabel(analysis.automatonType)}`,
    `Palabra: ${displayWord(simulation.word)}`,
    `Conclusion: ${simulation.accepted ? "ACEPTADA" : "NO ACEPTADA"}`,
    "",
    "## Funcion de transicion extendida",
    "",
    ...simulation.deltaStar.flatMap((step) => {
      const prefix = step.prefix === "" ? EPSILON_DISPLAY : step.prefix;
      return [
        `### Prefijo ${prefix}`,
        `- reachable = ${formatStateSet(step.reachableStateNames)}`,
        `- closure = ${formatStateSet(step.closureStateNames)}`,
        "",
      ];
    }),
    "## Resultado",
    "",
    `- ${finalResult}`,
    `- ${verification}`,
    "",
    ...pathLines(simulation.acceptedPaths, "Trazas de aceptacion"),
    ...pathLines(simulation.rejectedPaths, "Trazas de rechazo"),
  ];

  downloadText(content.join("\n"), `${sanitizeFileName(document.name)}-simulacion.md`, "text/markdown;charset=utf-8");
}
