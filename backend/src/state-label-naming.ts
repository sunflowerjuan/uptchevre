/**
 * Detección del estilo de nombres de estados del AFN y generación de etiquetas
 * coherentes para los estados del AFD (subconjuntos).
 */

export type NamingStyle =
  | { type: "prefix"; prefix: string; subscript: boolean; startIndex: number }
  | { type: "number"; startIndex: number }
  | { type: "letter"; startIndex: number; uppercase: boolean };

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

/** Convierte un índice 0-based a una cadena de letras estilo Excel: 0→A, 25→Z, 26→AA … */
function indexToLetters(n: number, uppercase: boolean): string {
  let result = "";
  let i = n;
  do {
    result = String.fromCharCode((i % 26) + (uppercase ? 65 : 97)) + result;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return result;
}

/** Convierte una cadena de letras (A, Z, AA…) a su índice 0-based. */
function lettersToIndex(s: string): number {
  const lower = s.toLowerCase();
  let idx = 0;
  for (let i = 0; i < lower.length; i++) {
    idx = idx * 26 + (lower.charCodeAt(i) - 96);
  }
  return idx - 1;
}

function toSubscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUBSCRIPT_DIGITS[parseInt(d, 10)])
    .join("");
}

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
    const prefixMatch = name.match(/^([a-zA-Z]+)(\d+)$/);
    if (prefixMatch) {
      prefixFound = true;
      prefix = prefixMatch[1];
      subscript = false;
      const idx = parseInt(prefixMatch[2], 10);
      if (idx < minPrefixIndex) minPrefixIndex = idx;
      continue;
    }
    const numMatch = name.match(/^(\d+)$/);
    if (numMatch) {
      numberFound = true;
      const n = parseInt(numMatch[1], 10);
      if (n < minNumber) minNumber = n;
      continue;
    }
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
    return { type: "number", startIndex: Number.isFinite(minNumber) ? minNumber : 0 };
  }
  if (letterFound) {
    return {
      type: "letter",
      startIndex: Number.isFinite(minLetterIndex) ? minLetterIndex : 0,
      uppercase,
    };
  }
  return { type: "prefix", prefix: "q", subscript: false, startIndex: 0 };
}

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
