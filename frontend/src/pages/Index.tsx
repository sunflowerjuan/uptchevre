import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AutomataData } from "@/hooks/useAutomataEditor";
import { useAutomataEditor } from "@/hooks/useAutomataEditor";
import { ImportExportPanel } from "@/components/ImportExportPanel";
import { WorkArea } from "@/components/WorkArea";
import { FormalismPanel } from "@/components/FormalismPanel";
import { StringSimulator } from "@/components/StringSimulator";
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
  const [lastSimulation, setLastSimulation] = useState<AutomataSimulationResult | null>(null);
  const workAreaContainerId = "uptchevere-workarea";
  const workAreaSvgId = "uptchevere-workarea-svg";
  const formalismExportId = "uptchevere-formalism-export";
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

  const handleExportFormalismImage = useCallback(async (fileName: string) => {
    try {
      await exportElementAsPng(
        getHtmlElement(formalismExportId, "No se encontro la vista de formalismo."),
        `${fileName}-formalismo`,
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
  }, [getHtmlElement]);

  const handleCopyFormalism = useCallback(async () => {
    try {
      await copyElementImageToClipboard(
        getHtmlElement(formalismExportId, "No se encontro la vista de formalismo."),
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
  }, [getHtmlElement]);

  const handleExportSimulationMarkdown = useCallback((fileName: string) => {
    if (!analysisQuery.data || !lastSimulation) return;
    exportSimulationAsMarkdown(editor.currentDocument, analysisQuery.data, lastSimulation, fileName);
    toast({
      title: "Simulacion exportada",
      description: "Se descargaron los resultados de simulacion en Markdown.",
    });
  }, [analysisQuery.data, editor.currentDocument, lastSimulation]);

  const handleExportSimulationImage = useCallback(async (fileName: string) => {
    try {
      await exportElementAsPng(
        getHtmlElement(simulationExportId, "No se encontro la vista de simulacion."),
        `${fileName}-simulacion`,
      );
      toast({
        title: "Simulacion exportada",
        description: "La simulacion se descargo como PNG.",
      });
    } catch (error) {
      toast({
        title: "No se pudo exportar",
        description: error instanceof Error ? error.message : "No fue posible exportar la simulacion.",
        variant: "destructive",
      });
    }
  }, [getHtmlElement]);

  const handleCopySimulation = useCallback(async () => {
    try {
      await copyElementImageToClipboard(
        getHtmlElement(simulationExportId, "No se encontro la vista de simulacion."),
      );
      toast({
        title: "Simulacion copiada",
        description: "La simulacion se copio al portapapeles como imagen.",
      });
    } catch (error) {
      toast({
        title: "No se pudo copiar",
        description: error instanceof Error ? error.message : "No fue posible copiar la simulacion.",
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
            onShowSimulatorChange={setShowSimulator}
            onShowFormalismChange={setShowFormalism}
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
            <ImportExportPanel
              documentName={editor.documentName}
              onImportFile={(file) => void handleImportFile(file)}
              onExportJkaut={handleExportJkaut}
              onExportDiagramSvg={handleExportDiagramSvg}
              onExportDiagramPng={(fileName) => void handleExportDiagramPng(fileName)}
              onCopyDiagram={() => void handleCopyDiagram()}
              onExportFormalismMarkdown={handleExportFormalismMarkdown}
              onExportFormalismImage={(fileName) => void handleExportFormalismImage(fileName)}
              onCopyFormalism={() => void handleCopyFormalism()}
              onExportSimulationMarkdown={handleExportSimulationMarkdown}
              onExportSimulationImage={(fileName) => void handleExportSimulationImage(fileName)}
              onCopySimulation={() => void handleCopySimulation()}
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
            />
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
                  hasStates={editor.data.states.length > 0}
                  analysis={analysisQuery.data}
                  isLoading={analysisQuery.isLoading}
                  error={analysisQuery.error instanceof Error ? analysisQuery.error.message : null}
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
