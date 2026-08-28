"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity as ActivityIcon } from "lucide-react";
import { PageBody, PageHead } from "@/components/app/Shell";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Marks";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { api, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { describeVerb, relativeTime } from "@/lib/format";
import type { ActivityEntry, Membership, Paginated } from "@/lib/types";

const VERBS = [
  ["", "All kinds"],
  ["created", "Created"],
  ["status_changed", "Status changed"],
  ["reassigned", "Reassigned"],
  ["priority_changed", "Priority changed"],
  ["due_date_changed", "Due date changed"],
  ["commented", "Commented"],
  ["attached", "Attached a file"],
  ["overdue_flagged", "Flagged overdue"],
] as const;

export default function ActivityPage() {
  const { currentOrg } = useAuth();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [verb, setVerb] = useState("");
  const [actor, setActor] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const page = await api.get<Paginated<ActivityEntry>>(
        `/activity/${qs({
          organization: currentOrg.id,
          verb: verb || undefined,
          actor: actor || undefined,
          page_size: 50,
        })}`,
      );
      setError(null);
      setEntries(page.results);
      setNext(page.next);
      setCount(page.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the log.");
    } finally {
      setLoading(false);
    }
  }, [currentOrg, verb, actor]);

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

  useEffect(() => {
    if (!currentOrg) return;
    api
      .get<Membership[]>(`/organizations/${currentOrg.id}/members/`)
      .then((list) => setMembers(list ?? []))
      .catch(() => {});
  }, [currentOrg]);

  async function loadMore() {
    if (!next) return;
    setLoadingMore(true);
    try {
      const path = next.replace(/^.*\/api/, "");
      const page = await api.get<Paginated<ActivityEntry>>(path);
      setEntries((list) => [...list, ...page.results]);
      setNext(page.next);
    } finally {
      setLoadingMore(false);
    }
  }

  if (!currentOrg) {
    return (
      <>
        <PageHead title="Activity" />
        <EmptyState
          icon={<ActivityIcon size={28} strokeWidth={1.5} />}
          title="No organization selected"
          body="The activity log is scoped to one organization."
        />
      </>
    );
  }

  return (
    <>
      <PageHead title="Activity" meta={<span>{count} entries</span>} />

      <div className="px-5 sm:px-7 lg:px-8 py-3 rule-b bg-paper-2 flex flex-wrap gap-2">
        <Select
          value={verb}
          onChange={(e) => setVerb(e.target.value)}
          className="!h-9 !w-auto text-[13px]"
          aria-label="Filter by kind"
        >
          {VERBS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <Select
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          className="!h-9 !w-auto text-[13px]"
          aria-label="Filter by person"
        >
          <option value="">Anyone</option>
          {members.map((m) => (
            <option key={m.user.id} value={m.user.id}>
              {m.user.full_name || m.user.email}
            </option>
          ))}
        </Select>
      </div>

      <PageBody>
        <div className="px-5 sm:px-7 lg:px-8 py-6 max-w-[900px] w-full">
        {loading && entries.length === 0 ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} retry={refresh} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<ActivityIcon size={28} strokeWidth={1.5} />}
            title="Nothing recorded yet"
            body="Every status change, reassignment, comment and upload gets a row here the moment it happens."
          />
        ) : (
          <>
            <ul className="divide-y divide-[var(--color-rule)] rule-t">
              {entries.map((entry) => (
                <li key={entry.id} className="flex gap-3 py-3 items-start">
                  <Avatar
                    initials={entry.actor?.initials ?? "··"}
                    name={entry.actor?.full_name}
                    size={26}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] leading-snug text-ink-2">
                      <span className="font-medium text-ink">
                        {entry.actor?.full_name ||
                          entry.actor?.email ||
                          "A scheduled job"}
                      </span>{" "}
                      {describeVerb(entry.verb)}{" "}
                      {entry.task ? (
                        <Link
                          href={`/app/tasks/${entry.task}`}
                          className="text-signal no-underline hover:underline"
                        >
                          {entry.task_reference
                            ? `${entry.task_reference} ${entry.task_title ?? ""}`
                            : (entry.task_title ?? "a task")}
                        </Link>
                      ) : (
                        entry.new_value
                      )}
                    </p>
                    {entry.old_value && entry.new_value ? (
                      <p className="mt-0.5 text-[12px] text-ink-3">
                        {entry.field}: {entry.old_value.replace(/_/g, " ")} →{" "}
                        {entry.new_value.replace(/_/g, " ")}
                      </p>
                    ) : entry.new_value && entry.field ? (
                      <p className="mt-0.5 text-[12px] text-ink-3">
                        {entry.field}: {entry.new_value.replace(/_/g, " ")}
                      </p>
                    ) : null}
                  </div>
                  <span className="font-mono text-[10.5px] text-ink-4 tnum shrink-0 pt-1">
                    {relativeTime(entry.created_at)}
                  </span>
                </li>
              ))}
            </ul>

            {next && (
              <div className="pt-5 flex justify-center">
                <Button onClick={loadMore} loading={loadingMore}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      </PageBody>
    </>
  );
}
