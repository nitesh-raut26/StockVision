"""Concrete notification channels. Each self-enables based on configuration.

  • LogChannel      — always on. Logs the notification (dev delivery + audit).
  • EmailChannel    — on when SENDGRID_API_KEY is set. SendGrid v3 mail/send.
  • WhatsAppChannel — on when WhatsApp Cloud API creds are set. Meta Graph API.

Real provider calls are fully implemented but only fire when configured, so the
worker delivers (to the log) in any environment and upgrades to real channels the
moment credentials land — no code change.

NOTE (India): WhatsApp free-text only reaches a user inside the 24-hour customer
service window; proactive alerts need a pre-approved template (DLT). That template
id plugs into `_template_payload` when approved — see task #12.
"""

import logging

import httpx

from app.core.config import settings
from app.services.notifications.base import DeliveryResult, NotificationChannel, NotificationMessage

logger = logging.getLogger(__name__)


class LogChannel(NotificationChannel):
    name = "log"

    @property
    def enabled(self) -> bool:
        return True

    async def send(self, message: NotificationMessage) -> DeliveryResult:
        logger.info(
            "[notify:log] user=%s | %s — %s", message.user_id, message.title, message.body
        )
        return DeliveryResult(self.name, True, "logged")


class EmailChannel(NotificationChannel):
    name = "email"

    @property
    def enabled(self) -> bool:
        return bool(settings.sendgrid_api_key)

    async def send(self, message: NotificationMessage) -> DeliveryResult:
        if not message.email:
            return DeliveryResult(self.name, False, "no recipient email")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers={"Authorization": f"Bearer {settings.sendgrid_api_key}"},
                    json={
                        "personalizations": [{"to": [{"email": message.email}]}],
                        "from": {"email": settings.from_email, "name": "StockVision"},
                        "subject": message.title,
                        "content": [{"type": "text/plain", "value": message.body}],
                    },
                )
            ok = resp.status_code in (200, 202)
            return DeliveryResult(self.name, ok, f"status {resp.status_code}")
        except Exception as exc:  # never raise — delivery is best-effort
            logger.warning("Email delivery failed: %s", exc)
            return DeliveryResult(self.name, False, str(exc))


class WhatsAppChannel(NotificationChannel):
    name = "whatsapp"

    @property
    def enabled(self) -> bool:
        return bool(settings.whatsapp_api_token and settings.whatsapp_phone_number_id)

    async def send(self, message: NotificationMessage) -> DeliveryResult:
        if not message.phone:
            return DeliveryResult(self.name, False, "no recipient phone")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"https://graph.facebook.com/v21.0/{settings.whatsapp_phone_number_id}/messages",
                    headers={"Authorization": f"Bearer {settings.whatsapp_api_token}"},
                    json={
                        "messaging_product": "whatsapp",
                        "to": message.phone,
                        "type": "text",
                        "text": {"body": f"{message.title}\n{message.body}"},
                    },
                )
            ok = resp.status_code == 200
            return DeliveryResult(self.name, ok, f"status {resp.status_code}")
        except Exception as exc:  # never raise — delivery is best-effort
            logger.warning("WhatsApp delivery failed: %s", exc)
            return DeliveryResult(self.name, False, str(exc))
