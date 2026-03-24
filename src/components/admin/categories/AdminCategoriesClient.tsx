"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  FolderTree,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ImageUploadField } from "@/components/admin/banners/ImageUploadField";
import type { Category } from "@/types";

interface CategoryWithCount extends Category {
  product_count: number;
}

interface CategoryFormData {
  name: string;
  subtitle: string;
  slug: string;
  icon: string;
  image_url: string;
  is_visible: boolean;
}

const INITIAL_FORM: CategoryFormData = {
  name: "",
  subtitle: "",
  slug: "",
  icon: "Tag",
  image_url: "",
  is_visible: true,
};

export function AdminCategoriesClient() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 모달 상태
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormData>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithCount | null>(null);

  // ── 데이터 로드 ──
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const json = await res.json();
      if (json.success) {
        setCategories(json.data);
      }
    } catch {
      console.error("카테고리 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ── 토스트 자동 닫기 ──
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── 폼 열기 ──
  const openCreate = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEdit = (cat: CategoryWithCount) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      subtitle: cat.subtitle || "",
      slug: cat.slug,
      icon: cat.icon,
      image_url: cat.image_url || "",
      is_visible: cat.is_visible,
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  // ── 폼 검증 ──
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "카테고리 이름을 입력해주세요.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── 저장 ──
  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);

    try {
      const url = editingId
        ? `/api/admin/categories/${editingId}`
        : "/api/admin/categories";
      const method = editingId ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        name: form.name.trim(),
        subtitle: form.subtitle.trim(),
        icon: form.icon.trim() || "Tag",
        image_url: form.image_url || null,
        is_visible: form.is_visible,
      };

      if (form.slug.trim()) {
        body.slug = form.slug.trim();
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (json.success) {
        setToast({ type: "success", message: editingId ? "카테고리가 수정되었습니다." : "카테고리가 등록되었습니다." });
        setIsFormOpen(false);
        fetchCategories();
      } else {
        setToast({ type: "error", message: json.error?.message || "저장에 실패했습니다." });
      }
    } catch {
      setToast({ type: "error", message: "서버 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  };

  // ── 삭제 ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/categories/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setToast({ type: "success", message: "카테고리가 삭제되었습니다." });
        fetchCategories();
      } else {
        setToast({ type: "error", message: json.error?.message || "삭제에 실패했습니다." });
      }
    } catch {
      setToast({ type: "error", message: "서버 오류가 발생했습니다." });
    } finally {
      setDeleteTarget(null);
    }
  };

  // ── 순서 변경 ──
  const moveCategory = async (idx: number, direction: "up" | "down") => {
    if (reordering) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    setReordering(true);
    const newCategories = [...categories];
    [newCategories[idx], newCategories[swapIdx]] = [newCategories[swapIdx], newCategories[idx]];
    setCategories(newCategories);

    try {
      const orders = newCategories.map((cat, i) => ({ id: cat.id, sort_order: i + 1 }));
      const res = await fetch("/api/admin/categories/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      const json = await res.json();
      if (!json.success) {
        setToast({ type: "error", message: "순서 변경에 실패했습니다." });
        fetchCategories();
      }
    } catch {
      setToast({ type: "error", message: "순서 변경에 실패했습니다." });
      fetchCategories();
    } finally {
      setReordering(false);
    }
  };

  // ── 노출 토글 ──
  const toggleVisibility = async (cat: CategoryWithCount) => {
    try {
      const res = await fetch(`/api/admin/categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: !cat.is_visible }),
      });
      const json = await res.json();
      if (json.success) {
        fetchCategories();
      }
    } catch {
      setToast({ type: "error", message: "노출 상태 변경에 실패했습니다." });
    }
  };

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[18px] font-bold text-foreground">
            <FolderTree size={20} strokeWidth={1.75} className="text-primary" />
            카테고리 관리
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            상품권 카테고리를 등록·수정·삭제합니다. 총 {categories.length}개
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5 h-9 px-4 text-[13px]">
          <Plus size={15} />
          카테고리 등록
        </Button>
      </div>

      {/* 토스트 */}
      {toast && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-[13px] font-medium ${
            toast.type === "success"
              ? "bg-success-bg text-success"
              : "bg-error-bg text-error"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={15} />
          ) : (
            <AlertCircle size={15} />
          )}
          {toast.message}
        </div>
      )}

      {/* 테이블 */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-10">#</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-16">이미지</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">이름</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">서브타이틀</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">슬러그</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">상품 수</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">노출</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground w-28">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  등록된 카테고리가 없습니다.
                </td>
              </tr>
            ) : (
              categories.map((cat, idx) => (
                <tr
                  key={cat.id}
                  className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span className="w-4 text-center">{idx + 1}</span>
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveCategory(idx, "up")}
                          disabled={idx === 0 || reordering}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                          title="위로 이동"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          onClick={() => moveCategory(idx, "down")}
                          disabled={idx === categories.length - 1 || reordering}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                          title="아래로 이동"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </div>
                  </td>
                  {/* 카테고리 이미지 */}
                  <td className="px-4 py-3">
                    <div className="h-[40px] w-[40px] overflow-hidden rounded-md border border-border bg-muted flex items-center justify-center">
                      {cat.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cat.image_url}
                          alt={cat.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-mono">{cat.icon}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{cat.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {cat.subtitle || <span className="italic text-muted-foreground/50">미설정</span>}
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground">
                      {cat.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-center">{cat.product_count}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleVisibility(cat)}
                      className="inline-flex items-center justify-center"
                      title={cat.is_visible ? "노출 중" : "숨김"}
                      aria-label={`${cat.name} 카테고리 ${cat.is_visible ? "숨기기" : "노출하기"}`}
                    >
                      {cat.is_visible ? (
                        <Eye size={16} className="text-success" />
                      ) : (
                        <EyeOff size={16} className="text-muted-foreground" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(cat)}
                        title="수정"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(cat)}
                        title="삭제"
                        className="text-error hover:text-error"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── 등록/수정 모달 ── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="text-[15px] font-semibold">
              {editingId ? "카테고리 수정" : "카테고리 등록"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-6 py-5">
            {/* 이름 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-name" className="text-[13px] font-medium">
                카테고리 이름 <span className="text-error">*</span>
              </Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="예: 컬쳐랜드 상품권"
                className="h-9 text-[13px]"
              />
              {formErrors.name && (
                <p className="flex items-center gap-1 text-[12px] text-error">
                  <AlertCircle size={12} />
                  {formErrors.name}
                </p>
              )}
            </div>

            {/* 서브타이틀 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-subtitle" className="text-[13px] font-medium">
                서브타이틀 (영문)
              </Label>
              <Input
                id="cat-subtitle"
                value={form.subtitle}
                onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                placeholder="예: CULTURELAND GIFT CARD"
                className="h-9 text-[13px]"
              />
              <p className="text-[11px] text-muted-foreground">
                메인 페이지 카테고리 섹션 위에 표시됩니다. 비워두면 카테고리 이름이 표시됩니다.
              </p>
            </div>

            {/* 슬러그 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-slug" className="text-[13px] font-medium">
                슬러그 (URL)
              </Label>
              <Input
                id="cat-slug"
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="예: cultureland (자동 생성 가능)"
                className="h-9 text-[13px]"
              />
              <p className="text-[11px] text-muted-foreground">
                영문 소문자, 숫자, 하이픈만 사용. 비워두면 자동 생성됩니다.
              </p>
            </div>

            {/* 아이콘 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-icon" className="text-[13px] font-medium">
                아이콘 (Lucide)
              </Label>
              <Input
                id="cat-icon"
                value={form.icon}
                onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                placeholder="예: Tag, Gift, CreditCard"
                className="h-9 text-[13px]"
              />
              <p className="text-[11px] text-muted-foreground">
                이미지를 업로드하면 아이콘 대신 이미지가 표시됩니다.
              </p>
            </div>

            {/* 카테고리 이미지 */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[13px] font-medium">
                카테고리 이미지 (선택)
              </Label>
              <ImageUploadField
                value={form.image_url}
                bucket="categories"
                onChange={(url) => setForm((prev) => ({ ...prev, image_url: url }))}
                previewSize="sm"
              />
              <p className="text-[11px] text-muted-foreground">
                권장 사이즈: 80×80px. 이미지 미설정 시 아이콘이 사용됩니다.
              </p>
            </div>

            {/* 노출 여부 */}
            <div className="flex items-center justify-between">
              <Label htmlFor="cat-visible" className="text-[13px] font-medium">
                사용자에게 노출
              </Label>
              <Switch
                id="cat-visible"
                checked={form.is_visible}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, is_visible: v }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            <Button
              variant="outline"
              onClick={() => setIsFormOpen(false)}
              className="h-9 px-5 text-[13px]"
            >
              취소
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-6 text-[13px] bg-primary text-white hover:bg-brand-primary-dark"
            >
              {saving ? "저장 중..." : editingId ? "수정" : "등록"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 삭제 확인 ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error-bg">
                <Trash2 size={20} className="text-error" />
              </div>
            </AlertDialogMedia>
            <AlertDialogTitle>카테고리 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> 카테고리를 삭제하시겠습니까?
              {deleteTarget && deleteTarget.product_count > 0 && (
                <span className="mt-1 block text-error">
                  이 카테고리에 {deleteTarget.product_count}개의 상품이 있어 삭제할 수 없습니다.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!!deleteTarget && deleteTarget.product_count > 0}
              className="bg-error text-white hover:bg-error/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
