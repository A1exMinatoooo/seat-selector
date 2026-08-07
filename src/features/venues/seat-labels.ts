export type LabelStyle = "letters" | "numbers";
export type LabelDirection = "ascending" | "descending";

function alphabeticLabel(index: number): string {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

export function generateSeatLabels(
  count: number,
  style: LabelStyle,
  direction: LabelDirection,
): string[] {
  const values = Array.from({ length: count }, (_, index) => (
    style === "letters" ? alphabeticLabel(index) : String(index + 1)
  ));
  return direction === "ascending" ? values : values.reverse();
}
