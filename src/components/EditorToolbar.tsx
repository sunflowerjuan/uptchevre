import { MousePointer2, Circle, ArrowRight, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EditorTool } from "@/hooks/useAutomataEditor";

interface ToolbarProps {
  selectedTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  onClear: () => void;
}

const tools: { id: EditorTool; label: string; icon: React.ElementType }[] = [
  { id: "select", label: "Seleccionar / Mover", icon: MousePointer2 },
  { id: "addState", label: "Agregar Estado", icon: Circle },
  { id: "addTransition", label: "Agregar Transición", icon: ArrowRight },
  { id: "delete", label: "Eliminar", icon: Trash2 },
];

export function EditorToolbar({ selectedTool, onToolChange, onClear }: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card p-1 shadow-sm">
      {tools.map((tool) => (
        <Tooltip key={tool.id}>
          <TooltipTrigger asChild>
            <Button
              variant={selectedTool === tool.id ? "default" : "ghost"}
              size="icon"
              className="h-9 w-9"
              onClick={() => onToolChange(tool.id)}
            >
              <tool.icon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{tool.label}</TooltipContent>
        </Tooltip>
      ))}
      <div className="mx-1 h-6 w-px bg-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClear}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Limpiar Todo</TooltipContent>
      </Tooltip>
    </div>
  );
}
