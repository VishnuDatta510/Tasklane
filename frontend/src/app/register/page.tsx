"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/app/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    password_confirm: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/app");
  }, [loading, user, router]);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setGeneral(null);

    if (form.password !== form.password_confirm) {
      setErrors({ password_confirm: "The two passwords do not match." });
      setBusy(false);
      return;
    }

    try {
      await register({ ...form, email: form.email.trim().toLowerCase() });
      router.push("/app");
    } catch (err) {
      if (err instanceof ApiError) {
        const collected: Record<string, string> = {};
        for (const key of ["email", "password", "password_confirm", "full_name"]) {
          const message = err.fieldError(key);
          if (message) collected[key] = message;
        }
        setErrors(collected);
        if (Object.keys(collected).length === 0) setGeneral(err.message);
      } else {
        setGeneral("Could not create the account.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Start a workspace"
      intro="Create your account, then invite the people who need it. You can delete the whole thing just as fast."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-signal font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {general && (
          <div
            role="alert"
            className="text-[13.5px] text-danger bg-danger-wash border border-danger/25 rounded-[2px] px-3.5 py-3 leading-snug"
          >
            {general}
          </div>
        )}

        <Field label="Full name" error={errors.full_name}>
          {(id) => (
            <Input
              id={id}
              autoComplete="name"
              value={form.full_name}
              onChange={set("full_name")}
              placeholder="Aisha Khan"
            />
          )}
        </Field>

        <Field label="Email" required error={errors.email}>
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={set("email")}
              aria-invalid={!!errors.email}
              placeholder="you@company.com"
            />
          )}
        </Field>

        <Field
          label="Password"
          required
          error={errors.password}
          hint={errors.password ? undefined : "At least 8 characters, and not a common one."}
        >
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={set("password")}
              aria-invalid={!!errors.password}
            />
          )}
        </Field>

        <Field label="Confirm password" required error={errors.password_confirm}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              required
              value={form.password_confirm}
              onChange={set("password_confirm")}
              aria-invalid={!!errors.password_confirm}
            />
          )}
        </Field>

        <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-1">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
