/**
 * Detección del estilo de nombres de estados del autómata origen y generación
 * de etiquetas coherentes para los estados nuevos creados durante la
 * determinizacion.
 *
 * Idea central:
 * Si el usuario trabaja con nombres como `q0`, `q1`, `q2`, el AFD resultante
 * debería seguir ese patrón. Si trabaja con letras como `A`, `B`, `C`, el
 * sistema intenta respetarlo. Esto mejora la continuidad visual y hace que el
 * resultado sea más fácil de leer.
 */

export type NamingStyle =
  | { type: "prefix"; prefix: string; subscript: boolean; startIndex: number }
  | { type: "number"; startIndex: number }
  | { type: "letter"; startIndex: number; uppercase: boolean };

// Dígitos Unicode en subíndice. Se usan para preservar estilos como q₀, q₁, q₂.
const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

/**
 * Convierte un índice 0-based a una secuencia alfabética estilo Excel.
 *
 * Propósito:
 * Permitir nombres como `A`, `B`, ..., `Z`, `AA`, `AB`, ... cuando el estilo
 * dominante del autómata original es alfabético.
 *
 * Parámetros:
 * - `n: number`
 *   Índice base cero a convertir.
 * - `uppercase: boolean`
 *   Indica si las letras deben emitirse en mayúscula o minúscula.
 *
 * Valor de retorno:
 * - `string`
 *   Secuencia de letras equivalente al índice.
 */
function indexToLetters(n: number, uppercase: boolean): string {
  let result = "";
  let i = n;
  do {
    result = String.fromCharCode((i % 26) + (uppercase ? 65 : 97)) + result;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return result;
}

/**
 * Convierte una etiqueta alfabética estilo Excel a un índice base cero.
 *
 * Propósito:
 * Detectar correctamente desde qué posición debería continuar una secuencia
 * como `A, B, C` o `AA, AB`.
 *
 * Parámetros:
 * - `s: string`
 *   Cadena compuesta únicamente por letras.
 *
 * Valor de retorno:
 * - `number`
 *   Índice base cero correspondiente.
 */
function lettersToIndex(s: string): number {
  const lower = s.toLowerCase();
  let idx = 0;
  for (let i = 0; i < lower.length; i++) {
    idx = idx * 26 + (lower.charCodeAt(i) - 96);
  }
  return idx - 1;
}

/**
 * Convierte un número decimal a su representación usando subíndices Unicode.
 *
 * Propósito:
 * Mantener coherencia con estilos de nombres como `q₀`, `q₁`, `q₂`.
 *
 * Parámetros:
 * - `n: number`
 *   Número a convertir.
 *
 * Valor de retorno:
 * - `string`
 *   Cadena de dígitos en subíndice.
 */
function toSubscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUBSCRIPT_DIGITS[parseInt(d, 10)])
    .join("");
}

/**
 * Detecta el patrón de nombres dominante en un conjunto de estados.
 *
 * Propósito:
 * Inferir si las etiquetas del autómata siguen un patrón de prefijo con índice
 * (`q0`, `s1`, `q₀`), numérico puro (`0`, `1`, `2`) o alfabético (`A`, `B`,
 * `C`). El resultado se usa después para nombrar los estados generados.
 *
 * Parámetros:
 * - `nameMap: Map<string, string>`
 *   Mapa entre ID interno y nombre visible de cada estado.
 *
 * Valor de retorno:
 * - `NamingStyle`
 *   Descripción del estilo detectado, junto con el punto desde el cual debe
 *   continuar la numeración o secuencia.
 *
 * Limitación:
 * Si el conjunto de nombres mezcla varios estilos, la función prioriza en este
 * orden: prefijo con índice, numérico puro y luego alfabético.
 */
export function detectNamingStyle(nameMap: Map<string, string>): NamingStyle {
  const names = Array.from(nameMap.values());
  let minPrefixIndex = Infinity;
  let prefix = "q";
  let subscript = false;
  let prefixFound = false;
  let minNumber = Infinity;
  let numberFound = false;
  let minLetterIndex = Infinity;
  let uppercase = true;
  let letterFound = false;

  for (const name of names) {
    // Caso 1: patrón tipo q₀, s₁, p₂.
    const subMatch = name.match(/^([a-zA-Z]+)([₀₁₂₃₄₅₆₇₈₉]+)$/);
    if (subMatch) {
      prefixFound = true;
      prefix = subMatch[1];
      subscript = true;
      const idx = Array.from(subMatch[2]).reduce((acc, ch) => {
        const d = SUBSCRIPT_DIGITS.indexOf(ch);
        return acc * 10 + (d >= 0 ? d : 0);
      }, 0);
      if (idx < minPrefixIndex) minPrefixIndex = idx;
      continue;
    }

    // Caso 2: patrón tipo q0, s12.
    const prefixMatch = name.match(/^([a-zA-Z]+)(\d+)$/);
    if (prefixMatch) {
      prefixFound = true;
      prefix = prefixMatch[1];
      subscript = false;
      const idx = parseInt(prefixMatch[2], 10);
      if (idx < minPrefixIndex) minPrefixIndex = idx;
      continue;
    }

    // Caso 3: etiquetas numéricas puras.
    const numMatch = name.match(/^(\d+)$/);
    if (numMatch) {
      numberFound = true;
      const n = parseInt(numMatch[1], 10);
      if (n < minNumber) minNumber = n;
      continue;
    }

    // Caso 4: secuencia alfabética.
    const letMatch = name.match(/^([a-zA-Z]+)$/);
    if (letMatch) {
      letterFound = true;
      uppercase = letMatch[1] === letMatch[1].toUpperCase();
      const idx = lettersToIndex(letMatch[1]);
      if (idx < minLetterIndex) minLetterIndex = idx;
    }
  }

  if (prefixFound) {
    return {
      type: "prefix",
      prefix,
      subscript,
      startIndex: Number.isFinite(minPrefixIndex) ? minPrefixIndex : 0,
    };
  }
  if (numberFound) {
    return {
      type: "number",
      startIndex: Number.isFinite(minNumber) ? minNumber : 0,
    };
  }
  if (letterFound) {
    return {
      type: "letter",
      startIndex: Number.isFinite(minLetterIndex) ? minLetterIndex : 0,
      uppercase,
    };
  }

  // Fallback razonable cuando no existe un patrón claro.
  return { type: "prefix", prefix: "q", subscript: false, startIndex: 0 };
}

/**
 * Genera una etiqueta nueva respetando el estilo detectado.
 *
 * Propósito:
 * Crear nombres consistentes para estados derivados, por ejemplo durante la
 * construcción de subconjuntos.
 *
 * Parámetros:
 * - `style: NamingStyle`
 *   Estilo previamente detectado.
 * - `offset: number`
 *   Desplazamiento relativo dentro de la nueva secuencia.
 *
 * Valor de retorno:
 * - `string`
 *   Etiqueta visible que sigue el estilo del autómata original.
 */
export function makeLabel(style: NamingStyle, offset: number): string {
  switch (style.type) {
    case "prefix": {
      const n = style.startIndex + offset;
      return `${style.prefix}${style.subscript ? toSubscript(n) : n}`;
    }
    case "number":
      return String(style.startIndex + offset);
    case "letter":
      return indexToLetters(style.startIndex + offset, style.uppercase);
  }
}
