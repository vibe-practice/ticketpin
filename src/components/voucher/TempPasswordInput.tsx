"use client";

import PinInput from "./PinInput";

interface TempPasswordInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  hasError?: boolean;
  firstInputRef?: React.RefObject<HTMLInputElement | null>;
}

export default function TempPasswordInput({
  value,
  onChange,
  disabled = false,
  hasError = false,
  firstInputRef,
}: TempPasswordInputProps) {
  return (
    <PinInput
      length={3}
      value={value}
      onChange={onChange}
      disabled={disabled}
      hasError={hasError}
      label="임시 비밀번호"
      type="text"
      size="lg"
      firstInputRef={firstInputRef}
    />
  );
}
