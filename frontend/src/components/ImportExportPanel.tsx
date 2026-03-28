import { useEffect, useRef, useState } from "react";
import {
  Clipboard,
  Download,
  FileImage,
  FileJson2,
  FileUp,
  History,
  Image,
  PanelRightOpen,
  Sigma,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { AutomataWorkspaceDocument } from "@/lib/automata-workspace";

export type FormalismExportSection =
  | "full"
  | "tuple"
  | "matrix"
  | "transition"
  | "closure";

interface ImportExportPanelProps {
  documentName: string;
  onImportFile: (file: File) => void;
  onExportJkaut: (fileName: string) => void;
  onExportDiagramSvg: (fileName: string) => void;
  onExportDiagramPng: (fileName: string) => void;
  onCopyDiagram: () => void;
  onExportFormalismMarkdown: (fileName: string) => void;
  onExportFormalismImage: (fileName: string, section: FormalismExportSection) => void;
  onCopyFormalism: (section: FormalismExportSection) => void;
  onExportSimulationMarkdown: (fileName: string) => void;
  onExportSimulationPdf: (fileName: string) => void;
  recentDocuments: AutomataWorkspaceDocument[];
  onOpenRecent: (document: AutomataWorkspaceDocument) => void;
  canExportDiagram: boolean;
  canExportFormalism: boolean;
  canExportSimulation: boolean;
  supportsEpsilon?: boolean;
}

function formatRecentDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ImportExportPanel({
  documentName,
  onImportFile,
  onExportJkaut,
  onExportDiagramSvg,
  onExportDiagramPng,
  onCopyDiagram,
  onExportFormalismMarkdown,
  onExportFormalismImage,
  onCopyFormalism,
  onExportSimulationMarkdown,
  onExportSimulationPdf,
  recentDocuments,
  onOpenRecent,
  canExportDiagram,
  canExportFormalism,
  canExportSimulation,
  supportsEpsilon = false,
}: ImportExportPanelProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [exportFileName, setExportFileName] = useState(documentName || "A");
  const [formalismSection, setFormalismSection] = useState<FormalismExportSection>("full");

  useEffect(() => {
    setExportFileName(documentName || "A");
  }, [documentName]);

  const effectiveFileName = exportFileName.trim() || "A";

  return (
    <div className="border-t p-2">
      <Sheet>
        <SheetTrigger asChild>
          <Button type="button" variant="secondary" className="w-full justify-center gap-2">
            <PanelRightOpen className="h-4 w-4" />
            Exportar
          </Button>
        </SheetTrigger>

        <SheetContent side="right" className="w-full p-0 sm:max-w-xl">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Exportar e importar</SheetTitle>
          </SheetHeader>

          <div className="h-[calc(100vh-88px)] overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              <section className="space-y-3 rounded-xl border bg-card p-4">
                <p className="text-sm font-semibold text-foreground">Archivo</p>

                <Input
                  value={exportFileName}
                  onChange={(event) => setExportFileName(event.target.value)}
                  placeholder="Nombre del archivo"
                />

                <input
                  ref={importInputRef}
                  type="file"
                  accept=".jkaut,application/json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      onImportFile(file);
                    }
                    event.currentTarget.value = "";
                  }}
                />

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="justify-start gap-2"
                    onClick={() => importInputRef.current?.click()}
                  >
                    <FileUp className="h-4 w-4" />
                    Importar .jkaut
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    className="justify-start gap-2"
                    onClick={() => onExportJkaut(effectiveFileName)}
                  >
                    <FileJson2 className="h-4 w-4" />
                    Exportar .jkaut
                  </Button>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border bg-card p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Diagrama</p>
                  <p className="text-xs text-muted-foreground">
                    Exporta el canvas como SVG, PNG o cópialo al portapapeles.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => onExportDiagramSvg(effectiveFileName)}
                    disabled={!canExportDiagram}
                  >
                    <Workflow className="h-4 w-4" />
                    SVG
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => onExportDiagramPng(effectiveFileName)}
                    disabled={!canExportDiagram}
                  >
                    <Image className="h-4 w-4" />
                    PNG
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={onCopyDiagram}
                    disabled={!canExportDiagram}
                  >
                    <Clipboard className="h-4 w-4" />
                    Copiar
                  </Button>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border bg-card p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Formalismo</p>
                  <p className="text-xs text-muted-foreground">
                    Selecciona la parte que quieres exportar como imagen.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "full", label: "Completo" },
                    { id: "tuple", label: "5-tupla" },
                    { id: "matrix", label: "Matriz" },
                    { id: "transition", label: "δ" },
                    { id: "closure", label: "Clausura-ε", disabled: !supportsEpsilon },
                  ].map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant={formalismSection === option.id ? "default" : "outline"}
                      className="justify-start"
                      disabled={option.disabled}
                      onClick={() => setFormalismSection(option.id as FormalismExportSection)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => onExportFormalismImage(effectiveFileName, formalismSection)}
                    disabled={!canExportFormalism}
                  >
                    <FileImage className="h-4 w-4" />
                    PNG
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => onCopyFormalism(formalismSection)}
                    disabled={!canExportFormalism}
                  >
                    <Clipboard className="h-4 w-4" />
                    Copiar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => onExportFormalismMarkdown(effectiveFileName)}
                    disabled={!canExportFormalism}
                  >
                    <Sigma className="h-4 w-4" />
                    Markdown
                  </Button>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border bg-card p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Simulación</p>
                  <p className="text-xs text-muted-foreground">
                    Exporta la ultima simulación disponible como PDF o Markdown.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => onExportSimulationPdf(effectiveFileName)}
                    disabled={!canExportSimulation}
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => onExportSimulationMarkdown(effectiveFileName)}
                    disabled={!canExportSimulation}
                  >
                    <Sigma className="h-4 w-4" />
                    Markdown
                  </Button>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <History className="h-4 w-4" />
                  Recientes
                </div>

                {recentDocuments.length > 0 ? (
                  <div className="space-y-2">
                    {recentDocuments.map((document) => (
                      <button
                        key={document.id}
                        type="button"
                        className="w-full rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-accent"
                        onClick={() => onOpenRecent(document)}
                      >
                        <p className="truncate text-xs font-medium text-foreground">{document.name}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {document.automaton.states.length} estados · {document.automaton.transitions.length} transiciones
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatRecentDate(document.updatedAt)}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">SIN RECIENTES</p>
                )}
              </section>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
