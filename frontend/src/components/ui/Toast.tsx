"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type Kind = "success" | "error";
interface Toast {
  id: number;
  kind: Kind;
  message: string;
}

const ToastContext = createContext<{
  notify: (message: string, kind?: Kind) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, kind: Kind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-[min(24rem,calc(100vw-2.5rem))]"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`plate flex items-start gap-2.5 px-3.5 py-3 text-sm shadow-[0_8px_24px_-8px_rgba(18,20,26,0.22)]
              ${t.kind === "error" ? "border-l-danger" : "border-l-success"}`}
            style={{ animation: "toast-in 260ms cubic-bezier(0.16,1,0.3,1)" }}
          >
            {t.kind === "error" ? (
              <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" aria-hidden />
            ) : (
              <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" aria-hidden />
            )}
            <span className="flex-1 leading-snug text-ink">{t.message}</span>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="text-ink-4 hover:text-ink transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
