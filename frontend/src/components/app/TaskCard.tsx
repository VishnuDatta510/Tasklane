"use client";

import Link from "next/link";
import { MessageSquare, Paperclip } from "lucide-react";
import { Avatar, LabelChip, PriorityMark } from "@/components/ui/Marks";
import { formatShortDate } from "@/lib/format";
import type { Task } from "@/lib/types";

/**
 * The wall label. Every field sits in a fixed slot so the eye learns where to
 * look: reference and priority on the top rail, title as the object name,
 * labels and dates on the plinth line.
 */
export function TaskCard({
  task,
  dragging = false,
}: {
  task: Task;
  dragging?: boolean;
}) {
  const overdue = task.overdue;

  return (
    <article
      className={`plate bg-paper px-2.5 py-2 flex flex-col gap-1.5 select-none
        transition-[border-color,box-shadow] duration-150
        ${dragging ? "shadow-[0_16px_36px_-12px_rgba(18,20,26,0.32)] border-signal" : "hover:border-rule-strong"}`}
    >
      <div className="flex items-center gap-2">
        <Link
          href={`/app/tasks/${task.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[10px] text-ink-3 tnum no-underline hover:text-signal transition-colors"
        >
          {task.reference}
        </Link>
        <span className="ml-auto">
          <PriorityMark priority={task.priority} />
        </span>
      </div>

      <Link
        href={`/app/tasks/${task.id}`}
        onClick={(e) => e.stopPropagation()}
        className="text-[12.5px] leading-[1.35] font-medium text-ink no-underline hover:text-signal transition-colors"
      >
        {task.title}
      </Link>

      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {task.labels.slice(0, 3).map((l) => (
            <LabelChip key={l.id} name={l.name} color={l.color} />
          ))}
          {task.labels.length > 3 && (
            <span className="text-[10px] text-ink-4 self-center">
              +{task.labels.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        {task.due_date && (
          <span
            className={`font-mono text-[10px] tnum ${overdue ? "text-danger font-medium" : "text-ink-4"}`}
            title={overdue ? "Overdue" : "Due"}
          >
            {formatShortDate(task.due_date)}
          </span>
        )}
        {task.comment_count > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-4 tnum">
            <MessageSquare size={11} />
            {task.comment_count}
          </span>
        )}
        {task.attachment_count > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-4 tnum">
            <Paperclip size={11} />
            {task.attachment_count}
          </span>
        )}
        <span className="ml-auto">
          {task.assignee ? (
            <Avatar
              initials={task.assignee.initials}
              name={task.assignee.full_name || task.assignee.email}
              size={19}
            />
          ) : (
            <span
              className="inline-block w-[19px] h-[19px] rounded-full border border-dashed border-rule-strong"
              title="Unassigned"
            />
          )}
        </span>
      </div>
    </article>
  );
}
