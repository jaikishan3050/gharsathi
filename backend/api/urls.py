from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ServiceViewSet,
    TechnicianProfileViewSet,
    BookingViewSet,
    ComplaintViewSet,
    AdminWithdrawalViewSet,
    AdminAnalyticsView,
    ResetDemoView,
    SetupSuperuserView,
    RazorpayCreateOrderView,
    RazorpayVerifyPaymentView,
    CustomerProfileViewSet,
    SendOTPView,
    VerifyOTPView,
)

router = DefaultRouter()
router.register(r'services', ServiceViewSet, basename='service')
router.register(r'technicians', TechnicianProfileViewSet, basename='technician')
router.register(r'customers', CustomerProfileViewSet, basename='customer')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'complaints', ComplaintViewSet, basename='complaint')
router.register(r'admin/withdrawals', AdminWithdrawalViewSet, basename='admin-withdrawal')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/send-otp/', SendOTPView.as_view(), name='auth-send-otp'),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='auth-verify-otp'),
    path('payments/create-order/', RazorpayCreateOrderView.as_view(), name='razorpay-create-order'),
    path('payments/razorpay/create-order/', RazorpayCreateOrderView.as_view(), name='razorpay-create-order-alias'),
    path('payments/verify/', RazorpayVerifyPaymentView.as_view(), name='razorpay-verify'),
    path('payments/razorpay/verify/', RazorpayVerifyPaymentView.as_view(), name='razorpay-verify-alias'),
    path('admin/analytics/', AdminAnalyticsView.as_view(), name='admin-analytics'),
    path('admin/reset-demo/', ResetDemoView.as_view(), name='admin-reset-demo'),
    path('admin/setup-superuser/', SetupSuperuserView.as_view(), name='admin-setup-superuser'),
    path('auth/setup-admin/', SetupSuperuserView.as_view(), name='auth-setup-admin'),
]
