"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Trash2,
  Shield,
  Globe,
  AlertCircle,
  Loader2,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addIpSchema, type AddIpInput } from "@/lib/validations/admin";
import type { ServerMessage } from "../page";

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface AllowedIp {
  id: string;
  ip_address: string;
  description: string | null;
  created_at: string;
}

interface AllowedIpSectionProps {
  onMessage: (msg: ServerMessage) => void;
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

export function AllowedIpSection({ onMessage }: AllowedIpSectionProps) {
  const [ips, setIps] = useState<AllowedIp[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentIp, setCurrentIp] = useState<string>("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddIpInput>({
    resolver: zodResolver(addIpSchema),
    defaultValues: { ip_address: "", description: "" },
  });

  // 현재 접속 IP 가져오기 (서버 API 우선, 외부 API 폴백)
  useEffect(() => {
    fetch("/api/admin/settings/current-ip")
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data.ip !== "unknown") {
          setCurrentIp(result.data.ip);
        } else {
          return fetch("https://api.ipify.org?format=json")
            .then((res) => res.json())
            .then((data) => setCurrentIp(data.ip || "알 수 없음"));
        }
      })
      .catch(() => setCurrentIp("알 수 없음"));
  }, []);

  // IP 목록 조회
  const fetchIps = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/allowed-ips");
      const result = await res.json();
      if (result.success) {
        setIps(result.data);
      }
    } catch {
      onMessage({ type: "error", text: "IP 목록을 불러올 수 없습니다." });
    } finally {
      setLoading(false);
    }
  }, [onMessage]);

  useEffect(() => {
    fetchIps();
  }, [fetchIps]);

  // IP 추가
  const onAddIp = async (data: AddIpInput) => {
    try {
      const res = await fetch("/api/admin/settings/allowed-ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (result.success) {
        onMessage({ type: "success", text: "IP가 추가되었습니다." });
        reset();
        fetchIps();
      } else {
        onMessage({
          type: "error",
          text: result.error?.message || "IP 추가에 실패했습니다.",
        });
      }
    } catch {
      onMessage({ type: "error", text: "네트워크 오류가 발생했습니다." });
    }
  };

  // IP 삭제
  const handleDelete = async (id: string) => {
    if (!confirm("이 IP를 삭제하시겠습니까?")) return;

    setDeletingId(id);

    try {
      const res = await fetch("/api/admin/settings/allowed-ips", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const result = await res.json();

      if (result.success) {
        onMessage({ type: "success", text: "IP가 삭제되었습니다." });
        fetchIps();
      } else {
        onMessage({
          type: "error",
          text: result.error?.message || "IP 삭제에 실패했습니다.",
        });
      }
    } catch {
      onMessage({ type: "error", text: "네트워크 오류가 발생했습니다." });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {/* 현재 접속 IP */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Monitor size={18} className="text-primary" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-foreground">현재 접속 IP</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          현재 브라우저에서 접속 중인 IP 주소입니다.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-muted px-4 py-2.5">
          <Globe size={14} className="text-muted-foreground" />
          <span className="font-mono text-sm font-semibold text-foreground">
            {currentIp || "불러오는 중..."}
          </span>
        </div>
      </div>

      {/* 허용된 IP 관리 */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={18} className="text-primary" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-foreground">허용된 IP 관리</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          관리자 페이지에 접근할 수 있는 IP 주소를 관리합니다. 등록된 IP만 접속이 가능합니다.
        </p>

        {/* IP 추가 폼 */}
        <form
          onSubmit={handleSubmit(onAddIp)}
          className="mb-6 rounded-lg border border-dashed border-border bg-muted/30 p-4"
        >
          <h3 className="text-[14px] font-semibold text-foreground mb-3">IP 추가</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ip_address" className="text-xs text-muted-foreground">
                IP 주소
              </Label>
              <Input
                id="ip_address"
                placeholder="예: 192.168.1.1"
                {...register("ip_address")}
                className="h-9 text-sm font-mono"
              />
              {errors.ip_address && (
                <p className="flex items-center gap-1 text-[14px] text-destructive">
                  <AlertCircle size={11} />
                  {errors.ip_address.message}
                </p>
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="description" className="text-xs text-muted-foreground">
                메모 (선택)
              </Label>
              <Input
                id="description"
                placeholder="예: 사무실 IP"
                {...register("description")}
                className="h-9 text-sm"
              />
              {errors.description && (
                <p className="flex items-center gap-1 text-[14px] text-destructive">
                  <AlertCircle size={11} />
                  {errors.description.message}
                </p>
              )}
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-9 gap-1.5"
              >
                {isSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                추가
              </Button>
            </div>
          </div>
        </form>

        {/* IP 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : ips.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            등록된 IP가 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {ips.map((ip) => (
              <div
                key={ip.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Globe size={15} className="shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-foreground">
                      {ip.ip_address}
                      {ip.ip_address === currentIp && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          현재 IP
                        </span>
                      )}
                    </p>
                    {ip.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {ip.description}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(ip.id)}
                  disabled={deletingId === ip.id}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                  aria-label={`${ip.ip_address} 삭제`}
                >
                  {deletingId === ip.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
