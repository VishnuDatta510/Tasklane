import Link from "next/link";

/** Shared frame for sign in, register and invite acceptance. */
export function AuthLayout({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <div className="flex flex-col px-5 sm:px-10 lg:px-16 py-8">
        <Link href="/" className="flex items-center gap-2.5 no-underline w-fit">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
            <rect x="1.5" y="3.5" width="19" height="15" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="5" cy="7" r="1" fill="var(--color-signal)" />
            <path d="M8.5 7.5h9M8.5 11h9M5 14.5h12.5" stroke="var(--color-ink-4)" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
          <span className="text-[14px] font-semibold tracking-[-0.015em]">
            TaskLane
          </span>
        </Link>

        <div className="flex-1 flex items-center">
          <div className="w-full max-w-[27rem] mx-auto lg:mx-0 py-10">
            <h1 className="display text-[clamp(1.9rem,4vw,2.5rem)]">{title}</h1>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">
              {intro}
            </p>
            <div className="mt-8">{children}</div>
            {footer && (
              <div className="mt-6 text-[13.5px] text-ink-2">{footer}</div>
            )}
          </div>
        </div>
      </div>

      {/* The plinth: a quiet counterweight so the form is not floating in white. */}
      <aside className="hidden lg:flex flex-col justify-end bg-plinth text-white p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.14]"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <blockquote className="relative max-w-[34ch]">
          <p className="display text-[1.9rem] leading-[1.15]">
            Every status change, every reassignment, every hand that touched it.
          </p>
          <footer className="mt-5 text-[13.5px] text-white/50 leading-relaxed">
            The activity log is append-only. Nobody quietly rewrites last
            Tuesday.
          </footer>
        </blockquote>
      </aside>
    </div>
  );
}
