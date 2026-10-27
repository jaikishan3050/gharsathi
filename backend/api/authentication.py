import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission

from .models import CustomerProfile, TechnicianProfile


class AuthenticatedPrincipal:
    """Small role-aware identity wrapper for the project's signed JWTs."""

    is_authenticated = True

    def __init__(self, role, profile):
        self.role = role
        self.profile = profile
        self.id = profile.pk
        self.phone = getattr(profile, 'phone', '')
        self.is_staff = role == 'admin' and bool(profile.is_staff or profile.is_superuser)


class GharSathiJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header = request.headers.get('Authorization', '')
        if not header:
            return None
        if not header.startswith('Bearer '):
            raise AuthenticationFailed('Use a Bearer authentication token.')

        token = header[7:].strip()
        if not token:
            raise AuthenticationFailed('Authentication token is missing.')

        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        except jwt.ExpiredSignatureError as exc:
            raise AuthenticationFailed('Session expired. Please log in again.') from exc
        except jwt.InvalidTokenError as exc:
            raise AuthenticationFailed('Invalid authentication token.') from exc

        role = payload.get('role')
        profile = None
        if role == 'admin':
            user_id = payload.get('user_id')
            if user_id:
                profile = get_user_model().objects.filter(pk=user_id, is_active=True, is_staff=True).first()
        elif role == 'technician':
            profile = TechnicianProfile.objects.filter(pk=payload.get('id')).first() if payload.get('id') else None
            if not profile and payload.get('phone'):
                phone = ''.join(filter(str.isdigit, str(payload['phone'])))[-10:]
                profile = TechnicianProfile.objects.filter(phone__endswith=phone).first()
        elif role == 'customer':
            profile = CustomerProfile.objects.filter(pk=payload.get('id')).first() if payload.get('id') else None
            if not profile and payload.get('phone'):
                phone = ''.join(filter(str.isdigit, str(payload['phone'])))[-10:]
                profile = CustomerProfile.objects.filter(phone__endswith=phone).first()

        if not profile:
            raise AuthenticationFailed('Account for this session was not found or is inactive.')
        return AuthenticatedPrincipal(role, profile), payload


class IsGharSathiAuthenticated(BasePermission):
    """DRF permission that requires a valid Ghar Sathi JWT identity."""
    def has_permission(self, request, view):
        return bool(getattr(request.user, 'is_authenticated', False))


class HasGharSathiRole:
    """Factory for role-specific DRF permissions."""
    @classmethod
    def for_roles(cls, *roles):
        class RolePermission(BasePermission):
            def has_permission(self, request, view):
                return getattr(request.user, 'role', None) in roles

        return RolePermission


IsGharSathiAdmin = HasGharSathiRole.for_roles('admin')
IsGharSathiCustomer = HasGharSathiRole.for_roles('customer')
IsGharSathiTechnician = HasGharSathiRole.for_roles('technician')
