"""Populate the database with a believable demo organization.

    python manage.py seed_demo
    python manage.py seed_demo --reset   # wipe the demo org first

All content is synthetic. Every account uses the same password so the demo is
easy to walk through: see PASSWORD below.
"""

import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from orgs.models import Membership, Organization, Role
from projects.models import Project
from tasks.models import (
    ActivityLog,
    Comment,
    Label,
    Task,
    TaskPriority,
    TaskStatus,
)

User = get_user_model()

PASSWORD = "tracker-demo-2026"

PEOPLE = [
    ("aisha@example.com", "Aisha Khan", Role.OWNER),
    ("marco@example.com", "Marco Testa", Role.MANAGER),
    ("priya@example.com", "Priya Raman", Role.MANAGER),
    ("jonas@example.com", "Jonas Weber", Role.MEMBER),
    ("lena@example.com", "Lena Fischer", Role.MEMBER),
    ("sam@example.com", "Sam Okafor", Role.MEMBER),
]

LABELS = [
    ("backend", "#1b3bef"),
    ("frontend", "#6b3fc4"),
    ("security", "#c62828"),
    ("perf", "#b4690e"),
    ("infra", "#1a7f52"),
    ("docs", "#6f7684"),
]

PROJECTS = [
    (
        "TaskLane API",
        "API",
        "The Django + DRF backend: auth, permissions, activity log.",
        "#1b3bef",
    ),
    ("Web Client", "WEB", "The Next.js frontend, board, and dashboard surfaces.", "#6b3fc4"),
    ("Platform", "OPS", "Docker, CI, deployment, and observability.", "#1a7f52"),
]

TASKS = {
    "API": [
        (
            "Object-level permissions on comments",
            TaskStatus.IN_PROGRESS,
            TaskPriority.URGENT,
            ["backend", "security"],
        ),
        ("Rate-limit the invitation endpoint", TaskStatus.TODO, TaskPriority.HIGH, ["security"]),
        (
            "Cache the dashboard aggregate",
            TaskStatus.IN_REVIEW,
            TaskPriority.HIGH,
            ["perf", "backend"],
        ),
        ("Swap username auth for email", TaskStatus.DONE, TaskPriority.MEDIUM, ["backend"]),
        (
            "Backfill activity rows for legacy tasks",
            TaskStatus.TODO,
            TaskPriority.MEDIUM,
            ["backend"],
        ),
        (
            "Return 404 instead of 403 for foreign objects",
            TaskStatus.DONE,
            TaskPriority.HIGH,
            ["security"],
        ),
        ("Paginate the activity feed", TaskStatus.TODO, TaskPriority.LOW, ["backend"]),
        (
            "Validate attachment content types",
            TaskStatus.DONE,
            TaskPriority.HIGH,
            ["security", "backend"],
        ),
        ("Add select_related to the task list", TaskStatus.DONE, TaskPriority.MEDIUM, ["perf"]),
    ],
    "WEB": [
        (
            "Board drag-and-drop between columns",
            TaskStatus.IN_PROGRESS,
            TaskPriority.HIGH,
            ["frontend"],
        ),
        (
            "Silent token refresh on 401",
            TaskStatus.DONE,
            TaskPriority.URGENT,
            ["frontend", "security"],
        ),
        (
            "Empty states for every list surface",
            TaskStatus.IN_REVIEW,
            TaskPriority.MEDIUM,
            ["frontend"],
        ),
        ("Keyboard shortcuts for the board", TaskStatus.TODO, TaskPriority.LOW, ["frontend"]),
        (
            "Task detail: comments and attachments",
            TaskStatus.IN_PROGRESS,
            TaskPriority.HIGH,
            ["frontend"],
        ),
        ("Mobile layout for the side rail", TaskStatus.TODO, TaskPriority.MEDIUM, ["frontend"]),
        ("Skeletons instead of spinners", TaskStatus.DONE, TaskPriority.LOW, ["frontend"]),
    ],
    "OPS": [
        ("Compose file for the full stack", TaskStatus.DONE, TaskPriority.HIGH, ["infra"]),
        (
            "GitHub Actions: lint, migrate check, tests",
            TaskStatus.IN_PROGRESS,
            TaskPriority.HIGH,
            ["infra"],
        ),
        ("Celery beat schedule for overdue sweep", TaskStatus.DONE, TaskPriority.MEDIUM, ["infra"]),
        ("Write the deployment runbook", TaskStatus.TODO, TaskPriority.MEDIUM, ["docs", "infra"]),
        ("Alert when the worker queue backs up", TaskStatus.TODO, TaskPriority.LOW, ["infra"]),
    ],
}

COMMENTS = [
    "Pushed a first pass — the permission class is in place but the list endpoint still needs scoping.",
    "Confirmed on staging. The 404 path is what we want; a 403 would leak that the row exists.",
    "This is blocked on the migration landing first.",
    "Nice catch. I'd rather validate this in the serializer than the view.",
    "Query count dropped from 51 to 4 after the prefetch. Screenshot attached.",
    "Can we split this? The second half is really its own task.",
]


class Command(BaseCommand):
    help = "Create a demo organization with projects, tasks, comments and activity."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete the existing demo organization before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        rng = random.Random(20260828)

        if options["reset"]:
            deleted, _ = Organization.objects.filter(slug="northwind-labs").delete()
            self.stdout.write(f"Removed existing demo data ({deleted} rows).")

        if Organization.objects.filter(slug="northwind-labs").exists():
            self.stdout.write(
                self.style.WARNING(
                    "Demo organization already exists. Re-run with --reset to rebuild it."
                )
            )
            return

        users = {}
        for email, name, _role in PEOPLE:
            user, created = User.objects.get_or_create(email=email, defaults={"full_name": name})
            if created:
                user.set_password(PASSWORD)
                user.save(update_fields=["password"])
            users[email] = user

        org = Organization.objects.create(
            name="Northwind Labs",
            slug="northwind-labs",
            description="A six-person product team shipping a work tracker.",
            created_by=users["aisha@example.com"],
        )
        for email, _name, role in PEOPLE:
            Membership.objects.create(organization=org, user=users[email], role=role)

        labels = {
            name: Label.objects.create(organization=org, name=name, color=color)
            for name, color in LABELS
        }

        members = list(users.values())
        today = timezone.localdate()
        now = timezone.now()
        created_tasks = []

        for name, key, description, color in PROJECTS:
            project = Project.objects.create(
                organization=org,
                name=name,
                key=key,
                description=description,
                color=color,
                lead=rng.choice(members),
                created_by=users["aisha@example.com"],
            )

            for index, (title, status, priority, label_names) in enumerate(TASKS[key]):
                assignee = rng.choice(members + [None])
                offset = rng.choice([-9, -4, -1, 0, 2, 5, 11, 21, None])
                due = today + timedelta(days=offset) if offset is not None else None

                task = Task.objects.create(
                    project=project,
                    title=title,
                    description=(
                        f"{description}\n\nOpened while working through the "
                        f"{name.lower()} milestone."
                    ),
                    status=status,
                    priority=priority,
                    assignee=assignee,
                    created_by=rng.choice(members),
                    due_date=due,
                    position=index,
                )
                task.labels.set([labels[n] for n in label_names])
                created_tasks.append(task)

                ActivityLog.objects.create(
                    organization=org,
                    task=task,
                    actor=task.created_by,
                    verb=ActivityLog.Verb.CREATED,
                    new_value=task.title[:255],
                    created_at=now - timedelta(hours=rng.randint(6, 400)),
                )
                if status != TaskStatus.TODO:
                    ActivityLog.objects.create(
                        organization=org,
                        task=task,
                        actor=rng.choice(members),
                        verb=ActivityLog.Verb.STATUS_CHANGED,
                        field="status",
                        old_value="todo",
                        new_value=status,
                        created_at=now - timedelta(hours=rng.randint(1, 200)),
                    )
                if assignee:
                    ActivityLog.objects.create(
                        organization=org,
                        task=task,
                        actor=rng.choice(members),
                        verb=ActivityLog.Verb.REASSIGNED,
                        field="assignee",
                        new_value=assignee.get_full_name(),
                        created_at=now - timedelta(hours=rng.randint(1, 180)),
                    )

        for task in rng.sample(created_tasks, k=12):
            for body in rng.sample(COMMENTS, k=rng.randint(1, 3)):
                Comment.objects.create(task=task, author=rng.choice(members), body=body)

        for task in Task.objects.filter(status=TaskStatus.DONE):
            Task.objects.filter(pk=task.pk).update(
                completed_at=now - timedelta(days=rng.randint(0, 25))
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nSeeded '{org.name}': {len(PROJECTS)} projects, "
                f"{len(created_tasks)} tasks, {len(PEOPLE)} people.\n"
            )
        )
        self.stdout.write("Sign in with any of these:\n")
        for email, name, role in PEOPLE:
            self.stdout.write(f"  {email:<24} {role:<9} {name}")
        self.stdout.write(f"\nPassword for all of them: {PASSWORD}\n")
