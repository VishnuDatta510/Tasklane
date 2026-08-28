"use client";

import { useId, useState } from "react";
import type { TaskStatus } from "@/lib/types";

/**
 * Hand-built SVG marks. Three forms, each chosen for the job its data does:
 *
 *  - StatusBar  identity across four named states  -> categorical, one hue each
 *  - WorkloadRow magnitude per person             -> one hue, length encodes
 *  - TrendArea  change over time                  -> one series, area + line
 *
 * All three carry a hover layer and never encode by colour alone: every mark
 * ships beside its own label.
 */

export const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "var(--color-todo)",
  in_progress: "var(--color-progress)",
  in_review: "var(--color-review)",
  done: "var(--color-done)",
};

/* --------------------------------------------------------------------- */

export function StatusBar({
  data,
  total,
}: {
  data: { status: TaskStatus; label: string; count: number }[];
  total: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const present = data.filter((d) => d.count > 0);

  if (total === 0) {
    return (
      <div className="h-2 bg-paper-3 rounded-[2px]" aria-hidden />
    );
  }

  return (
    <div>
      {/* 2px surface gaps between segments keep adjacent fills legible. */}
      <div
        className="flex h-2.5 w-full gap-[2px]"
        role="img"
        aria-label={present
          .map((d) => `${d.label}: ${d.count}`)
          .join(", ")}
      >
        {present.map((d) => (
          <div
            key={d.status}
            onMouseEnter={() => setHover(d.status)}
            onMouseLeave={() => setHover(null)}
            className="rounded-[2px] transition-opacity duration-150"
            style={{
              width: `${(d.count / total) * 100}%`,
              background: STATUS_COLOR[d.status],
              opacity: hover && hover !== d.status ? 0.35 : 1,
            }}
            title={`${d.label}: ${d.count}`}
          />
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
        {data.map((d) => (
          <li
            key={d.status}
            onMouseEnter={() => setHover(d.status)}
            onMouseLeave={() => setHover(null)}
            className="flex flex-col gap-1 transition-opacity duration-150"
            style={{ opacity: hover && hover !== d.status ? 0.45 : 1 }}
          >
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="w-[7px] h-[7px] rounded-full shrink-0"
                style={{ background: STATUS_COLOR[d.status] }}
              />
              <span className="field-label truncate">{d.label}</span>
            </span>
            <span className="text-[19px] font-semibold tnum leading-none pl-[13px]">
              {d.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------------- */

export function WorkloadRow({
  name,
  role,
  open,
  done,
  overdue,
  max,
}: {
  name: string;
  role: string;
  open: number;
  done: number;
  overdue: number;
  max: number;
}) {
  const width = max > 0 ? (open / max) * 100 : 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-4 items-center py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium truncate leading-tight">{name}</p>
        <p className="field-label !text-[9px] mt-1">{role}</p>
      </div>

      <div
        className="h-5 flex items-center"
        title={`${open} open, ${overdue} overdue, ${done} done`}
      >
        {open > 0 && (
          <div
            className="h-[9px] rounded-[2px] transition-[width] duration-300"
            style={{
              width: `${Math.max(width, 3)}%`,
              background: "var(--color-signal)",
            }}
          />
        )}
        {overdue > 0 && (
          <span className="ml-2 text-[11px] font-medium text-danger tnum whitespace-nowrap">
            {overdue} overdue
          </span>
        )}
      </div>

      <div className="text-right tnum">
        <span className="text-[14px] font-semibold">{open}</span>
        <span className="text-[12px] text-ink-4"> / {open + done}</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- */

export function TrendArea({
  data,
  height = 96,
}: {
  data: { day: string; count: number }[];
  height?: number;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[13px] text-ink-4"
        style={{ height }}
      >
        Not enough completed work yet to draw a trend.
      </div>
    );
  }

  const width = 640;
  const pad = { top: 8, right: 4, bottom: 18, left: 4 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.count), 1);

  const x = (i: number) => pad.left + (i / (data.length - 1)) * plotW;
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.count)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${pad.top + plotH} L${x(0)},${pad.top + plotH} Z`;

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full block"
        style={{ height }}
        role="img"
        aria-label={`Tasks completed per day over the last 30 days. Peak ${max}.`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-signal)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-signal)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={pad.top + plotH}
          y2={pad.top + plotH}
          stroke="var(--color-rule)"
          strokeWidth="1"
        />

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--color-signal)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {active && hover !== null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.top}
              y2={pad.top + plotH}
              stroke="var(--color-rule-strong)"
              strokeWidth="1"
            />
            <circle
              cx={x(hover)}
              cy={y(active.count)}
              r="4.5"
              fill="var(--color-signal)"
              stroke="var(--color-paper)"
              strokeWidth="2"
            />
          </>
        )}

        {/* Invisible hit targets, wider than the marks. */}
        {data.map((d, i) => (
          <rect
            key={d.day}
            x={x(i) - plotW / (data.length - 1) / 2}
            y={0}
            width={plotW / (data.length - 1)}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      <div className="flex justify-between mt-1 font-mono text-[10px] text-ink-4 tnum">
        <span>{formatDay(data[0].day)}</span>
        <span>{formatDay(data[data.length - 1].day)}</span>
      </div>

      {active && (
        <div className="absolute top-0 left-0 pointer-events-none plate bg-paper px-2.5 py-1.5 text-[12px] shadow-[0_8px_20px_-8px_rgba(18,20,26,0.28)]">
          <span className="font-medium tnum">{active.count}</span>{" "}
          <span className="text-ink-3">
            completed on {formatDay(active.day)}
          </span>
        </div>
      )}
    </div>
  );
}

function formatDay(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
