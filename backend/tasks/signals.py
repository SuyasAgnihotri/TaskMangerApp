from django.db.models.signals import post_save
from django.dispatch import receiver

from tasks.models import ActivityLog, Comment


@receiver(post_save, sender=Comment)
def log_comment_activity(sender, instance, created, **kwargs):
    if created:
        ActivityLog.objects.create(
            task=instance.task,
            user=instance.author,
            action=ActivityLog.Action.COMMENT_ADDED,
            details={"comment_id": instance.id},
        )
