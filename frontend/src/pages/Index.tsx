import { useState, useCallback } from "react";
import { useAutomataEditor } from "@/hooks/useAutomataEditor";
import { WorkArea } from "@/components/WorkArea";
import { FormalismPanel } from "@/components/FormalismPanel";
import { StringSimulator } from "@/components/StringSimulator";
import { EditorToolbar } from "@/components/EditorToolbar";
import { Header } from "@/layout/header";
import { Footer } from "@/layout/footer";
import { Sidebar, type SidebarModule } from "@/layout/Sidebar";
import { SettingsPanel } from "@/layout/settingsPanel";

const Index = () => {
  const editor = useAutomataEditor();
  const [highlightedStates, setHighlightedStates] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeModule, setActiveModule] = useState<SidebarModule>("both");
  const [showSimulator, setShowSimulator] = useState(true);
  const [showFormalism, setShowFormalism] = useState(true);

  const handleHighlight = useCallback((states: Set<string>) => {
    setHighlightedStates(states);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header
        onUndo={editor.undo}
        onRedo={editor.redo}
        data={editor.data}
      />

      {/* Main content */}
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
              onClear={editor.clearAll}
            />
          </div>
          {activeModule === "settings" ? (
            <SettingsPanel
              showSimulator={showSimulator}
              showFormalism={showFormalism}
              onShowSimulatorChange={setShowSimulator}
              onShowFormalismChange={setShowFormalism}
            />
          ) : (
            <>
              {(activeModule === "both" || activeModule === "simulator") && showSimulator && (
                <StringSimulator
                  data={editor.data}
                  highlightedStates={highlightedStates}
                  onHighlight={handleHighlight}
                />
              )}
              {(activeModule === "both" || activeModule === "formalism") && showFormalism && (
                <div className="border-t">
                  <FormalismPanel data={editor.data} />
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      <Footer />
    </div>
  );
};

export default Index;
