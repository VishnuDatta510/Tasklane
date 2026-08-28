"use client";

import { useId } from "react";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (id: string) => React.ReactNode;
}

/** The wall-label anatomy: tracked field name, then the value. */
export function Field({ label, error, hint, required, children }: FieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children(id)}
      {error ? (
        <p className="text-[12.5px] text-danger leading-snug">{error}</p>
      ) : hint ? (
        <p className="text-[12.5px] text-ink-3 leading-snug">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "w-full bg-paper border border-rule-strong rounded-[2px] px-3 text-sm text-ink " +
  "transition-colors duration-150 hover:border-ink-4 " +
  "focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/25 " +
  "disabled:bg-paper-2 disabled:text-ink-4 disabled:cursor-not-allowed " +
  "aria-[invalid=true]:border-danger";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`${CONTROL} h-10 ${className}`} {...rest} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea className={`${CONTROL} py-2.5 leading-relaxed ${className}`} {...rest} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select className={`${CONTROL} h-10 pr-8 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path d=%22M2 4.5L6 8.5L10 4.5%22 stroke=%22%236f7684%22 stroke-width=%221.5%22 fill=%22none%22 stroke-linecap=%22round%22/></svg>')] bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat ${className}`} {...rest}>
      {children}
    </select>
  );
}
