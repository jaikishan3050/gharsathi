import json
import logging
import re
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


def sanitize_group_name(name):
    """
    Sanitizes channel group name to contain only ASCII alphanumerics, hyphens, and underscores.
    """
    if not name:
        return 'all'
    clean = re.sub(r'[^a-zA-Z0-9_\-]', '_', str(name).strip().lower())
    return clean[:90] or 'all'


class JobDispatchConsumer(AsyncWebsocketConsumer):
    """
    Real-Time WebSocket Consumer for live job dispatch between customers and technicians.
    Technicians receive instant unassigned booking broadcasts without manual page refresh.
    """

    async def connect(self):
        self.broadcast_group = 'jobs_broadcast'
        self.area_group = None

        # Accept connection
        await self.accept()

        # Join global jobs broadcast group
        await self.channel_layer.group_add(self.broadcast_group, self.channel_name)

        # Check for area parameter in URL route
        url_area = self.scope.get('url_route', {}).get('kwargs', {}).get('area')
        if url_area:
            self.area_group = f"jobs_{sanitize_group_name(url_area)}"
            await self.channel_layer.group_add(self.area_group, self.channel_name)

        logger.info(f"WebSocket client connected to {self.broadcast_group} (area: {self.area_group})")

        # Send welcome handshake
        await self.send(text_data=json.dumps({
            'type': 'connected',
            'status': 'online',
            'message': 'Ghar Sathi Real-Time Live Dispatch WebSocket connected.',
            'area_group': self.area_group or 'all',
        }))

    async def disconnect(self, close_code):
        # Leave global broadcast group
        if hasattr(self, 'broadcast_group') and self.broadcast_group:
            await self.channel_layer.group_discard(self.broadcast_group, self.channel_name)

        # Leave area group if registered
        if hasattr(self, 'area_group') and self.area_group:
            await self.channel_layer.group_discard(self.area_group, self.channel_name)

        logger.info(f"WebSocket client disconnected (code: {close_code})")

    async def receive(self, text_data=None, bytes_data=None):
        """
        Handles incoming messages from the client (e.g. area subscriptions or ping-pong heartbeat).
        """
        if not text_data:
            return

        try:
            payload = json.loads(text_data)
        except Exception:
            return

        action = payload.get('action') or payload.get('type')

        if action == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong', 'timestamp': payload.get('timestamp')}))

        elif action in ('subscribe_area', 'set_area'):
            new_area = payload.get('area')
            if new_area:
                # Leave old area group if any
                if self.area_group:
                    await self.channel_layer.group_discard(self.area_group, self.channel_name)

                self.area_group = f"jobs_{sanitize_group_name(new_area)}"
                await self.channel_layer.group_add(self.area_group, self.channel_name)

                await self.send(text_data=json.dumps({
                    'type': 'area_subscribed',
                    'area': new_area,
                    'group': self.area_group,
                    'message': f"Subscribed to real-time job alerts for {new_area}.",
                }))

    # Channel Layer Event Handlers
    async def job_broadcast(self, event):
        """
        Sends newly created job broadcast to the WebSocket client.
        """
        await self.send(text_data=json.dumps(event.get('data', {})))

    async def job_update(self, event):
        """
        Sends booking status change updates to the WebSocket client.
        """
        await self.send(text_data=json.dumps(event.get('data', {})))

    async def job_alert(self, event):
        """
        Sends general job notification alerts.
        """
        await self.send(text_data=json.dumps(event.get('data', {})))
