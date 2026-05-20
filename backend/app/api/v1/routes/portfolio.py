"""Portfolio routes — summary, holdings, goals, tax."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.portfolio import Portfolio, Holding, Goal
from app.schemas.portfolio import PortfolioSummary, TaxSummary, GoalCreate, GoalOut
from app.services.portfolio_service import get_portfolio_summary, get_tax_summary, get_goals

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/summary", response_model=PortfolioSummary)
async def summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_portfolio_summary(db, current_user.id)


@router.get("/tax", response_model=TaxSummary)
async def tax(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_tax_summary(db, current_user.id)


# ---- Goals ----

@router.get("/goals", response_model=list[GoalOut])
async def list_goals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_goals(db, current_user.id)


@router.post("/goals", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(
    body: GoalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date

    # Default allocation based on goal type
    allocations = {
        "retirement": [{"asset": "Equity", "pct": 60}, {"asset": "Debt", "pct": 30}, {"asset": "Gold", "pct": 10}],
        "education": [{"asset": "Equity", "pct": 70}, {"asset": "Debt", "pct": 20}, {"asset": "Gold", "pct": 10}],
        "home": [{"asset": "Equity", "pct": 50}, {"asset": "Debt", "pct": 40}, {"asset": "Gold", "pct": 10}],
        "emergency": [{"asset": "Liquid Funds", "pct": 70}, {"asset": "Debt", "pct": 30}],
        "custom": [{"asset": "Equity", "pct": 60}, {"asset": "Debt", "pct": 40}],
    }

    goal = Goal(
        user_id=current_user.id,
        name=body.name,
        goal_type=body.goal_type,
        target_amount=body.target_amount,
        target_date=body.target_date,
        monthly_sip=body.monthly_sip,
        current_corpus=0.0,
        suggested_allocation=allocations.get(body.goal_type, []),
    )
    db.add(goal)
    await db.flush()
    await db.refresh(goal)

    # Compute projection
    years_left = max((goal.target_date - date.today()).days / 365, 0.1)
    projected = goal.monthly_sip * 12 * years_left
    on_track = projected >= goal.target_amount

    return {
        "id": goal.id,
        "name": goal.name,
        "goal_type": goal.goal_type,
        "target_amount": goal.target_amount,
        "target_date": goal.target_date,
        "monthly_sip": goal.monthly_sip,
        "current_corpus": goal.current_corpus,
        "projected_corpus": round(projected, 2),
        "on_track": on_track,
        "completion_pct": 0.0,
        "suggested_allocation": goal.suggested_allocation,
    }


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == current_user.id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    await db.delete(goal)
