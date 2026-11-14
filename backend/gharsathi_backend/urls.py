from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings
from django.db import connection, DatabaseError
from django.views.decorators.cache import never_cache


@never_cache
def root_health_check(request):
    healthy = True
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            healthy = cursor.fetchone()[0] == 1
    except DatabaseError:
        healthy = False
    return JsonResponse({
        'status': 'online' if healthy else 'unavailable',
        'platform': 'Ghar Sathi Production API',
        'version': '1.0.9',
        'database': 'connected' if healthy else 'unavailable',
        'commit': settings.DEPLOYMENT_COMMIT or None,
        'endpoints': {
            'services': '/api/services/',
            'technicians': '/api/technicians/',
            'bookings': '/api/bookings/',
            'admin': '/admin/',
        }
    }, status=200 if healthy else 503)


urlpatterns = [
    path('', root_health_check, name='root-health'),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]
