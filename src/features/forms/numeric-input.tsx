"use client";

import { useEffect, useId, useState, type InputHTMLAttributes } from "react";
import {
  numericInputError,
  validNumericValue,
  type NumericConstraints,
} from "./numeric-input-validation";

type NumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "min" | "max" | "step" | "onChange"
> &
  NumericConstraints & {
    value?: number;
    defaultValue?: number;
    draftValue?: string;
    onValueChange?: (value: number) => void;
    onDraftValueChange?: (value: string) => void;
    onValidityChange?: (valid: boolean) => void;
  };

export function NumericInput({
  value,
  defaultValue,
  draftValue,
  min,
  max,
  step,
  onValueChange,
  onDraftValueChange,
  onValidityChange,
  id,
  className,
  required = true,
  ...inputProps
}: NumericInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const [draft, setDraft] = useState(() => String(value ?? defaultValue ?? ""));
  const [touched, setTouched] = useState(false);
  const constraints = { min, max, step };
  const currentDraft = draftValue ?? draft;
  const validationError = numericInputError(currentDraft, constraints);
  const error = touched ? validationError : null;

  useEffect(() => {
    onValidityChange?.(validationError === null);
  }, [onValidityChange, validationError]);

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
        value={currentDraft}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : inputProps["aria-describedby"]}
        onChange={(event) => {
          const nextDraft = event.target.value;
          if (draftValue === undefined) setDraft(nextDraft);
          onDraftValueChange?.(nextDraft);
          const nextValue = validNumericValue(nextDraft, constraints);
          onValidityChange?.(nextValue !== null);
          if (nextValue !== null) onValueChange?.(nextValue);
        }}
        onBlur={() => setTouched(true)}
      />
      {error ? (
        <span className="numeric-input-error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
