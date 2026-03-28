import { useMemo, useRef } from "react";
import { Download, FileImage, FileJson2, FileUp, History, Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AutomataWorkspaceDocument } from "@/lib/automata-workspace";

interface ImportExportPanelProps {
  documentName: string;
  onDocumentNameChange: (name: string) => void;
  onImportFile: (file: File) => void;
  onExportJkaut: () => void;
  onExportDiagram: () => void;
  onExportFormalism: () => void;
  onExportSimulation: () => void;
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
  onDocumentNameChange,
  onImportFile,
  onExportJkaut,
  onExportDiagram,
  onExportFormalism,
  onExportSimulation,
  recentDocuments,
  onOpenRecent,
  canExportDiagram,
  canExportFormalism,
  canExportSimulation,
}: ImportExportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sortedRecentDocuments = useMemo(
    () =>
      [...recentDocuments].sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      ),
    [recentDocuments],
  );

  return (
    <div className="border-t p-2">
      <div className="rounded-xl border bg-muted/20 p-3">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Importar y exportar
            </p>
            <Input
              value={documentName}
              onChange={(event) => onDocumentNameChange(event.target.value)}
              className="h-8 text-xs"
              placeholder="Nombre del automata"
            />
          </div>

          <input
            ref={inputRef}
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
              size="sm"
              className="justify-start gap-2 text-xs"
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="h-3.5 w-3.5" />
              Importar .jkaut
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="justify-start gap-2 text-xs"
              onClick={onExportJkaut}
            >
              <FileJson2 className="h-3.5 w-3.5" />
              Exportar .jkaut
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-start gap-2 text-xs"
              onClick={onExportDiagram}
              disabled={!canExportDiagram}
            >
              <FileImage className="h-3.5 w-3.5" />
              Imagen
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-start gap-2 text-xs"
              onClick={onExportFormalism}
              disabled={!canExportFormalism}
            >
              <Sigma className="h-3.5 w-3.5" />
              Formalismo
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="col-span-2 justify-start gap-2 text-xs"
              onClick={onExportSimulation}
              disabled={!canExportSimulation}
            >
              <Download className="h-3.5 w-3.5" />
              Resultados de simulacion
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              Recientes
            </div>

            {sortedRecentDocuments.length > 0 ? (
              <div className="space-y-2">
                {sortedRecentDocuments.map((document) => (
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
              <p className="text-xs text-muted-foreground">
                Los ultimos dos automatas apareceran aqui cuando cambies de trabajo.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
