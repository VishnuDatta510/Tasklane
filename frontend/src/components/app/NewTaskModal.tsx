"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  type Label,
  type Membership,
  type Project,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

export function NewTaskModal({
  open,
  status,
  projects,
  defaultProject,
  onClose,
  onCreated,
}: {
  open: boolean;
  status: TaskStatus;
  projects: Project[];
  defaultProject?: number;
  onClose: () => void;
  onCreated: (task: Task) => void;
}) {
  const { currentOrg } = useAuth();
  const [form, setForm] = useState({
    project: String(defaultProject ?? projects[0]?.id ?? ""),
    title: "",
    description: "",
    status,
    priority: "medium" as TaskPriority,
    assignee_id: "",
    due_date: "",
  });
  const [labelIds, setLabelIds] = useState<number[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !currentOrg) return;
    let cancelled = false;
    (async () => {
      try {
        const [labelPage, memberList] = await Promise.all([
          api.get<{ results: Label[] }>(
            `/labels/?organization=${currentOrg.id}&page_size=100`,
          ),
          api.get<Membership[]>(`/organizations/${currentOrg.id}/members/`),
        ]);
        if (cancelled) return;
        setLabels(labelPage.results ?? []);
        setMembers(memberList ?? []);
      } catch {
        /* pickers stay empty; the task can still be created without them */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentOrg]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setGeneral(null);

    try {
      const task = await api.post<Task>("/tasks/", {
        project: Number(form.project),
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
        priority: form.priority,
        assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
        due_date: form.due_date || null,
        label_ids: labelIds,
      });
      onCreated(task);
    } catch (err) {
      if (err instanceof ApiError) {
        const collected: Record<string, string> = {};
        for (const key of [
          "project",
          "title",
          "status",
          "priority",
          "assignee_id",
          "due_date",
          "label_ids",
        ]) {
          const message = err.fieldError(key);
          if (message) collected[key] = message;
        }
        setErrors(collected);
        if (Object.keys(collected).length === 0) setGeneral(err.message);
      } else {
        setGeneral("Could not create the task.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New task"
      description="It lands in the column you picked. Everything except the title can be filled in later."
      width={560}
      footer={
        <>
          <Button onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="new-task-form"
            loading={busy}
          >
            Create task
          </Button>
        </>
      }
    >
      <form
        id="new-task-form"
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        {general && (
          <div
            role="alert"
            className="text-[13.5px] text-danger bg-danger-wash border border-danger/25 rounded-[2px] px-3.5 py-3 leading-snug"
          >
            {general}
          </div>
        )}

        <Field label="Title" required error={errors.title}>
          {(id) => (
            <Input
              id={id}
              autoFocus
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              aria-invalid={!!errors.title}
              placeholder="Rate-limit the invitation endpoint"
            />
          )}
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Project" required error={errors.project}>
            {(id) => (
              <Select
                id={id}
                required
                value={form.project}
                onChange={(e) => set("project", e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} — {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Column" error={errors.status}>
            {(id) => (
              <Select
                id={id}
                value={form.status}
                onChange={(e) => set("status", e.target.value as TaskStatus)}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Priority" error={errors.priority}>
            {(id) => (
              <Select
                id={id}
                value={form.priority}
                onChange={(e) => set("priority", e.target.value as TaskPriority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Assignee" error={errors.assignee_id}>
            {(id) => (
              <Select
                id={id}
                value={form.assignee_id}
                onChange={(e) => set("assignee_id", e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.full_name || m.user.email}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field
          label="Due date"
          error={errors.due_date}
          hint={errors.due_date ? undefined : "Leave empty if there is no deadline."}
        >
          {(id) => (
            <Input
              id={id}
              type="date"
              value={form.due_date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => set("due_date", e.target.value)}
              aria-invalid={!!errors.due_date}
            />
          )}
        </Field>

        {labels.length > 0 && (
          <Field label="Labels" error={errors.label_ids} hint="Up to 8.">
            {() => (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {labels.map((l) => {
                  const on = labelIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setLabelIds((ids) =>
                          on ? ids.filter((x) => x !== l.id) : [...ids, l.id],
                        )
                      }
                      className={`inline-flex items-center gap-1.5 text-[11.5px] leading-none px-2 py-[6px] rounded-[2px] border transition-colors duration-150 ${
                        on
                          ? "border-transparent text-ink"
                          : "border-rule text-ink-3 hover:border-rule-strong"
                      }`}
                      style={
                        on
                          ? { background: `${l.color}1f`, borderColor: `${l.color}80` }
                          : undefined
                      }
                    >
                      <span
                        aria-hidden
                        className="w-[6px] h-[6px] rounded-full"
                        style={{ background: l.color }}
                      />
                      {l.name}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
        )}

        <Field label="Description" error={errors.description}>
          {(id) => (
            <Textarea
              id={id}
              rows={4}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What needs doing, and how will we know it is done?"
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
