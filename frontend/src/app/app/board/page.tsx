"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, Search, X } from "lucide-react";
import { PageHead } from "@/components/app/Shell";
import { TaskCard } from "@/components/app/TaskCard";
import { STATUS_COLOR } from "@/components/app/Charts";
import { NewTaskModal } from "@/components/app/NewTaskModal";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  type Paginated,
  type Project,
  type Task,
  type TaskStatus,
} from "@/lib/types";

export default function BoardPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <Board />
    </Suspense>
  );
}

function Board() {
  const { currentOrg } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const params = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragged, setDragged] = useState<Task | null>(null);
  const [creating, setCreating] = useState<TaskStatus | null>(null);

  const [search, setSearch] = useState(params.get("search") ?? "");
  const projectFilter = params.get("project") ?? "";
  const assigneeFilter = params.get("assignee") ?? "";
  const overdueOnly = params.get("overdue") === "true";
  const unassignedOnly = params.get("unassigned") === "true";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const fetchData = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const query = qs({
        organization: currentOrg.id,
        project: projectFilter || undefined,
        assignee: assigneeFilter || undefined,
        overdue: overdueOnly ? "true" : undefined,
        unassigned: unassignedOnly ? "true" : undefined,
        search: search || undefined,
        page_size: 100,
        ordering: "position",
      });
      const [taskPage, projectPage] = await Promise.all([
        api.get<Paginated<Task>>(`/tasks/${query}`),
        api.get<Paginated<Project>>(
          `/projects/?organization=${currentOrg.id}&page_size=100`,
        ),
      ]);
      setError(null);
      setTasks(taskPage.results);
      setProjects(projectPage.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the board.");
    } finally {
      setLoading(false);
    }
  }, [currentOrg, projectFilter, assigneeFilter, overdueOnly, unassignedOnly, search]);

  /** Manual refresh: unlike the mount fetch, this one shows the spinner
   *  straight away because the user just asked for it. */
  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    const timer = setTimeout(() => void fetchData(), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [fetchData, search]);

  const columns = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
    };
    for (const task of tasks) grouped[task.status]?.push(task);
    return grouped;
  }, [tasks]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/app/board?${next.toString()}`);
  }

  function onDragStart(event: DragStartEvent) {
    setDragged(tasks.find((t) => String(t.id) === event.active.id) ?? null);
  }

  async function onDragEnd(event: DragEndEvent) {
    const task = dragged;
    setDragged(null);
    if (!task || !event.over) return;

    const target = event.over.id as TaskStatus;
    if (target === task.status) return;

    const previous = tasks;
    setTasks((current) =>
      current.map((t) => (t.id === task.id ? { ...t, status: target } : t)),
    );

    try {
      const updated = await api.post<Task>(`/tasks/${task.id}/move/`, {
        status: target,
      });
      setTasks((current) =>
        current.map((t) => (t.id === task.id ? updated : t)),
      );
    } catch (err) {
      setTasks(previous);
      notify(
        err instanceof Error ? err.message : "Could not move that task.",
        "error",
      );
    }
  }

  const filtersActive =
    !!projectFilter || !!assigneeFilter || overdueOnly || unassignedOnly || !!search;

  if (!currentOrg) {
    return (
      <>
        <PageHead title="Board" />
        <EmptyState
          title="No organization selected"
          body="Create or join an organization before opening a board."
        />
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Board"
        meta={<span>{tasks.length} tasks</span>}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setCreating("todo")}
            disabled={projects.length === 0}
          >
            New task
          </Button>
        }
      />

      {/* Filters in one row above the board. */}
      <div className="px-5 sm:px-7 lg:px-8 py-3 rule-b bg-paper-2 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles and descriptions"
            className="!h-9 !pl-8 w-[min(19rem,60vw)] text-[13px]"
            aria-label="Search tasks"
          />
        </div>

        <Select
          value={projectFilter}
          onChange={(e) => setParam("project", e.target.value)}
          className="!h-9 !w-auto text-[13px]"
          aria-label="Filter by project"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.key} — {p.name}
            </option>
          ))}
        </Select>

        <FilterToggle
          active={overdueOnly}
          onClick={() => setParam("overdue", overdueOnly ? "" : "true")}
        >
          Overdue
        </FilterToggle>
        <FilterToggle
          active={unassignedOnly}
          onClick={() => setParam("unassigned", unassignedOnly ? "" : "true")}
        >
          Unassigned
        </FilterToggle>

        {filtersActive && (
          <button
            onClick={() => {
              setSearch("");
              router.replace("/app/board");
            }}
            className="inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink transition-colors ml-1"
          >
            <X size={13} />
            Clear
          </button>
        )}
      </div>

      {error ? (
        <ErrorState message={error} retry={refresh} />
      ) : loading && tasks.length === 0 ? (
        <BoardSkeleton />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body="A board shows the tasks inside your projects. Create a project first and the columns will fill up."
          action={
            <Button variant="primary" onClick={() => router.push("/app/projects")}>
              Go to projects
            </Button>
          }
        />
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-[repeat(4,minmax(260px,1fr))] min-w-[1080px] lg:min-w-0 divide-x divide-[var(--color-rule)] min-h-full">
              {STATUS_ORDER.map((status) => (
                <Column
                  key={status}
                  status={status}
                  tasks={columns[status]}
                  onAdd={() => setCreating(status)}
                  filtersActive={filtersActive}
                />
              ))}
            </div>
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.16,1,0.3,1)" }}>
            {dragged ? (
              <div className="w-[260px] rotate-[1.5deg]">
                <TaskCard task={dragged} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {creating && (
        <NewTaskModal
          open
          status={creating}
          projects={projects}
          defaultProject={projectFilter ? Number(projectFilter) : projects[0]?.id}
          onClose={() => setCreating(null)}
          onCreated={(task) => {
            setTasks((current) => [task, ...current]);
            setCreating(null);
            notify(`${task.reference} created.`);
          }}
        />
      )}
    </>
  );
}

function Column({
  status,
  tasks,
  onAdd,
  filtersActive,
}: {
  status: TaskStatus;
  tasks: Task[];
  onAdd: () => void;
  filtersActive: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={`flex flex-col min-w-0 transition-colors duration-150 ${
        isOver ? "bg-signal-wash" : ""
      }`}
    >
      <header className="flex items-center gap-2 px-3 h-11 rule-b sticky top-0 bg-paper z-10">
        <span
          aria-hidden
          className="w-[7px] h-[7px] rounded-full shrink-0"
          style={{ background: STATUS_COLOR[status] }}
        />
        <h2 className="text-[12.5px] font-semibold">{STATUS_LABEL[status]}</h2>
        <span className="font-mono text-[11px] text-ink-4 tnum">{tasks.length}</span>
        <button
          onClick={onAdd}
          className="ml-auto text-ink-4 hover:text-signal transition-colors p-1"
          aria-label={`Add a task to ${STATUS_LABEL[status]}`}
        >
          <Plus size={14} />
        </button>
      </header>

      <div className="flex-1 p-2 flex flex-col gap-2 bg-paper-2/40">
        {tasks.map((task) => (
          <DraggableCard key={task.id} task={task} />
        ))}

        {tasks.length === 0 && (
          <p className="text-[12.5px] text-ink-4 text-center px-3 py-8 leading-relaxed">
            {filtersActive
              ? "Nothing here matches your filters."
              : `Nothing in ${STATUS_LABEL[status].toLowerCase()}.`}
          </p>
        )}
      </div>
    </section>
  );
}

function DraggableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: String(task.id),
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-35" : ""}`}
    >
      <TaskCard task={task} />
    </div>
  );
}

function FilterToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 px-3 rounded-[2px] border text-[13px] transition-colors duration-150
        ${
          active
            ? "border-signal bg-signal-wash text-signal font-medium"
            : "border-rule-strong bg-paper text-ink-2 hover:border-ink-4"
        }`}
    >
      {children}
    </button>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(4,minmax(260px,1fr))] min-w-[1080px] lg:min-w-0 divide-x divide-[var(--color-rule)]">
      {Array.from({ length: 4 }).map((_, col) => (
        <div key={col} className="p-2 flex flex-col gap-2">
          <Skeleton className="h-7 w-full mb-1" />
          {Array.from({ length: 3 - (col % 2) }).map((_, i) => (
            <Skeleton key={i} className="h-[86px] w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
