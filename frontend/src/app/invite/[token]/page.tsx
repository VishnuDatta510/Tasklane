"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/app/AuthLayout";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const { user, loading, refreshOrgs, setCurrentOrg } = useAuth();
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      try {
        window.sessionStorage.setItem("pt_pending_invite", token);
      } catch {
        /* ignore */
      }
    }
  }, [loading, user, token]);

  async function accept() {
    setState("working");
    setMessage(null);
    try {
      const result = await api.post<{
        detail: string;
        organization_id: number;
      }>("/invitations/accept/", { token });

      const orgs = await refreshOrgs();
      const joined = orgs.find((o) => o.id === result.organization_id);
      if (joined) setCurrentOrg(joined);

      try {
        window.sessionStorage.removeItem("pt_pending_invite");
      } catch {
        /* ignore */
      }

      setMessage(result.detail);
      setState("done");
      setTimeout(() => router.push("/app"), 1200);
    } catch (err) {
      setMessage(
        err instanceof ApiError
          ? (err.fieldError("token") ?? err.message)
          : "Could not accept that invitation.",
      );
      setState("failed");
    }
  }

  if (loading) {
    return (
      <AuthLayout title="Invitation" intro="Checking your session…">
        <div />
      </AuthLayout>
    );
  }

  if (!user) {
    return (
      <AuthLayout
        title="You have been invited"
        intro="Sign in or create an account with the email address the invitation was sent to, and we will bring you straight back here."
        footer={
          <>
            New here?{" "}
            <Link href="/register" className="text-signal font-medium">
              Create an account
            </Link>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push("/login")}
          >
            Sign in to accept
          </Button>
          <p className="text-[12.5px] text-ink-3 leading-relaxed">
            The invitation is tied to one email address. Signing in with a
            different one will not work.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={state === "done" ? "You're in" : "Accept your invitation"}
      intro={
        state === "done"
          ? "Taking you to the workspace…"
          : `Signed in as ${user.email}. Accepting adds you to the organization that invited this address.`
      }
    >
      <div className="flex flex-col gap-4">
        {message && (
          <div
            role="alert"
            className={`text-[13.5px] rounded-[2px] px-3.5 py-3 border leading-snug ${
              state === "failed"
                ? "text-danger bg-danger-wash border-danger/25"
                : "text-success bg-success-wash border-success/25"
            }`}
          >
            {message}
          </div>
        )}

        {state !== "done" && (
          <Button
            variant="primary"
            size="lg"
            loading={state === "working"}
            onClick={accept}
          >
            Accept invitation
          </Button>
        )}

        <Link
          href="/app"
          className="text-[13px] text-ink-2 no-underline hover:text-ink transition-colors"
        >
          Skip for now
        </Link>
      </div>
    </AuthLayout>
  );
}
