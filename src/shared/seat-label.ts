function withoutSuffix(label: string, suffix: "排" | "座"): string {
  return label.trim().replace(new RegExp(`${suffix}$`, "u"), "");
}

export function displaySeatNumber(label: string): string {
  return withoutSuffix(label, "座");
}

export function formatSeatLabel(rowLabel: string, columnLabel: string): string {
  const row = withoutSuffix(rowLabel, "排");
  const seat = displaySeatNumber(columnLabel);
  return `${row}排${seat || "未编号"}座`;
}
