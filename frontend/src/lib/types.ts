export type Role = "owner" | "manager" | "member";
export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface UserMini {
  id: number;
  email: string;
  full_name: string;
  avatar_url: string;
  initials: string;
}

export interface User extends UserMini {
  date_joined: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  description: string;
  created_by: UserMini | null;
  my_role: Role | null;
  member_count: number;
  project_count: number;
  created_at: string;
}

export interface Membership {
  id: number;
  user: UserMini;
  role: Role;
  joined_at: string;
}

export interface Invitation {
  id: number;
  organization: number;
  organization_name: string;
  email: string;
  role: Role;
  invited_by: UserMini | null;
  accepted_at: string | null;
  expires_at: string;
  is_pending: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  organization: number;
  organization_name: string;
  name: string;
  slug: string;
  key: string;
  description: string;
  color: string;
  status: "active" | "archived";
  lead: UserMini | null;
  created_by: UserMini | null;
  task_count: number;
  open_task_count: number;
  done_task_count: number;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: number;
  organization: number;
  name: string;
  color: string;
  task_count?: number;
}

export interface Task {
  id: number;
  project: number;
  project_name: string;
  project_key: string;
  organization_id: number;
  number: number;
  reference: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: UserMini | null;
  created_by: UserMini | null;
  labels: Label[];
  due_date: string | null;
  position: number;
  overdue: boolean;
  comment_count: number;
  attachment_count: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  task: number;
  author: UserMini | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: number;
  task: number;
  file_url: string | null;
  original_name: string;
  content_type: string;
  size: number;
  uploaded_by: UserMini | null;
  created_at: string;
}

export interface ActivityEntry {
  id: number;
  task: number | null;
  task_title?: string;
  task_reference?: string | null;
  actor: UserMini | null;
  verb: string;
  field: string;
  old_value: string;
  new_value: string;
  created_at: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DashboardStats {
  organization: { id: number; name: string; slug: string };
  totals: {
    tasks: number;
    open: number;
    done: number;
    overdue: number;
    due_soon: number;
    unassigned: number;
    projects: number;
    members: number;
    completion_rate: number;
  };
  by_status: { status: TaskStatus; label: string; count: number }[];
  by_priority: { priority: TaskPriority; count: number }[];
  per_member: {
    user_id: number;
    role: Role;
    user__email: string;
    user__full_name: string;
    open_tasks: number;
    done_tasks: number;
    overdue_tasks: number;
  }[];
  per_project: {
    id: number;
    name: string;
    key: string;
    color: string;
    status: string;
    total_tasks: number;
    open_tasks: number;
    done_tasks: number;
    overdue_tasks: number;
  }[];
  recent_activity: {
    id: number;
    verb: string;
    field: string;
    old_value: string;
    new_value: string;
    created_at: string;
    task_id: number | null;
    task__title: string | null;
    actor__full_name: string | null;
    actor__email: string | null;
  }[];
  completion_trend: { day: string; count: number }[];
  generated_at: string;
  cached: boolean;
}

export const STATUS_ORDER: TaskStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "done",
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  member: "Member",
};
