import factory
from django.contrib.auth import get_user_model
from factory.django import DjangoModelFactory

from orgs.models import Membership, Organization, Role
from projects.models import Project
from tasks.models import Comment, Label, Task, TaskPriority, TaskStatus

User = get_user_model()


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"person{n}@example.com")
    full_name = factory.Sequence(lambda n: f"Person {n}")

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):
        if not create:
            return
        obj.set_password(extracted or "test-password-9271")
        obj.save(update_fields=["password"])


class OrganizationFactory(DjangoModelFactory):
    class Meta:
        model = Organization

    name = factory.Sequence(lambda n: f"Organization {n}")
    created_by = factory.SubFactory(UserFactory)


class MembershipFactory(DjangoModelFactory):
    class Meta:
        model = Membership

    organization = factory.SubFactory(OrganizationFactory)
    user = factory.SubFactory(UserFactory)
    role = Role.MEMBER


class ProjectFactory(DjangoModelFactory):
    class Meta:
        model = Project

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f"Project {n}")
    key = factory.Sequence(lambda n: f"PR{n}")
    created_by = factory.SubFactory(UserFactory)


class LabelFactory(DjangoModelFactory):
    class Meta:
        model = Label

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f"label-{n}")
    color = "#1b3bef"


class TaskFactory(DjangoModelFactory):
    class Meta:
        model = Task

    project = factory.SubFactory(ProjectFactory)
    title = factory.Sequence(lambda n: f"Task number {n}")
    status = TaskStatus.TODO
    priority = TaskPriority.MEDIUM
    created_by = factory.SubFactory(UserFactory)


class CommentFactory(DjangoModelFactory):
    class Meta:
        model = Comment

    task = factory.SubFactory(TaskFactory)
    author = factory.SubFactory(UserFactory)
    body = "A comment body."
