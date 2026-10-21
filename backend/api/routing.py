from django.urls import path, re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^ws/jobs/(?P<area>[\w\-]+)/?$', consumers.JobDispatchConsumer.as_asgi()),
    re_path(r'^ws/jobs/?$', consumers.JobDispatchConsumer.as_asgi()),
    path('ws/jobs/', consumers.JobDispatchConsumer.as_asgi()),
    path('ws/jobs/<str:area>/', consumers.JobDispatchConsumer.as_asgi()),
]
