import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AutomataData } from "@/hooks/useAutomataEditor";
import { useAutomataEditor } from "@/hooks/useAutomataEditor";
import { ImportExportPanel } from "@/components/ImportExportPanel";
import { GrammarPanel } from "@/components/GrammarPanel";
import type { FormalismExportSection } from "@/components/ImportExportPanel";
import { WorkArea } from "@/components/WorkArea";
import { FormalismPanel } from "@/components/FormalismPanel";
import { StringSimulator } from "@/components/StringSimulator";
import {
  TransformationPanel,
  type PersistedNfaToDfaState,
} from "@/components/TransformationPanel";
import { EditorToolbar } from "@/components/EditorToolbar";
import { Header } from "@/layout/header";
import { Sidebar, type SidebarModule } from "@/layout/Sidebar";
import { SettingsPanel } from "@/layout/settingsPanel";
import { toast } from "@/hooks/use-toast";
import { analyzeAutomatonRequest } from "@/lib/automata-api";
import type { AutomataSimulationResult } from "@/lib/automata-api";
import {
  copyElementImageToClipboard,
  exportElementAsPng,
  exportElementAsPdf,
  exportFormalismAsMarkdown,
  exportSimulationAsMarkdown,
  exportSvgElementAsSvg,
  exportSvgElementAsPng,
  exportWorkspaceAsJkaut,
} from "@/lib/automata-export";
import { getTheorySnapshot } from "@/lib/automata";
import { parseJkautFile, type AutomataWorkspaceDocument } from "@/lib/automata-workspace";

const Index = () => {
  const editor = useAutomataEditor();
  const [highlightedStates, setHighlightedStates] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeModule, setActiveModule] = useState<SidebarModule>("both");
  const [showSimulator, setShowSimulator] = useState(true);
  const [showFormalism, setShowFormalism] = useState(true);
  const [strictGrammarRules, setStrictGrammarRules] = useState(true);
  const [lastSimulation, setLastSimulation] = useState<AutomataSimulationResult | null>(null);
  /** Conserva AFN/AFD de la conversión al cambiar de módulo en la barra lateral (el panel se desmonta). */
  const [persistedNfaToDfa, setPersistedNfaToDfa] = useState<PersistedNfaToDfaState | null>(null);
  const [transformationView, setTransformationView] = useState<"nfa" | "dfa">("nfa");
  const workAreaContainerId = "uptchevere-workarea";
  const workAreaSvgId = "uptchevere-workarea-svg";
  const formalismExportId = "uptchevere-formalism-export";
  const formalismTupleExportId = "uptchevere-formalism-tuple";
  const formalismMatrixExportId = "uptchevere-formalism-matrix";
  const formalismTransitionExportId = "uptchevere-formalism-transition";
  const formalismClosureExportId = "uptchevere-formalism-closure";
  const simulationExportId = "uptchevere-simulation-export";

  const analysisQuery = useQuery({
    queryKey: ["automata-analysis", getTheorySnapshot(editor.data)],
    queryFn: () => analyzeAutomatonRequest(editor.data),
    enabled: editor.data.states.length > 0,
    refetchOnWindowFocus: false,
  });

  const handleHighlight = useCallback((states: Set<string>) => {
    setHighlightedStates(states);
  }, []);

  const handlePersistedNfaToDfaChange = useCallback((next: PersistedNfaToDfaState | null) => {
    setPersistedNfaToDfa(next);
  }, []);

  const handleTransformationViewChange = useCallback((next: "nfa" | "dfa") => {
    setTransformationView(next);
  }, []);

  const handleLoadConvertedDfa = useCallback((dfa: AutomataData) => {
    editor.loadAutomaton(dfa, { name: `${editor.documentName} (AFD)` });
    setHighlightedStates(new Set());
    toast({
      title: "AFD cargado",
      description: "El autómata determinista se cargó en el editor.",
    });
  }, [editor]);

  const handleLoadExample = useCallback((example: AutomataData, title: string) => {
    editor.loadAutomaton(example, { name: title });
    setHighlightedStates(new Set());
    setLastSimulation(null);
    setShowSimulator(true);
    setShowFormalism(true);
    setActiveModule("both");

    toast({
      title: "Ejemplo cargado",
      description: `Se cargo "${title}" en el editor.`,
    });
  }, [editor]);

  const handleClearEditor = useCallback(() => {
    editor.clearAll();
    setHighlightedStates(new Set());
    setLastSimulation(null);
  }, [editor]);

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const importedDocument = parseJkautFile(text);
        editor.loadAutomaton(importedDocument.automaton, {
          id: importedDocument.id,
          name: importedDocument.name,
        });
        setHighlightedStates(new Set());
        setLastSimulation(null);
        setShowSimulator(true);
        setShowFormalism(true);
        setActiveModule("both");

        toast({
          title: "Archivo importado",
          description: `"${importedDocument.name}" ya esta listo en el editor.`,
        });
      } catch (error) {
        toast({
          title: "No se pudo importar",
          description: error instanceof Error ? error.message : "El archivo no es valido.",
          variant: "destructive",
        });
      }
    },
    [editor],
  );

  const handleOpenRecent = useCallback(
    (document: AutomataWorkspaceDocument) => {
      editor.openRecentDocument(document);
      setHighlightedStates(new Set());
      setLastSimulation(null);
      setShowSimulator(true);
      setShowFormalism(true);
      setActiveModule("both");

      toast({
        title: "Automata recuperado",
        description: `Se abrio "${document.name}" desde recientes.`,
      });
    },
    [editor],
  );

  const handleExportJkaut = useCallback((fileName: string) => {
    exportWorkspaceAsJkaut(editor.currentDocument, fileName);
    toast({
      title: "Archivo exportado",
      description: `Se descargo ${fileName || "A"}.jkaut.`,
    });
  }, [editor.currentDocument]);

  const getSvgElement = useCallback(() => {
    const svgElement = document.getElementById(workAreaSvgId);
    if (!(svgElement instanceof SVGSVGElement)) {
      throw new Error("No se encontro el diagrama actual.");
    }
    return svgElement;
  }, []);

  const getHtmlElement = useCallback((elementId: string, errorMessage: string) => {
    const element = document.getElementById(elementId);
    if (!(element instanceof HTMLElement)) {
      throw new Error(errorMessage);
    }
    return element;
  }, []);

  const getFormalismElementId = useCallback((section: FormalismExportSection) => {
    if (section === "tuple") return formalismTupleExportId;
    if (section === "matrix") return formalismMatrixExportId;
    if (section === "transition") return formalismTransitionExportId;
    if (section === "closure") return formalismClosureExportId;
    return formalismExportId;
  }, []);

  const handleExportDiagramSvg = useCallback((fileName: string) => {
    try {
      exportSvgElementAsSvg(getSvgElement(), fileName);
      toast({
        title: "SVG exportado",
        description: "El diagrama se descargo como SVG.",
      });
    } catch (error) {
      toast({
        title: "No se pudo exportar",
        description: error instanceof Error ? error.message : "No se encontro el diagrama actual.",
        variant: "destructive",
      });
    }
  }, [getSvgElement]);

  const handleExportDiagramPng = useCallback(async (fileName: string) => {
    try {
      await exportSvgElementAsPng(getSvgElement(), fileName);
      toast({
        title: "Imagen exportada",
        description: "El diagrama se descargo como PNG.",
      });
    } catch (error) {
      toast({
        title: "No se pudo exportar la imagen",
        description: error instanceof Error ? error.message : "Ocurrio un error al exportar el diagrama.",
        variant: "destructive",
      });
    }
  }, [getSvgElement]);

  const handleCopyDiagram = useCallback(async () => {
    try {
      await copyElementImageToClipboard(
        getHtmlElement(workAreaContainerId, "No se encontro el diagrama actual."),
      );
      toast({
        title: "Diagrama copiado",
        description: "El diagrama se copio al portapapeles como imagen.",
      });
    } catch (error) {
      toast({
        title: "No se pudo copiar",
        description: error instanceof Error ? error.message : "No fue posible copiar el diagrama.",
        variant: "destructive",
      });
    }
  }, [getHtmlElement]);

  const handleExportFormalismMarkdown = useCallback((fileName: string) => {
    if (!analysisQuery.data) return;
    exportFormalismAsMarkdown(editor.currentDocument, analysisQuery.data, fileName);
    toast({
      title: "Formalismo exportado",
      description: "Se descargo la documentacion del formalismo en Markdown.",
    });
  }, [analysisQuery.data, editor.currentDocument]);

  const handleExportFormalismImage = useCallback(async (fileName: string, section: FormalismExportSection) => {
    try {
      await exportElementAsPng(
        getHtmlElement(
          getFormalismElementId(section),
          "No se encontro la sección seleccionada del formalismo.",
        ),
        `${fileName}-formalismo-${section}`,
      );
      toast({
        title: "Formalismo exportado",
        description: "El formalismo se descargo como PNG.",
      });
    } catch (error) {
      toast({
        title: "No se pudo exportar",
        description: error instanceof Error ? error.message : "No fue posible exportar el formalismo.",
        variant: "destructive",
      });
    }
  }, [getFormalismElementId, getHtmlElement]);

  const handleCopyFormalism = useCallback(async (section: FormalismExportSection) => {
    try {
      await copyElementImageToClipboard(
        getHtmlElement(
          getFormalismElementId(section),
          "No se encontro la sección seleccionada del formalismo.",
        ),
      );
      toast({
        title: "Formalismo copiado",
        description: "El formalismo se copio al portapapeles como imagen.",
      });
    } catch (error) {
      toast({
        title: "No se pudo copiar",
        description: error instanceof Error ? error.message : "No fue posible copiar el formalismo.",
        variant: "destructive",
      });
    }
  }, [getFormalismElementId, getHtmlElement]);

  const handleExportSimulationMarkdown = useCallback((fileName: string) => {
    if (!analysisQuery.data || !lastSimulation) return;
    exportSimulationAsMarkdown(editor.currentDocument, analysisQuery.data, lastSimulation, fileName);
    toast({
      title: "Simulacion exportada",
      description: "Se descargaron los resultados de simulacion en Markdown.",
    });
  }, [analysisQuery.data, editor.currentDocument, lastSimulation]);

  const handleExportSimulationPdf = useCallback(async (fileName: string) => {
    try {
      await exportElementAsPdf(
        getHtmlElement(simulationExportId, "No se encontro la vista de simulacion."),
        `${fileName}-simulacion`,
      );
      toast({
        title: "Simulacion exportada",
        description: "La simulacion se descargo como PDF.",
      });
    } catch (error) {
      toast({
        title: "No se pudo exportar",
        description: error instanceof Error ? error.message : "No fue posible exportar la simulacion.",
        variant: "destructive",
      });
    }
  }, [getHtmlElement]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header
        onUndo={editor.undo}
        onRedo={editor.redo}
        data={editor.data}
        settingsPanel={
          <SettingsPanel
            showSimulator={showSimulator}
            showFormalism={showFormalism}
            strictGrammarRules={strictGrammarRules}
            onShowSimulatorChange={setShowSimulator}
            onShowFormalismChange={setShowFormalism}
            onStrictGrammarRulesChange={setStrictGrammarRules}
            onLoadExample={handleLoadExample}
          />
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          activeModule={activeModule}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
          onSelectModule={setActiveModule}
          footer={
            <>
              <GrammarPanel data={editor.data} strictGrammarRules={strictGrammarRules} />
              <ImportExportPanel
                documentName={editor.documentName}
                onImportFile={(file) => void handleImportFile(file)}
                onExportJkaut={handleExportJkaut}
                onExportDiagramSvg={handleExportDiagramSvg}
                onExportDiagramPng={(fileName) => void handleExportDiagramPng(fileName)}
                onCopyDiagram={() => void handleCopyDiagram()}
                onExportFormalismMarkdown={handleExportFormalismMarkdown}
                onExportFormalismImage={(fileName, section) => void handleExportFormalismImage(fileName, section)}
                onCopyFormalism={(section) => void handleCopyFormalism(section)}
                onExportSimulationMarkdown={handleExportSimulationMarkdown}
                onExportSimulationPdf={(fileName) => void handleExportSimulationPdf(fileName)}
                recentDocuments={editor.recentDocuments}
                onOpenRecent={handleOpenRecent}
                canExportDiagram={editor.data.states.length > 0}
                canExportFormalism={Boolean(
                  analysisQuery.data &&
                    showFormalism &&
                    (activeModule === "both" || activeModule === "formalism"),
                )}
                canExportSimulation={Boolean(
                  analysisQuery.data &&
                    lastSimulation &&
                    showSimulator &&
                    (activeModule === "both" || activeModule === "simulator"),
                )}
                supportsEpsilon={Boolean(analysisQuery.data?.supportsEpsilon)}
              />
            </>
          }
        />

        <WorkArea
          containerId={workAreaContainerId}
          svgId={workAreaSvgId}
          data={editor.data}
          selectedTool={editor.selectedTool}
          selectedNode={editor.selectedNode}
          transitionStart={editor.transitionStart}
          highlightedStates={highlightedStates}
          onSelectNode={editor.setSelectedNode}
          onAddState={editor.addState}
          onMoveState={editor.moveState}
          onCommitMove={editor.commitMove}
          onDeleteState={editor.deleteState}
          onToggleAccept={editor.toggleAccept}
          onSetInitial={editor.setInitial}
          onRenameState={editor.renameState}
          onTransitionStart={editor.setTransitionStart}
          onAddTransition={editor.addTransition}
          onEditTransition={editor.editTransitionSymbols}
        />

        <aside className="hidden w-80 flex-shrink-0 border-l bg-card lg:block overflow-y-auto">
          <div className="border-b p-3">
            <EditorToolbar
              selectedTool={editor.selectedTool}
              onToolChange={editor.setSelectedTool}
              onClear={handleClearEditor}
            />
          </div>

          <>
            {(activeModule === "both" || activeModule === "simulator") && showSimulator && (
              <div id={simulationExportId}>
                <StringSimulator
                  data={editor.data}
                  analysis={analysisQuery.data}
                  analysisLoading={analysisQuery.isLoading}
                  analysisError={analysisQuery.error instanceof Error ? analysisQuery.error.message : null}
                  onHighlight={handleHighlight}
                  onSimulationChange={setLastSimulation}
                />
              </div>
            )}

            {(activeModule === "both" || activeModule === "formalism") && showFormalism && (
              <div id={formalismExportId} className="border-t">
                <FormalismPanel
                  automatonName={editor.documentName}
                  rootId={formalismExportId}
                  tupleSectionId={formalismTupleExportId}
                  matrixSectionId={formalismMatrixExportId}
                  transitionSectionId={formalismTransitionExportId}
                  closureSectionId={formalismClosureExportId}
                  hasStates={editor.data.states.length > 0}
                  analysis={analysisQuery.data}
                  isLoading={analysisQuery.isLoading}
                  error={analysisQuery.error instanceof Error ? analysisQuery.error.message : null}
                />
              </div>
            )}

            {activeModule === "conversion" && (
              <div className="border-t">
                <TransformationPanel
                  data={editor.data}
                  analysis={analysisQuery.data}
                  analysisLoading={analysisQuery.isLoading}
                  onLoadDfa={handleLoadConvertedDfa}
                  persistedNfaToDfa={persistedNfaToDfa}
                  onPersistedNfaToDfaChange={handlePersistedNfaToDfaChange}
                  transformationView={transformationView}
                  onTransformationViewChange={handleTransformationViewChange}
                />
              </div>
            )}
          </>
        </aside>
      </div>
    </div>
  );
};

export default Index;
