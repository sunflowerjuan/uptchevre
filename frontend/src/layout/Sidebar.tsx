import { ChevronLeft, ChevronRight, FileCode2, PlayCircle, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SidebarModule = "simulator" | "formalism" | "both";

interface SidebarProps {
  collapsed: boolean;
  activeModule: SidebarModule;
  onToggle: () => void;
  onSelectModule: (module: SidebarModule) => void;
}

const modules: { id: SidebarModule; label: string; icon: React.ElementType }[] = [
  { id: "both", label: "Panel completo", icon: FileCode2 },
  { id: "simulator", label: "Simulador", icon: PlayCircle },
  { id: "formalism", label: "Formalismo", icon: Table2 },
];

export function Sidebar({ collapsed, activeModule, onToggle, onSelectModule }: SidebarProps) {
  return (
    <aside
      className={`border-r bg-card transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-3 py-3">
          {!collapsed && (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Herramientas
            </p>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${collapsed ? "mx-auto" : ""}`}
            onClick={onToggle}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {modules.map((module) => {
            const ActiveIcon = module.icon;
            const selected = activeModule === module.id;
            return (
              <Button
                key={module.id}
                variant={selected ? "secondary" : "ghost"}
                className={`w-full ${collapsed ? "justify-center" : "justify-start gap-2"}`}
                onClick={() => onSelectModule(module.id)}
              >
                <ActiveIcon className="h-4 w-4" />
                {!collapsed && <span className="text-xs">{module.label}</span>}
              </Button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

