"""Two-sided referral reward ledger — codes, claims, fraud checks, milestones.

Replaces the old hardcoded mock. Rewards credit when a referred user *qualifies*
(first subscription) — `qualify_referral` is called server-side from the
subscription flow, never by the client (which would be a self-credit fraud vector).
"""

import re
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.portfolio import ReferralReward, ReferralCode
from app.models.user import User

REFERRER_REWARD_INR = 100   # credited to the referrer per qualified referral
REFERRED_REWARD_INR = 100   # welcome bonus credited to the referred user

# Bonus premium days granted to the referrer when they reach each milestone count.
MILESTONES = [
    {"target": 1, "reward": "₹100", "premium_days": 0},
    {"target": 3, "reward": "₹300", "premium_days": 0},
    {"target": 5, "reward": "₹500 + 1 month Premium", "premium_days": 30},
    {"target": 10, "reward": "₹1,500", "premium_days": 0},
]

_NON_ALNUM = re.compile(r"[^A-Z0-9]")
_CODE_FORMAT = re.compile(r"SV-[A-Z0-9]{1,4}-[A-Z0-9]{1,8}")


# ── Pure helpers (unit-tested, no DB) ─────────────────────────────────────────

def make_code(name: str | None, user_id: str) -> str:
    """Deterministic, unique-per-user referral code, e.g. SV-RAUT-1A2B."""
    name_part = _NON_ALNUM.sub("", (name or "USER").upper())[:4] or "USER"
    id_part = _NON_ALNUM.sub("", user_id.upper())[:5] or "00000"
    return f"SV-{name_part}-{id_part}"


def milestones_for(qualified_count: int) -> list[dict]:
    return [{**m, "achieved": qualified_count >= m["target"]} for m in MILESTONES]


def is_valid_code_format(code: str) -> bool:
    return bool(_CODE_FORMAT.fullmatch(code.strip().upper()))


def premium_days_at(qualified_count: int) -> int:
    """Milestone premium-day bonus granted exactly when the count hits a target."""
    return sum(m["premium_days"] for m in MILESTONES if m["target"] == qualified_count)


# ── DB operations ─────────────────────────────────────────────────────────────

async def get_or_create_code(db: AsyncSession, user: User) -> str:
    row = (await db.execute(select(ReferralCode).where(ReferralCode.user_id == user.id))).scalar_one_or_none()
    if row:
        return row.code
    code = make_code(user.name, user.id)
    db.add(ReferralCode(user_id=user.id, code=code))
    await db.commit()
    return code


async def referral_stats(db: AsyncSession, user: User) -> dict:
    code = await get_or_create_code(db, user)
    rows = (await db.execute(select(ReferralReward).where(ReferralReward.referrer_user_id == user.id))).scalars().all()
    qualified = [r for r in rows if r.status == "qualified"]
    return {
        "code": code,
        "invited": len(rows),
        "qualified": len(qualified),
        "earned_inr": sum(r.reward_inr for r in qualified),
        "pending_inr": REFERRER_REWARD_INR * sum(1 for r in rows if r.status == "pending"),
        "premium_days_earned": sum(r.reward_premium_days for r in qualified),
        "milestones": milestones_for(len(qualified)),
    }


async def claim_referral(db: AsyncSession, user: User, code: str) -> dict:
    code = code.strip().upper()
    if not is_valid_code_format(code):
        return {"ok": False, "error": "Invalid referral code format."}

    referrer_row = (await db.execute(select(ReferralCode).where(ReferralCode.code == code))).scalar_one_or_none()
    if not referrer_row:
        return {"ok": False, "error": "Referral code not found."}
    if referrer_row.user_id == user.id:
        return {"ok": False, "error": "You cannot use your own referral code."}

    already = (await db.execute(select(ReferralReward).where(ReferralReward.referred_user_id == user.id))).scalar_one_or_none()
    if already:
        return {"ok": False, "error": "You have already used a referral code."}

    db.add(ReferralReward(
        referrer_user_id=referrer_row.user_id,
        referred_user_id=user.id,
        code_used=code,
        status="pending",
    ))
    await db.commit()
    return {"ok": True, "message": "Referral applied! Rewards credit when you complete your first subscription."}


async def qualify_referral(db: AsyncSession, referred_user_id: str) -> dict:
    """Mark a referred user's referral qualified and credit both sides. Idempotent.
    Call from the subscription flow when the referred user first subscribes."""
    row = (await db.execute(select(ReferralReward).where(ReferralReward.referred_user_id == referred_user_id))).scalar_one_or_none()
    if not row or row.status == "qualified":
        return {"ok": False, "credited": 0}

    new_qualified_count = (await db.execute(
        select(func.count()).select_from(ReferralReward).where(
            ReferralReward.referrer_user_id == row.referrer_user_id,
            ReferralReward.status == "qualified",
        )
    )).scalar_one() + 1

    row.status = "qualified"
    row.reward_inr = REFERRER_REWARD_INR
    row.referred_reward_inr = REFERRED_REWARD_INR
    row.reward_premium_days = premium_days_at(new_qualified_count)
    row.qualified_at = datetime.now(timezone.utc)
    await db.commit()
    return {
        "ok": True,
        "referrer_inr": REFERRER_REWARD_INR,
        "referred_inr": REFERRED_REWARD_INR,
        "premium_days": row.reward_premium_days,
    }


async def fetch_referral_ledger(db: AsyncSession, user: User) -> list[dict]:
    rows = (await db.execute(
        select(ReferralReward).where(ReferralReward.referrer_user_id == user.id).order_by(ReferralReward.created_at.desc())
    )).scalars().all()
    return [
        {
            "id": r.id,
            "status": r.status,
            "reward_inr": r.reward_inr,
            "reward_premium_days": r.reward_premium_days,
            "code_used": r.code_used,
            "qualified_at": r.qualified_at.isoformat() if r.qualified_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
