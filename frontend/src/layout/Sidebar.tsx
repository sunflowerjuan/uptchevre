import { ChevronLeft, ChevronRight, FileCode2, GitBranch, PlayCircle, Shuffle, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export type SidebarModule = "simulator" | "formalism" | "both" | "conversion" | "minimization";

interface SidebarProps {
  collapsed: boolean;
  activeModule: SidebarModule;
  onToggle: () => void;
  onSelectModule: (module: SidebarModule) => void;
  secondaryTools?: ReactNode;
  footer?: ReactNode;
}

const modules: { id: SidebarModule; label: string; icon: React.ElementType }[] = [
  { id: "both", label: "Panel completo", icon: FileCode2 },
  { id: "simulator", label: "Simulador", icon: PlayCircle },
  { id: "formalism", label: "Formalismo", icon: Table2 },
  { id: "conversion", label: "Transformación", icon: Shuffle },
  { id: "minimization", label: "Minimización", icon: GitBranch },
];

export function Sidebar({
  collapsed,
  activeModule,
  onToggle,
  onSelectModule,
  secondaryTools,
  footer,
}: SidebarProps) {
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

        {secondaryTools && (
          <div className="border-t p-2">
            {!collapsed && (
              <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Herramientas extra
              </p>
            )}
            {secondaryTools}
          </div>
        )}

        {!collapsed && footer}
      </div>
    </aside>
  );
}
