"""Permission classes.

Two layers protect every endpoint and they do different jobs:

1. Queryset scoping (`get_queryset`) decides what *exists* for this user. This
   is the real security boundary -- it is what makes list endpoints safe, since
   `has_object_permission` is never called for a list.
2. Permission classes decide what this user may *do* with something they can
   already see.

Getting layer 1 wrong leaks data. Getting layer 2 wrong allows an unauthorised
write. Both matter.
"""

from rest_framework import permissions

from orgs.models import Membership, Role


def membership_for(user, organization_id):
    if not user or not user.is_authenticated or organization_id is None:
        return None
    return Membership.objects.filter(user=user, organization_id=organization_id).first()


def role_for(user, organization_id) -> str | None:
    membership = membership_for(user, organization_id)
    return membership.role if membership else None


def has_role_at_least(user, organization_id, minimum: str) -> bool:
    role = role_for(user, organization_id)
    return role is not None and Role.rank(role) >= Role.rank(minimum)


class RequiresAuthentication(permissions.BasePermission):
    """Base for every permission class in this project.

    Setting `permission_classes` on a view REPLACES DEFAULT_PERMISSION_CLASSES
    rather than adding to it. Without this base, a view that declares
    `permission_classes = [IsOrgMember]` silently drops IsAuthenticated, an
    anonymous request sails past has_permission (which defaults to True), and
    get_queryset() then crashes filtering on AnonymousUser -- a 500 where a 401
    belongs.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class IsOrgMember(RequiresAuthentication):
    """Object must belong to an organization the requester is a member of.

    Relies on the object exposing `organization_id` directly or via
    `get_organization_id()`.
    """

    message = "You are not a member of this organization."

    def has_object_permission(self, request, view, obj):
        org_id = _org_id_of(obj)
        return membership_for(request.user, org_id) is not None


class IsOrgMemberWriteManager(RequiresAuthentication):
    """Any member may read; manager or owner required to write."""

    message = "You need manager or owner rights in this organization."

    def has_object_permission(self, request, view, obj):
        org_id = _org_id_of(obj)
        if request.method in permissions.SAFE_METHODS:
            return membership_for(request.user, org_id) is not None
        return has_role_at_least(request.user, org_id, Role.MANAGER)


class IsOrgOwner(RequiresAuthentication):
    message = "Only an organization owner can do that."

    def has_object_permission(self, request, view, obj):
        return role_for(request.user, _org_id_of(obj)) == Role.OWNER


class IsAuthorOrOrgManagerOrReadOnly(RequiresAuthentication):
    """Comments: the author may edit or delete their own; managers may delete
    anyone's; everyone else in the org gets read-only."""

    message = "You can only edit your own comments."

    def has_object_permission(self, request, view, obj):
        org_id = _org_id_of(obj)
        if request.method in permissions.SAFE_METHODS:
            return membership_for(request.user, org_id) is not None
        if getattr(obj, "author_id", None) == request.user.id:
            return True
        if request.method == "DELETE":
            return has_role_at_least(request.user, org_id, Role.MANAGER)
        return False


class IsSelf(RequiresAuthentication):
    def has_object_permission(self, request, view, obj):
        return obj == request.user


def _org_id_of(obj):
    """Walk whatever relation this model uses to reach its organization."""
    if hasattr(obj, "get_organization_id"):
        return obj.get_organization_id()
    if hasattr(obj, "organization_id"):
        return obj.organization_id
    if hasattr(obj, "project"):
        return obj.project.organization_id
    if hasattr(obj, "task"):
        return obj.task.project.organization_id
    return getattr(obj, "id", None)
