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
import type { AdminNotice, NoticeCategory } from "@/types";

// ─── Zod 스키마 ───────────────────────────────────────────────────────────────

const noticeSchema = z.object({
  title: z
    .string()
    .min(1, "제목을 입력하세요")
    .max(200, "200자 이내로 입력하세요"),
  content: z
    .string()
    .min(1, "내용을 입력하세요")
    .max(10000, "10000자 이내로 입력하세요"),
  category: z.enum(["일반", "이벤트", "점검"] as const),
  is_important: z.boolean(),
  is_visible: z.boolean(),
});

type NoticeFormData = z.infer<typeof noticeSchema>;

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const NOTICE_CATEGORIES: Exclude<NoticeCategory, "전체">[] = [
  "일반",
  "이벤트",
  "점검",
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface NoticeFormModalProps {
  open: boolean;
  onClose: () => void;
  notice?: AdminNotice | null;
  onSave: (data: NoticeFormData) => void;
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

export function NoticeFormModal({
  open,
  onClose,
  notice,
  onSave,
}: NoticeFormModalProps) {
  const isEdit = !!notice;

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NoticeFormData>({
    resolver: zodResolver(noticeSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "일반",
      is_important: false,
      is_visible: true,
    },
  });

  const watchCategory = useWatch({ control, name: "category" });
  const watchIsImportant = useWatch({ control, name: "is_important" });
  const watchIsVisible = useWatch({ control, name: "is_visible" });

  // 수정 모드일 때 기존 값 주입
  useEffect(() => {
    if (open) {
      if (notice) {
        reset({
          title: notice.title,
          content: notice.content,
          category: notice.category,
          is_important: notice.is_important,
          is_visible: notice.is_visible,
        });
      } else {
        reset({
          title: "",
          content: "",
          category: "일반",
          is_important: false,
          is_visible: true,
        });
      }
    }
  }, [open, notice, reset]);

  const onSubmit = (data: NoticeFormData) => {
    onSave(data);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0"
        aria-describedby="notice-form-desc"
      >
        <DialogHeader className="border-b border-border px-6 py-4 sticky top-0 bg-card z-10">
          <DialogTitle className="text-[15px] font-semibold text-foreground">
            {isEdit ? "공지사항 수정" : "공지사항 등록"}
          </DialogTitle>
          <p id="notice-form-desc" className="sr-only">
            {isEdit ? "공지사항을 수정합니다." : "새 공지사항을 등록합니다."}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-5 px-6 py-5">

            {/* ── 제목 ──────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title" className="text-[13px] font-medium text-foreground">
                제목 <span className="text-error">*</span>
              </Label>
              <Input
                id="title"
                placeholder="공지사항 제목을 입력하세요"
                className="h-10 text-sm"
                {...register("title")}
              />
              {errors.title && (
                <p className="flex items-center gap-1 text-[12px] text-error">
                  <AlertCircle size={11} />
                  {errors.title.message}
                </p>
              )}
            </div>

            {/* ── 카테고리 ──────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category" className="text-[13px] font-medium text-foreground">
                카테고리 <span className="text-error">*</span>
              </Label>
              <Select
                value={watchCategory}
                onValueChange={(v) =>
                  setValue("category", v as Exclude<NoticeCategory, "전체">, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="category" className="h-10 text-sm">
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {NOTICE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="flex items-center gap-1 text-[12px] text-error">
                  <AlertCircle size={11} />
                  {errors.category.message}
                </p>
              )}
            </div>

            {/* ── 내용 ──────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content" className="text-[13px] font-medium text-foreground">
                내용 <span className="text-error">*</span>
              </Label>
              <Textarea
                id="content"
                placeholder="공지사항 내용을 입력하세요"
                rows={12}
                className="text-sm resize-none"
                {...register("content")}
              />
              {errors.content && (
                <p className="flex items-center gap-1 text-[12px] text-error">
                  <AlertCircle size={11} />
                  {errors.content.message}
                </p>
              )}
            </div>

            {/* ── 중요 공지 + 노출 여부 ─────────────────── */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-foreground">중요 공지</p>
                  <p className="text-[12px] text-muted-foreground">
                    활성화 시 공지 목록 최상단에 고정됩니다
                  </p>
                </div>
                <Switch
                  checked={watchIsImportant}
                  onCheckedChange={(v) => setValue("is_important", v)}
                  aria-label="중요 공지 여부"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-foreground">노출 여부</p>
                  <p className="text-[12px] text-muted-foreground">
                    비활성화 시 사용자 공지사항 페이지에 표시되지 않습니다
                  </p>
                </div>
                <Switch
                  checked={watchIsVisible}
                  onCheckedChange={(v) => setValue("is_visible", v)}
                  aria-label="노출 여부"
                />
              </div>
            </div>
          </div>

          {/* ── 하단 버튼 ──────────────────────────────── */}
          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4 sticky bottom-0 bg-card">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 px-5 text-[13px]"
            >
              취소
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-9 px-6 text-[13px] bg-primary text-white hover:bg-brand-primary-dark"
            >
              {isSubmitting ? "저장 중..." : isEdit ? "수정 완료" : "공지 등록"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
