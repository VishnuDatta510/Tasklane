"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { PageBody, PageHead } from "@/components/app/Shell";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Marks";
import { ErrorState, SectionHead, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { describeVerb, formatBytes, formatDate, relativeTime } from "@/lib/format";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  type ActivityEntry,
  type Attachment,
  type Comment,
  type Label,
  type Membership,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { notify } = useToast();
  const { currentOrg, user } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const detail = await api.get<Task>(`/tasks/${id}/`);
      setError(null);
      setTask(detail);

      const [commentPage, attachmentPage, activityList] = await Promise.all([
        api.get<{ results: Comment[] }>(`/tasks/${id}/comments/?page_size=100`),
        api.get<{ results: Attachment[] }>(`/tasks/${id}/attachments/?page_size=100`),
        api.get<ActivityEntry[]>(`/tasks/${id}/activity/`),
      ]);
      setComments(commentPage.results ?? []);
      setAttachments(attachmentPage.results ?? []);
      setActivity(activityList ?? []);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "That task does not exist, or it belongs to an organization you are not in."
          : err instanceof Error
            ? err.message
            : "Could not load the task.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!currentOrg) return;
    (async () => {
      try {
        const [memberList, labelPage] = await Promise.all([
          api.get<Membership[]>(`/organizations/${currentOrg.id}/members/`),
          api.get<{ results: Label[] }>(
            `/labels/?organization=${currentOrg.id}&page_size=100`,
          ),
        ]);
        setMembers(memberList ?? []);
        setLabels(labelPage.results ?? []);
      } catch {
        /* the detail view still works without the pickers */
      }
    })();
  }, [currentOrg]);

  const reloadActivity = useCallback(async () => {
    try {
      setActivity(await api.get<ActivityEntry[]>(`/tasks/${id}/activity/`));
    } catch {
      /* the panel keeps whatever it already had */
    }
  }, [id]);

  async function patch(body: Record<string, unknown>) {
    if (!task) return;
    const previous = task;
    try {
      const updated = await api.patch<Task>(`/tasks/${task.id}/`, body);
      setTask(updated);
      setActivity(await api.get<ActivityEntry[]>(`/tasks/${task.id}/activity/`));
    } catch (err) {
      setTask(previous);
      notify(
        err instanceof Error ? err.message : "Could not save that change.",
        "error",
      );
    }
  }

  async function remove() {
    if (!task) return;
    if (!confirm(`Delete ${task.reference}? This cannot be undone.`)) return;
    try {
      await api.delete(`/tasks/${task.id}/`);
      notify(`${task.reference} deleted.`);
      router.push("/app/board");
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Could not delete that task.",
        "error",
      );
    }
  }

  if (loading && !task) {
    return (
      <>
        <PageHead title="Task" />
        <div className="px-5 sm:px-7 lg:px-8 py-6 flex flex-col gap-4 max-w-[1100px]">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </>
    );
  }

  if (error || !task) {
    return (
      <>
        <PageHead title="Task" />
        <ErrorState message={error ?? "Not found."} retry={refresh} />
      </>
    );
  }

  return (
    <>
      <PageHead
        title={task.reference}
        meta={
          <Link
            href={`/app/board?project=${task.project}`}
            className="no-underline hover:text-ink transition-colors"
          >
            {task.project_key} — {task.project_name}
          </Link>
        }
        actions={
          <>
            <Button
              size="sm"
              icon={<ArrowLeft size={14} />}
              onClick={() => router.push("/app/board")}
            >
              Board
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={14} />}
              onClick={remove}
            >
              Delete
            </Button>
          </>
        }
      />

      <PageBody>
        <div className="px-5 sm:px-7 lg:px-8 py-6 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-8 lg:gap-10 max-w-[1240px] w-full">
        <div className="min-w-0 flex flex-col gap-9">
          <TitleAndDescription task={task} onSave={patch} />

          <section>
            <SectionHead title="Attachments" meta={`${attachments.length}`} />
            <Attachments
              taskId={task.id}
              attachments={attachments}
              setAttachments={setAttachments}
              onChanged={reloadActivity}
            />
          </section>

          <section>
            <SectionHead title="Comments" meta={`${comments.length}`} />
            <Comments
              taskId={task.id}
              comments={comments}
              setComments={setComments}
              currentUserId={user?.id}
              onChanged={reloadActivity}
            />
          </section>

          <section>
            <SectionHead title="Activity" meta={`${activity.length} entries`} />
            {activity.length === 0 ? (
              <p className="text-[13px] text-ink-4 py-3">Nothing recorded yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-rule)]">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex gap-3 py-2.5 items-baseline">
                    <span className="font-mono text-[10.5px] text-ink-4 tnum w-16 shrink-0">
                      {relativeTime(entry.created_at)}
                    </span>
                    <p className="text-[13px] leading-snug text-ink-2">
                      <span className="font-medium text-ink">
                        {entry.actor?.full_name ||
                          entry.actor?.email ||
                          "A scheduled job"}
                      </span>{" "}
                      {describeVerb(entry.verb)}
                      {entry.old_value && entry.new_value ? (
                        <>
                          {" "}
                          <span className="text-ink-3">
                            {entry.old_value.replace(/_/g, " ")}
                          </span>{" "}
                          →{" "}
                          <span className="text-ink">
                            {entry.new_value.replace(/_/g, " ")}
                          </span>
                        </>
                      ) : entry.new_value ? (
                        <>
                          {" "}
                          <span className="text-ink">
                            {entry.new_value.replace(/_/g, " ")}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="lg:border-l lg:border-[var(--color-rule)] lg:pl-8">
          <Sidebar
            task={task}
            members={members}
            labels={labels}
            onPatch={patch}
          />
        </aside>
      </div>
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------ */

function TitleAndDescription({
  task,
  onSave,
}: {
  task: Task;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [busy, setBusy] = useState(false);

  const [synced, setSynced] = useState(`${task.title}\u0000${task.description ?? ""}`);
  const current = `${task.title}\u0000${task.description ?? ""}`;
  if (synced !== current) {
    setSynced(current);
    setTitle(task.title);
    setDescription(task.description ?? "");
  }

  if (!editing) {
    return (
      <div>
        <h2 className="display text-[clamp(1.5rem,3vw,2.05rem)]">{task.title}</h2>
        {task.description ? (
          <p className="mt-4 text-[14.5px] leading-[1.65] text-ink-2 whitespace-pre-wrap measure">
            {task.description}
          </p>
        ) : (
          <p className="mt-4 text-[13.5px] text-ink-4 italic">
            No description yet.
          </p>
        )}
        <button
          onClick={() => setEditing(true)}
          className="mt-4 text-[12.5px] font-medium text-signal hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({ title: title.trim(), description: description.trim() });
        setBusy(false);
        setEditing(false);
      }}
    >
      <Field label="Title" required>
        {(id) => (
          <Input
            id={id}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        )}
      </Field>
      <Field label="Description">
        {(id) => (
          <Textarea
            id={id}
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </Field>
      <div className="flex gap-2">
        <Button variant="primary" type="submit" loading={busy}>
          Save
        </Button>
        <Button
          type="button"
          onClick={() => {
            setTitle(task.title);
            setDescription(task.description ?? "");
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function Sidebar({
  task,
  members,
  labels,
  onPatch,
}: {
  task: Task;
  members: Membership[];
  labels: Label[];
  onPatch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const rows: [string, React.ReactNode][] = [
    [
      "Status",
      <Select
        key="status"
        value={task.status}
        onChange={(e) => onPatch({ status: e.target.value as TaskStatus })}
        className="!h-9 text-[13px]"
        aria-label="Status"
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </Select>,
    ],
    [
      "Priority",
      <Select
        key="priority"
        value={task.priority}
        onChange={(e) => onPatch({ priority: e.target.value as TaskPriority })}
        className="!h-9 text-[13px]"
        aria-label="Priority"
      >
        {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </Select>,
    ],
    [
      "Assignee",
      <Select
        key="assignee"
        value={task.assignee?.id ?? ""}
        onChange={(e) =>
          onPatch({ assignee_id: e.target.value ? Number(e.target.value) : null })
        }
        className="!h-9 text-[13px]"
        aria-label="Assignee"
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.user.id} value={m.user.id}>
            {m.user.full_name || m.user.email}
          </option>
        ))}
      </Select>,
    ],
    [
      "Due date",
      <Input
        key="due"
        type="date"
        value={task.due_date ?? ""}
        onChange={(e) => onPatch({ due_date: e.target.value || null })}
        className="!h-9 text-[13px]"
        aria-label="Due date"
      />,
    ],
  ];

  return (
    <div className="flex flex-col gap-6">
      {task.overdue && (
        <p className="text-[12.5px] text-danger bg-danger-wash border border-danger/25 rounded-[2px] px-3 py-2.5 leading-snug">
          This task is past its due date.
        </p>
      )}

      <dl className="flex flex-col gap-4">
        {rows.map(([term, control]) => (
          <div key={term}>
            <dt className="field-label mb-1.5">{term}</dt>
            <dd>{control}</dd>
          </div>
        ))}
      </dl>

      <div>
        <p className="field-label mb-2">Labels</p>
        <div className="flex flex-wrap gap-1.5">
          {labels.length === 0 && (
            <p className="text-[12.5px] text-ink-4">
              No labels in this organization yet.
            </p>
          )}
          {labels.map((l) => {
            const on = task.labels.some((x) => x.id === l.id);
            return (
              <button
                key={l.id}
                aria-pressed={on}
                onClick={() =>
                  onPatch({
                    label_ids: on
                      ? task.labels.filter((x) => x.id !== l.id).map((x) => x.id)
                      : [...task.labels.map((x) => x.id), l.id],
                  })
                }
                className={`inline-flex items-center gap-1.5 text-[11.5px] leading-none px-2 py-[6px] rounded-[2px] border transition-colors duration-150 ${
                  on ? "text-ink" : "border-rule text-ink-3 hover:border-rule-strong"
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
      </div>

      <dl className="flex flex-col gap-3 rule-t pt-5">
        <div className="flex items-center justify-between gap-3">
          <dt className="field-label">Created by</dt>
          <dd className="text-[12.5px] text-ink-2 flex items-center gap-1.5 min-w-0">
            {task.created_by && (
              <Avatar initials={task.created_by.initials} size={18} />
            )}
            <span className="truncate">
              {task.created_by?.full_name || task.created_by?.email || "—"}
            </span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="field-label">Created</dt>
          <dd className="text-[12.5px] text-ink-2 tnum">
            {formatDate(task.created_at)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="field-label">Updated</dt>
          <dd className="text-[12.5px] text-ink-2 tnum">
            {formatDate(task.updated_at)}
          </dd>
        </div>
        {task.completed_at && (
          <div className="flex items-center justify-between gap-3">
            <dt className="field-label">Completed</dt>
            <dd className="text-[12.5px] text-done tnum">
              {formatDate(task.completed_at)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Comments({
  taskId,
  comments,
  setComments,
  currentUserId,
  onChanged,
}: {
  taskId: number;
  comments: Comment[];
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
  currentUserId?: number;
  onChanged: () => void;
}) {
  const { notify } = useToast();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const created = await api.post<Comment>(`/tasks/${taskId}/comments/`, {
        body: body.trim(),
      });
      setComments((c) => [...c, created]);
      setBody("");
      onChanged();
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Could not post that comment.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    try {
      await api.delete(`/tasks/${taskId}/comments/${id}/`);
      setComments((c) => c.filter((x) => x.id !== id));
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Could not delete that comment.",
        "error",
      );
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {comments.length === 0 ? (
        <p className="text-[13px] text-ink-4">
          No comments yet. Start the thread.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar
                initials={c.author?.initials ?? "?"}
                name={c.author?.full_name}
                size={28}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-medium">
                    {c.author?.full_name || c.author?.email || "Unknown"}
                  </span>
                  <span className="font-mono text-[10.5px] text-ink-4">
                    {relativeTime(c.created_at)}
                  </span>
                  {c.author?.id === currentUserId && (
                    <button
                      onClick={() => remove(c.id)}
                      className="ml-auto text-[11.5px] text-ink-4 hover:text-danger transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[13.5px] leading-[1.6] text-ink-2 whitespace-pre-wrap">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2.5">
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment"
          aria-label="Add a comment"
          maxLength={5000}
        />
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            type="submit"
            loading={busy}
            disabled={!body.trim()}
          >
            Comment
          </Button>
          <span className="text-[11.5px] text-ink-4 tnum">
            {body.length}/5000
          </span>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Attachments({
  taskId,
  attachments,
  setAttachments,
  onChanged,
}: {
  taskId: number;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  onChanged: () => void;
}) {
  const { notify } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const created = await api.post<Attachment>(
        `/tasks/${taskId}/attachments/`,
        data,
      );
      setAttachments((a) => [created, ...a]);
      notify(`${file.name} attached.`);
      onChanged();
    } catch (err) {
      notify(
        err instanceof ApiError
          ? (err.fieldError("file") ?? err.message)
          : "Could not upload that file.",
        "error",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: number) {
    try {
      await api.delete(`/tasks/${taskId}/attachments/${id}/`);
      setAttachments((a) => a.filter((x) => x.id !== id));
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Could not delete that file.",
        "error",
      );
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {attachments.length > 0 && (
        <ul className="divide-y divide-[var(--color-rule)]">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <Paperclip size={14} className="text-ink-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] truncate">{a.original_name}</p>
                <p className="font-mono text-[10.5px] text-ink-4 tnum">
                  {formatBytes(a.size)} · {relativeTime(a.created_at)}
                  {a.uploaded_by ? ` · ${a.uploaded_by.full_name || a.uploaded_by.email}` : ""}
                </p>
              </div>
              {a.file_url && (
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink-4 hover:text-signal transition-colors p-1.5"
                  aria-label={`Download ${a.original_name}`}
                >
                  <Download size={14} />
                </a>
              )}
              <button
                onClick={() => remove(a.id)}
                className="text-ink-4 hover:text-danger transition-colors p-1.5"
                aria-label={`Delete ${a.original_name}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          id="attachment-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
        <Button
          size="sm"
          icon={<Upload size={14} />}
          loading={busy}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Attach a file
        </Button>
        <p className="mt-2 text-[11.5px] text-ink-4">
          Up to 10 MB. Images, PDF, text, CSV, Word, or zip.
        </p>
      </div>
    </div>
  );
}
