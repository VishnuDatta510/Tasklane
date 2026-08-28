import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-paper-3 rounded-[2px] ${className}`}
      style={{ animation: "pulse-soft 1.6s ease-in-out infinite" }}
      aria-hidden
    />
  );
}

/** Empty states here are the onboarding — every one teaches the next action. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-16">
      {icon && <div className="text-ink-4 mb-4">{icon}</div>}
      <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="text-[13.5px] text-ink-3 mt-1.5 max-w-[42ch] leading-relaxed">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-14">
      <h3 className="text-[15px] font-semibold text-danger">Could not load this</h3>
      <p className="text-[13.5px] text-ink-3 mt-1.5 max-w-[46ch] leading-relaxed">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-4 text-[13px] font-medium text-signal hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function SectionHead({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 pb-2.5 rule-b mb-4">
      <div className="flex items-baseline gap-3">
        <h2 className="field-label !text-[11px]">{title}</h2>
        {meta && <span className="text-[12px] text-ink-4 tnum">{meta}</span>}
      </div>
      {action}
    </div>
  );
}
