import { useState, useRef, useEffect } from "react";
import type { AutomataState } from "@/hooks/useAutomataEditor";

interface StateNodeProps {
  state: AutomataState;
  isSelected: boolean;
  isHighlighted?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onRename: (id: string, newLabel: string) => void;
}

export function StateNode({ state, isSelected, isHighlighted, onMouseDown, onRename }: StateNodeProps) {
  const r = 28;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(state.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (editValue.trim() && editValue.trim() !== state.label) {
      onRename(state.id, editValue.trim());
    } else {
      setEditValue(state.label);
    }
  };

  const handleDoubleClickLabel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(state.label);
    setEditing(true);
  };

  return (
    <g onMouseDown={onMouseDown} className="cursor-pointer">
      {/* Initial arrow */}
      {state.isInitial && (
        <line
          x1={state.x - r - 30}
          y1={state.y}
          x2={state.x - r - 2}
          y2={state.y}
          stroke="hsl(var(--node-border))"
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
        />
      )}
      {/* Accept outer ring */}
      {state.isAccept && (
        <circle
          cx={state.x}
          cy={state.y}
          r={r + 5}
          fill="none"
          stroke={isSelected ? "hsl(var(--node-active))" : "hsl(var(--node-accept))"}
          strokeWidth="2"
        />
      )}
      {/* Highlight glow */}
      {isHighlighted && (
        <circle
          cx={state.x}
          cy={state.y}
          r={r + 10}
          fill="hsl(var(--primary) / 0.15)"
          stroke="hsl(var(--primary) / 0.4)"
          strokeWidth="2"
          className="animate-pulse"
        />
      )}
      {/* Main circle */}
      <circle
        cx={state.x}
        cy={state.y}
        r={r}
        fill={isHighlighted ? "hsl(var(--primary) / 0.15)" : "hsl(var(--node-bg))"}
        stroke={isHighlighted ? "hsl(var(--primary))" : isSelected ? "hsl(var(--node-active))" : "hsl(var(--node-border))"}
        strokeWidth={isHighlighted ? 3 : isSelected ? 3 : 2}
        className="transition-colors"
      />
      {/* Label or inline edit */}
      {editing ? (
        <foreignObject
          x={state.x - 30}
          y={state.y - 10}
          width={60}
          height={20}
        >
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") {
                setEditValue(state.label);
                setEditing(false);
              }
            }}
            className="w-full h-full bg-transparent text-center font-mono text-xs font-semibold outline-none border-b border-primary"
            style={{ color: "hsl(var(--foreground))" }}
          />
        </foreignObject>
      ) : (
        <text
          x={state.x}
          y={state.y + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground font-mono text-sm font-semibold select-none pointer-events-auto"
          onDoubleClick={handleDoubleClickLabel}
        >
          {state.label}
        </text>
      )}
    </g>
  );
}
