import { GitBranch, Heart, Mail, Instagram } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { CREATORS } from "@/constants/creators";

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

      <div className="space-y-3 rounded-lg border bg-card p-3 text-xs">
        <p className="font-semibold text-foreground">UPTCHEVRE</p>
        <p className="text-muted-foreground">
          Editor visual de automatas finitos para aprendizaje.
        </p>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Heart className="h-3.5 w-3.5" />
          <span>Creadores</span>
        </div>
        {CREATORS.map((creator) => (
          <div key={creator.name} className="rounded-md border p-2">
            <p className="font-medium text-foreground">{creator.name}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
              <a
                href={creator.github}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <GitBranch className="h-3.5 w-3.5" />
                GitHub
              </a>
              <a
                href={creator.instagram}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Instagram className="h-3.5 w-3.5" />
                Instagram
              </a>
              <a href={creator.email} className="inline-flex items-center gap-1 hover:text-foreground">
                <Mail className="h-3.5 w-3.5" />
                Correo
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-3">
        <p className="text-xs font-semibold text-foreground">Configuracion</p>
        <p className="text-[11px] text-muted-foreground">
          Esta seccion esta en construccion.
        </p>
        <div className="flex items-center justify-between text-xs">
          <span>Mostrar simulador</span>
          <Switch
            checked={showSimulator}
            onCheckedChange={onShowSimulatorChange}
            disabled
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span>Mostrar formalismo</span>
          <Switch
            checked={showFormalism}
            onCheckedChange={onShowFormalismChange}
            disabled
          />
        </div>
      </div>
    </div>
  );
}

