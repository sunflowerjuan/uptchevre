import { Bot, Redo2, Settings2, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AutomataData } from "@/hooks/useAutomataEditor";

interface HeaderProps {
  onUndo: () => void;
  onRedo: () => void;
  data: AutomataData;
  settingsPanel: ReactNode;
  exportPanel?: ReactNode;
}

export function Header({ onUndo, onRedo, data, settingsPanel, exportPanel }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b bg-card px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">UPTCHEVRE</h1>
          <p className="text-[11px] leading-none text-muted-foreground">
            Editor de Automatas Finitos
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border bg-card p-1 shadow-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onUndo}>
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Deshacer (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onRedo}>
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Rehacer (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        <Sheet>
          <Tooltip>
            <TooltipTrigger asChild>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </SheetTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Ajustes y ayuda</TooltipContent>
          </Tooltip>

          <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
            <SheetHeader className="border-b px-6 py-5">
              <SheetTitle>Configuracion</SheetTitle>
              <SheetDescription>
                Personaliza la experiencia y consulta la ayuda del editor.
              </SheetDescription>
            </SheetHeader>
            <div className="h-[calc(100vh-88px)]">{settingsPanel}</div>
          </SheetContent>
        </Sheet>

        {exportPanel}
      </div>

      <div className="hidden text-xs text-muted-foreground sm:block">
        <span className="font-mono">{data.states.length}</span> estados ·{" "}
        <span className="font-mono">{data.transitions.length}</span> transiciones
      </div>
    </header>
  );
}

