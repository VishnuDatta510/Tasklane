"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, Inbox, Plus } from "lucide-react";
import { PageBody, PageHead } from "@/components/app/Shell";
import { StatusBar, TrendArea, WorkloadRow } from "@/components/app/Charts";
import { Button, LinkButton } from "@/components/ui/Button";
import {
  EmptyState,
  ErrorState,
  SectionHead,
  Skeleton,
} from "@/components/ui/States";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { describeVerb, relativeTime } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

export default function DashboardPage() {
  const { currentOrg, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const data = await api.get<DashboardStats>(
        `/dashboard/?organization=${currentOrg.id}`,
      );
      setError(null);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  /** Manual refresh: unlike the mount fetch, this one shows the spinner
   *  straight away because the user just asked for it. */
  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!currentOrg) return;
    void fetchData();
  }, [fetchData, currentOrg]);

  if (!authLoading && !currentOrg) {
    return (
      <>
        <PageHead title="Dashboard" />
        <EmptyState
          icon={<Inbox size={28} strokeWidth={1.5} />}
          title="You are not in an organization yet"
          body="An organization holds your projects, your people, and their roles. Create one to get started, or ask a teammate to invite you."
          action={
            <LinkButton variant="primary" icon={<Plus size={15} />} href="/app/settings?new=1">
              Create an organization
            </LinkButton>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Dashboard"
        meta={
          stats && (
            <span>
              {stats.totals.projects} projects · {stats.totals.members} people
            </span>
          )
        }
        actions={
          <Button size="sm" onClick={refresh} loading={loading}>
            Refresh
          </Button>
        }
      />

      <PageBody>
        <div className="px-5 sm:px-7 lg:px-8 py-6 max-w-[1400px] w-full">
        {loading && !stats ? (
          <DashboardSkeleton />
        ) : error ? (
          <ErrorState message={error} retry={refresh} />
        ) : stats ? (
          <DashboardBody stats={stats} />
        ) : null}
      </div>
      </PageBody>
    </>
  );
}

function DashboardBody({ stats }: { stats: DashboardStats }) {
  const { totals } = stats;
  const maxOpen = Math.max(...stats.per_member.map((m) => m.open_tasks), 1);

  if (totals.tasks === 0) {
    return (
      <EmptyState
        icon={<Inbox size={28} strokeWidth={1.5} />}
        title="No work tracked yet"
        body="Create a project, then open your first task. The dashboard fills in as soon as there is something to count."
        action={
          <LinkButton variant="primary" icon={<Plus size={15} />} href="/app/projects">
            Create a project
          </LinkButton>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-9">
      {/* Attention row: only rendered when there is something to attend to. */}
      {(totals.overdue > 0 || totals.due_soon > 0 || totals.unassigned > 0) && (
        <div className="flex flex-wrap gap-2.5">
          {totals.overdue > 0 && (
            <AttentionChip
              href="/app/board?overdue=true"
              icon={<AlertTriangle size={14} />}
              tone="danger"
              count={totals.overdue}
              label={totals.overdue === 1 ? "task is overdue" : "tasks are overdue"}
            />
          )}
          {totals.due_soon > 0 && (
            <AttentionChip
              href="/app/board"
              icon={<CalendarClock size={14} />}
              tone="neutral"
              count={totals.due_soon}
              label="due in the next 7 days"
            />
          )}
          {totals.unassigned > 0 && (
            <AttentionChip
              href="/app/board?unassigned=true"
              icon={<Inbox size={14} />}
              tone="neutral"
              count={totals.unassigned}
              label="unassigned"
            />
          )}
        </div>
      )}

      <section>
        <SectionHead
          title="Where the work stands"
          meta={`${totals.tasks} tasks · ${totals.completion_rate}% complete`}
        />
        <StatusBar data={stats.by_status} total={totals.tasks} />
      </section>

      <div className="grid lg:grid-cols-2 gap-9">
        <section>
          <SectionHead title="Workload" meta={`${stats.per_member.length} people`} />
          <div className="divide-y divide-[var(--color-rule)]">
            {stats.per_member
              .slice()
              .sort((a, b) => b.open_tasks - a.open_tasks)
              .map((m) => (
                <WorkloadRow
                  key={m.user_id}
                  name={m.user__full_name || m.user__email}
                  role={m.role}
                  open={m.open_tasks}
                  done={m.done_tasks}
                  overdue={m.overdue_tasks}
                  max={maxOpen}
                />
              ))}
          </div>
        </section>

        <section>
          <SectionHead title="Completed per day" meta="last 30 days" />
          <TrendArea data={stats.completion_trend} />
        </section>
      </div>

      <section>
        <SectionHead
          title="Projects"
          action={
            <Link
              href="/app/projects"
              className="text-[12.5px] font-medium text-signal no-underline hover:underline"
            >
              All projects
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left border-collapse">
            <thead>
              <tr className="rule-b">
                <th className="field-label font-semibold pb-2.5 pr-4">Project</th>
                <th className="field-label font-semibold pb-2.5 px-3 text-right w-20">Open</th>
                <th className="field-label font-semibold pb-2.5 px-3 text-right w-20">Done</th>
                <th className="field-label font-semibold pb-2.5 pl-3 text-right w-24">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {stats.per_project.map((p) => (
                <tr key={p.id} className="rule-b hover:bg-paper-2 transition-colors">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/app/board?project=${p.id}`}
                      className="flex items-center gap-2.5 no-underline group"
                    >
                      <span
                        aria-hidden
                        className="w-[3px] h-6 rounded-[1px] shrink-0"
                        style={{ background: p.color }}
                      />
                      <span className="font-mono text-[11px] text-ink-3">{p.key}</span>
                      <span className="text-[13.5px] truncate group-hover:text-signal transition-colors">
                        {p.name}
                      </span>
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-right tnum text-[13.5px]">{p.open_tasks}</td>
                  <td className="py-3 px-3 text-right tnum text-[13.5px] text-ink-3">{p.done_tasks}</td>
                  <td className="py-3 pl-3 text-right tnum text-[13.5px]">
                    {p.overdue_tasks > 0 ? (
                      <span className="text-danger font-medium">{p.overdue_tasks}</span>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionHead
          title="Recent activity"
          action={
            <Link
              href="/app/activity"
              className="text-[12.5px] font-medium text-signal no-underline hover:underline"
            >
              Full log
            </Link>
          }
        />
        <ul className="divide-y divide-[var(--color-rule)]">
          {stats.recent_activity.map((entry) => (
            <li key={entry.id} className="flex gap-3 py-2.5 items-baseline">
              <span className="font-mono text-[10.5px] text-ink-4 tnum w-16 shrink-0">
                {relativeTime(entry.created_at)}
              </span>
              <p className="text-[13.5px] leading-snug text-ink-2 min-w-0">
                <span className="font-medium text-ink">
                  {entry.actor__full_name || entry.actor__email || "A scheduled job"}
                </span>{" "}
                {describeVerb(entry.verb)}{" "}
                {entry.task_id ? (
                  <Link href={`/app/tasks/${entry.task_id}`} className="text-signal no-underline hover:underline">
                    {entry.task__title}
                  </Link>
                ) : (
                  <span>{entry.new_value}</span>
                )}
                {entry.old_value && entry.new_value && (
                  <span className="text-ink-3">
                    {" "}
                    · {entry.old_value.replace(/_/g, " ")} → {entry.new_value.replace(/_/g, " ")}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[11.5px] text-ink-4 pt-2">
        {stats.cached
          ? "Served from cache. Refreshes automatically after any change, or every two minutes."
          : "Freshly computed."}
      </p>
    </div>
  );
}

function AttentionChip({
  href,
  icon,
  count,
  label,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  count: number;
  label: string;
  tone: "danger" | "neutral";
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 h-9 px-3 rounded-[2px] border no-underline text-[13px]
        transition-colors duration-150
        ${
          tone === "danger"
            ? "border-danger/30 bg-danger-wash text-danger hover:border-danger/60"
            : "border-rule bg-paper-2 text-ink-2 hover:border-rule-strong hover:text-ink"
        }`}
    >
      {icon}
      <span className="font-semibold tnum">{count}</span>
      <span>{label}</span>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-9">
      <div className="flex gap-2.5">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div>
        <Skeleton className="h-3 w-40 mb-4" />
        <Skeleton className="h-2.5 w-full" />
        <div className="grid grid-cols-4 gap-4 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-9">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
