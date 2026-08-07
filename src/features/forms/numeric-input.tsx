"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { numericInputError, validNumericValue, type NumericConstraints } from "./numeric-input-validation";

type NumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "min" | "max" | "step" | "onChange"> & NumericConstraints & {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
};

export function NumericInput({ value, defaultValue, min, max, step, onValueChange, id, className, required = true, ...inputProps }: NumericInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const [draft, setDraft] = useState(() => String(value ?? defaultValue ?? ""));
  const [touched, setTouched] = useState(false);
  const constraints = { min, max, step };
  const error = touched ? numericInputError(draft, constraints) : null;

  return (
    <span className="numeric-input-field">
      <input
        {...inputProps}
        id={inputId}
        className={className}
        type="number"
        min={min}
        max={max}
        step={step}
        required={required}
        value={draft}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : inputProps["aria-describedby"]}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);
          const nextValue = validNumericValue(nextDraft, constraints);
          if (nextValue !== null) onValueChange?.(nextValue);
        }}
        onBlur={() => setTouched(true)}
      />
      {error ? <span className="numeric-input-error" id={errorId} role="alert">{error}</span> : null}
    </span>
  );
}
