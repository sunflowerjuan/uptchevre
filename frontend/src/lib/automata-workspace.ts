import type { AutomataData } from "@/hooks/useAutomataEditor";

export interface AutomataWorkspaceDocument {
  id: string;
  name: string;
  automaton: AutomataData;
  updatedAt: string;
}

export interface JkautFile {
  format: "uptchevere.jkaut";
  version: 1;
  exportedAt: string;
  document: {
    id: string;
    name: string;
  };
  automaton: AutomataData;
}

const CURRENT_DOCUMENT_STORAGE_KEY = "uptchevere.current-document";
const RECENT_DOCUMENTS_STORAGE_KEY = "uptchevere.recent-documents";
const MAX_RECENT_DOCUMENTS = 2;

export function createEmptyAutomatonData(): AutomataData {
  return {
    states: [],
    transitions: [],
    alphabet: [],
  };
}

export function cloneAutomataData(data: AutomataData): AutomataData {
  return {
    states: data.states.map((state) => ({ ...state })),
    transitions: data.transitions.map((transition) => ({ ...transition })),
    alphabet: [...data.alphabet],
  };
}

export function isAutomataEmpty(data: AutomataData): boolean {
  return data.states.length === 0 && data.transitions.length === 0 && data.alphabet.length === 0;
}

function createDocumentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `doc_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function createWorkspaceDocument(params?: {
  id?: string;
  name?: string;
  automaton?: AutomataData;
  updatedAt?: string;
}): AutomataWorkspaceDocument {
  return {
    id: params?.id ?? createDocumentId(),
    name: params?.name?.trim() || "A",
    automaton: cloneAutomataData(params?.automaton ?? createEmptyAutomatonData()),
    updatedAt: params?.updatedAt ?? new Date().toISOString(),
  };
}

function isAutomataState(value: unknown): value is AutomataData["states"][number] {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    typeof candidate.isInitial === "boolean" &&
    typeof candidate.isAccept === "boolean"
  );
}

function isAutomataTransition(value: unknown): value is AutomataData["transitions"][number] {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.from === "string" &&
    typeof candidate.to === "string" &&
    typeof candidate.symbol === "string"
  );
}

export function isAutomataData(value: unknown): value is AutomataData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;

  return (
    Array.isArray(candidate.states) &&
    candidate.states.every(isAutomataState) &&
    Array.isArray(candidate.transitions) &&
    candidate.transitions.every(isAutomataTransition) &&
    Array.isArray(candidate.alphabet) &&
    candidate.alphabet.every((symbol) => typeof symbol === "string")
  );
}

function isWorkspaceDocument(value: unknown): value is AutomataWorkspaceDocument {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.updatedAt === "string" &&
    isAutomataData(candidate.automaton)
  );
}

function readStorageItem(key: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function writeStorageItem(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

export function loadCurrentWorkspaceDocument(): AutomataWorkspaceDocument | null {
  const raw = readStorageItem(CURRENT_DOCUMENT_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isWorkspaceDocument(parsed) ? createWorkspaceDocument(parsed) : null;
  } catch {
    return null;
  }
}

export function saveCurrentWorkspaceDocument(document: AutomataWorkspaceDocument) {
  writeStorageItem(CURRENT_DOCUMENT_STORAGE_KEY, JSON.stringify(document));
}

export function loadRecentWorkspaceDocuments(): AutomataWorkspaceDocument[] {
  const raw = readStorageItem(RECENT_DOCUMENTS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isWorkspaceDocument)
      .map((document) => createWorkspaceDocument(document))
      .slice(0, MAX_RECENT_DOCUMENTS);
  } catch {
    return [];
  }
}

export function saveRecentWorkspaceDocuments(documents: AutomataWorkspaceDocument[]) {
  writeStorageItem(
    RECENT_DOCUMENTS_STORAGE_KEY,
    JSON.stringify(documents.slice(0, MAX_RECENT_DOCUMENTS)),
  );
}

export function archiveWorkspaceDocument(
  document: AutomataWorkspaceDocument,
  documents: AutomataWorkspaceDocument[],
) {
  if (isAutomataEmpty(document.automaton)) {
    return documents.slice(0, MAX_RECENT_DOCUMENTS);
  }

  const archivedDocument = createWorkspaceDocument({
    ...document,
    updatedAt: new Date().toISOString(),
  });

  return [archivedDocument, ...documents.filter((entry) => entry.id !== document.id)].slice(
    0,
    MAX_RECENT_DOCUMENTS,
  );
}

export function createJkautFile(document: AutomataWorkspaceDocument): JkautFile {
  return {
    format: "uptchevere.jkaut",
    version: 1,
    exportedAt: new Date().toISOString(),
    document: {
      id: document.id,
      name: document.name,
    },
    automaton: cloneAutomataData(document.automaton),
  };
}

export function parseJkautFile(raw: string): AutomataWorkspaceDocument {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("El archivo .jkaut no contiene JSON valido.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("El archivo .jkaut no tiene un formato reconocido.");
  }

  const candidate = parsed as Record<string, unknown>;
  const document = candidate.document as Record<string, unknown> | undefined;

  if (
    candidate.format !== "uptchevere.jkaut" ||
    candidate.version !== 1 ||
    !document ||
    typeof document.name !== "string" ||
    !isAutomataData(candidate.automaton)
  ) {
    throw new Error("El archivo .jkaut no corresponde al formato de UPTCHEVERE.");
  }

  return createWorkspaceDocument({
    id: typeof document.id === "string" ? document.id : undefined,
    name: document.name,
    automaton: candidate.automaton,
    updatedAt: typeof candidate.exportedAt === "string" ? candidate.exportedAt : undefined,
  });
}
