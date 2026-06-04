"""Notification dispatch — fan a message out to every enabled channel.

The Log channel is always present, so `dispatch()` always produces at least one
(audit) delivery; Email/WhatsApp join automatically once their creds are set.
"""

from app.services.notifications.base import (
    DeliveryResult,
    NotificationChannel,
    NotificationMessage,
)
from app.services.notifications.channels import EmailChannel, LogChannel, WhatsAppChannel

# Instantiated once; `enabled` is evaluated live per-send against settings.
_ALL_CHANNELS: list[NotificationChannel] = [LogChannel(), EmailChannel(), WhatsAppChannel()]


def active_channels() -> list[NotificationChannel]:
    return [c for c in _ALL_CHANNELS if c.enabled]


async def dispatch(message: NotificationMessage) -> list[DeliveryResult]:
    """Send `message` via every enabled channel; collect per-channel results."""
    results: list[DeliveryResult] = []
    for channel in active_channels():
        results.append(await channel.send(message))
    return results


__all__ = [
    "NotificationChannel",
    "NotificationMessage",
    "DeliveryResult",
    "LogChannel",
    "EmailChannel",
    "WhatsAppChannel",
    "active_channels",
    "dispatch",
]
