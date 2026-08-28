"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutGrid,
  FolderKanban,
  Columns3,
  Users,
  Activity,
  Settings,
  LogOut,
  Check,
  ChevronsUpDown,
  Menu,
  X,
  Plus,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/ui/Marks";
import { Skeleton } from "@/components/ui/States";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/app/board", label: "Board", icon: Columns3 },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/activity", label: "Activity", icon: Activity },
  { href: "/app/members", label: "Members", icon: Users },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) return <ShellSkeleton />;
  if (!user) return null;

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      <button
        onClick={() => setNavOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 plate bg-paper w-9 h-9 inline-flex items-center justify-center"
        aria-label="Open navigation"
      >
        <Menu size={16} />
      </button>

      {navOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-plinth/30"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}

      <SideRail open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col h-dvh overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function SideRail({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, orgs, currentOrg, setCurrentOrg, logout } = useAuth();
  const [picker, setPicker] = useState(false);

  return (
    <aside
      className={`bg-paper-2 rule-r flex flex-col shrink-0 z-40
        fixed lg:sticky inset-y-0 left-0 h-dvh w-[var(--shell-nav)]
        transition-transform duration-200 ease-out
        ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      style={{ top: 0 }}
    >
      <div className="h-14 flex items-center gap-2 px-3 rule-b shrink-0">
        <Link href="/" className="flex items-center gap-2 no-underline min-w-0">
          <svg width="20" height="20" viewBox="0 0 22 22" aria-hidden className="shrink-0">
            <rect x="1.5" y="3.5" width="19" height="15" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="5" cy="7" r="1" fill="var(--color-signal)" />
            <path d="M8.5 7.5h9M8.5 11h9M5 14.5h12.5" stroke="var(--color-ink-4)" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
          <span className="text-[13.5px] font-semibold tracking-[-0.01em] truncate">
            TaskLane
          </span>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden ml-auto text-ink-3 hover:text-ink p-1"
          aria-label="Close navigation"
        >
          <X size={16} />
        </button>
      </div>

      {/* Organization switcher */}
      <div className="p-2.5 rule-b shrink-0 relative">
        <button
          onClick={() => setPicker((p) => !p)}
          className="w-full flex items-center gap-2 px-2.5 h-11 bg-paper border border-rule rounded-[2px] text-left hover:border-rule-strong transition-colors"
          aria-expanded={picker}
        >
          <span className="w-6 h-6 rounded-[2px] bg-signal text-white text-[10px] font-bold inline-flex items-center justify-center shrink-0">
            {(currentOrg?.name ?? "?").slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium truncate leading-tight">
              {currentOrg?.name ?? "No organization"}
            </span>
            {currentOrg?.my_role && (
              <span className="block field-label !text-[9px] mt-0.5">
                {currentOrg.my_role}
              </span>
            )}
          </span>
          <ChevronsUpDown size={13} className="text-ink-4 shrink-0" />
        </button>

        {picker && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setPicker(false)} aria-hidden />
            <div className="absolute left-2.5 right-2.5 top-[calc(100%-2px)] z-20 plate bg-paper shadow-[0_12px_32px_-12px_rgba(18,20,26,0.28)] max-h-72 overflow-y-auto">
              {orgs.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    setCurrentOrg(o);
                    setPicker(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-paper-2 transition-colors"
                >
                  <span className="text-[13px] truncate flex-1">{o.name}</span>
                  {o.id === currentOrg?.id && (
                    <Check size={14} className="text-signal shrink-0" />
                  )}
                </button>
              ))}
              <Link
                href="/app/settings?new=1"
                onClick={() => setPicker(false)}
                className="flex items-center gap-2 px-3 py-2.5 rule-t text-[13px] text-signal no-underline hover:bg-signal-wash transition-colors"
              >
                <Plus size={14} />
                New organization
              </Link>
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2.5">
        <ul className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 h-9 px-2.5 rounded-[2px] text-[13.5px] no-underline
                    transition-colors duration-150
                    ${
                      active
                        ? "bg-signal-wash text-signal font-medium"
                        : "text-ink-2 hover:bg-paper-3 hover:text-ink"
                    }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={15} className="shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-2.5 rule-t shrink-0">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <Avatar initials={user!.initials} name={user!.full_name || user!.email} size={28} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium truncate leading-tight">
              {user!.full_name || "Unnamed"}
            </p>
            <p className="text-[11px] text-ink-3 truncate">{user!.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-ink-4 hover:text-danger transition-colors p-1.5"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-dvh flex">
      <div className="w-[var(--shell-nav)] bg-paper-2 rule-r p-2.5 hidden lg:flex flex-col gap-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-11 w-full mt-2" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
      <div className="flex-1 p-8 flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

/** Page header used by every app route. */
export function PageHead({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="rule-b bg-paper shrink-0 z-30">
      <div className="px-5 sm:px-7 lg:px-8 h-14 flex items-center gap-4 pl-14 lg:pl-8">
        <h1 className="text-[15px] font-semibold tracking-[-0.015em] truncate">
          {title}
        </h1>
        {meta && <div className="hidden sm:flex items-center gap-3 text-[12.5px] text-ink-3 tnum">{meta}</div>}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}

/** Scrollable body for an app page. The shell bounds the height; this owns the
 *  scrolling, so sticky elements inside a page stick to the page, not the
 *  viewport. */
export function PageBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex-1 overflow-y-auto ${className}`}>{children}</div>
  );
}
