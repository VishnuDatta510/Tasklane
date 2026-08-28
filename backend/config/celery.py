import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("tasklane")

app.config_from_object("django.conf:settings", namespace="CELERY")

app.autodiscover_tasks()
app.autodiscover_tasks(related_name="celery_tasks")

app.conf.beat_schedule = {
    "flag-overdue-tasks-hourly": {
        "task": "tasks.celery_tasks.flag_overdue_tasks",
        "schedule": crontab(minute=0),
    },
    "daily-digest": {
        "task": "tasks.celery_tasks.send_daily_digest",
        "schedule": crontab(hour=8, minute=0),
    },
}


@app.task(bind=True)
def debug_task(self):
    return f"request: {self.request!r}"
