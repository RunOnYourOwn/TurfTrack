// React Select shared styles
export const selectStyles = {
  control: (base: any) => ({
    ...base,
    minHeight: 36,
    borderRadius: 6,
    backgroundColor: "var(--card)",
    borderColor: "var(--border)",
    boxShadow: "none",
    "&:hover": {
      borderColor: "var(--border)",
    },
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    boxShadow:
      "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "var(--accent)"
      : state.isFocused
      ? "var(--accent)"
      : "var(--card)",
    color:
      state.isSelected || state.isFocused
        ? "var(--accent-foreground)"
        : "var(--foreground)",
    "&:active": {
      backgroundColor: "var(--accent)",
    },
  }),
  singleValue: (base: any) => ({
    ...base,
    color: "var(--foreground)",
  }),
  multiValue: (base: any) => ({
    ...base,
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  }),
  multiValueLabel: (base: any) => ({
    ...base,
    color: "var(--accent-foreground)",
  }),
  multiValueRemove: (base: any) => ({
    ...base,
    color: "var(--accent-foreground)",
    "&:hover": {
      backgroundColor: "var(--destructive)",
      color: "var(--destructive-foreground)",
    },
  }),
  input: (base: any) => ({
    ...base,
    color: "var(--foreground)",
  }),
  placeholder: (base: any) => ({
    ...base,
    color: "var(--muted-foreground)",
  }),
  clearIndicator: (base: any) => ({
    ...base,
    color: "var(--muted-foreground)",
    "&:hover": {
      color: "var(--foreground)",
    },
  }),
  dropdownIndicator: (base: any) => ({
    ...base,
    color: "var(--muted-foreground)",
    "&:hover": {
      color: "var(--foreground)",
    },
  }),
};
