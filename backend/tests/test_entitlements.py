"""Unit tests for server-side plan entitlements (no DB or network)."""

import pytest
from fastapi import HTTPException

from app.api.entitlements import plan_rank, require_plan
from app.models.user import User

pytestmark = pytest.mark.unit


def _user(plan):
    return User(plan=plan)


def test_plan_rank_mirrors_frontend_hierarchy():
    assert plan_rank("free") == 0
    assert plan_rank("premium") == 1
    assert plan_rank("pro") == 1
    assert plan_rank("enterprise") == 2
    # unknown / missing → treated as free
    assert plan_rank(None) == 0
    assert plan_rank("garbage") == 0


async def test_premium_required_blocks_free_user():
    dep = require_plan("premium")
    with pytest.raises(HTTPException) as exc_info:
        await dep(current_user=_user("free"))
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["code"] == "plan_upgrade_required"
    assert exc_info.value.detail["required_plan"] == "premium"
    assert exc_info.value.detail["current_plan"] == "free"


async def test_premium_required_allows_premium_and_above():
    dep = require_plan("premium")
    assert (await dep(current_user=_user("premium"))).plan == "premium"
    assert (await dep(current_user=_user("pro"))).plan == "pro"
    assert (await dep(current_user=_user("enterprise"))).plan == "enterprise"


async def test_enterprise_required_blocks_premium_user():
    dep = require_plan("enterprise")
    with pytest.raises(HTTPException) as exc_info:
        await dep(current_user=_user("premium"))
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["required_plan"] == "enterprise"


async def test_enterprise_required_allows_enterprise():
    dep = require_plan("enterprise")
    assert (await dep(current_user=_user("enterprise"))).plan == "enterprise"
