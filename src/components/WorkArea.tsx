import { useRef, useCallback, useState } from "react";
import { StateNode } from "./StateNode";
import { TransitionRenderer } from "./TransitionRenderer";
import type { EditorTool, AutomataData } from "@/hooks/useAutomataEditor";

interface WorkAreaProps {
  data: AutomataData;
  selectedTool: EditorTool;
  selectedNode: string | null;
  transitionStart: string | null;
  highlightedStates?: Set<string>;
  onSelectNode: (id: string | null) => void;
  onAddState: (x: number, y: number) => void;
  onMoveState: (id: string, x: number, y: number) => void;
  onCommitMove: (snapshot: AutomataData) => void;
  onDeleteState: (id: string) => void;
  onToggleAccept: (id: string) => void;
  onSetInitial: (id: string) => void;
  onRenameState: (id: string, newLabel: string) => void;
  onTransitionStart: (id: string | null) => void;
  onAddTransition: (from: string, to: string, symbol: string) => void;
  onEditTransition: (from: string, to: string, oldSymbols: string[], newInput: string) => void;
}

export function WorkArea({
  data,
  selectedTool,
  selectedNode,
  transitionStart,
  highlightedStates,
  onSelectNode,
  onAddState,
  onMoveState,
  onCommitMove,
  onDeleteState,
  onToggleAccept,
  onSetInitial,
  onRenameState,
  onTransitionStart,
  onAddTransition,
  onEditTransition,
}: WorkAreaProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const preDragSnapshot = useRef<AutomataData | null>(null);

  const getSVGPoint = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== svgRef.current) return;
      if (selectedTool === "addState") {
        const pt = getSVGPoint(e);
        onAddState(pt.x, pt.y);
      } else {
        onSelectNode(null);
        onTransitionStart(null);
      }
    },
    [selectedTool, getSVGPoint, onAddState, onSelectNode, onTransitionStart]
  );

  const handleStateMouseDown = useCallback(
    (stateId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const state = data.states.find((s) => s.id === stateId);
      if (!state) return;

      if (selectedTool === "select") {
        onSelectNode(stateId);
        const pt = getSVGPoint(e);
        setDragOffset({ x: pt.x - state.x, y: pt.y - state.y });
        setDragging(stateId);
        preDragSnapshot.current = data;
      } else if (selectedTool === "delete") {
        onDeleteState(stateId);
      } else if (selectedTool === "addTransition") {
        if (!transitionStart) {
          onTransitionStart(stateId);
          onSelectNode(stateId);
        } else {
          const symbol = prompt("Símbolos de transición (ej: a, b, ε — separar con , + |):");
          if (symbol !== null && symbol.trim() !== "") {
            onAddTransition(transitionStart, stateId, symbol.trim());
          }
          onTransitionStart(null);
          onSelectNode(null);
        }
      }
    },
    [selectedTool, data, getSVGPoint, onSelectNode, onDeleteState, transitionStart, onTransitionStart, onAddTransition]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const pt = getSVGPoint(e);
      onMoveState(dragging, pt.x - dragOffset.x, pt.y - dragOffset.y);
    },
    [dragging, dragOffset, getSVGPoint, onMoveState]
  );

  const handleMouseUp = useCallback(() => {
    if (dragging && preDragSnapshot.current) {
      // Only commit if position actually changed
      const snap = preDragSnapshot.current;
      const current = data.states.find((s) => s.id === dragging);
      const old = snap.states.find((s) => s.id === dragging);
      if (current && old && (current.x !== old.x || current.y !== old.y)) {
        onCommitMove(snap);
      }
      preDragSnapshot.current = null;
    }
    setDragging(null);
  }, [dragging, data.states, onCommitMove]);

  const handleDoubleClick = useCallback(
    (stateId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (selectedTool === "select") {
        onToggleAccept(stateId);
      }
    },
    [selectedTool, onToggleAccept]
  );

  const handleContextMenu = useCallback(
    (stateId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (selectedTool === "select") {
        onSetInitial(stateId);
      }
    },
    [selectedTool, onSetInitial]
  );

  const cursorClass =
    selectedTool === "addState"
      ? "cursor-crosshair"
      : selectedTool === "delete"
      ? "cursor-pointer"
      : selectedTool === "addTransition"
      ? "cursor-cell"
      : "cursor-default";

  return (
    <div className="relative flex-1 overflow-hidden rounded-lg border bg-canvas canvas-grid">
      {transitionStart && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
          Selecciona el estado destino para la transición desde{" "}
          <span className="font-mono text-primary">{transitionStart}</span>
        </div>
      )}

      <svg
        ref={svgRef}
        className={`h-full w-full ${cursorClass}`}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="hsl(var(--transition-line))"
            />
          </marker>
        </defs>

        <TransitionRenderer
          transitions={data.transitions}
          states={data.states}
          onEditTransition={onEditTransition}
        />

        {data.states.map((state) => (
          <g
            key={state.id}
            onDoubleClick={(e) => handleDoubleClick(state.id, e)}
            onContextMenu={(e) => handleContextMenu(state.id, e)}
          >
            <StateNode
              state={state}
              isSelected={selectedNode === state.id || transitionStart === state.id}
              isHighlighted={highlightedStates?.has(state.id)}
              onMouseDown={(e) => handleStateMouseDown(state.id, e)}
              onRename={onRenameState}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
