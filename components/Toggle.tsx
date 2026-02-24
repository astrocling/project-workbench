"use client";

import { useId } from "react";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  label?: React.ReactNode;
  size?: "sm" | "md";
};

export function Toggle({
  checked,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  label,
  size = "md",
}: ToggleProps) {
  const id = useId();
  const track =
    size === "sm"
      ? "h-5 w-9 rounded-full"
      : "h-6 w-11 rounded-full";
  const thumb =
    size === "sm"
      ? "h-4 w-4 rounded-full translate-x-0.5"
      : "h-5 w-5 rounded-full translate-x-0.5";
  const thumbOn =
    size === "sm"
      ? "translate-x-4"
      : "translate-x-5";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!disabled) onChange(!checked);
    }
  };

  const control = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={handleKeyDown}
      className={`
        relative inline-flex shrink-0 cursor-pointer items-center rounded-full
        transition-colors duration-200 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-bg
        ${checked ? "bg-jblue-500" : "bg-surface-300 dark:bg-dark-muted"}
        ${disabled ? "cursor-not-allowed opacity-60" : "hover:opacity-90"}
        ${track}
      `}
    >
      <span
        className={`
          inline-block transform rounded-full bg-white shadow-sm
          transition-transform duration-200 ease-out
          ${thumb}
          ${checked ? thumbOn : ""}
        `}
      />
    </button>
  );

  if (label != null) {
    return (
      <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2">
        {control}
        <span className="text-body-sm text-surface-800 dark:text-surface-100 select-none">
          {label}
        </span>
      </label>
    );
  }

  return control;
}
