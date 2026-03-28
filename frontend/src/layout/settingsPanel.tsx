import { GitBranch, Heart, Mail, Instagram, Laptop, Moon, PlayCircle, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AutomataData } from "@/hooks/useAutomataEditor";
import { AUTOMATA_EXAMPLES } from "@/constants/automataExamples";
import { CREATORS } from "@/constants/creators";

interface SettingsPanelProps {
  showFormalism: boolean;
  showSimulator: boolean;
  onShowFormalismChange: (checked: boolean) => void;
  onShowSimulatorChange: (checked: boolean) => void;
  onLoadExample: (data: AutomataData, title: string) => void;
}

export function SettingsPanel({
  showFormalism,
  showSimulator,
  onShowFormalismChange,
  onShowSimulatorChange,
  onLoadExample,
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
            Ajusta la apariencia y consulta la guia integrada del editor.
          </p>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="help">Help</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="help" className="space-y-4">
            <section className="space-y-3 rounded-xl border bg-card p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Que hace UPTCHEVRE hoy</p>
                <p className="text-sm text-muted-foreground">
                  El proyecto es un editor visual de automatas finitos con simulacion de palabras,
                  representacion formal del automata y soporte de temas claro/oscuro.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium text-foreground">Canvas</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Espacio principal para crear estados, moverlos y conectar transiciones.
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium text-foreground">Simulador</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ejecuta palabras paso a paso o completas y resalta los estados activos.
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium text-foreground">Formalismo</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Resume el automata como quintupla y tabla de transiciones.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border bg-card p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Ejemplos interactivos</p>
                <p className="text-xs text-muted-foreground">
                  Carga un automata de referencia directamente en el canvas para explorar el editor.
                </p>
              </div>

              <div className="space-y-3">
                {AUTOMATA_EXAMPLES.map((example) => (
                  <div key={example.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">{example.title}</p>
                        <p className="text-xs text-muted-foreground">{example.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Pruebas sugeridas:{" "}
                          {example.tryWords.map((word, index) => (
                            <span key={`${example.id}-${word || "epsilon"}-${index}`}>
                              <span className="font-mono text-foreground">{word === "" ? "ε" : word}</span>
                              {index < example.tryWords.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => onLoadExample(example.data, example.title)}
                      >
                        <PlayCircle className="h-4 w-4" />
                        Cargar ejemplo
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3 rounded-xl border bg-card p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Flujo recomendado</p>
                <p className="text-xs text-muted-foreground">
                  Sigue este recorrido para construir y probar un automata desde cero.
                </p>
              </div>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>1. Selecciona una herramienta en el panel izquierdo.</li>
                <li>2. Agrega estados sobre el canvas y reubicalos arrastrando.</li>
                <li>3. Marca el estado inicial y los estados de aceptacion.</li>
                <li>4. Crea transiciones y usa el simulador para validar palabras.</li>
                <li>5. Revisa el formalismo para confirmar la definicion generada.</li>
              </ol>
            </section>

            <section className="space-y-3 rounded-xl border bg-card p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Controles del editor</p>
                <p className="text-xs text-muted-foreground">
                  Aqui quedaron reubicados los tips que antes aparecian en el footer.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium text-foreground">Interacciones rapidas</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li>Doble clic en un estado: activa o desactiva aceptacion.</li>
                    <li>Doble clic en el nombre: renombra el estado.</li>
                    <li>Clic derecho en un estado: lo marca como inicial.</li>
                    <li>Ctrl + rueda del mouse: acerca o aleja el canvas.</li>
                    <li>Arrastrar fondo con seleccionar: mueve la vista.</li>
                  </ul>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium text-foreground">Transiciones</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li>Usa la herramienta de transicion y elige origen y destino.</li>
                    <li>Puedes escribir varios simbolos con `a+b`, `a|b` o `a,b`.</li>
                    <li>Las etiquetas de transicion se pueden editar con doble clic.</li>
                    <li>Los bucles y transiciones opuestas se curvan automaticamente.</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border bg-card p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Estado actual del producto</p>
                <p className="text-xs text-muted-foreground">
                  Documentacion breve de lo que esta implementado hasta este momento.
                </p>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Editor visual con herramientas para seleccionar, crear y eliminar.</li>
                <li>Historial local con deshacer y rehacer desde el header o con teclado.</li>
                <li>Simulacion de palabras con traza e iluminacion de estados.</li>
                <li>Panel de formalismo con estados, alfabeto, estado inicial, finales y tabla.</li>
                <li>Configuracion de tema y visibilidad de paneles desde ajustes.</li>
                <li>Backend preparado para equivalencia de automatas, aunque esta vista aun no lo consume.</li>
              </ul>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}

