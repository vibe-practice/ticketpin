"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadFieldProps {
  value: string; // 현재 이미지 URL (빈 문자열 = 없음)
  bucket: string; // "banners" | "side-banners" | "categories"
  onChange: (url: string) => void;
  className?: string;
  previewSize?: "sm" | "md" | "lg"; // sm=100px, md=160px, lg=240px
  accept?: string;
  disabled?: boolean;
}

export function ImageUploadField({
  value,
  bucket,
  onChange,
  className,
  previewSize = "md",
  accept = "image/jpeg,image/png,image/webp,image/gif",
  disabled = false,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const previewHeight = previewSize === "sm" ? "h-24" : previewSize === "lg" ? "h-48" : "h-36";

  const uploadFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bucket", bucket);

        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });
        const json = await res.json();

        if (json.success) {
          onChange(json.data.url);
        } else {
          setUploadError(json.error?.message ?? "업로드에 실패했습니다.");
        }
      } catch {
        setUploadError("업로드 중 오류가 발생했습니다.");
      } finally {
        setUploading(false);
      }
    },
    [bucket, onChange]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setUploadError(null);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* 업로드 영역 */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="이미지 업로드 영역"
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled && !uploading) {
            inputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-all duration-200",
          previewHeight,
          dragging
            ? "border-primary bg-brand-primary-soft"
            : value
              ? "border-border bg-muted/20"
              : "border-border bg-muted/10 hover:border-primary/60 hover:bg-brand-primary-soft/30",
          disabled && "cursor-default opacity-60",
          uploading && "cursor-wait"
        )}
      >
        {/* 미리보기 이미지 */}
        {value && !uploading ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="업로드된 이미지 미리보기"
              className="h-full w-full object-cover"
            />
            {/* 삭제 버튼 오버레이 */}
            {!disabled && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1.5 rounded-md bg-error px-3 py-1.5 text-[14px] font-semibold text-white shadow-md transition-transform hover:scale-105"
                  aria-label="이미지 삭제"
                >
                  <X size={13} />
                  이미지 삭제
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                  className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[14px] font-semibold text-foreground shadow-md transition-transform hover:scale-105"
                  aria-label="이미지 교체"
                >
                  <Upload size={13} />
                  교체
                </button>
              </div>
            )}
          </>
        ) : uploading ? (
          <div className="flex flex-col items-center gap-2 text-primary">
            <Loader2 size={24} className="animate-spin" />
            <p className="text-[14px] font-medium">업로드 중...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className={cn(
              "flex items-center justify-center rounded-xl transition-colors",
              dragging ? "text-primary" : "text-muted-foreground"
            )}>
              <ImageIcon size={28} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-medium text-foreground">
                {dragging ? "여기에 놓으세요" : "클릭하거나 드래그하여 업로드"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                JPEG, PNG, WebP, GIF · 최대 5MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 에러 메시지 */}
      {uploadError && (
        <p className="text-[11px] text-error">{uploadError}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}
