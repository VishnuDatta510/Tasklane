"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

/** Uses <dialog> so the overlay escapes any overflow-hidden ancestor and the
 *  browser handles focus trapping and Escape for us. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 520,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="backdrop:bg-plinth/35 backdrop:backdrop-blur-[2px] bg-transparent p-0 m-auto max-h-[90vh]"
      style={{ width: `min(${width}px, calc(100vw - 2rem))` }}
    >
      <div className="plate bg-paper flex flex-col max-h-[90vh] shadow-[0_24px_60px_-20px_rgba(18,20,26,0.35)]">
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3.5 rule-b">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
            {description && (
              <p className="text-[13px] text-ink-3 mt-1 leading-snug">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink-4 hover:text-ink transition-colors -mr-1 -mt-0.5 p-1"
          >
            <X size={16} />
          </button>
        </header>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <footer className="px-5 py-3.5 rule-t bg-paper-2 flex justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
