"""Structured (JSON) logging + per-request correlation IDs.

Every log line carries a `request_id` so a single request can be traced end-to-end
(and correlated with Sentry events). JSON output is ready for log aggregation
(Loki/Datadog/CloudWatch) without a parsing step.
"""

import json
import logging
from contextvars import ContextVar

# Set by RequestIDMiddleware for the duration of each request.
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get("")
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": getattr(record, "request_id", ""),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


_configured = False


def configure_logging(level: str = "INFO") -> None:
    """Install the JSON formatter + request-id filter on the root logger. Idempotent."""
    global _configured  # noqa: PLW0603
    if _configured:
        return

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    handler.addFilter(RequestIdFilter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # yfinance is noisy; keep it quiet regardless of root level.
    logging.getLogger("yfinance").setLevel(logging.CRITICAL)
    _configured = True
