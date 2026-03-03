import { useState, useCallback } from "react";
import { useAutomataEditor } from "@/hooks/useAutomataEditor";
import { EditorToolbar } from "@/components/EditorToolbar";
import { WorkArea } from "@/components/WorkArea";
import { FormalismPanel } from "@/components/FormalismPanel";
import { StringSimulator } from "@/components/StringSimulator";
import { Bot, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const Index = () => {
  const editor = useAutomataEditor();
  const [highlightedStates, setHighlightedStates] = useState<Set<string>>(new Set());

  const handleHighlight = useCallback((states: Set<string>) => {
    setHighlightedStates(states);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-card px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              UPTCHEVRE
            </h1>
            <p className="text-[11px] text-muted-foreground leading-none">
              Editor de Autómatas Finitos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <EditorToolbar
            selectedTool={editor.selectedTool}
            onToolChange={editor.setSelectedTool}
            onClear={editor.clearAll}
          />
          <div className="flex items-center gap-0.5 rounded-lg border bg-card p-1 shadow-sm">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={editor.undo}>
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Deshacer (Ctrl+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={editor.redo}>
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Rehacer (Ctrl+Y)</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="text-xs text-muted-foreground hidden sm:block">
          <span className="font-mono">{editor.data.states.length}</span> estados ·{" "}
          <span className="font-mono">{editor.data.transitions.length}</span> transiciones
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
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
          <StringSimulator
            data={editor.data}
            highlightedStates={highlightedStates}
            onHighlight={handleHighlight}
          />
          <div className="border-t">
            <FormalismPanel data={editor.data} />
          </div>
        </aside>
      </div>

      {/* Bottom hint bar */}
      <footer className="border-t bg-card px-4 py-2 text-[11px] text-muted-foreground">
        <span className="font-medium">Tips:</span> Doble clic en estado = toggle aceptación · Doble clic en nombre = renombrar · Clic derecho = marcar inicial · <span className="font-mono">a+b</span>, <span className="font-mono">a|b</span>, <span className="font-mono">a,b</span> para múltiples símbolos
      </footer>
    </div>
  );
};

export default Index;
