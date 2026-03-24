import { GitBranch, Heart } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface SettingsPanelProps {
  showFormalism: boolean;
  showSimulator: boolean;
  onShowFormalismChange: (checked: boolean) => void;
  onShowSimulatorChange: (checked: boolean) => void;
}

export function SettingsPanel({
  showFormalism,
  showSimulator,
  onShowFormalismChange,
  onShowSimulatorChange,
}: SettingsPanelProps) {
  return (
    <div className="space-y-5 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Creditos y Configuracion
      </h3>

      <div className="space-y-2 rounded-lg border bg-card p-3 text-xs">
        <p className="font-semibold text-foreground">UPTCHEVRE</p>
        <p className="text-muted-foreground">Editor visual de automatas finitos para aprendizaje.</p>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Heart className="h-3.5 w-3.5" />
          <span>Construido con React + TypeScript</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5" />
          <span>Refactor layout modular</span>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-3">
        <p className="text-xs font-semibold text-foreground">Configuracion</p>
        <div className="flex items-center justify-between text-xs">
          <span>Mostrar simulador</span>
          <Switch checked={showSimulator} onCheckedChange={onShowSimulatorChange} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span>Mostrar formalismo</span>
          <Switch checked={showFormalism} onCheckedChange={onShowFormalismChange} />
        </div>
      </div>
    </div>
  );
}

