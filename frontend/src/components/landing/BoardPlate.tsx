"use client";

import { useEffect, useState } from "react";

/**
 * The proof in the first viewport: a real board plate, rendered at the
 * fidelity the product actually ships. Content is synthetic demo data.
 *
 * The signature motion: one label leaves its slot in "In progress" and
 * settles into "In review", the way a wall label is re-hung. It runs once,
 * on a slow loop, and never blocks reading.
 */

type Demo = {
  ref: string;
  title: string;
  who: string;
  priority: 1 | 2 | 3 | 4;
  due?: string;
  label?: { name: string; color: string };
};

const COLUMNS: { key: string; name: string; dot: string; items: Demo[] }[] = [
  {
    key: "todo",
    name: "To do",
    dot: "var(--color-todo)",
    items: [
      {
        ref: "API-31",
        title: "Rate-limit the invitation endpoint",
        who: "PR",
        priority: 3,
        due: "12 Sep",
        label: { name: "security", color: "#c62828" },
      },
      {
        ref: "API-34",
        title: "Backfill activity rows for legacy tasks",
        who: "MT",
        priority: 2,
      },
    ],
  },
  {
    key: "in_progress",
    name: "In progress",
    dot: "var(--color-progress)",
    items: [
      {
        ref: "API-28",
        title: "Object-level permissions on comments",
        who: "AK",
        priority: 4,
        due: "29 Aug",
        label: { name: "backend", color: "#1b3bef" },
      },
    ],
  },
  {
    key: "in_review",
    name: "In review",
    dot: "var(--color-review)",
    items: [
      {
        ref: "API-22",
        title: "Cache the dashboard aggregate",
        who: "PR",
        priority: 3,
        label: { name: "perf", color: "#6b3fc4" },
      },
    ],
  },
  {
    key: "done",
    name: "Done",
    dot: "var(--color-done)",
    items: [
      {
        ref: "API-19",
        title: "Swap username auth for email",
        who: "MT",
        priority: 2,
      },
    ],
  },
];

const MOVER: Demo = {
  ref: "API-28",
  title: "Object-level permissions on comments",
  who: "AK",
  priority: 4,
  due: "29 Aug",
  label: { name: "backend", color: "#1b3bef" },
};

export function BoardPlate() {
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    if (reduce) return;
    const t = window.setTimeout(() => setMoved(true), 1400);
    const loop = window.setInterval(() => setMoved((m) => !m), 6200);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(loop);
    };
  }, []);

  return (
    <div className="plate bg-paper overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3.5 h-11 rule-b bg-paper-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] font-medium text-signal tracking-tight">
            API
          </span>
          <span className="text-[13px] font-medium truncate">
            TaskLane API
          </span>
        </div>
        <span className="field-label hidden sm:block">Board</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-[var(--color-rule)]">
        {COLUMNS.map((col) => {
          const items = [...col.items];
          if (col.key === "in_progress" && moved) items.pop();
          if (col.key === "in_review" && moved) items.unshift(MOVER);
          return (
            <section key={col.key} className="min-w-0 flex flex-col">
              <header className="flex items-center gap-1.5 px-3 h-9 rule-b">
                <span
                  aria-hidden
                  className="w-[6px] h-[6px] rounded-full shrink-0"
                  style={{ background: col.dot }}
                />
                <h3 className="text-[11.5px] font-semibold truncate">
                  {col.name}
                </h3>
                <span className="ml-auto font-mono text-[10.5px] text-ink-4 tnum">
                  {items.length}
                </span>
              </header>

              <div className="p-2 flex flex-col gap-2 min-h-[188px] bg-paper-2/40">
                {items.map((t) => (
                  <DemoLabel key={t.ref} task={t} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DemoLabel({ task }: { task: Demo }) {
  return (
    <article
      className="plate bg-paper px-2.5 py-2 flex flex-col gap-1.5"
      style={{ animation: "label-settle 420ms var(--ease-out-strong)" }}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-ink-3 tnum">
          {task.ref}
        </span>
        <span className="ml-auto inline-flex items-end gap-[2px] h-2.5" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-[2.5px] rounded-[1px]"
              style={{
                height: `${i * 25}%`,
                background:
                  i <= task.priority
                    ? task.priority === 4
                      ? "var(--color-urgent)"
                      : task.priority === 3
                        ? "var(--color-high)"
                        : "var(--color-medium)"
                    : "var(--color-rule)",
              }}
            />
          ))}
        </span>
      </div>

      <p className="text-[12.5px] leading-[1.35] font-medium text-ink">
        {task.title}
      </p>

      <div className="flex items-center gap-1.5 pt-0.5">
        {task.label && (
          <span
            className="text-[10px] leading-none px-1.5 py-[3px] rounded-[2px] border"
            style={{
              borderColor: `${task.label.color}55`,
              background: `${task.label.color}12`,
              color: "var(--color-ink-2)",
            }}
          >
            {task.label.name}
          </span>
        )}
        {task.due && (
          <span className="font-mono text-[10px] text-ink-4 tnum">
            {task.due}
          </span>
        )}
        <span className="ml-auto inline-flex items-center justify-center w-[19px] h-[19px] rounded-full bg-paper-3 text-[9px] font-semibold text-ink-2">
          {task.who}
        </span>
      </div>
    </article>
  );
}
