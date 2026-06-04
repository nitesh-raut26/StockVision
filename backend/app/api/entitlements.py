"""Server-side plan entitlement enforcement.

Plan gating used to live only in the frontend (`src/components/ui/PlanGate.tsx`),
which means a free user could call premium endpoints directly and get the data —
a straight revenue leak. This module enforces the *same* hierarchy on the server.

Hierarchy mirrors the frontend exactly:
    free: 0, premium: 1, pro: 1, enterprise: 2

Usage (router- or route-level dependency):

    from app.api.entitlements import require_plan
    api_router.include_router(dcf.router, dependencies=[Depends(require_plan("premium"))])

The dependency layers on top of `get_current_user`, so an unauthenticated caller
gets 401 (from auth) and an under-entitled caller gets 403 with a structured body
the frontend can branch on (`detail.code == "plan_upgrade_required"`).
"""

from fastapi import Depends, HTTPException, status

from app.api.deps import get_current_user
from app.models.user import User

# Keep in lock-step with frontend PLAN_RANK in src/components/ui/PlanGate.tsx
PLAN_RANK: dict[str, int] = {"free": 0, "premium": 1, "pro": 1, "enterprise": 2}


def plan_rank(plan: str | None) -> int:
    """Numeric rank for a plan string; unknown/None → free (0)."""
    return PLAN_RANK.get((plan or "free").lower(), 0)


def require_plan(min_plan: str):
    """Build a dependency that allows the request only if the current user's
    plan rank is >= the required plan's rank.

    Returns the authenticated `User` so handlers can still depend on it.
    """
    required_rank = plan_rank(min_plan)

    async def _require_plan(current_user: User = Depends(get_current_user)) -> User:
        if plan_rank(current_user.plan) < required_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "plan_upgrade_required",
                    "message": f"This feature requires the {min_plan} plan.",
                    "required_plan": min_plan,
                    "current_plan": (current_user.plan or "free"),
                },
            )
        return current_user

    return _require_plan
