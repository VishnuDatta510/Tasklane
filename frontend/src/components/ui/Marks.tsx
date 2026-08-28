import type { Role, TaskPriority, TaskStatus } from "@/lib/types";
import { PRIORITY_LABEL, ROLE_LABEL, STATUS_LABEL } from "@/lib/types";

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "var(--color-todo)",
  in_progress: "var(--color-progress)",
  in_review: "var(--color-review)",
  done: "var(--color-done)",
};

/** Status reads as a marked rule, not a filled pill — pills would compete
 *  with the accent for attention. */
export function StatusMark({ status }: { status: TaskStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-2 whitespace-nowrap">
      <span
        aria-hidden
        className="w-[7px] h-[7px] rounded-full shrink-0"
        style={{ background: STATUS_COLOR[status] }}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  urgent: "var(--color-urgent)",
  high: "var(--color-high)",
  medium: "var(--color-medium)",
  low: "var(--color-low)",
};

/** Four ascending bars — priority is a quantity, so it gets a quantity mark. */
export function PriorityMark({ priority }: { priority: TaskPriority }) {
  const level = { low: 1, medium: 2, high: 3, urgent: 4 }[priority];
  return (
    <span
      className="inline-flex items-end gap-[2px] h-3"
      title={`${PRIORITY_LABEL[priority]} priority`}
      aria-label={`${PRIORITY_LABEL[priority]} priority`}
    >
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-[1px]"
          style={{
            height: `${i * 25}%`,
            background:
              i <= level ? PRIORITY_COLOR[priority] : "var(--color-rule)",
          }}
        />
      ))}
    </span>
  );
}

export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] leading-none px-1.5 py-[3px] rounded-[2px] border whitespace-nowrap"
      style={{ borderColor: `${color}55`, color: "var(--color-ink-2)", background: `${color}12` }}
    >
      <span aria-hidden className="w-[5px] h-[5px] rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}

export function RoleTag({ role }: { role: Role }) {
  const strong = role === "owner";
  return (
    <span
      className={`field-label px-1.5 py-[3px] border rounded-[2px] ${
        strong
          ? "text-signal border-signal/35 bg-signal-wash"
          : "text-ink-3 border-rule"
      }`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

export function Avatar({
  name,
  initials,
  size = 26,
}: {
  name?: string;
  initials: string;
  size?: number;
}) {
  return (
    <span
      title={name}
      className="inline-flex items-center justify-center rounded-full bg-paper-3 text-ink-2 font-semibold shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}
