"use client";

import { useRef, KeyboardEvent, ChangeEvent, ClipboardEvent } from "react";
import { cn } from "@/lib/utils";

interface PinInputProps {
  length: number;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  label: string;
  type?: "text" | "password";
  size?: "default" | "lg";
  firstInputRef?: React.RefObject<HTMLInputElement | null>;
}

export default function PinInput({
  length,
  value,
  onChange,
  disabled = false,
  hasError = false,
  autoFocus = false,
  label,
  type = "text",
  size = "default",
  firstInputRef,
}: PinInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const lastIndex = length - 1;

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      const next = [...value];
      next[index] = "";
      onChange(next);
      return;
    }

    if (raw.length > 1) {
      const digits = raw.split("").slice(0, length);
      const next = Array(length).fill("");
      digits.forEach((d, i) => {
        if (i < length) next[i] = d;
      });
      onChange(next);
      const lastFilledIndex = Math.min(digits.length - 1, lastIndex);
      const focusTarget = lastFilledIndex < lastIndex ? lastFilledIndex + 1 : lastIndex;
      inputRefs.current[focusTarget]?.focus();
      return;
    }

    const next = [...value];
    next[index] = raw[raw.length - 1];
    onChange(next);

    if (index < lastIndex && raw) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!value[index] && index > 0) {
        const next = [...value];
        next[index - 1] = "";
        onChange(next);
        inputRefs.current[index - 1]?.focus();
      } else {
        const next = [...value];
        next[index] = "";
        onChange(next);
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < lastIndex) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    const digits = text.split("").slice(0, length);
    const next = Array(length).fill("");
    digits.forEach((d, i) => {
      if (i < length) next[i] = d;
    });
    onChange(next);
    const lastFilledIndex = Math.min(digits.length - 1, lastIndex);
    const focusTarget = lastFilledIndex < lastIndex ? lastFilledIndex + 1 : lastIndex;
    inputRefs.current[focusTarget]?.focus();
  };

  const isLg = size === "lg";

  return (
    <div className={cn("flex items-center justify-center", isLg ? "gap-3" : "gap-2.5")}>
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
            if (index === 0 && firstInputRef) {
              (firstInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
            }
          }}
          type={type}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={value[index]}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={`${label} ${index + 1}번째 자리`}
          className={cn(
            "rounded-xl border-2 bg-card text-center font-bold tabular-nums",
            "transition-all duration-200 outline-none",
            "selection:bg-primary/20",
            isLg ? "h-16 w-14 text-2xl" : "h-14 w-12 text-xl",
            disabled
              ? "cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60"
              : hasError
              ? "border-error bg-error-bg text-error focus:border-error focus:ring-2 focus:ring-error/20"
              : value[index]
              ? "border-primary bg-brand-primary-muted text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              : "border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 hover:border-primary/40"
          )}
        />
      ))}
    </div>
  );
}
