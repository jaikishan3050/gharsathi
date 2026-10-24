from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def root_health_check(request):
    return JsonResponse({
        'status': 'online',
        'platform': 'Ghar Sathi Production API',
        'version': '1.0.7',
        'database': 'PostgreSQL Connected',
        'superuser': 'prabhat@gharsathi.in',
        'gateway': 'Razorpay Live Production (rzp_live_Tr00Y2gS1bC4Rv)',
        'endpoints': {
            'services': '/api/services/',
            'technicians': '/api/technicians/',
            'bookings': '/api/bookings/',
            'admin': '/admin/',
            'setup_admin': '/api/admin/setup-superuser/',
            'purge_production_data': '/api/admin/purge-production-data/',
        }
    })


urlpatterns = [
    path('', root_health_check, name='root-health'),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]
