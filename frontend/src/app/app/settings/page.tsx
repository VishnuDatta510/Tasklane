"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Plus, Tag, Trash2 } from "lucide-react";
import { PageBody, PageHead } from "@/components/app/Shell";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SectionHead } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Label, Organization, Paginated } from "@/lib/types";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <Settings />
    </Suspense>
  );
}

function Settings() {
  const { currentOrg, orgs, user, refreshOrgs, refreshUser, setCurrentOrg, logout } =
    useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [creatingOrg, setCreatingOrg] = useState(params.get("new") === "1");

  const isOwner = currentOrg?.my_role === "owner";
  const canManage = isOwner || currentOrg?.my_role === "manager";

  return (
    <>
      <PageHead title="Settings" />

      <PageBody>
        <div className="px-5 sm:px-7 lg:px-8 py-6 max-w-[760px] w-full flex flex-col gap-11">
        <ProfileSection
          fullName={user?.full_name ?? ""}
          email={user?.email ?? ""}
          onSaved={async () => {
            await refreshUser();
            notify("Profile updated.");
          }}
        />

        <PasswordSection />

        <section>
          <SectionHead
            title="Organizations"
            meta={`${orgs.length}`}
            action={
              <Button
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setCreatingOrg(true)}
              >
                New
              </Button>
            }
          />
          <ul className="divide-y divide-[var(--color-rule)]">
            {orgs.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-3">
                <span className="w-8 h-8 rounded-[2px] bg-signal text-white text-[11px] font-bold inline-flex items-center justify-center shrink-0">
                  {o.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium truncate">{o.name}</p>
                  <p className="text-[12px] text-ink-3 tnum">
                    {o.member_count} members · {o.project_count} projects ·{" "}
                    {o.my_role}
                  </p>
                </div>
                {o.id === currentOrg?.id ? (
                  <span className="field-label text-signal">Current</span>
                ) : (
                  <Button size="sm" onClick={() => setCurrentOrg(o)}>
                    Switch
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {currentOrg && canManage && <LabelsSection organizationId={currentOrg.id} />}

        {currentOrg && (
          <OrganizationSection
            organization={currentOrg}
            isOwner={!!isOwner}
            onChanged={async () => {
              await refreshOrgs();
              notify("Organization updated.");
            }}
            onDeleted={async () => {
              await refreshOrgs();
              notify("Organization deleted.");
              router.push("/app");
            }}
          />
        )}

        <section className="rule-t pt-6">
          <Button variant="danger" onClick={logout}>
            Sign out
          </Button>
        </section>
      </div>
      </PageBody>

      {creatingOrg && (
        <NewOrgModal
          onClose={() => {
            setCreatingOrg(false);
            router.replace("/app/settings");
          }}
          onCreated={async (org) => {
            await refreshOrgs();
            setCurrentOrg(org);
            setCreatingOrg(false);
            router.replace("/app/settings");
            notify(`${org.name} created. You are its owner.`);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function ProfileSection({
  fullName,
  email,
  onSaved,
}: {
  fullName: string;
  email: string;
  onSaved: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [name, setName] = useState(fullName);
  const [busy, setBusy] = useState(false);

  const [syncedName, setSyncedName] = useState(fullName);
  if (syncedName !== fullName) {
    setSyncedName(fullName);
    setName(fullName);
  }

  return (
    <section>
      <SectionHead title="Your profile" />
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.patch("/auth/me/", { full_name: name.trim() });
            await onSaved();
          } catch (err) {
            notify(
              err instanceof Error ? err.message : "Could not save your profile.",
              "error",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Email" hint="Your email is your sign-in and cannot be changed here.">
          {(id) => <Input id={id} value={email} disabled />}
        </Field>
        <Field label="Full name">
          {(id) => (
            <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <div>
          <Button variant="primary" type="submit" loading={busy}>
            Save profile
          </Button>
        </div>
      </form>
    </section>
  );
}

function PasswordSection() {
  const { notify } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  return (
    <section>
      <SectionHead title="Password" />
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErrors({});
          try {
            await api.post("/auth/change-password/", {
              current_password: current,
              new_password: next,
            });
            setCurrent("");
            setNext("");
            notify("Password updated.");
          } catch (err) {
            if (err instanceof ApiError) {
              setErrors({
                current_password: err.fieldError("current_password") ?? "",
                new_password: err.fieldError("new_password") ?? "",
              });
              if (!err.fieldError("current_password") && !err.fieldError("new_password"))
                notify(err.message, "error");
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Current password" error={errors.current_password || undefined}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="New password"
          error={errors.new_password || undefined}
          hint={errors.new_password ? undefined : "At least 8 characters, and not a common one."}
        >
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          )}
        </Field>
        <div>
          <Button
            variant="primary"
            type="submit"
            loading={busy}
            disabled={!current || !next}
          >
            Change password
          </Button>
        </div>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function LabelsSection({ organizationId }: { organizationId: number }) {
  const { notify } = useToast();
  const [labels, setLabels] = useState<Label[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<Paginated<Label>>(`/labels/?organization=${organizationId}&page_size=100`)
      .then((page) => setLabels(page.results))
      .catch(() => {});
  }, [organizationId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const created = await api.post<Label>("/labels/", {
        organization: organizationId,
        name: name.trim(),
        color,
      });
      setLabels((l) => [...l, created]);
      setName("");
    } catch (err) {
      notify(
        err instanceof ApiError
          ? (err.fieldError("name") ?? err.message)
          : "Could not create that label.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(label: Label) {
    if (!confirm(`Delete the label "${label.name}"? It comes off every task.`))
      return;
    try {
      await api.delete(`/labels/${label.id}/`);
      setLabels((l) => l.filter((x) => x.id !== label.id));
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Could not delete that label.",
        "error",
      );
    }
  }

  return (
    <section>
      <SectionHead title="Labels" meta={`${labels.length}`} />

      {labels.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-5">
          {labels.map((l) => (
            <li
              key={l.id}
              className="inline-flex items-center gap-2 text-[12.5px] px-2.5 py-1.5 rounded-[2px] border"
              style={{ borderColor: `${l.color}66`, background: `${l.color}12` }}
            >
              <span
                aria-hidden
                className="w-[7px] h-[7px] rounded-full"
                style={{ background: l.color }}
              />
              {l.name}
              {typeof l.task_count === "number" && (
                <span className="text-ink-4 tnum">{l.task_count}</span>
              )}
              <button
                onClick={() => remove(l)}
                className="text-ink-4 hover:text-danger transition-colors"
                aria-label={`Delete ${l.name}`}
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex flex-wrap items-end gap-2.5">
        <div className="flex-1 min-w-[12rem]">
          <Field label="New label">
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="security"
                maxLength={40}
              />
            )}
          </Field>
        </div>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-14 border border-rule-strong rounded-[2px] bg-paper p-1 cursor-pointer"
          aria-label="Label colour"
        />
        <Button type="submit" icon={<Tag size={14} />} loading={busy} disabled={!name.trim()}>
          Add
        </Button>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function OrganizationSection({
  organization,
  isOwner,
  onChanged,
  onDeleted,
}: {
  organization: Organization;
  isOwner: boolean;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.description);
  const [busy, setBusy] = useState(false);

  const [syncedId, setSyncedId] = useState(organization.id);
  if (syncedId !== organization.id) {
    setSyncedId(organization.id);
    setName(organization.name);
    setDescription(organization.description);
  }

  return (
    <section>
      <SectionHead title="This organization" meta={organization.slug} />
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.patch(`/organizations/${organization.id}/`, {
              name: name.trim(),
              description: description.trim(),
            });
            await onChanged();
          } catch (err) {
            notify(
              err instanceof Error ? err.message : "Could not save.",
              "error",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Name">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isOwner && organization.my_role !== "manager"}
            />
          )}
        </Field>
        <Field label="Description">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        <div className="flex gap-2">
          <Button variant="primary" type="submit" loading={busy}>
            Save
          </Button>
          {isOwner && (
            <Button
              type="button"
              variant="danger"
              icon={<Building2 size={14} />}
              onClick={async () => {
                if (
                  !confirm(
                    `Delete ${organization.name}? Every project, task, comment and file in it goes too. This cannot be undone.`,
                  )
                )
                  return;
                try {
                  await api.delete(`/organizations/${organization.id}/`);
                  await onDeleted();
                } catch (err) {
                  notify(
                    err instanceof Error ? err.message : "Could not delete.",
                    "error",
                  );
                }
              }}
            >
              Delete organization
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}

function NewOrgModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (org: Organization) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title="New organization"
      description="You become its owner. Invite the rest of the team afterwards."
      footer={
        <>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-org" loading={busy}>
            Create
          </Button>
        </>
      }
    >
      <form
        id="new-org"
        className="flex flex-col gap-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const org = await api.post<Organization>("/organizations/", {
              name: name.trim(),
              description: description.trim(),
            });
            await onCreated(org);
          } catch (err) {
            setError(
              err instanceof ApiError
                ? (err.fieldError("name") ?? err.message)
                : "Could not create the organization.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <div
            role="alert"
            className="text-[13.5px] text-danger bg-danger-wash border border-danger/25 rounded-[2px] px-3.5 py-3"
          >
            {error}
          </div>
        )}
        <Field label="Name" required>
          {(id) => (
            <Input
              id={id}
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Northwind Labs"
            />
          )}
        </Field>
        <Field label="Description">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team work on?"
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
