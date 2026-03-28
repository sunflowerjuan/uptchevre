import { useRef, useCallback, useState, useEffect } from "react";
import { StateNode } from "./StateNode";
import { TransitionRenderer } from "./TransitionRenderer";
import { Button } from "@/components/ui/button";
import { Plus, Minus, RotateCcw } from "lucide-react";
import type { EditorTool, AutomataData } from "@/hooks/useAutomataEditor";

interface WorkAreaProps {
  containerId?: string;
  svgId?: string;
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
  onEditTransition: (
    from: string,
    to: string,
    oldSymbols: string[],
    newInput: string,
  ) => void;
}

export function WorkArea({
  containerId,
  svgId,
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

  // ===== ZOOM & PAN =====
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // ===== COORDINATE FIX =====
  const getSVGPoint = useCallback(
    (e: React.MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };

      const rect = svg.getBoundingClientRect();

      return {
        x: (e.clientX - rect.left - offset.x) / scale,
        y: (e.clientY - rect.top - offset.y) / scale,
      };
    },
    [offset, scale],
  );

  // ===== CTRL + WHEEL (correct implementation) =====
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;

      e.preventDefault();

      const zoomIntensity = 0.1;
      const direction = e.deltaY > 0 ? -1 : 1;

      setScale((prev) =>
        Math.min(Math.max(prev + direction * zoomIntensity, 0.2), 3),
      );
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      svg.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // ===== PAN (only background + only select tool) =====
  const handleMouseDownCanvas = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== svgRef.current) return;
      if (selectedTool !== "select") return;

      setIsPanning(true);
      panStart.current = {
        x: e.clientX - offset.x,
        y: e.clientY - offset.y,
      };
    },
    [selectedTool, offset],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setOffset({
          x: e.clientX - panStart.current.x,
          y: e.clientY - panStart.current.y,
        });
        return;
      }

      if (!dragging) return;

      const pt = getSVGPoint(e);
      onMoveState(dragging, pt.x - dragOffset.x, pt.y - dragOffset.y);
    },
    [isPanning, dragging, dragOffset, getSVGPoint, onMoveState],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);

    if (dragging && preDragSnapshot.current) {
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

  // ===== CANVAS CLICK =====
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
    [selectedTool, getSVGPoint, onAddState, onSelectNode, onTransitionStart],
  );
  const handleDoubleClick = useCallback(
    (stateId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (selectedTool === "select") {
        onToggleAccept(stateId);
      }
    },
    [selectedTool, onToggleAccept],
  );

  const handleContextMenu = useCallback(
    (stateId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (selectedTool === "select") {
        onSetInitial(stateId);
      }
    },
    [selectedTool, onSetInitial],
  );
  // ===== STATE INTERACTIONS (INTACT) =====
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
          const symbol = prompt("Símbolos de transición:");
          if (symbol !== null) {
            onAddTransition(transitionStart, stateId, symbol);
          }
          onTransitionStart(null);
          onSelectNode(null);
        }
      }
    },
    [
      selectedTool,
      data,
      getSVGPoint,
      onSelectNode,
      onDeleteState,
      transitionStart,
      onTransitionStart,
      onAddTransition,
    ],
  );

  const zoomPercentage = Math.round(scale * 100);

  return (
    <div
      id={containerId}
      className="relative flex-1 overflow-hidden rounded-lg border bg-canvas canvas-grid"
    >
      {/* Mini Figma Panel */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-3 bg-card/80 backdrop-blur-md border rounded-xl px-4 py-2 shadow-lg">
        <Button
          size="icon"
          variant="secondary"
          onClick={() => setScale((s) => Math.max(s - 0.1, 0.2))}
        >
          <Minus className="h-4 w-4" />
        </Button>

        <div className="text-xs font-mono w-12 text-center">
          {zoomPercentage}%
        </div>

        <Button
          size="icon"
          variant="secondary"
          onClick={() => setScale((s) => Math.min(s + 0.1, 3))}
        >
          <Plus className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="outline"
          onClick={() => {
            setScale(1);
            setOffset({ x: 0, y: 0 });
          }}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <svg
        id={svgId}
        ref={svgRef}
        className="h-full w-full"
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDownCanvas}
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

        <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
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
                isSelected={
                  selectedNode === state.id || transitionStart === state.id
                }
                isHighlighted={highlightedStates?.has(state.id)}
                onMouseDown={(e) => handleStateMouseDown(state.id, e)}
                onRename={onRenameState}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
