"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { PageBody, PageHead } from "@/components/app/Shell";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Marks";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Membership, Paginated, Project } from "@/lib/types";

export default function ProjectsPage() {
  const { currentOrg } = useAuth();
  const { notify } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const canManage =
    currentOrg?.my_role === "owner" || currentOrg?.my_role === "manager";

  const fetchData = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const [page, memberList] = await Promise.all([
        api.get<Paginated<Project>>(
          `/projects/?organization=${currentOrg.id}&page_size=100`,
        ),
        api.get<Membership[]>(`/organizations/${currentOrg.id}/members/`),
      ]);
      setError(null);
      setProjects(page.results);
      setMembers(memberList ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load projects.");
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

  async function archive(project: Project) {
    try {
      const updated = await api.patch<Project>(`/projects/${project.id}/`, {
        status: project.status === "active" ? "archived" : "active",
      });
      setProjects((list) =>
        list.map((p) => (p.id === updated.id ? updated : p)),
      );
      notify(
        updated.status === "archived"
          ? `${updated.key} archived.`
          : `${updated.key} reopened.`,
      );
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Could not update that project.",
        "error",
      );
    }
  }

  if (!currentOrg) {
    return (
      <>
        <PageHead title="Projects" />
        <EmptyState
          icon={<FolderKanban size={28} strokeWidth={1.5} />}
          title="No organization selected"
          body="Projects live inside an organization. Create or join one first."
        />
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Projects"
        meta={<span>{projects.length} in this organization</span>}
        actions={
          canManage && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setCreating(true)}
            >
              New project
            </Button>
          )
        }
      />

      <PageBody>
        <div className="px-5 sm:px-7 lg:px-8 py-6 max-w-[1240px] w-full">
        {loading && projects.length === 0 ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[74px] w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} retry={refresh} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban size={28} strokeWidth={1.5} />}
            title="No projects yet"
            body={
              canManage
                ? "A project groups related tasks and gives them a reference prefix like API-14. Create your first one."
                : "There are no projects here yet. A manager or owner can create one."
            }
            action={
              canManage && (
                <Button
                  variant="primary"
                  icon={<Plus size={15} />}
                  onClick={() => setCreating(true)}
                >
                  Create a project
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--color-rule)] rule-t">
            {projects.map((p) => (
              <li key={p.id} className="py-4 flex items-start gap-4">
                <span
                  aria-hidden
                  className="w-[3px] self-stretch rounded-[1px] shrink-0"
                  style={{ background: p.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <Link
                      href={`/app/board?project=${p.id}`}
                      className="font-mono text-[11px] text-signal no-underline"
                    >
                      {p.key}
                    </Link>
                    <Link
                      href={`/app/board?project=${p.id}`}
                      className="text-[15px] font-semibold tracking-[-0.01em] no-underline hover:text-signal transition-colors"
                    >
                      {p.name}
                    </Link>
                    {p.status === "archived" && (
                      <span className="field-label px-1.5 py-[3px] border border-rule rounded-[2px]">
                        Archived
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="mt-1.5 text-[13.5px] text-ink-2 leading-relaxed measure">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center gap-4 flex-wrap text-[12px] text-ink-3 tnum">
                    <span>
                      <span className="font-semibold text-ink">{p.open_task_count}</span> open
                    </span>
                    <span>
                      <span className="font-semibold text-ink">{p.done_task_count}</span> done
                    </span>
                    <span>Created {formatDate(p.created_at)}</span>
                    {p.lead && (
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar initials={p.lead.initials} size={17} />
                        {p.lead.full_name || p.lead.email}
                      </span>
                    )}
                  </div>
                </div>

                {canManage && (
                  <Button size="sm" onClick={() => archive(p)}>
                    {p.status === "active" ? "Archive" : "Reopen"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      </PageBody>

      {creating && currentOrg && (
        <NewProjectModal
          organizationId={currentOrg.id}
          members={members}
          onClose={() => setCreating(false)}
          onCreated={(project) => {
            setProjects((list) => [...list, project]);
            setCreating(false);
            notify(`${project.key} created.`);
          }}
        />
      )}
    </>
  );
}

function NewProjectModal({
  organizationId,
  members,
  onClose,
  onCreated,
}: {
  organizationId: number;
  members: Membership[];
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    key: "",
    description: "",
    color: "#1b3bef",
    lead_id: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setGeneral(null);
    try {
      const project = await api.post<Project>("/projects/", {
        organization: organizationId,
        name: form.name.trim(),
        key: form.key.trim().toUpperCase() || undefined,
        description: form.description.trim(),
        color: form.color,
        lead_id: form.lead_id ? Number(form.lead_id) : null,
      });
      onCreated(project);
    } catch (err) {
      if (err instanceof ApiError) {
        const collected: Record<string, string> = {};
        for (const key of ["name", "key", "organization", "lead_id", "color"]) {
          const message = err.fieldError(key);
          if (message) collected[key] = message;
        }
        setErrors(collected);
        if (Object.keys(collected).length === 0) setGeneral(err.message);
      } else {
        setGeneral("Could not create the project.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New project"
      description="The key becomes the prefix on every task reference in this project."
      footer={
        <>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-project" loading={busy}>
            Create project
          </Button>
        </>
      }
    >
      <form id="new-project" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {general && (
          <div
            role="alert"
            className="text-[13.5px] text-danger bg-danger-wash border border-danger/25 rounded-[2px] px-3.5 py-3"
          >
            {general}
          </div>
        )}

        <Field label="Name" required error={errors.name}>
          {(id) => (
            <Input
              id={id}
              autoFocus
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Web Client"
            />
          )}
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="Key"
            error={errors.key}
            hint={errors.key ? undefined : "Left empty, one is derived from the name."}
          >
            {(id) => (
              <Input
                id={id}
                value={form.key}
                maxLength={10}
                onChange={(e) =>
                  setForm((f) => ({ ...f, key: e.target.value.toUpperCase() }))
                }
                placeholder="WEB"
                className="font-mono"
              />
            )}
          </Field>

          <Field label="Lead" error={errors.lead_id}>
            {(id) => (
              <Select
                id={id}
                value={form.lead_id}
                onChange={(e) => setForm((f) => ({ ...f, lead_id: e.target.value }))}
              >
                <option value="">No lead</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.full_name || m.user.email}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Colour">
          {(id) => (
            <div className="flex items-center gap-2.5">
              <input
                id={id}
                type="color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="h-10 w-14 border border-rule-strong rounded-[2px] bg-paper p-1 cursor-pointer"
              />
              <span className="font-mono text-[12.5px] text-ink-3">{form.color}</span>
            </div>
          )}
        </Field>

        <Field label="Description">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="What does this project cover?"
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
