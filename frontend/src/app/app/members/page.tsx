"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, UserPlus, Users, X } from "lucide-react";
import { PageBody, PageHead } from "@/components/app/Shell";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Avatar, RoleTag } from "@/components/ui/Marks";
import { EmptyState, ErrorState, SectionHead, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { ROLE_LABEL, type Invitation, type Membership, type Role } from "@/lib/types";

export default function MembersPage() {
  const { currentOrg, user, refreshOrgs } = useAuth();
  const { notify } = useToast();
  const [members, setMembers] = useState<Membership[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const myRole = currentOrg?.my_role;
  const canManage = myRole === "owner" || myRole === "manager";
  const isOwner = myRole === "owner";

  const fetchData = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const memberList = await api.get<Membership[]>(
        `/organizations/${currentOrg.id}/members/`,
      );
      setError(null);
      setMembers(memberList ?? []);

      if (canManage) {
        const inviteList = await api.get<Invitation[]>(
          `/organizations/${currentOrg.id}/invitations/`,
        );
        setInvitations((inviteList ?? []).filter((i) => i.is_pending));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load members.");
    } finally {
      setLoading(false);
    }
  }, [currentOrg, canManage]);

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

  async function changeRole(membership: Membership, role: Role) {
    if (!currentOrg) return;
    const previous = members;
    setMembers((list) =>
      list.map((m) => (m.id === membership.id ? { ...m, role } : m)),
    );
    try {
      await api.patch(
        `/organizations/${currentOrg.id}/members/${membership.id}/`,
        { role },
      );
      notify(
        `${membership.user.full_name || membership.user.email} is now ${ROLE_LABEL[role].toLowerCase()}.`,
      );
      await refreshOrgs();
    } catch (err) {
      setMembers(previous);
      notify(
        err instanceof ApiError
          ? (err.fieldError("role") ?? err.message)
          : "Could not change that role.",
        "error",
      );
    }
  }

  async function removeMember(membership: Membership) {
    if (!currentOrg) return;
    const name = membership.user.full_name || membership.user.email;
    if (!confirm(`Remove ${name} from ${currentOrg.name}?`)) return;
    try {
      await api.delete(
        `/organizations/${currentOrg.id}/members/${membership.id}/remove/`,
      );
      setMembers((list) => list.filter((m) => m.id !== membership.id));
      notify(`${name} removed.`);
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Could not remove that member.",
        "error",
      );
    }
  }

  async function revoke(invitation: Invitation) {
    if (!currentOrg) return;
    try {
      await api.delete(
        `/organizations/${currentOrg.id}/invitations/${invitation.id}/`,
      );
      setInvitations((list) => list.filter((i) => i.id !== invitation.id));
      notify("Invitation revoked.");
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Could not revoke that invitation.",
        "error",
      );
    }
  }

  if (!currentOrg) {
    return (
      <>
        <PageHead title="Members" />
        <EmptyState
          icon={<Users size={28} strokeWidth={1.5} />}
          title="No organization selected"
          body="Create or join an organization to manage its people."
        />
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Members"
        meta={<span>{members.length} in {currentOrg.name}</span>}
        actions={
          canManage && (
            <Button
              variant="primary"
              size="sm"
              icon={<UserPlus size={14} />}
              onClick={() => setInviting(true)}
            >
              Invite
            </Button>
          )
        }
      />

      <PageBody>
        <div className="px-5 sm:px-7 lg:px-8 py-6 max-w-[1000px] w-full flex flex-col gap-10">
        {loading && members.length === 0 ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} retry={refresh} />
        ) : (
          <>
            <section>
              <SectionHead title="People" meta={`${members.length}`} />
              <ul className="divide-y divide-[var(--color-rule)]">
                {members.map((m) => {
                  const isMe = m.user.id === user?.id;
                  return (
                    <li key={m.id} className="flex items-center gap-3 py-3">
                      <Avatar
                        initials={m.user.initials}
                        name={m.user.full_name}
                        size={34}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium truncate">
                          {m.user.full_name || "Unnamed"}
                          {isMe && (
                            <span className="text-ink-4 font-normal"> · you</span>
                          )}
                        </p>
                        <p className="text-[12.5px] text-ink-3 truncate">
                          {m.user.email}
                        </p>
                      </div>

                      <span className="hidden sm:block text-[12px] text-ink-4 tnum">
                        joined {formatDate(m.joined_at)}
                      </span>

                      {canManage && !isMe ? (
                        <Select
                          value={m.role}
                          onChange={(e) => changeRole(m, e.target.value as Role)}
                          className="!h-8 !w-auto text-[12.5px]"
                          aria-label={`Role for ${m.user.email}`}
                        >
                          <option value="member">Member</option>
                          <option value="manager">Manager</option>
                          {/* Only an owner may grant ownership; the server
                              enforces this too. */}
                          <option value="owner" disabled={!isOwner}>
                            Owner
                          </option>
                        </Select>
                      ) : (
                        <RoleTag role={m.role} />
                      )}

                      {canManage && !isMe && (
                        <button
                          onClick={() => removeMember(m)}
                          className="text-ink-4 hover:text-danger transition-colors p-1.5"
                          aria-label={`Remove ${m.user.email}`}
                        >
                          <X size={15} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {canManage && (
              <section>
                <SectionHead
                  title="Pending invitations"
                  meta={`${invitations.length}`}
                />
                {invitations.length === 0 ? (
                  <p className="text-[13px] text-ink-4 py-2">
                    No invitations are outstanding.
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--color-rule)]">
                    {invitations.map((i) => (
                      <li key={i.id} className="flex items-center gap-3 py-3">
                        <Mail size={15} className="text-ink-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] truncate">{i.email}</p>
                          <p className="text-[11.5px] text-ink-4 tnum">
                            invited as {ROLE_LABEL[i.role].toLowerCase()} · expires{" "}
                            {formatDate(i.expires_at)}
                          </p>
                        </div>
                        <Button size="sm" onClick={() => revoke(i)}>
                          Revoke
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </div>
      </PageBody>

      {inviting && (
        <InviteModal
          organizationId={currentOrg.id}
          onClose={() => setInviting(false)}
          onInvited={(invitation) => {
            setInvitations((list) => [invitation, ...list]);
            setInviting(false);
            notify(`Invitation sent to ${invitation.email}.`);
          }}
        />
      )}
    </>
  );
}

function InviteModal({
  organizationId,
  onClose,
  onInvited,
}: {
  organizationId: number;
  onClose: () => void;
  onInvited: (invitation: Invitation) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setGeneral(null);
    try {
      const invitation = await api.post<Invitation>(
        `/organizations/${organizationId}/invitations/`,
        { email: email.trim().toLowerCase(), role },
      );
      onInvited(invitation);
    } catch (err) {
      if (err instanceof ApiError) {
        const collected: Record<string, string> = {};
        for (const key of ["email", "role"]) {
          const message = err.fieldError(key);
          if (message) collected[key] = message;
        }
        setErrors(collected);
        if (Object.keys(collected).length === 0) setGeneral(err.message);
      } else {
        setGeneral("Could not send that invitation.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite someone"
      description="They get an email with a link that expires in seven days."
      footer={
        <>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="invite-form" loading={busy}>
            Send invitation
          </Button>
        </>
      }
    >
      <form id="invite-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {general && (
          <div
            role="alert"
            className="text-[13.5px] text-danger bg-danger-wash border border-danger/25 rounded-[2px] px-3.5 py-3"
          >
            {general}
          </div>
        )}

        <Field label="Email" required error={errors.email}>
          {(id) => (
            <Input
              id={id}
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              placeholder="teammate@company.com"
            />
          )}
        </Field>

        <Field
          label="Role"
          error={errors.role}
          hint="Ownership is granted after they join, not in the invitation."
        >
          {(id) => (
            <Select
              id={id}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="member">Member — creates and works tasks</option>
              <option value="manager">Manager — also manages projects and people</option>
            </Select>
          )}
        </Field>
      </form>
    </Modal>
  );
}
