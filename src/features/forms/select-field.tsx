"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  Button,
  FieldError,
  Header,
  Label,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";

export type SelectOption = { id: string; label: string };
export type SelectGroup = { id: string; label: string; options: SelectOption[] };

type CommonProps = {
  name?: string;
  label?: string;
  ariaLabel?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

type SelectFieldProps = CommonProps & {
  options?: SelectOption[];
  groups?: SelectGroup[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  displayValue?: (value: string) => string;
};

function OptionList({ options }: { options: SelectOption[] }) {
  return options.map((option) => (
    <ListBoxItem id={option.id} key={option.id} textValue={option.label}>
      {option.label}
    </ListBoxItem>
  ));
}

export function SelectField({
  name,
  label,
  ariaLabel,
  options = [],
  groups = [],
  value,
  defaultValue,
  onValueChange,
  required = false,
  disabled = false,
  className = "",
  placeholder = "请选择",
  displayValue,
}: SelectFieldProps) {
  return (
    <Select
      className={`select-field ${className}`.trim()}
      name={name}
      aria-label={ariaLabel}
      isRequired={required}
      isDisabled={disabled}
      validationBehavior="native"
      {...(value === undefined ? { defaultSelectedKey: defaultValue } : { selectedKey: value })}
      onSelectionChange={(key) => onValueChange?.(String(key))}
    >
      {label ? <Label>{label}</Label> : null}
      <Button className="select-field-trigger">
        <SelectValue>
          {({ selectedText, state }) => {
            const selectedKey = state.selectedKey;
            if (selectedKey == null) return placeholder;
            return displayValue?.(String(selectedKey)) ?? selectedText;
          }}
        </SelectValue>
        <span className="select-field-chevron" aria-hidden="true">
          ⌄
        </span>
      </Button>
      <FieldError className="field-error" />
      <Popover className="select-field-popover">
        <ListBox className="select-field-listbox">
          {groups.length ? (
            groups.map((group) => (
              <ListBoxSection id={group.id} key={group.id}>
                <Header>{group.label}</Header>
                <OptionList options={group.options} />
              </ListBoxSection>
            ))
          ) : (
            <OptionList options={options} />
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}

export function SearchableSelectField({
  name,
  label,
  ariaLabel,
  options,
  defaultValue,
  required = false,
  disabled = false,
  className = "",
}: CommonProps & { options: SelectOption[]; defaultValue?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const labelId = useId();
  const [selectedKey, setSelectedKey] = useState<string | null>(defaultValue ?? null);
  const [inputValue, setInputValue] = useState(
    () => options.find((option) => option.id === defaultValue)?.label ?? "",
  );
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const filteredOptions = showAll
    ? options
    : options.filter((option) =>
        option.label.toLocaleLowerCase().includes(inputValue.toLocaleLowerCase()),
      );

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
        const selected = options.find((option) => option.id === selectedKey);
        setInputValue(selected?.label ?? "");
      }
    }
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open, options, selectedKey]);

  function openAllOptions() {
    setShowAll(true);
    setOpen(true);
  }

  function selectOption(option: SelectOption) {
    setSelectedKey(option.id);
    setInputValue(option.label);
    inputRef.current?.setCustomValidity("");
    inputRef.current?.focus();
    setOpen(false);
  }

  function moveOptionFocus(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End", "Escape"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.focus();
      return;
    }
    const optionElements = [
      ...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []),
    ];
    const currentIndex = optionElements.indexOf(event.currentTarget);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? optionElements.length - 1
          : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + optionElements.length) %
            optionElements.length;
    optionElements[nextIndex]?.focus();
  }

  return (
    <div
      ref={rootRef}
      className={`select-field searchable-select-field ${className}`.trim()}
      aria-label={ariaLabel}
      onBlur={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setOpen(false);
          const selected = options.find((option) => option.id === selectedKey);
          setInputValue(selected?.label ?? "");
        }
      }}
    >
      {label ? (
        <label id={labelId} htmlFor={`${listboxId}-input`}>
          {label}
        </label>
      ) : null}
      <div className="searchable-select-control">
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          className="searchable-select-input"
          role="combobox"
          aria-label={label ? undefined : ariaLabel}
          aria-labelledby={label ? labelId : undefined}
          aria-controls={listboxId}
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          required={required}
          disabled={disabled}
          value={inputValue}
          onFocus={openAllOptions}
          onChange={(event) => {
            setInputValue(event.target.value);
            setSelectedKey(null);
            setShowAll(false);
            setOpen(true);
            event.target.setCustomValidity("请选择列表中的时区");
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              const selected = options.find((option) => option.id === selectedKey);
              setInputValue(selected?.label ?? "");
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!open) openAllOptions();
              requestAnimationFrame(() =>
                rootRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus(),
              );
            }
          }}
        />
        <button
          type="button"
          className="searchable-select-button"
          aria-label="展开选项"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => {
            if (open) setOpen(false);
            else openAllOptions();
          }}
        >
          <span aria-hidden="true">⌄</span>
        </button>
      </div>
      <input type="hidden" name={name} value={selectedKey ?? ""} />
      <div
        id={listboxId}
        className="select-field-popover select-field-listbox searchable-select-listbox"
        role="listbox"
        aria-label={label ?? ariaLabel}
        hidden={!open}
      >
        {filteredOptions.map((option) => (
          <button
            type="button"
            role="option"
            aria-selected={option.id === selectedKey}
            key={option.id}
            onPointerDown={(event) => {
              // WebKit clears relatedTarget when a listbox option takes focus. Keeping focus on
              // the combobox prevents its blur handler from restoring the stale selection.
              event.preventDefault();
            }}
            onClick={() => selectOption(option)}
            onKeyDown={moveOptionFocus}
          >
            {option.label}
          </button>
        ))}
        {filteredOptions.length === 0 ? <p className="select-field-empty">没有匹配项</p> : null}
      </div>
    </div>
  );
}
