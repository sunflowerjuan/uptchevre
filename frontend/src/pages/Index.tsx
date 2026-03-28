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
  exportFormalismAsMarkdown,
  exportSimulationAsMarkdown,
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
  const workAreaSvgId = "uptchevere-workarea-svg";

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

  const handleExportJkaut = useCallback(() => {
    exportWorkspaceAsJkaut(editor.currentDocument);
    toast({
      title: "Archivo exportado",
      description: `Se descargo ${editor.documentName || "A"}.jkaut.`,
    });
  }, [editor.currentDocument, editor.documentName]);

  const handleExportDiagram = useCallback(async () => {
    const svgElement = document.getElementById(workAreaSvgId);
    if (!(svgElement instanceof SVGSVGElement)) {
      toast({
        title: "No se pudo exportar",
        description: "No se encontro el diagrama actual.",
        variant: "destructive",
      });
      return;
    }

    try {
      await exportSvgElementAsPng(svgElement, editor.documentName);
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
  }, [editor.documentName]);

  const handleExportFormalism = useCallback(() => {
    if (!analysisQuery.data) return;
    exportFormalismAsMarkdown(editor.currentDocument, analysisQuery.data);
    toast({
      title: "Formalismo exportado",
      description: "Se descargo la documentacion del formalismo en Markdown.",
    });
  }, [analysisQuery.data, editor.currentDocument]);

  const handleExportSimulation = useCallback(() => {
    if (!analysisQuery.data || !lastSimulation) return;
    exportSimulationAsMarkdown(editor.currentDocument, analysisQuery.data, lastSimulation);
    toast({
      title: "Simulacion exportada",
      description: "Se descargaron los resultados de simulacion en Markdown.",
    });
  }, [analysisQuery.data, editor.currentDocument, lastSimulation]);

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
              onDocumentNameChange={editor.setDocumentName}
              onImportFile={(file) => void handleImportFile(file)}
              onExportJkaut={handleExportJkaut}
              onExportDiagram={() => void handleExportDiagram()}
              onExportFormalism={handleExportFormalism}
              onExportSimulation={handleExportSimulation}
              recentDocuments={editor.recentDocuments}
              onOpenRecent={handleOpenRecent}
              canExportDiagram={editor.data.states.length > 0}
              canExportFormalism={Boolean(analysisQuery.data)}
              canExportSimulation={Boolean(analysisQuery.data && lastSimulation)}
            />
          }
        />

        <WorkArea
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
              <StringSimulator
                data={editor.data}
                analysis={analysisQuery.data}
                analysisLoading={analysisQuery.isLoading}
                analysisError={analysisQuery.error instanceof Error ? analysisQuery.error.message : null}
                onHighlight={handleHighlight}
                onSimulationChange={setLastSimulation}
              />
            )}

            {(activeModule === "both" || activeModule === "formalism") && showFormalism && (
              <div className="border-t">
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
