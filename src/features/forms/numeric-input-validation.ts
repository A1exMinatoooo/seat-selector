export type NumericConstraints = { min?: number; max?: number; step?: number | "any" };

export function numericInputError(draft: string, constraints: NumericConstraints): string | null {
  if (!draft.trim()) return "请输入内容";
  const value = Number(draft);
  if (!Number.isFinite(value)) return "请输入有效数字";
  if (constraints.min !== undefined && value < constraints.min) return `请输入不小于 ${constraints.min} 的数字`;
  if (constraints.max !== undefined && value > constraints.max) return `请输入不大于 ${constraints.max} 的数字`;
  const step = constraints.step ?? 1;
  if (step !== "any") {
    const base = constraints.min ?? 0;
    const steps = (value - base) / step;
    if (Math.abs(steps - Math.round(steps)) > 1e-9) return step === 1 ? "请输入整数" : `请输入步长为 ${step} 的数字`;
  }
  return null;
}

export function validNumericValue(draft: string, constraints: NumericConstraints): number | null {
  return numericInputError(draft, constraints) === null ? Number(draft) : null;
}
