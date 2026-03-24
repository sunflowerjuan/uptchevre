import { useState, useRef, useEffect } from "react";
import type { AutomataState, AutomataTransition } from "@/hooks/useAutomataEditor";

interface TransitionRendererProps {
  transitions: AutomataTransition[];
  states: AutomataState[];
  onEditTransition?: (from: string, to: string, oldSymbols: string[], newInput: string) => void;
}

function EditableLabel({
  x,
  y,
  label,
  onCommit,
}: {
  x: number;
  y: number;
  label: string;
  onCommit: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (value.trim() && value.trim() !== label) {
      onCommit(value.trim());
    } else {
      setValue(label);
    }
  };

  if (editing) {
    return (
      <foreignObject x={x - 35} y={y - 10} width={70} height={20}>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(label);
              setEditing(false);
            }
          }}
          className="w-full h-full bg-card text-center font-mono text-xs outline-none border border-primary rounded px-1"
          style={{ color: "hsl(var(--foreground))" }}
        />
      </foreignObject>
    );
  }

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      className="fill-foreground font-mono text-xs cursor-pointer select-none"
      onDoubleClick={(e) => {
        e.stopPropagation();
        setValue(label);
        setEditing(true);
      }}
    >
      {label}
    </text>
  );
}

export function TransitionRenderer({ transitions, states, onEditTransition }: TransitionRendererProps) {
  const stateMap = new Map(states.map((s) => [s.id, s]));

  // Group transitions by from-to pair
  const grouped = new Map<string, string[]>();
  transitions.forEach((t) => {
    const key = `${t.from}->${t.to}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t.symbol);
  });

  return (
    <>
      {Array.from(grouped.entries()).map(([key, symbols]) => {
        const [fromId, toId] = key.split("->");
        const from = stateMap.get(fromId);
        const to = stateMap.get(toId);
        if (!from || !to) return null;

        const label = symbols.join(", ");

        const handleEdit = (newInput: string) => {
          onEditTransition?.(fromId, toId, symbols, newInput);
        };

        // Self-loop
        if (fromId === toId) {
          const labelX = from.x;
          const labelY = from.y - 65;
          return (
            <g key={key}>
              <path
                d={`M ${from.x - 12} ${from.y - 28} C ${from.x - 40} ${from.y - 70}, ${from.x + 40} ${from.y - 70}, ${from.x + 12} ${from.y - 28}`}
                fill="none"
                stroke="hsl(var(--transition-line))"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
              <EditableLabel x={labelX} y={labelY} label={label} onCommit={handleEdit} />
            </g>
          );
        }

        // Check for reverse transition
        const reverseKey = `${toId}->${fromId}`;
        const hasReverse = grouped.has(reverseKey);

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = dx / len;
        const ny = dy / len;

        const r = 28;
        const startX = from.x + nx * r;
        const startY = from.y + ny * r;
        const endX = to.x - nx * r;
        const endY = to.y - ny * r;

        if (hasReverse) {
          const perpX = -ny * 20;
          const perpY = nx * 20;
          const midX = (startX + endX) / 2 + perpX;
          const midY = (startY + endY) / 2 + perpY;

          return (
            <g key={key}>
              <path
                d={`M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`}
                fill="none"
                stroke="hsl(var(--transition-line))"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
              <EditableLabel x={midX} y={midY - 6} label={label} onCommit={handleEdit} />
            </g>
          );
        }

        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        return (
          <g key={key}>
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="hsl(var(--transition-line))"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
            <EditableLabel
              x={midX + (-ny * 14)}
              y={midY + (nx * 14)}
              label={label}
              onCommit={handleEdit}
            />
          </g>
        );
      })}
    </>
  );
}
