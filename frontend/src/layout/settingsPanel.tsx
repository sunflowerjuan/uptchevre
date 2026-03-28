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
import { displayWord } from "@/lib/automata";

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
            Ajusta la interfaz y consulta la documentacion teorica del editor.
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

              <RadioGroup value={theme} onValueChange={setTheme} className="grid gap-3 md:grid-cols-3">
                <Label htmlFor="theme-system" className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-accent">
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

                <Label htmlFor="theme-light" className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-accent">
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

                <Label htmlFor="theme-dark" className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-accent">
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
                <Switch checked={showSimulator} onCheckedChange={onShowSimulatorChange} />
              </div>

              <div className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">Mostrar formalismos</p>
                  <p className="text-xs text-muted-foreground">
                    Muestra la clasificacion, delta, e-closure y definiciones extendidas.
                  </p>
                </div>
                <Switch checked={showFormalism} onCheckedChange={onShowFormalismChange} />
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
                    <a href={creator.github} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                      <GitBranch className="h-3.5 w-3.5" />
                      GitHub
                    </a>
                    <a href={creator.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
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
                <p className="text-sm font-semibold text-foreground">Empezar con la herramienta</p>
                <p className="text-xs text-muted-foreground">
                  Recorrido recomendado para construir y validar un automata desde cero.
                </p>
              </div>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>1. Elige una herramienta en el panel izquierdo para seleccionar, crear o eliminar.</li>
                <li>2. Agrega estados, arrastralos y define cuales son iniciales y de aceptacion.</li>
                <li>3. Crea transiciones; si confirmas una etiqueta vacia, se registra una transicion epsilon.</li>
                <li>4. Usa Formalismos para verificar tipo de automata, delta, e-closure y definiciones teoricas.</li>
                <li>5. Usa Simulacion para obtener delta* y caminos aceptados o rechazados desde el backend.</li>
              </ol>
            </section>

            <section className="space-y-3 rounded-xl border bg-card p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Los automatas</p>
                <p className="text-xs text-muted-foreground">
                  UPTCHEVRE clasifica automaticamente el automata construido como DFA, NFA o NFA-EPSILON.
                </p>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>DFA: cada pareja estado-simbolo conduce a un unico destino y no usa epsilon.</li>
                <li>NFA: una misma pareja estado-simbolo puede abrir varios caminos posibles.</li>
                <li>NFA-EPSILON: ademas del no determinismo, permite transiciones epsilon que no consumen entrada.</li>
              </ul>
            </section>

            <section className="space-y-3 rounded-xl border bg-card p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Formalismos NFA</p>
                <p className="text-xs text-muted-foreground">
                  Para NFA, el backend formaliza delta como una funcion a subconjuntos.
                </p>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>M = (Q, Sigma, delta, q0, F).</li>
                <li>delta: Q x Sigma -&gt; P(Q).</li>
                <li>delta*(S, wa) se calcula aplicando primero delta* al prefijo w y luego delta con el simbolo a.</li>
                <li>La tabla de formalismos muestra cada destino como conjunto de estados.</li>
              </ul>
            </section>

            <section className="space-y-3 rounded-xl border bg-card p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Formalismos NFA-E</p>
                <p className="text-xs text-muted-foreground">
                  Cuando existen transiciones epsilon, el backend incorpora e-closure y cierre por epsilon en cada paso.
                </p>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>delta: Q x (Sigma U {"{epsilon}"}) -&gt; P(Q).</li>
                <li>e-closure(q) contiene todos los estados alcanzables desde q usando solo epsilon.</li>
                <li>En delta*, primero se calcula move con el simbolo consumido y luego la e-closure del conjunto resultante.</li>
                <li>La seccion Formalismos lista el cierre epsilon de cada estado cuando el automata lo requiere.</li>
              </ul>
            </section>

            <section className="space-y-3 rounded-xl border bg-card p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Simulacion</p>
                <p className="text-xs text-muted-foreground">
                  La simulacion ya no se calcula solo en cliente: el backend devuelve delta* y trazas de caminos.
                </p>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Ejecutar consume toda la palabra y resalta el conjunto activo final.</li>
                <li>Paso permite recorrer las trazas delta* prefijo por prefijo.</li>
                <li>Para NFA y NFA-E se listan caminos aceptados y rechazados segun las rutas posibles.</li>
                <li>Una palabra se acepta si al menos un camino termina en un estado de aceptacion.</li>
              </ul>
            </section>

            <section className="space-y-3 rounded-xl border bg-card p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Ejemplos</p>
                <p className="text-xs text-muted-foreground">
                  Carga automatas de referencia directamente en el editor para probar teoria y simulacion.
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
                              <span className="font-mono text-foreground">{displayWord(word)}</span>
                              {index < example.tryWords.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </p>
                      </div>

                      <Button type="button" variant="outline" className="shrink-0" onClick={() => onLoadExample(example.data, example.title)}>
                        <PlayCircle className="h-4 w-4" />
                        Cargar ejemplo
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
