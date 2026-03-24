"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Gift,
  Search,
  User,
  X,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import ProductInfoCard from "./ProductInfoCard";
import VoucherProgressBar from "./VoucherProgressBar";
import { useBfcacheReload } from "@/hooks/useBfcacheReload";
import type { VoucherWithDetails } from "@/types";

interface VoucherGiftProps {
  voucher: VoucherWithDetails;
  currentUserId: string;
}

interface SearchedUser {
  id: string;
  username: string;
  name: string;
}

export default function VoucherGift({ voucher, currentUserId }: VoucherGiftProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null);
  const [selfGiftError, setSelfGiftError] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useBfcacheReload();

  // 300ms debounce 자동완성
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteractingRef = useRef(false);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    setSelfGiftError(false);
    try {
      const res = await fetch(`/api/vouchers/${voucher.code}/search-user?q=${encodeURIComponent(query.trim())}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setSearchResults(json.data ?? []);
        if (json.is_self_search && (json.data ?? []).length === 0) {
          setSelfGiftError(true);
        }
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [voucher.code]);

  useEffect(() => {
    if (selectedUser) return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, searchUsers, selectedUser]);

  const handleSelectUser = (user: SearchedUser) => {
    // 자기 자신 선물 방지 (API에서 이미 제외하지만 이중 보호)
    if (user.id === currentUserId) {
      setSelfGiftError(true);
      setSelectedUser(null);
      return;
    }
    setSelfGiftError(false);
    setSelectedUser(user);
    setSearchResults([]);
    setHasSearched(false);
    setSearchQuery("");
  };

  const handleClearRecipient = () => {
    setSelectedUser(null);
    setSelfGiftError(false);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const canSubmit = selectedUser !== null;

  const handleGiftRequest = () => {
    if (!canSubmit) return;
    setSendError(null);
    setShowConfirmDialog(true);
  };

  const handleConfirmGift = async () => {
    if (!selectedUser) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/vouchers/${voucher.code}/gift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_username: selectedUser.username }),
      });
      const data = await res.json();

      if (data.success) {
        setShowConfirmDialog(false);
        router.replace(`/v/${voucher.code}/gifted`);
        return;
      } else {
        setShowConfirmDialog(false);
        setSendError(data.error?.message ?? "선물 전송에 실패했습니다. 다시 시도해주세요.");
      }
    } catch {
      setShowConfirmDialog(false);
      setSendError("선물 전송에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSending(false);
    }
  };

  // ── 선물하기 폼 화면 ──────────────────────────────
  return (
    <div className="w-full">
      {/* 프로세스 바 */}
      <VoucherProgressBar currentStep={4} />

      {/* 큰 헤딩 */}
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-2">
        누구에게 선물할까요?
      </h1>
      <p className="text-[16px] text-muted-foreground mb-6">
        검색하여 받는 사람을 선택해주세요.
      </p>

      {/* 상품 정보 카드 */}
      <ProductInfoCard voucher={voucher} />

      {/* 수신자 검색 섹션 */}
      <div className="mt-5 rounded-xl border border-border bg-card p-5">
        <p className="mb-3 text-[15px] font-semibold text-foreground">수신자 검색</p>

        {/* 선택된 수신자가 있는 경우 */}
        {selectedUser ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <User size={16} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-foreground">
                    {selectedUser.username}
                  </p>
                  <p className="text-[14px] text-muted-foreground">
                    {selectedUser.name}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClearRecipient}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-muted hover:bg-muted/70 transition-colors"
                aria-label="수신자 변경"
              >
                <X size={13} className="text-muted-foreground" />
              </button>
            </div>
            <p className="mt-2 text-[14px] text-muted-foreground">
              이 회원에게 선물을 전송합니다. 변경하려면 X를 누르세요.
            </p>
          </div>
        ) : (
          <>
            {/* 검색 입력 (자동완성) */}
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelfGiftError(false);
                }}
                onBlur={() => {
                  if (!isInteractingRef.current) {
                    setHasSearched(false);
                  }
                }}
                onFocus={() => {
                  if (searchQuery.trim()) searchUsers(searchQuery);
                }}
                placeholder="아이디를 입력하세요 (2자 이상)"
                className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-[15px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
              />
            </div>

            {/* 자기 자신 선물 방지 에러 */}
            {selfGiftError && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-error-bg px-3 py-2">
                <AlertCircle size={13} className="shrink-0 text-error" />
                <p className="text-[15px] leading-snug text-error">
                  자기 자신에게는 선물할 수 없습니다.
                </p>
              </div>
            )}

            {/* 검색 결과 */}
            {hasSearched && !selfGiftError && (
              <div className="mt-2">
                {isSearching ? (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-center">
                    <p className="text-[15px] text-muted-foreground">검색 중...</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-center">
                    <p className="text-[15px] text-muted-foreground">
                      검색 결과가 없습니다.
                    </p>
                    <p className="mt-0.5 text-[14px] text-muted-foreground">
                      아이디를 정확히 입력해주세요.
                    </p>
                  </div>
                ) : (
                  <div role="listbox" aria-label="검색 결과" className="rounded-lg border border-border bg-card overflow-hidden">
                    {searchResults.map((user, idx) => (
                      <button
                        key={user.id}
                        role="option"
                        aria-selected={false}
                        onMouseDown={() => { isInteractingRef.current = true; }}
                        onClick={() => { isInteractingRef.current = false; handleSelectUser(user); }}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted",
                          idx !== 0 && "border-t border-border"
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <User size={14} className="text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium text-foreground">
                            {user.username}
                          </p>
                          <p className="text-[14px] text-muted-foreground">
                            {user.name}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 결제취소 불가 경고 Alert */}
      <div className="mt-4 rounded-xl border border-error/30 bg-error-bg p-4">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-error/10">
            <AlertTriangle size={14} className="text-error" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-error">주의사항</p>
            <p className="mt-1 text-[14px] text-foreground/70 leading-relaxed">
              선물 전송 후에는{" "}
              <strong className="text-error">결제 취소가 불가합니다.</strong>
              <br />
              수신자에게 새로운 URL이 발급되며, 현재 URL은 사용할 수 없게 됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 전송 에러 메시지 */}
      {sendError && (
        <div className="mt-4 flex items-start gap-1.5 rounded-lg bg-error-bg px-3 py-2">
          <AlertCircle size={13} className="mt-0.5 shrink-0 text-error" />
          <p className="text-[15px] leading-snug text-error">{sendError}</p>
        </div>
      )}

      {/* 선물하기 버튼 */}
      <div className="mt-5 space-y-2">
        <button
          onClick={handleGiftRequest}
          disabled={!canSubmit}
          className={cn(
            "flex h-14 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-bold transition-all",
            canSubmit
              ? "bg-foreground text-background hover:bg-foreground/80 active:scale-[0.98]"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          )}
        >
          <Gift size={18} />
          선물하기
        </button>
        <button
          onClick={() => router.replace("/")}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          홈으로 이동
        </button>
      </div>

      {/* 확인 모달 */}
      <Dialog
        open={showConfirmDialog}
        onOpenChange={(open) => {
          if (!isSending) setShowConfirmDialog(open);
        }}
      >
        <DialogContent className="max-w-xs rounded-xl" showCloseButton={false}>
          <DialogHeader className="text-center">
            <div className="mb-2 flex justify-center">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Gift size={22} className="text-primary" />
                <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-error">
                  <AlertTriangle size={11} className="text-white" />
                </div>
              </div>
            </div>
            <DialogTitle className="text-center text-[16px]">
              정말 선물하시겠습니까?
            </DialogTitle>
            <DialogDescription className="text-center text-[14px] leading-relaxed">
              선물 전송 후에는 선물 취소 및 결제 취소가 불가합니다.
              <br />
              수신자에게 새로운 URL이 발급되며,
              <br />
              현재 URL은 사용할 수 없게 됩니다.
            </DialogDescription>
          </DialogHeader>

          {/* 수신자 정보 요약 */}
          {selectedUser && (
            <div className="my-1 rounded-lg bg-muted/50 px-4 py-3 text-[15px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">수신자</span>
                <span className="font-semibold text-foreground">
                  {selectedUser.username}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-muted-foreground">상품</span>
                <span className="max-w-[60%] truncate text-right font-medium text-foreground text-[14px]">
                  {voucher.product?.name ?? "(삭제된 상품)"}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <button
              onClick={handleConfirmGift}
              disabled={isSending}
              className={cn(
                "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold transition-all",
                isSending
                  ? "cursor-not-allowed bg-foreground/70 text-background"
                  : "bg-foreground text-background hover:bg-foreground/80 active:scale-[0.98]"
              )}
            >
              {isSending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  전송 중...
                </>
              ) : (
                <>
                  <Send size={14} />
                  선물 전송하기
                </>
              )}
            </button>
            <button
              onClick={() => setShowConfirmDialog(false)}
              disabled={isSending}
              className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              돌아가기
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
