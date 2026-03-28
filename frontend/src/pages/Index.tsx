import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AutomataData } from "@/hooks/useAutomataEditor";
import { useAutomataEditor } from "@/hooks/useAutomataEditor";
import { WorkArea } from "@/components/WorkArea";
import { FormalismPanel } from "@/components/FormalismPanel";
import { StringSimulator } from "@/components/StringSimulator";
import { EditorToolbar } from "@/components/EditorToolbar";
import { Header } from "@/layout/header";
import { Sidebar, type SidebarModule } from "@/layout/Sidebar";
import { SettingsPanel } from "@/layout/settingsPanel";
import { toast } from "@/hooks/use-toast";
import { analyzeAutomatonRequest } from "@/lib/automata-api";
import { getTheorySnapshot } from "@/lib/automata";

const Index = () => {
  const editor = useAutomataEditor();
  const [highlightedStates, setHighlightedStates] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeModule, setActiveModule] = useState<SidebarModule>("both");
  const [showSimulator, setShowSimulator] = useState(true);
  const [showFormalism, setShowFormalism] = useState(true);

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
    editor.loadAutomaton(example);
    setHighlightedStates(new Set());
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
  }, [editor]);

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
        />

        <WorkArea
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
              />
            )}

            {(activeModule === "both" || activeModule === "formalism") && showFormalism && (
              <div className="border-t">
                <FormalismPanel
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
