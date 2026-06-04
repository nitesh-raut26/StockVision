"""Notification delivery channel interface.

Alerts used to be written to a `Notification` table and never delivered anywhere.
This package adds pluggable delivery channels (log, email, WhatsApp, …) so a fired
alert actually reaches the user. The Log channel is always enabled and doubles as a
guaranteed dev-time delivery + audit trail; richer channels self-enable when their
credentials are configured.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class NotificationMessage:
    user_id: str
    title: str
    body: str
    email: str | None = None
    phone: str | None = None
    category: str = "alert"
    meta: dict = field(default_factory=dict)


@dataclass
class DeliveryResult:
    channel: str
    ok: bool
    detail: str = ""


class NotificationChannel(ABC):
    name: str = "abstract"

    @property
    @abstractmethod
    def enabled(self) -> bool:
        """Whether this channel is configured and should be attempted."""

    @abstractmethod
    async def send(self, message: NotificationMessage) -> DeliveryResult:
        """Deliver one message. Must never raise — return a failed DeliveryResult."""
