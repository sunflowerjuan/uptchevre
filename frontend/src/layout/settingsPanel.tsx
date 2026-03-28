import { GitBranch, Heart, Mail, Instagram, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const { theme = "system", setTheme } = useTheme();

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Configuracion
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Ajusta la apariencia y los paneles visibles del espacio de trabajo.
          </p>
        </div>

        <section className="space-y-4 rounded-xl border bg-card p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Tema</p>
            <p className="text-xs text-muted-foreground">
              Por defecto, UPTCHEVRE sigue la configuracion del sistema.
            </p>
          </div>

          <RadioGroup
            value={theme}
            onValueChange={setTheme}
            className="grid gap-3 md:grid-cols-3"
          >
            <Label
              htmlFor="theme-system"
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-accent"
            >
              <RadioGroupItem id="theme-system" value="system" className="mt-1" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Laptop className="h-4 w-4" />
                  Sistema
                </div>
                <p className="text-xs text-muted-foreground">
                  Usa automaticamente el modo claro u oscuro del dispositivo.
                </p>
              </div>
            </Label>

            <Label
              htmlFor="theme-light"
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-accent"
            >
              <RadioGroupItem id="theme-light" value="light" className="mt-1" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sun className="h-4 w-4" />
                  Light
                </div>
                <p className="text-xs text-muted-foreground">
                  Mantiene el editor en una interfaz clara y luminosa.
                </p>
              </div>
            </Label>

            <Label
              htmlFor="theme-dark"
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-accent"
            >
              <RadioGroupItem id="theme-dark" value="dark" className="mt-1" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Moon className="h-4 w-4" />
                  Dark
                </div>
                <p className="text-xs text-muted-foreground">
                  Prioriza contraste alto para trabajar en entornos oscuros.
                </p>
              </div>
            </Label>
          </RadioGroup>
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Paneles</p>
            <p className="text-xs text-muted-foreground">
              Controla que herramientas de apoyo aparecen en la barra lateral derecha.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm">
            <div>
              <p className="font-medium text-foreground">Mostrar simulador</p>
              <p className="text-xs text-muted-foreground">
                Visualiza la ejecucion de palabras sobre el automata.
              </p>
            </div>
            <Switch
              checked={showSimulator}
              onCheckedChange={onShowSimulatorChange}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm">
            <div>
              <p className="font-medium text-foreground">Mostrar formalismo</p>
              <p className="text-xs text-muted-foreground">
                Muestra la definicion formal y la tabla de transiciones.
              </p>
            </div>
            <Switch
              checked={showFormalism}
              onCheckedChange={onShowFormalismChange}
            />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-4 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Heart className="h-3.5 w-3.5" />
            <span>Creditos</span>
          </div>

          {CREATORS.map((creator) => (
            <div key={creator.name} className="rounded-lg border p-3">
              <p className="font-medium text-foreground">{creator.name}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
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
        </section>
      </div>
    </ScrollArea>
  );
}

