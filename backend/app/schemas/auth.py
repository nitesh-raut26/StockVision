"""Pydantic schemas for authentication."""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List


class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, pattern=r"^\+?[1-9]\d{9,14}$")
    password: Optional[str] = Field(None, min_length=8)


class UserLogin(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    otp: Optional[str] = None


class OtpRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+?91\d{10}$")


class OtpVerify(BaseModel):
    phone: str
    otp: str = Field(..., min_length=4, max_length=8)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserOut"


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=32)
    password: str = Field(..., min_length=8)


class UpdateMeRequest(BaseModel):
    """Typed schema for PATCH /auth/me — prevents mass assignment."""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    language: Optional[str] = Field(None, pattern="^(en|hi|te|ta|mr)$")
    investing_style: Optional[str] = Field(None, pattern="^(beginner|intermediate|pro)$")
    risk_appetite: Optional[int] = Field(None, ge=1, le=10)
    sectors: Optional[List[str]] = None
    onboarding_completed: Optional[bool] = None


class UserOut(BaseModel):
    id: str
    name: str
    email: Optional[str]
    phone: Optional[str]
    plan: str
    language: str
    investing_style: Optional[str]
    risk_appetite: Optional[int]
    sectors: list[str]
    onboarding_completed: bool

    class Config:
        from_attributes = True
