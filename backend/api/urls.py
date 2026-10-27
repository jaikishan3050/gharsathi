from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ServiceViewSet,
    SubServiceViewSet,
    TechnicianProfileViewSet,
    BookingViewSet,
    ComplaintViewSet,
    AdminWithdrawalViewSet,
    AdminAnalyticsView,
    ResetDemoView,
    SetupSuperuserView,
    PurgeProductionDataView,
    RazorpayCreateOrderView,
    RazorpayVerifyPaymentView,
    CustomerProfileViewSet,
    SendOTPView,
    VerifyOTPView,
    LoginView,
    AuthMeView,
    TechnicianForgotPasswordView,
    TechnicianResetPasswordView,
)

router = DefaultRouter()
router.register(r'services', ServiceViewSet, basename='service')
router.register(r'subservices', SubServiceViewSet, basename='subservice')
router.register(r'technicians', TechnicianProfileViewSet, basename='technician')
router.register(r'customers', CustomerProfileViewSet, basename='customer')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'complaints', ComplaintViewSet, basename='complaint')
router.register(r'admin/withdrawals', AdminWithdrawalViewSet, basename='admin-withdrawal')

urlpatterns = [
    # Specific technician auth endpoints MUST precede router.urls to avoid slug/pk clash
    path('technicians/send-otp/', SendOTPView.as_view(), name='technician-send-otp'),
    path('technicians/verify-otp/', VerifyOTPView.as_view(), name='technician-verify-otp'),
    path('technicians/forgot-password/', TechnicianForgotPasswordView.as_view(), name='technician-forgot-password'),
    path('technicians/reset-password-otp/', TechnicianResetPasswordView.as_view(), name='technician-reset-password-otp'),
    path('technicians/login/', LoginView.as_view(), name='technician-login'),

    # Auth aliases for bulletproof routing
    path('auth/technicians/forgot-password/', TechnicianForgotPasswordView.as_view(), name='auth-technician-forgot-password'),
    path('auth/technicians/reset-password-otp/', TechnicianResetPasswordView.as_view(), name='auth-technician-reset-password-otp'),
    path('auth/forgot-password/', TechnicianForgotPasswordView.as_view(), name='auth-forgot-password'),
    path('auth/reset-password-otp/', TechnicianResetPasswordView.as_view(), name='auth-reset-password-otp'),

    # General Auth Endpoints
    path('auth/send-otp/', SendOTPView.as_view(), name='auth-send-otp'),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='auth-verify-otp'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/me/', AuthMeView.as_view(), name='auth-me'),
    path('auth/setup-admin/', SetupSuperuserView.as_view(), name='auth-setup-admin'),

    # Payments Endpoints
    path('payments/create-order/', RazorpayCreateOrderView.as_view(), name='razorpay-create-order'),
    path('payments/razorpay/create-order/', RazorpayCreateOrderView.as_view(), name='razorpay-create-order-alias'),
    path('payments/verify/', RazorpayVerifyPaymentView.as_view(), name='razorpay-verify'),
    path('payments/razorpay/verify/', RazorpayVerifyPaymentView.as_view(), name='razorpay-verify-alias'),

    # Admin Management & Analytics Endpoints
    path('admin/analytics/', AdminAnalyticsView.as_view(), name='admin-analytics'),
    path('admin/reset-demo/', ResetDemoView.as_view(), name='admin-reset-demo'),
    path('admin/setup-superuser/', SetupSuperuserView.as_view(), name='admin-setup-superuser'),
    path('admin/purge-production-data/', PurgeProductionDataView.as_view(), name='admin-purge-production-data'),

    # Router ViewSets
    path('', include(router.urls)),
]
