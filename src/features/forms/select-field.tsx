"use client";

import {
  Button,
  ComboBox,
  FieldError,
  Header,
  Input,
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
  return (
    <ComboBox<SelectOption>
      className={`select-field searchable-select-field ${className}`.trim()}
      name={name}
      aria-label={ariaLabel}
      defaultSelectedKey={defaultValue}
      defaultItems={options}
      isRequired={required}
      isDisabled={disabled}
      validationBehavior="native"
      formValue="key"
      menuTrigger="focus"
    >
      {label ? <Label>{label}</Label> : null}
      <div className="searchable-select-control">
        <Input className="searchable-select-input" />
        <Button className="searchable-select-button" aria-label="展开选项">
          <span aria-hidden="true">⌄</span>
        </Button>
      </div>
      <FieldError className="field-error" />
      <Popover className="select-field-popover">
        <ListBox<SelectOption> className="select-field-listbox">
          {(option) => <ListBoxItem id={option.id}>{option.label}</ListBoxItem>}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}
