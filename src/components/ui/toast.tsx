"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (item: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_CONFIG: Record<
  ToastType,
  { icon: React.ElementType; bg: string; border: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    bg: "bg-toast-success-bg",
    border: "border-success/40",
    iconColor: "text-success-light",
  },
  error: {
    icon: AlertCircle,
    bg: "bg-toast-error-bg",
    border: "border-error/40",
    iconColor: "text-error-light",
  },
  warning: {
    icon: TriangleAlert,
    bg: "bg-toast-warning-bg",
    border: "border-warning/40",
    iconColor: "text-warning-light",
  },
  info: {
    icon: Info,
    bg: "bg-toast-info-bg",
    border: "border-info/40",
    iconColor: "text-info-light",
  },
};

function SingleToast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const config = TOAST_CONFIG[item.type];
  const Icon = config.icon;
  const duration = item.duration ?? (item.type === "error" ? 0 : 5000);

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(item.id), 250);
  }, [item.id, onDismiss]);

  useEffect(() => {
    const enterTimer = setTimeout(() => setVisible(true), 10);
    if (duration > 0) {
      timerRef.current = setTimeout(dismiss, duration);
    }
    return () => {
      clearTimeout(enterTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, dismiss]);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };
  const handleMouseLeave = () => {
    if (duration > 0) {
      timerRef.current = setTimeout(dismiss, 1500);
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: visible && !leaving ? "translateY(0) scale(1)" : "translateY(-14px) scale(0.95)",
        opacity: visible && !leaving ? 1 : 0,
        transition: leaving
          ? "opacity 0.18s ease, transform 0.18s ease"
          : "opacity 0.25s ease-out, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      className={`relative flex w-full overflow-hidden rounded-2xl border ${config.bg} ${config.border} shadow-2xl`}
    >
      {/* 내용 */}
      <div className="flex flex-1 items-center gap-3 px-4 py-3.5">
        <div className={`shrink-0 ${config.iconColor}`}>
          <Icon size={20} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug">{item.title}</p>
          {item.description && (
            <p className="mt-0.5 text-[14px] text-white/60 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>
        <button
          onClick={dismiss}
          className="ml-1 shrink-0 rounded-lg p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80 focus:outline-none"
          aria-label="알림 닫기"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>

    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((item: Omit<ToastItem, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...item, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      {/* Toast 컨테이너: PC·모바일 모두 상단 가운데 */}
      <div
        aria-label="알림 목록"
        className="fixed top-4 left-1/2 z-[9999] flex -translate-x-1/2 flex-col gap-2"
        style={{ width: "min(calc(100vw - 32px), 420px)" }}
      >
        {toasts.map((item) => (
          <SingleToast key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast는 ToastProvider 하위에서만 사용할 수 있습니다.");
  }
  return ctx;
}
