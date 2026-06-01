"""Unit tests for JWT creation, decoding, and token type enforcement."""

import pytest
from datetime import timedelta

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
    encrypt_field,
    decrypt_field,
)


class TestPasswordHashing:
    def test_hash_and_verify(self):
        hashed = hash_password("mypassword123")
        assert hashed != "mypassword123"
        assert verify_password("mypassword123", hashed)

    def test_wrong_password_fails(self):
        hashed = hash_password("correct")
        assert not verify_password("wrong", hashed)

    def test_hashes_are_unique(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2  # bcrypt uses random salt


class TestJWTTokens:
    def test_access_token_type(self):
        token = create_access_token("user-123")
        payload = decode_token(token)
        assert payload["sub"] == "user-123"
        assert payload["type"] == "access"

    def test_refresh_token_type(self):
        jti, token = create_refresh_token("user-456")
        payload = decode_token(token)
        assert payload["sub"] == "user-456"
        assert payload["type"] == "refresh"
        assert payload["jti"] == jti

    def test_expired_access_token_raises(self):
        token = create_access_token("user-789", expires_delta=timedelta(seconds=-1))
        with pytest.raises(ValueError, match="expired"):
            decode_token(token)

    def test_tampered_token_raises(self):
        token = create_access_token("user-abc")
        tampered = token[:-4] + "xxxx"
        with pytest.raises(ValueError):
            decode_token(tampered)

    def test_refresh_jti_is_unique(self):
        jti1, _ = create_refresh_token("user")
        jti2, _ = create_refresh_token("user")
        assert jti1 != jti2


class TestFieldEncryption:
    def test_none_passthrough(self):
        assert encrypt_field(None) is None
        assert decrypt_field(None) is None

    def test_empty_string_passthrough(self):
        assert encrypt_field("") == ""

    def test_no_key_returns_plaintext(self):
        # With no encryption key configured, value is returned as-is (with warning)
        result = encrypt_field("PAN123")
        assert result == "PAN123"

    def test_roundtrip_with_key(self, monkeypatch):
        from cryptography.fernet import Fernet
        key = Fernet.generate_key().decode()
        monkeypatch.setattr("app.core.config.settings.field_encryption_key", key)
        # Re-import to pick up new key
        import importlib
        import app.core.security as sec
        importlib.reload(sec)
        encrypted = sec.encrypt_field("ABCDE1234F")
        assert encrypted != "ABCDE1234F"
        decrypted = sec.decrypt_field(encrypted)
        assert decrypted == "ABCDE1234F"
