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
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { AutomataWorkspaceDocument } from "@/lib/automata-workspace";

interface ImportExportPanelProps {
  documentName: string;
  onImportFile: (file: File) => void;
  onExportJkaut: (fileName: string) => void;
  onExportDiagramSvg: (fileName: string) => void;
  onExportDiagramPng: (fileName: string) => void;
  onCopyDiagram: () => void;
  onExportFormalismMarkdown: (fileName: string) => void;
  onExportFormalismImage: (fileName: string) => void;
  onCopyFormalism: () => void;
  onExportSimulationMarkdown: (fileName: string) => void;
  onExportSimulationImage: (fileName: string) => void;
  onCopySimulation: () => void;
  recentDocuments: AutomataWorkspaceDocument[];
  onOpenRecent: (document: AutomataWorkspaceDocument) => void;
  canExportDiagram: boolean;
  canExportFormalism: boolean;
  canExportSimulation: boolean;
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
  onExportSimulationImage,
  onCopySimulation,
  recentDocuments,
  onOpenRecent,
  canExportDiagram,
  canExportFormalism,
  canExportSimulation,
}: ImportExportPanelProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [exportFileName, setExportFileName] = useState(documentName || "A");

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
            <SheetDescription>
              Descarga el automata, sus vistas derivadas o recupera un archivo `.jkaut`.
            </SheetDescription>
          </SheetHeader>

          <div className="h-[calc(100vh-88px)] overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              <section className="space-y-3 rounded-xl border bg-card p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Archivo</p>
                  <p className="text-xs text-muted-foreground">
                    El nombre del archivo es independiente del nombre del automata actual.
                  </p>
                </div>

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
                    Descarga el formalismo como imagen o como Markdown.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => onExportFormalismImage(effectiveFileName)}
                    disabled={!canExportFormalism}
                  >
                    <FileImage className="h-4 w-4" />
                    PNG
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={onCopyFormalism}
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
                    Exporta la ultima simulacion disponible como imagen o documento.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => onExportSimulationImage(effectiveFileName)}
                    disabled={!canExportSimulation}
                  >
                    <FileImage className="h-4 w-4" />
                    PNG
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={onCopySimulation}
                    disabled={!canExportSimulation}
                  >
                    <Clipboard className="h-4 w-4" />
                    Copiar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => onExportSimulationMarkdown(effectiveFileName)}
                    disabled={!canExportSimulation}
                  >
                    <Download className="h-4 w-4" />
                    Markdown
                  </Button>
                </div>
              </section>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <History className="h-3.5 w-3.5" />
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
      </div>
    </div>
  );
}
