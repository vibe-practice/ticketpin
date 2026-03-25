"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import type { AdminFaqItem, FaqCategory } from "@/types";

// ─── Zod 스키마 ───────────────────────────────────────────────────────────────

const faqSchema = z.object({
  category: z.enum(["구매", "교환권", "선물", "환불", "계정"] as const),
  question: z
    .string()
    .min(1, "질문을 입력하세요")
    .max(200, "200자 이내로 입력하세요"),
  answer: z
    .string()
    .min(1, "답변을 입력하세요")
    .max(3000, "3000자 이내로 입력하세요"),
  sort_order: z.number().int("정수를 입력하세요").min(1, "1 이상이어야 합니다"),
  is_visible: z.boolean(),
});

type FaqFormData = z.infer<typeof faqSchema>;

import { FAQ_CATEGORIES } from "./AdminFaqClient";

// ─── Props ────────────────────────────────────────────────────────────────────

interface FaqFormModalProps {
  open: boolean;
  onClose: () => void;
  faq?: AdminFaqItem | null;
  maxSortOrder?: number;
  onSave: (data: FaqFormData) => void;
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

export function FaqFormModal({
  open,
  onClose,
  faq,
  maxSortOrder = 1,
  onSave,
}: FaqFormModalProps) {
  const isEdit = !!faq;

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FaqFormData>({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      category: "구매",
      question: "",
      answer: "",
      sort_order: maxSortOrder,
      is_visible: true,
    },
  });

  const watchCategory = useWatch({ control, name: "category" });
  const watchIsVisible = useWatch({ control, name: "is_visible" });

  // 수정 모드일 때 기존 값 주입
  useEffect(() => {
    if (open) {
      if (faq) {
        reset({
          category: faq.category,
          question: faq.question,
          answer: faq.answer,
          sort_order: faq.sort_order,
          is_visible: faq.is_visible,
        });
      } else {
        reset({
          category: "구매",
          question: "",
          answer: "",
          sort_order: maxSortOrder,
          is_visible: true,
        });
      }
    }
  }, [open, faq, maxSortOrder, reset]);

  const onSubmit = (data: FaqFormData) => {
    onSave(data);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0"
        aria-describedby="faq-form-desc"
      >
        <DialogHeader className="border-b border-border px-6 py-4 sticky top-0 bg-card z-10">
          <DialogTitle className="text-[15px] font-semibold text-foreground">
            {isEdit ? "FAQ 수정" : "FAQ 등록"}
          </DialogTitle>
          <p id="faq-form-desc" className="sr-only">
            {isEdit ? "FAQ를 수정합니다." : "새 FAQ를 등록합니다."}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-5 px-6 py-5">

            {/* ── 카테고리 + 정렬 순서 ──────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category" className="text-[14px] font-medium text-foreground">
                  카테고리 <span className="text-error">*</span>
                </Label>
                <Select
                  value={watchCategory}
                  onValueChange={(v) =>
                    setValue("category", v as Exclude<FaqCategory, "전체">, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="category" className="h-10 text-sm">
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {FAQ_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="flex items-center gap-1 text-[14px] text-error">
                    <AlertCircle size={11} />
                    {errors.category.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sort_order" className="text-[14px] font-medium text-foreground">
                  정렬 순서 <span className="text-error">*</span>
                </Label>
                <Input
                  id="sort_order"
                  type="number"
                  placeholder="1"
                  className="h-10 text-sm"
                  {...register("sort_order", { valueAsNumber: true })}
                />
                {errors.sort_order && (
                  <p className="flex items-center gap-1 text-[14px] text-error">
                    <AlertCircle size={11} />
                    {errors.sort_order.message}
                  </p>
                )}
              </div>
            </div>

            {/* ── 질문 ──────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="question" className="text-[14px] font-medium text-foreground">
                질문 <span className="text-error">*</span>
              </Label>
              <Input
                id="question"
                placeholder="질문을 입력하세요"
                className="h-10 text-sm"
                {...register("question")}
              />
              {errors.question && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={11} />
                  {errors.question.message}
                </p>
              )}
            </div>

            {/* ── 답변 ──────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="answer" className="text-[14px] font-medium text-foreground">
                답변 <span className="text-error">*</span>
              </Label>
              <Textarea
                id="answer"
                placeholder="답변을 입력하세요"
                rows={7}
                className="text-sm resize-none"
                {...register("answer")}
              />
              {errors.answer && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={11} />
                  {errors.answer.message}
                </p>
              )}
            </div>

            {/* ── 노출 여부 ──────────────────────────────── */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
              <div>
                <p className="text-[14px] font-medium text-foreground">노출 여부</p>
                <p className="text-[14px] text-muted-foreground">
                  비활성화 시 사용자 FAQ 페이지에 표시되지 않습니다
                </p>
              </div>
              <Switch
                checked={watchIsVisible}
                onCheckedChange={(v) => setValue("is_visible", v)}
                aria-label="노출 여부"
              />
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
              {isSubmitting ? "저장 중..." : isEdit ? "수정 완료" : "FAQ 등록"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
