import type { LabelStyle } from "./seat-labels";

function alphabeticOrdinal(label: string): number | null {
  if (!/^[A-Z]+$/i.test(label)) return null;
  return [...label.toUpperCase()].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0);
}

function labelOrdinal(label: string, style: LabelStyle): number | null {
  if (style === "letters") return alphabeticOrdinal(label);
  if (!/^[1-9]\d*$/.test(label)) return null;
  return Number(label);
}

function alphabeticLabel(ordinal: number): string {
  let value = ordinal;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

export function nextSeatNumber(labels: string[], style: LabelStyle): string {
  const lastOrdinal = labels.reduce((largest, label) => {
    const ordinal = labelOrdinal(label.trim(), style);
    return ordinal === null ? largest : Math.max(largest, ordinal);
  }, 0);
  const nextOrdinal = lastOrdinal + 1;
  return style === "letters" ? alphabeticLabel(nextOrdinal) : String(nextOrdinal);
}

export function displaySeatNumber(label: string): string {
  return label.trim().replace(/座$/u, "");
}
