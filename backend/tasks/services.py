"""Activity logging.

Written as explicit calls from the view layer rather than as post_save
signals. Signals would fire for fixtures, data migrations and admin edits,
would need to reconstruct "who did this" out of thin air, and would hide the
write from anyone reading the view. Explicit is slower to type and much easier
to reason about.
"""

from .models import ActivityLog, Task

TRACKED_FIELDS = {
    "status": ActivityLog.Verb.STATUS_CHANGED,
    "assignee_id": ActivityLog.Verb.REASSIGNED,
    "priority": ActivityLog.Verb.PRIORITY_CHANGED,
    "due_date": ActivityLog.Verb.DUE_DATE_CHANGED,
}


def snapshot(task: Task) -> dict:
    """Capture the tracked fields before a write."""
    return {field: getattr(task, field) for field in TRACKED_FIELDS}


def _display(field: str, value):
    if value is None or value == "":
        return ""
    if field == "assignee_id":
        from django.contrib.auth import get_user_model

        user = get_user_model().objects.filter(pk=value).first()
        return user.get_full_name() if user else str(value)
    return str(value)


def log_changes(task: Task, before: dict, actor) -> list[ActivityLog]:
    """Diff a snapshot against the saved task and write one row per change."""
    entries = []
    for field, verb in TRACKED_FIELDS.items():
        old = before.get(field)
        new = getattr(task, field)
        if old == new:
            continue
        entries.append(
            ActivityLog(
                organization_id=task.project.organization_id,
                task=task,
                actor=actor if actor and actor.is_authenticated else None,
                verb=verb,
                field=field.removesuffix("_id"),
                old_value=_display(field, old)[:255],
                new_value=_display(field, new)[:255],
            )
        )
    if entries:
        ActivityLog.objects.bulk_create(entries)
    return entries


def log_simple(task: Task, actor, verb: str, new_value: str = "") -> ActivityLog:
    return ActivityLog.objects.create(
        organization_id=task.project.organization_id,
        task=task,
        actor=actor if actor and actor.is_authenticated else None,
        verb=verb,
        new_value=new_value[:255],
    )
