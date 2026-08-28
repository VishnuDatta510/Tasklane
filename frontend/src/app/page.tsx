import Link from "next/link";
import { BoardPlate } from "@/components/landing/BoardPlate";

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <TopRule />
      <main className="flex-1">
        <Opening />
        <TheLabel />
        <AccessPlan />
        <TheRecord />
        <Close />
      </main>
      <Colophon />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TopRule() {
  return (
    <header className="sticky top-0 z-50 bg-paper/92 backdrop-blur-[6px] rule-b">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 no-underline shrink-0">
          <Plaque />
          <span className="text-[14px] font-semibold tracking-[-0.015em]">
            TaskLane
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 ml-4">
          {[
            ["The label", "#label"],
            ["Access", "#access"],
            ["The record", "#record"],
          ].map(([text, href]) => (
            <a
              key={href}
              href={href}
              className="text-[13px] text-ink-2 no-underline hover:text-ink transition-colors duration-150"
            >
              {text}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className="text-[13px] font-medium text-ink-2 no-underline hover:text-ink transition-colors px-2.5 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-[13px] font-medium no-underline bg-signal text-white h-9 px-4 inline-flex items-center rounded-[2px] border border-signal hover:bg-signal-ink hover:border-signal-ink transition-colors duration-150"
          >
            Start a workspace
          </Link>
        </div>
      </div>
    </header>
  );
}

/** The identity mark: a wall plaque with its fixing holes. */
function Plaque() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <rect
        x="1.5"
        y="3.5"
        width="19"
        height="15"
        rx="1"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="1.5"
      />
      <circle cx="5" cy="7" r="1" fill="var(--color-signal)" />
      <path
        d="M8.5 7.5h9M8.5 11h9M5 14.5h12.5"
        stroke="var(--color-ink-4)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

function Opening() {
  return (
    <section className="relative">
      <div className="absolute inset-0 grid-paper opacity-[0.55] pointer-events-none" aria-hidden />
      <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8 pt-16 pb-14 lg:pt-24 lg:pb-20">
        <div className="grid lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] gap-12 lg:gap-14 items-center">
          <div>
            <h1 className="display text-[clamp(2.6rem,6.2vw,4.15rem)]">
              Every piece of work,
              <br />
              <span className="text-signal">labelled and hung.</span>
            </h1>

            <p className="measure mt-6 text-[16.5px] leading-[1.6] text-ink-2">
              A tracker for small teams that treats a task the way a gallery
              treats an object: one label, every fact on it, and a record of
              every hand that moved it. Organizations, projects, roles,
              due dates, attachments, and an activity log that never forgets.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="no-underline bg-signal text-white h-12 px-6 inline-flex items-center text-[15px] font-medium rounded-[2px] border border-signal hover:bg-signal-ink hover:border-signal-ink transition-colors duration-150"
              >
                Start a workspace
              </Link>
              <Link
                href="/login"
                className="no-underline h-12 px-6 inline-flex items-center text-[15px] font-medium rounded-[2px] border border-rule-strong hover:border-ink-3 hover:bg-paper-2 transition-colors duration-150"
              >
                Sign in
              </Link>
            </div>

            <p className="mt-5 text-[13px] text-ink-3">
              Free while you evaluate it. No card, no sales call.
            </p>
          </div>

          <div className="lg:pl-2">
            <BoardPlate />
            <p className="mt-3 text-[12px] text-ink-4">
              A live board plate. Content shown is sample data.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/** The signature demonstration: the anatomy of one record, annotated. */
function TheLabel() {
  return (
    <section id="label" className="rule-t bg-paper-2">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-12 lg:gap-20 items-start">
          <div className="lg:sticky lg:top-24">
            <h2 className="display text-[clamp(1.9rem,3.6vw,2.75rem)]">
              One label carries the whole object.
            </h2>
            <p className="measure mt-5 text-[15.5px] leading-[1.62] text-ink-2">
              No hunting through tabs to learn what a task is. Reference,
              title, state, who holds it, when it is due, what it is tagged
              with, and what is attached — all on the face of the record, in a
              fixed order, so your eye learns exactly where to look.
            </p>
            <dl className="mt-8 grid sm:grid-cols-2 gap-x-8 gap-y-5">
              {[
                ["Reference", "Project key plus a per-project number. API-28 means something out loud."],
                ["Priority", "A four-step bar, because priority is a quantity, not a colour."],
                ["Assignee", "Validated against org membership — you cannot assign work to a stranger."],
                ["Due date", "Flagged overdue by a scheduled job, not by whoever notices first."],
              ].map(([term, def]) => (
                <div key={term}>
                  <dt className="field-label">{term}</dt>
                  <dd className="mt-1.5 text-[13.5px] leading-[1.5] text-ink-2">
                    {def}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <AnnotatedLabel />
        </div>
      </div>
    </section>
  );
}

function AnnotatedLabel() {
  const rows: [string, React.ReactNode][] = [
    ["Reference", <span key="r" className="font-mono text-[13px] tnum">API-28</span>],
    [
      "State",
      <span key="s" className="inline-flex items-center gap-1.5 text-[13px]">
        <span className="w-[7px] h-[7px] rounded-full bg-[var(--color-progress)]" />
        In progress
      </span>,
    ],
    [
      "Priority",
      <span key="p" className="inline-flex items-end gap-[2px] h-3">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="w-[3px] rounded-[1px]"
            style={{ height: `${i * 25}%`, background: "var(--color-urgent)" }}
          />
        ))}
      </span>,
    ],
    [
      "Assignee",
      <span key="a" className="inline-flex items-center gap-2 text-[13px]">
        <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-paper-3 text-[9px] font-semibold text-ink-2">
          AK
        </span>
        Aisha Khan
      </span>,
    ],
    ["Due", <span key="d" className="font-mono text-[13px] tnum">29 Aug 2026</span>],
    [
      "Labels",
      <span key="l" className="flex gap-1.5">
        <span className="text-[11px] leading-none px-1.5 py-[4px] rounded-[2px] border border-signal/35 bg-signal-wash text-ink-2">
          backend
        </span>
        <span className="text-[11px] leading-none px-1.5 py-[4px] rounded-[2px] border border-[#c62828]/35 bg-[#c62828]/[0.07] text-ink-2">
          security
        </span>
      </span>,
    ],
    ["Attachments", <span key="at" className="font-mono text-[13px] tnum">2</span>],
  ];

  return (
    <div className="plate bg-paper">
      <div className="px-5 pt-5 pb-4 rule-b">
        <p className="font-mono text-[11px] text-signal tnum">API-28</p>
        <h3 className="display text-[clamp(1.35rem,2.4vw,1.75rem)] mt-2">
          Object-level permissions on comments
        </h3>
        <p className="mt-3 text-[13.5px] leading-[1.6] text-ink-2 measure">
          Authors may edit their own; managers may delete anyone&rsquo;s;
          everyone else in the organization reads only.
        </p>
      </div>

      <dl className="divide-y divide-[var(--color-rule)]">
        {rows.map(([term, value]) => (
          <div
            key={term}
            className="grid grid-cols-[104px_1fr] gap-4 items-center px-5 py-3"
          >
            <dt className="field-label">{term}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AccessPlan() {
  const matrix: [string, boolean, boolean, boolean][] = [
    ["Create and work tasks", true, true, true],
    ["Comment and attach files", true, true, true],
    ["Create and delete projects", false, true, true],
    ["Invite and remove members", false, true, true],
    ["Change a member's role", false, true, true],
    ["Grant ownership", false, false, true],
    ["Delete the organization", false, false, true],
  ];

  return (
    <section id="access" className="rule-t">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8 py-16 lg:py-24">
        <div className="max-w-[52ch]">
          <h2 className="display text-[clamp(1.9rem,3.6vw,2.75rem)]">
            Three roles. Enforced in the database, not the interface.
          </h2>
          <p className="mt-5 text-[15.5px] leading-[1.62] text-ink-2">
            Hiding a button is decoration. Every rule below is checked on the
            server, on every request, against the organization the record
            actually belongs to.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left border-collapse">
            <thead>
              <tr className="rule-b">
                <th className="field-label font-semibold py-3 pr-4 align-bottom">
                  Capability
                </th>
                {["Member", "Manager", "Owner"].map((r) => (
                  <th
                    key={r}
                    className="field-label font-semibold py-3 px-4 w-[104px] align-bottom"
                  >
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map(([cap, m, mg, o]) => (
                <tr key={cap} className="rule-b">
                  <td className="py-3.5 pr-4 text-[14px]">{cap}</td>
                  {[m, mg, o].map((allowed, i) => (
                    <td key={i} className="py-3.5 px-4">
                      {allowed ? (
                        <svg width="15" height="15" viewBox="0 0 16 16" aria-label="Allowed">
                          <path
                            d="M3 8.6l3.2 3.2L13 5"
                            fill="none"
                            stroke="var(--color-signal)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 16 16" aria-label="Not allowed">
                          <path
                            d="M3.5 8h9"
                            stroke="var(--color-rule-strong)"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function TheRecord() {
  const log: [string, string, string][] = [
    ["09:14", "Aisha Khan", "moved API-28 from To do to In progress"],
    ["09:02", "Marco Testa", "assigned API-31 to Priya Raman"],
    ["08:47", "Priya Raman", "raised API-28 from High to Urgent"],
    ["08:31", "Marco Testa", "commented on API-22"],
    ["—", "Scheduled sweep", "flagged API-17 overdue"],
  ];

  return (
    <section id="record" className="rule-t bg-plinth text-white">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <h2 className="display text-[clamp(1.9rem,3.6vw,2.75rem)]">
              Nothing moves without leaving a record.
            </h2>
            <p className="mt-5 text-[15.5px] leading-[1.62] text-white/62 max-w-[50ch]">
              Every status change, reassignment, priority bump and due-date
              edit writes one row: who, which field, from what, to what, and
              when. Filter it by person, by task, or by kind. It is append-only,
              so nobody can quietly rewrite last Tuesday.
            </p>
            <p className="mt-6 text-[13.5px] leading-[1.6] text-white/45 max-w-[50ch]">
              Assignment emails go out on a background worker, so the request
              that assigned the task returns immediately. An hourly job sweeps
              for anything past its due date.
            </p>
          </div>

          <div className="border border-white/12 bg-white/[0.03]">
            <div className="px-4 h-10 flex items-center border-b border-white/12">
              <span className="field-label !text-white/45">Activity</span>
              <span className="ml-auto font-mono text-[10.5px] text-white/35">
                today
              </span>
            </div>
            <ul className="divide-y divide-white/8">
              {log.map(([time, who, what], i) => (
                <li key={i} className="flex gap-3 px-4 py-3">
                  <span className="font-mono text-[11px] text-white/35 tnum w-10 shrink-0 pt-[3px]">
                    {time}
                  </span>
                  <p className="text-[13.5px] leading-[1.5] text-white/80">
                    <span className="text-white font-medium">{who}</span>{" "}
                    {what}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Close() {
  return (
    <section className="rule-t">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8 py-20 lg:py-28 text-center">
        <h2 className="display text-[clamp(2.1rem,5vw,3.4rem)] max-w-[20ch] mx-auto">
          Hang your first label in about a minute.
        </h2>
        <p className="mt-5 text-[16px] text-ink-2 max-w-[52ch] mx-auto leading-[1.6]">
          Create a workspace, invite the people who need it, and start
          tracking. You can delete the whole thing just as fast.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="no-underline bg-signal text-white h-12 px-7 inline-flex items-center text-[15px] font-medium rounded-[2px] border border-signal hover:bg-signal-ink hover:border-signal-ink transition-colors duration-150"
          >
            Start a workspace
          </Link>
          <a
            href="http://localhost:8000/api/docs/"
            className="no-underline h-12 px-7 inline-flex items-center text-[15px] font-medium rounded-[2px] border border-rule-strong hover:border-ink-3 hover:bg-paper-2 transition-colors duration-150"
          >
            Read the API docs
          </a>
        </div>
      </div>
    </section>
  );
}

function Colophon() {
  return (
    <footer className="rule-t bg-paper-2">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8 py-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Plaque />
          <span className="text-[13px] font-medium">TaskLane</span>
        </div>
        <p className="text-[12.5px] text-ink-3">
          Django · DRF · PostgreSQL · Celery · Next.js
        </p>
      </div>
    </footer>
  );
}
