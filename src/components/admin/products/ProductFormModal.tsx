"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Upload, ImageIcon, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { AdminProductListItem, Category, FeeUnit, ProductStatus } from "@/types";

// ─── Zod 스키마 ───────────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1, "상품명을 입력하세요").max(100, "100자 이내로 입력하세요"),
  category_id: z.string().min(1, "카테고리를 선택하세요"),
  price: z
    .number()
    .int("정수만 입력 가능합니다")
    .min(1, "판매가는 1원 이상이어야 합니다"),
  fee_rate: z
    .number()
    .min(0, "0 이상이어야 합니다"),
  fee_unit: z.enum(["percent", "fixed"] as const),
  description: z.string().max(2000, "2000자 이내로 입력하세요").optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "soldout"] as const),
});

type ProductFormData = z.infer<typeof productSchema>;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  product?: AdminProductListItem | null; // null/undefined = 등록 모드
  categories: Category[];
  onSave: (data: ProductFormData & { image_url?: string | null; image_file?: File | null }) => void | Promise<void>;
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

export function ProductFormModal({
  open,
  onClose,
  product,
  categories,
  onSave,
}: ProductFormModalProps) {
  const isEdit = !!product;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const prevBlobUrl = useRef<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      category_id: "",
      price: undefined,
      fee_rate: 0,
      fee_unit: "percent",
      description: "",
      status: "active",
    },
  });

  // 수정 모드일 때 기존 값 주입 (render-time 동기화 패턴)
  const [prevSyncKey, setPrevSyncKey] = useState("");
  const syncKey = `${open}-${product?.id ?? "new"}`;
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    if (open) {
      if (product) {
        reset({
          name: product.name,
          category_id: product.category_id,
          price: product.price,
          fee_rate: product.fee_rate,
          fee_unit: product.fee_unit,
          description: product.description ?? "",
          status: product.status,
        });
        setPreviewUrl(product.image_url ?? null);
        setSelectedFile(null);
        setFileError(null);
      } else {
        reset({
          name: "",
          category_id: "",
          price: undefined,
          fee_rate: 0,
          fee_unit: "percent",
          description: "",
          status: "active",
        });
        setPreviewUrl(null);
        setSelectedFile(null);
        setFileError(null);
      }
    }
  }

  const watchCategoryId = useWatch({ control, name: "category_id" });
  const watchFeeUnit = useWatch({ control, name: "fee_unit" });
  const watchStatus = useWatch({ control, name: "status" });

  // blob URL cleanup
  useEffect(() => {
    return () => {
      if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
    };
  }, []);

  // 파일 선택 핸들러
  const handleFileChange = useCallback((file: File | null) => {
    if (!file) return;
    setFileError(null);
    if (!file.type.startsWith("image/")) {
      setFileError("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError("파일 크기는 5MB 이하여야 합니다.");
      return;
    }
    if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
    const url = URL.createObjectURL(file);
    prevBlobUrl.current = url;
    setPreviewUrl(url);
    setSelectedFile(file);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    handleFileChange(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFileChange(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const removeImage = useCallback(() => {
    if (prevBlobUrl.current) {
      URL.revokeObjectURL(prevBlobUrl.current);
      prevBlobUrl.current = null;
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // 폼 제출
  const onSubmit = async (data: ProductFormData) => {
    const imageUrl = selectedFile ? null : previewUrl;
    try {
      await onSave({ ...data, image_url: imageUrl, image_file: selectedFile });
      onClose();
    } catch {
      // onSave에서 이미 toast로 에러 표시 → 모달은 열린 상태 유지
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0"
        aria-describedby="product-form-desc"
      >
        <DialogHeader className="border-b border-border px-6 py-4 sticky top-0 bg-card z-10">
          <DialogTitle className="text-[15px] font-semibold text-foreground">
            {isEdit ? "상품 수정" : "상품 등록"}
          </DialogTitle>
          <p id="product-form-desc" className="sr-only">
            {isEdit ? "상품 정보를 수정합니다." : "새 상품을 등록합니다."}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-5 px-6 py-5">

            {/* ── 상품명 ──────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name" className="text-[14px] font-medium text-foreground">
                상품명 <span className="text-error">*</span>
              </Label>
              <Input
                id="name"
                placeholder="상품명을 입력하세요"
                className="h-10 text-sm"
                {...register("name")}
              />
              {errors.name && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={11} />
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* ── 카테고리 + 판매 상태 ───────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category_id" className="text-[14px] font-medium text-foreground">
                  카테고리 <span className="text-error">*</span>
                </Label>
                <Select
                  value={watchCategoryId}
                  onValueChange={(v) => setValue("category_id", v, { shouldValidate: true })}
                >
                  <SelectTrigger id="category_id" className="h-10 text-sm">
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category_id && (
                  <p className="flex items-center gap-1 text-[14px] text-error">
                    <AlertCircle size={11} />
                    {errors.category_id.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="status" className="text-[14px] font-medium text-foreground">
                  판매 상태 <span className="text-error">*</span>
                </Label>
                <Select
                  value={watchStatus}
                  onValueChange={(v) => setValue("status", v as ProductStatus, { shouldValidate: true })}
                >
                  <SelectTrigger id="status" className="h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">판매중</SelectItem>
                    <SelectItem value="inactive">판매중지</SelectItem>
                    <SelectItem value="soldout">품절</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── 판매가 ───────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price" className="text-[14px] font-medium text-foreground">
                판매가 (원) <span className="text-error">*</span>
              </Label>
              <Input
                id="price"
                type="number"
                placeholder="0"
                className="h-10 text-sm w-60"
                {...register("price", { valueAsNumber: true })}
              />
              {errors.price && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={11} />
                  {errors.price.message}
                </p>
              )}
            </div>

            {/* ── 수수료 ─────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[14px] font-medium text-foreground">
                수수료 <span className="text-error">*</span>
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  placeholder="0"
                  className="h-10 text-sm w-40"
                  {...register("fee_rate", { valueAsNumber: true })}
                />
                <RadioGroup
                  value={watchFeeUnit}
                  onValueChange={(v) => setValue("fee_unit", v as FeeUnit, { shouldValidate: true })}
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="percent" id="fee-percent" />
                    <Label htmlFor="fee-percent" className="text-[14px] cursor-pointer">%</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="fixed" id="fee-fixed" />
                    <Label htmlFor="fee-fixed" className="text-[14px] cursor-pointer">원</Label>
                  </div>
                </RadioGroup>
              </div>
              {errors.fee_rate && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={11} />
                  {errors.fee_rate.message}
                </p>
              )}
            </div>

            {/* ── 이미지 업로드 ──────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[14px] font-medium text-foreground">상품 이미지</Label>

              {previewUrl ? (
                <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-border group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="상품 이미지 미리보기"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="이미지 제거"
                  >
                    <X size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white text-[11px] font-medium"
                  >
                    변경
                  </button>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 w-full h-32 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200",
                    isDragging
                      ? "border-primary bg-brand-primary-muted"
                      : "border-border bg-muted/30 hover:border-primary/50 hover:bg-brand-primary-muted/50"
                  )}
                >
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                    isDragging ? "bg-primary/20" : "bg-muted"
                  )}>
                    <ImageIcon size={18} className={isDragging ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-medium text-foreground">
                      클릭하거나 드래그하여 업로드
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG, WEBP (최대 5MB)</p>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleInputChange}
                aria-label="이미지 파일 선택"
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-fit gap-1.5 h-8 text-[14px]"
              >
                <Upload size={13} />
                파일 선택
              </Button>
              {fileError && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={11} />
                  {fileError}
                </p>
              )}
            </div>

            {/* ── 상품 설명 ──────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description" className="text-[14px] font-medium text-foreground">
                상품 설명
              </Label>
              <Textarea
                id="description"
                placeholder="상품에 대한 상세 설명을 입력하세요"
                rows={4}
                className="text-sm resize-none"
                {...register("description")}
              />
              {errors.description && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={11} />
                  {errors.description.message}
                </p>
              )}
            </div>
          </div>

          {/* ── 하단 버튼 ──────────────────────────────── */}
          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4 sticky bottom-0 bg-card">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 px-5 text-[14px]"
            >
              취소
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-9 px-6 text-[14px] bg-primary text-white hover:bg-brand-primary-dark"
            >
              {isSubmitting ? "저장 중..." : isEdit ? "수정 완료" : "상품 등록"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
