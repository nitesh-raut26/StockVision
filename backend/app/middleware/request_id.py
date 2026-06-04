"""Per-request correlation IDs.

Reads an inbound `X-Request-ID` (e.g. from a load balancer) or generates one, makes
it available to every log line via `request_id_ctx`, and echoes it back on the
response so clients/proxies can correlate.
"""

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.logging_config import request_id_ctx


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        token = request_id_ctx.set(rid)
        try:
            response = await call_next(request)
        finally:
            request_id_ctx.reset(token)
        response.headers["X-Request-ID"] = rid
        return response
