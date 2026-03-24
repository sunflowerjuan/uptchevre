export function Footer() {
  return (
    <footer className="border-t bg-card px-4 py-2 text-[11px] text-muted-foreground">
      <span className="font-medium">Tips:</span> Doble clic en estado = toggle aceptacion · Doble
      clic en nombre = renombrar · Clic derecho = marcar inicial ·{" "}
      <span className="font-mono">a+b</span>, <span className="font-mono">a|b</span>,{" "}
      <span className="font-mono">a,b</span> para multiples simbolos
    </footer>
  );
}

