"""Thin wrappers that queue Celery tasks.

Views call these instead of importing the Celery tasks directly, so that a
view never has to care whether the work is queued or run inline (as it is in
tests, where CELERY_TASK_ALWAYS_EAGER is on).
"""

from .celery_tasks import send_assignment_email_task, send_invitation_email_task


def send_assignment_email(task_id: int, assignee_id: int, actor_id: int | None):
    send_assignment_email_task.delay(task_id, assignee_id, actor_id)


def send_invitation_email(invitation_id: int):
    send_invitation_email_task.delay(invitation_id)
