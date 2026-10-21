from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def root_health_check(request):
    return JsonResponse({
        'status': 'online',
        'platform': 'Ghar Sathi Production API',
        'version': '1.0.0',
        'database': 'PostgreSQL Connected',
        'endpoints': {
            'services': '/api/services/',
            'technicians': '/api/technicians/',
            'bookings': '/api/bookings/',
            'admin': '/admin/',
        }
    })


urlpatterns = [
    path('', root_health_check, name='root-health'),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]
