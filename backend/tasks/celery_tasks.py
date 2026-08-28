"""Background jobs.

Every task takes IDs rather than model instances. Instances would have to be
pickled, would go stale between queueing and execution, and would break the
json-only serializer we configured.

Every task is written to be safe to run twice: CELERY_TASK_ACKS_LATE means a
worker crash causes redelivery.
"""

import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=5,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=5,
)
def send_assignment_email_task(self, task_id: int, assignee_id: int, actor_id: int | None):
    from django.contrib.auth import get_user_model

    from .models import Task

    User = get_user_model()

    task = (
        Task.objects.select_related("project", "project__organization").filter(pk=task_id).first()
    )
    assignee = User.objects.filter(pk=assignee_id).first()

    if task is None or assignee is None:
        logger.info(
            "Skipping assignment email: task=%s assignee=%s no longer exist",
            task_id,
            assignee_id,
        )
        return "skipped"

    actor = User.objects.filter(pk=actor_id).first() if actor_id else None
    actor_name = actor.get_full_name() if actor else "Someone"
    url = f"{settings.FRONTEND_URL}/app/tasks/{task.id}"

    send_mail(
        subject=f"[{task.reference}] {actor_name} assigned you a task",
        message=(
            f'{actor_name} assigned you "{task.title}" in '
            f"{task.project.name} ({task.project.organization.name}).\n\n"
            f"Priority: {task.get_priority_display()}\n"
            f"Due: {task.due_date or 'no due date'}\n\n"
            f"Open it: {url}\n"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[assignee.email],
        fail_silently=False,
    )
    logger.info("Assignment email sent for task %s to %s", task_id, assignee.email)
    return "sent"


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=5,
    max_retries=3,
)
def send_invitation_email_task(self, invitation_id: int):
    from orgs.models import Invitation

    invitation = (
        Invitation.objects.select_related("organization", "invited_by")
        .filter(pk=invitation_id)
        .first()
    )
    if invitation is None:
        return "skipped"

    inviter = invitation.invited_by.get_full_name() if invitation.invited_by else "Someone"
    url = f"{settings.FRONTEND_URL}/invite/{invitation.token}"

    send_mail(
        subject=f"{inviter} invited you to {invitation.organization.name}",
        message=(
            f"{inviter} invited you to join {invitation.organization.name} "
            f"as a {invitation.get_role_display().lower()}.\n\n"
            f"Accept: {url}\n\n"
            f"This link expires on {invitation.expires_at:%d %b %Y}.\n"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitation.email],
        fail_silently=False,
    )
    return "sent"


@shared_task
def flag_overdue_tasks():
    """Scheduled job: mark tasks whose due date has passed.

    Idempotent -- it only touches rows whose is_overdue flag disagrees with
    reality, so running it twice in a row is a no-op the second time.
    """
    from .models import ActivityLog, Task, TaskStatus

    today = timezone.localdate()
    open_statuses = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW]

    newly_overdue = list(
        Task.objects.filter(
            due_date__lt=today, status__in=open_statuses, is_overdue=False
        ).select_related("project")
    )

    with transaction.atomic():
        if newly_overdue:
            Task.objects.filter(id__in=[t.id for t in newly_overdue]).update(is_overdue=True)
            ActivityLog.objects.bulk_create(
                [
                    ActivityLog(
                        organization_id=t.project.organization_id,
                        task=t,
                        actor=None,
                        verb=ActivityLog.Verb.OVERDUE_FLAGGED,
                        field="due_date",
                        new_value=str(t.due_date),
                    )
                    for t in newly_overdue
                ]
            )

        cleared = (
            Task.objects.filter(is_overdue=True)
            .exclude(due_date__lt=today, status__in=open_statuses)
            .update(is_overdue=False)
        )

    logger.info("Overdue sweep: flagged %s, cleared %s", len(newly_overdue), cleared)
    return {"flagged": len(newly_overdue), "cleared": cleared}


@shared_task
def send_daily_digest():
    """Optional daily summary of what each user has open and overdue."""
    from django.contrib.auth import get_user_model

    from .models import Task, TaskStatus

    User = get_user_model()
    today = timezone.localdate()
    sent = 0

    for user in User.objects.filter(is_active=True):
        open_tasks = Task.objects.filter(assignee=user).exclude(status=TaskStatus.DONE)
        overdue = open_tasks.filter(due_date__lt=today).count()
        total = open_tasks.count()
        if total == 0:
            continue
        send_mail(
            subject=f"Your day: {total} open, {overdue} overdue",
            message=(
                f"You have {total} open task(s), {overdue} of them overdue.\n\n"
                f"{settings.FRONTEND_URL}/app\n"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
        sent += 1
    return {"digests_sent": sent}
