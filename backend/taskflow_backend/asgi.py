from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.urls import path

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "taskflow_backend.settings")

django_asgi_app = get_asgi_application()

from core.middleware import JWTAuthMiddleware  # noqa: E402
from tasks.consumers import BoardConsumer  # noqa: E402

websocket_urlpatterns = [
    path("ws/board/<int:board_id>", BoardConsumer.as_asgi()),
]

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
        ),
    }
)
