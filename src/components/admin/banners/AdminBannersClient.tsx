"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Images,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  LayoutTemplate,
  Sidebar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUploadField } from "@/components/admin/banners/ImageUploadField";
import { cn } from "@/lib/utils";
import type { Banner, SideBanner, SideBannerPosition } from "@/types";

// ─── 위치 레이블 ─────────────────────────────────────────────────────────────

const POSITION_LABELS: Record<SideBannerPosition, string> = {
  sidebar_top: "사이드바 상단",
  sidebar_middle: "사이드바 중단",
  sidebar_bottom: "사이드바 하단",
};

const POSITION_BADGE_STYLE: Record<SideBannerPosition, string> = {
  sidebar_top: "bg-info-bg text-info",
  sidebar_middle: "bg-brand-primary-soft text-primary",
  sidebar_bottom: "bg-success-bg text-success",
};

// ─── 메인 배너 폼 타입 ────────────────────────────────────────────────────────

interface BannerFormData {
  image_url: string;
  link_url: string;
  alt_text: string;
  is_active: boolean;
}

const INITIAL_BANNER_FORM: BannerFormData = {
  image_url: "",
  link_url: "",
  alt_text: "",
  is_active: true,
};

// ─── 사이드 배너 폼 타입 ──────────────────────────────────────────────────────

interface SideBannerFormData {
  image_url: string;
  link_url: string;
  alt_text: string;
  position: SideBannerPosition;
  is_active: boolean;
}

const INITIAL_SIDE_FORM: SideBannerFormData = {
  image_url: "",
  link_url: "",
  alt_text: "",
  position: "sidebar_top",
  is_active: true,
};

// ─── 토스트 훅 ────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, show };
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function AdminBannersClient() {
  const { toast, show: showToast } = useToast();

  // ── 메인 배너 상태 ──
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerReordering, setBannerReordering] = useState(false);

  const [bannerFormOpen, setBannerFormOpen] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [bannerForm, setBannerForm] = useState<BannerFormData>(INITIAL_BANNER_FORM);
  const [bannerFormErrors, setBannerFormErrors] = useState<Record<string, string>>({});
  const [deleteBannerTarget, setDeleteBannerTarget] = useState<Banner | null>(null);
  const [deletingBanner, setDeletingBanner] = useState(false);

  // ── 사이드 배너 상태 ──
  const [sideBanners, setSideBanners] = useState<SideBanner[]>([]);
  const [sideBannersLoading, setSideBannersLoading] = useState(true);
  const [sideBannerSaving, setSideBannerSaving] = useState(false);

  const [sideBannerFormOpen, setSideBannerFormOpen] = useState(false);
  const [editingSideBannerId, setEditingSideBannerId] = useState<string | null>(null);
  const [sideBannerForm, setSideBannerForm] = useState<SideBannerFormData>(INITIAL_SIDE_FORM);
  const [sideBannerFormErrors, setSideBannerFormErrors] = useState<Record<string, string>>({});
  const [deleteSideBannerTarget, setDeleteSideBannerTarget] = useState<SideBanner | null>(null);
  const [deletingSideBanner, setDeletingSideBanner] = useState(false);

  // ── 데이터 로드 ──

  const fetchBanners = useCallback(async () => {
    try {
      setBannersLoading(true);
      const res = await fetch("/api/admin/banners");
      const json = await res.json();
      if (json.success) setBanners(json.data);
    } catch {
    } finally {
      setBannersLoading(false);
    }
  }, []);

  const fetchSideBanners = useCallback(async () => {
    try {
      setSideBannersLoading(true);
      const res = await fetch("/api/admin/side-banners");
      const json = await res.json();
      if (json.success) setSideBanners(json.data);
    } catch {
    } finally {
      setSideBannersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
    fetchSideBanners();
  }, [fetchBanners, fetchSideBanners]);

  // ══════════════════════════════════════════════════
  // 메인 배너 CRUD
  // ══════════════════════════════════════════════════

  const openBannerCreate = () => {
    setEditingBannerId(null);
    setBannerForm(INITIAL_BANNER_FORM);
    setBannerFormErrors({});
    setBannerFormOpen(true);
  };

  const openBannerEdit = (banner: Banner) => {
    setEditingBannerId(banner.id);
    setBannerForm({
      image_url: banner.image_url,
      link_url: banner.link_url ?? "",
      alt_text: banner.alt_text,
      is_active: banner.is_active,
    });
    setBannerFormErrors({});
    setBannerFormOpen(true);
  };

  const validateBannerForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!bannerForm.image_url) errors.image_url = "이미지를 업로드해주세요.";
    setBannerFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBannerSave = async () => {
    if (!validateBannerForm()) return;
    setBannerSaving(true);
    try {
      const url = editingBannerId
        ? `/api/admin/banners/${editingBannerId}`
        : "/api/admin/banners";
      const method = editingBannerId ? "PUT" : "POST";
      const body = {
        image_url: bannerForm.image_url,
        link_url: bannerForm.link_url.trim() || null,
        alt_text: bannerForm.alt_text.trim(),
        is_active: bannerForm.is_active,
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        showToast("success", editingBannerId ? "배너가 수정되었습니다." : "배너가 등록되었습니다.");
        setBannerFormOpen(false);
        fetchBanners();
      } else {
        showToast("error", json.error?.message ?? "저장에 실패했습니다.");
      }
    } catch {
      showToast("error", "서버 오류가 발생했습니다.");
    } finally {
      setBannerSaving(false);
    }
  };

  const handleBannerDelete = async () => {
    if (!deleteBannerTarget || deletingBanner) return;
    setDeletingBanner(true);
    try {
      const res = await fetch(`/api/admin/banners/${deleteBannerTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        showToast("success", "배너가 삭제되었습니다.");
        fetchBanners();
      } else {
        showToast("error", json.error?.message ?? "삭제에 실패했습니다.");
      }
    } catch {
      showToast("error", "서버 오류가 발생했습니다.");
    } finally {
      setDeleteBannerTarget(null);
      setDeletingBanner(false);
    }
  };

  const moveBanner = async (idx: number, direction: "up" | "down") => {
    if (bannerReordering) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= banners.length) return;
    setBannerReordering(true);
    const newBanners = [...banners];
    [newBanners[idx], newBanners[swapIdx]] = [newBanners[swapIdx], newBanners[idx]];
    setBanners(newBanners);
    try {
      const orders = newBanners.map((b, i) => ({ id: b.id, sort_order: i + 1 }));
      const res = await fetch("/api/admin/banners/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      const json = await res.json();
      if (!json.success) {
        showToast("error", "순서 변경에 실패했습니다.");
        fetchBanners();
      }
    } catch {
      showToast("error", "순서 변경에 실패했습니다.");
      fetchBanners();
    } finally {
      setBannerReordering(false);
    }
  };

  const toggleBannerActive = async (banner: Banner) => {
    // 낙관적 업데이트
    setBanners((prev) =>
      prev.map((b) => (b.id === banner.id ? { ...b, is_active: !b.is_active } : b))
    );
    try {
      const res = await fetch(`/api/admin/banners/${banner.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !banner.is_active }),
      });
      const json = await res.json();
      if (!json.success) {
        setBanners((prev) =>
          prev.map((b) => (b.id === banner.id ? { ...b, is_active: banner.is_active } : b))
        );
        showToast("error", "활성 상태 변경에 실패했습니다.");
      }
    } catch {
      setBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, is_active: banner.is_active } : b))
      );
      showToast("error", "활성 상태 변경에 실패했습니다.");
    }
  };

  // ══════════════════════════════════════════════════
  // 사이드 배너 CRUD
  // ══════════════════════════════════════════════════

  const openSideBannerCreate = () => {
    setEditingSideBannerId(null);
    setSideBannerForm(INITIAL_SIDE_FORM);
    setSideBannerFormErrors({});
    setSideBannerFormOpen(true);
  };

  const openSideBannerEdit = (sb: SideBanner) => {
    setEditingSideBannerId(sb.id);
    setSideBannerForm({
      image_url: sb.image_url,
      link_url: sb.link_url ?? "",
      alt_text: sb.alt_text,
      position: sb.position,
      is_active: sb.is_active,
    });
    setSideBannerFormErrors({});
    setSideBannerFormOpen(true);
  };

  const validateSideBannerForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!sideBannerForm.image_url) errors.image_url = "이미지를 업로드해주세요.";
    setSideBannerFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSideBannerSave = async () => {
    if (!validateSideBannerForm()) return;
    setSideBannerSaving(true);
    try {
      const url = editingSideBannerId
        ? `/api/admin/side-banners/${editingSideBannerId}`
        : "/api/admin/side-banners";
      const method = editingSideBannerId ? "PUT" : "POST";
      const body = {
        image_url: sideBannerForm.image_url,
        link_url: sideBannerForm.link_url.trim() || null,
        alt_text: sideBannerForm.alt_text.trim(),
        position: sideBannerForm.position,
        is_active: sideBannerForm.is_active,
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        showToast("success", editingSideBannerId ? "사이드 배너가 수정되었습니다." : "사이드 배너가 등록되었습니다.");
        setSideBannerFormOpen(false);
        fetchSideBanners();
      } else {
        showToast("error", json.error?.message ?? "저장에 실패했습니다.");
      }
    } catch {
      showToast("error", "서버 오류가 발생했습니다.");
    } finally {
      setSideBannerSaving(false);
    }
  };

  const handleSideBannerDelete = async () => {
    if (!deleteSideBannerTarget || deletingSideBanner) return;
    setDeletingSideBanner(true);
    try {
      const res = await fetch(`/api/admin/side-banners/${deleteSideBannerTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        showToast("success", "사이드 배너가 삭제되었습니다.");
        fetchSideBanners();
      } else {
        showToast("error", json.error?.message ?? "삭제에 실패했습니다.");
      }
    } catch {
      showToast("error", "서버 오류가 발생했습니다.");
    } finally {
      setDeleteSideBannerTarget(null);
      setDeletingSideBanner(false);
    }
  };

  const toggleSideBannerActive = async (sb: SideBanner) => {
    setSideBanners((prev) =>
      prev.map((b) => (b.id === sb.id ? { ...b, is_active: !b.is_active } : b))
    );
    try {
      const res = await fetch(`/api/admin/side-banners/${sb.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !sb.is_active }),
      });
      const json = await res.json();
      if (!json.success) {
        setSideBanners((prev) =>
          prev.map((b) => (b.id === sb.id ? { ...b, is_active: sb.is_active } : b))
        );
        showToast("error", "활성 상태 변경에 실패했습니다.");
      }
    } catch {
      setSideBanners((prev) =>
        prev.map((b) => (b.id === sb.id ? { ...b, is_active: sb.is_active } : b))
      );
      showToast("error", "활성 상태 변경에 실패했습니다.");
    }
  };

  // ── 렌더링 ──

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 토스트 */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 shadow-lg text-[14px] font-medium transition-all",
            toast.type === "success"
              ? "border-success/30 bg-success-bg text-success"
              : "border-error/30 bg-error-bg text-error"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={15} />
          ) : (
            <AlertCircle size={15} />
          )}
          {toast.message}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary-soft">
          <Images size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">배너 관리</h1>
          <p className="text-[14px] text-muted-foreground">메인 배너와 사이드 배너를 관리합니다</p>
        </div>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="main">
        <TabsList className="h-10 bg-muted/50">
          <TabsTrigger value="main" className="gap-1.5 text-[14px]">
            <LayoutTemplate size={14} />
            메인 배너
            <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
              {banners.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="side" className="gap-1.5 text-[14px]">
            <Sidebar size={14} />
            사이드 배너
            <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
              {sideBanners.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* ── 메인 배너 탭 ── */}
        <TabsContent value="main" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[14px] text-muted-foreground">
              메인 페이지 상단 슬라이더에 표시됩니다. 순서를 조정할 수 있습니다.
            </p>
            <Button onClick={openBannerCreate} className="gap-1.5 h-9 px-4 text-[14px]">
              <Plus size={14} />
              배너 등록
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-10">#</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-20">이미지</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">대체 텍스트</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">링크 URL</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground w-20">활성</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground w-28">관리</th>
                </tr>
              </thead>
              <tbody>
                {bannersLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        로딩 중...
                      </div>
                    </td>
                  </tr>
                ) : banners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Images size={32} strokeWidth={1.5} className="opacity-40" />
                        <p className="text-[14px]">등록된 배너가 없습니다.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  banners.map((banner, idx) => (
                    <tr
                      key={banner.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors"
                    >
                      {/* 순서 */}
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span className="w-4 text-center text-[14px]">{idx + 1}</span>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => moveBanner(idx, "up")}
                              disabled={idx === 0 || bannerReordering}
                              className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                              title="위로 이동"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBanner(idx, "down")}
                              disabled={idx === banners.length - 1 || bannerReordering}
                              className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                              title="아래로 이동"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 이미지 미리보기 */}
                      <td className="px-4 py-3">
                        <div className="h-[46px] w-[82px] overflow-hidden rounded-md border border-border bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={banner.image_url}
                            alt={banner.alt_text || "배너 이미지"}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      </td>

                      {/* 대체 텍스트 */}
                      <td className="px-4 py-3 text-foreground">
                        {banner.alt_text || (
                          <span className="italic text-muted-foreground/50">미설정</span>
                        )}
                      </td>

                      {/* 링크 */}
                      <td className="px-4 py-3">
                        {banner.link_url ? (
                          <a
                            href={banner.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline max-w-[220px] truncate"
                            title={banner.link_url}
                          >
                            <ExternalLink size={12} className="shrink-0" />
                            <span className="truncate text-[14px]">{banner.link_url}</span>
                          </a>
                        ) : (
                          <span className="italic text-muted-foreground/50">없음</span>
                        )}
                      </td>

                      {/* 활성 토글 */}
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <Switch
                            checked={banner.is_active}
                            onCheckedChange={() => toggleBannerActive(banner)}
                            aria-label={banner.is_active ? "활성" : "비활성"}
                          />
                        </div>
                      </td>

                      {/* 액션 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openBannerEdit(banner)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-brand-primary-soft hover:text-primary transition-colors"
                            title="수정"
                            aria-label="배너 수정"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteBannerTarget(banner)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-error-bg hover:text-error transition-colors"
                            title="삭제"
                            aria-label="배너 삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── 사이드 배너 탭 ── */}
        <TabsContent value="side" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[14px] text-muted-foreground">
              사이드바 영역에 표시되는 배너입니다. 위치(상단/중단/하단)를 지정할 수 있습니다.
            </p>
            <Button onClick={openSideBannerCreate} className="gap-1.5 h-9 px-4 text-[14px]">
              <Plus size={14} />
              사이드 배너 등록
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-20">이미지</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">대체 텍스트</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground w-32">위치</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">링크 URL</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground w-20">활성</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground w-24">관리</th>
                </tr>
              </thead>
              <tbody>
                {sideBannersLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        로딩 중...
                      </div>
                    </td>
                  </tr>
                ) : sideBanners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Sidebar size={32} strokeWidth={1.5} className="opacity-40" />
                        <p className="text-[14px]">등록된 사이드 배너가 없습니다.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sideBanners.map((sb) => (
                    <tr
                      key={sb.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors"
                    >
                      {/* 이미지 */}
                      <td className="px-4 py-3">
                        <div className="h-[46px] w-[82px] overflow-hidden rounded-md border border-border bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={sb.image_url}
                            alt={sb.alt_text || "사이드 배너"}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      </td>

                      {/* 대체 텍스트 */}
                      <td className="px-4 py-3 text-foreground">
                        {sb.alt_text || (
                          <span className="italic text-muted-foreground/50">미설정</span>
                        )}
                      </td>

                      {/* 위치 뱃지 */}
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <span
                            className={cn(
                              "whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                              POSITION_BADGE_STYLE[sb.position]
                            )}
                          >
                            {POSITION_LABELS[sb.position]}
                          </span>
                        </div>
                      </td>

                      {/* 링크 */}
                      <td className="px-4 py-3">
                        {sb.link_url ? (
                          <a
                            href={sb.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline max-w-[200px]"
                            title={sb.link_url}
                          >
                            <ExternalLink size={12} className="shrink-0" />
                            <span className="truncate text-[14px]">{sb.link_url}</span>
                          </a>
                        ) : (
                          <span className="italic text-muted-foreground/50">없음</span>
                        )}
                      </td>

                      {/* 활성 토글 */}
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <Switch
                            checked={sb.is_active}
                            onCheckedChange={() => toggleSideBannerActive(sb)}
                            aria-label={sb.is_active ? "활성" : "비활성"}
                          />
                        </div>
                      </td>

                      {/* 액션 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openSideBannerEdit(sb)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-brand-primary-soft hover:text-primary transition-colors"
                            title="수정"
                            aria-label="사이드 배너 수정"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteSideBannerTarget(sb)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-error-bg hover:text-error transition-colors"
                            title="삭제"
                            aria-label="사이드 배너 삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════════════════════════════════════════════════ */}
      {/* 메인 배너 등록/수정 모달 */}
      {/* ══════════════════════════════════════════════════ */}
      <Dialog open={bannerFormOpen} onOpenChange={setBannerFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="text-[15px] font-semibold">
              {editingBannerId ? "메인 배너 수정" : "메인 배너 등록"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-6 py-5">
            {/* 이미지 업로드 */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[14px] font-medium">
                배너 이미지 <span className="text-error">*</span>
              </Label>
              <ImageUploadField
                value={bannerForm.image_url}
                bucket="banners"
                onChange={(url) => setBannerForm((prev) => ({ ...prev, image_url: url }))}
                previewSize="lg"
              />
              {bannerFormErrors.image_url && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={12} />
                  {bannerFormErrors.image_url}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                권장 사이즈: 1200×400px (3:1 비율). JPEG, PNG, WebP 지원.
              </p>
            </div>

            {/* 링크 URL */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="banner-link" className="text-[14px] font-medium">
                링크 URL
              </Label>
              <Input
                id="banner-link"
                value={bannerForm.link_url}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, link_url: e.target.value }))}
                placeholder="https://example.com/promotion (선택)"
                className="h-9 text-[14px]"
              />
            </div>

            {/* 대체 텍스트 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="banner-alt" className="text-[14px] font-medium">
                대체 텍스트 (alt)
              </Label>
              <Input
                id="banner-alt"
                value={bannerForm.alt_text}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, alt_text: e.target.value }))}
                placeholder="예: 봄맞이 특가 이벤트 배너"
                className="h-9 text-[14px]"
              />
              <p className="text-[11px] text-muted-foreground">
                스크린 리더 및 이미지 로드 실패 시 표시됩니다.
              </p>
            </div>

            {/* 활성 여부 */}
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <Label htmlFor="banner-active" className="text-[14px] font-medium">
                  배너 활성화
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  비활성 시 메인 슬라이더에 표시되지 않습니다.
                </p>
              </div>
              <Switch
                id="banner-active"
                checked={bannerForm.is_active}
                onCheckedChange={(v) => setBannerForm((prev) => ({ ...prev, is_active: v }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            <Button
              variant="outline"
              onClick={() => setBannerFormOpen(false)}
              className="h-9 px-5 text-[14px]"
            >
              취소
            </Button>
            <Button
              onClick={handleBannerSave}
              disabled={bannerSaving}
              className="h-9 px-6 text-[14px] bg-primary text-white hover:bg-brand-primary-dark"
            >
              {bannerSaving ? "저장 중..." : editingBannerId ? "수정" : "등록"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════ */}
      {/* 메인 배너 삭제 확인 */}
      {/* ══════════════════════════════════════════════════ */}
      <AlertDialog open={!!deleteBannerTarget} onOpenChange={(v) => { if (!v) setDeleteBannerTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-error-bg text-error">
              <AlertTriangle size={28} strokeWidth={2} />
            </AlertDialogMedia>
            <AlertDialogTitle>배너 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 배너를 삭제하시겠습니까?
              <br />
              삭제 후 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteBannerTarget(null)}>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleBannerDelete} disabled={deletingBanner}>
              {deletingBanner ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══════════════════════════════════════════════════ */}
      {/* 사이드 배너 등록/수정 모달 */}
      {/* ══════════════════════════════════════════════════ */}
      <Dialog open={sideBannerFormOpen} onOpenChange={setSideBannerFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="text-[15px] font-semibold">
              {editingSideBannerId ? "사이드 배너 수정" : "사이드 배너 등록"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-6 py-5">
            {/* 이미지 업로드 */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[14px] font-medium">
                배너 이미지 <span className="text-error">*</span>
              </Label>
              <ImageUploadField
                value={sideBannerForm.image_url}
                bucket="side-banners"
                onChange={(url) => setSideBannerForm((prev) => ({ ...prev, image_url: url }))}
                previewSize="md"
              />
              {sideBannerFormErrors.image_url && (
                <p className="flex items-center gap-1 text-[14px] text-error">
                  <AlertCircle size={12} />
                  {sideBannerFormErrors.image_url}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                권장 사이즈: 240×120px. JPEG, PNG, WebP 지원.
              </p>
            </div>

            {/* 위치 선택 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="side-position" className="text-[14px] font-medium">
                표시 위치 <span className="text-error">*</span>
              </Label>
              <Select
                value={sideBannerForm.position}
                onValueChange={(v) =>
                  setSideBannerForm((prev) => ({ ...prev, position: v as SideBannerPosition }))
                }
              >
                <SelectTrigger id="side-position" className="h-9 text-[14px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sidebar_top">사이드바 상단</SelectItem>
                  <SelectItem value="sidebar_middle">사이드바 중단</SelectItem>
                  <SelectItem value="sidebar_bottom">사이드바 하단</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 링크 URL */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="side-link" className="text-[14px] font-medium">
                링크 URL
              </Label>
              <Input
                id="side-link"
                value={sideBannerForm.link_url}
                onChange={(e) => setSideBannerForm((prev) => ({ ...prev, link_url: e.target.value }))}
                placeholder="https://example.com (선택)"
                className="h-9 text-[14px]"
              />
            </div>

            {/* 대체 텍스트 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="side-alt" className="text-[14px] font-medium">
                대체 텍스트 (alt)
              </Label>
              <Input
                id="side-alt"
                value={sideBannerForm.alt_text}
                onChange={(e) => setSideBannerForm((prev) => ({ ...prev, alt_text: e.target.value }))}
                placeholder="예: 이벤트 사이드 배너"
                className="h-9 text-[14px]"
              />
            </div>

            {/* 활성 여부 */}
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <Label htmlFor="side-active" className="text-[14px] font-medium">
                  배너 활성화
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  비활성 시 사이드바에 표시되지 않습니다.
                </p>
              </div>
              <Switch
                id="side-active"
                checked={sideBannerForm.is_active}
                onCheckedChange={(v) => setSideBannerForm((prev) => ({ ...prev, is_active: v }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            <Button
              variant="outline"
              onClick={() => setSideBannerFormOpen(false)}
              className="h-9 px-5 text-[14px]"
            >
              취소
            </Button>
            <Button
              onClick={handleSideBannerSave}
              disabled={sideBannerSaving}
              className="h-9 px-6 text-[14px] bg-primary text-white hover:bg-brand-primary-dark"
            >
              {sideBannerSaving ? "저장 중..." : editingSideBannerId ? "수정" : "등록"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════ */}
      {/* 사이드 배너 삭제 확인 */}
      {/* ══════════════════════════════════════════════════ */}
      <AlertDialog open={!!deleteSideBannerTarget} onOpenChange={(v) => { if (!v) setDeleteSideBannerTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-error-bg text-error">
              <AlertTriangle size={28} strokeWidth={2} />
            </AlertDialogMedia>
            <AlertDialogTitle>사이드 배너 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 사이드 배너를 삭제하시겠습니까?
              <br />
              삭제 후 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteSideBannerTarget(null)}>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleSideBannerDelete} disabled={deletingSideBanner}>
              {deletingSideBanner ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
