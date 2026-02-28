"""Firebase Admin SDK initialization and auth verification."""

import firebase_admin
from firebase_admin import auth, credentials
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import get_settings

settings = get_settings()

# Initialize Firebase Admin SDK only once
_firebase_app = None


def init_firebase():
    """Initialize Firebase Admin SDK."""
    global _firebase_app
    if _firebase_app is None:
        try:
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            _firebase_app = firebase_admin.initialize_app(cred)
        except (FileNotFoundError, ValueError):
            # In development, initialize without credentials (limited functionality)
            _firebase_app = firebase_admin.initialize_app()


security = HTTPBearer()


async def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Verify Firebase ID token from Authorization header.
    Returns the decoded token with uid, email, and custom claims.
    """
    try:
        decoded_token = auth.verify_id_token(credentials.credentials)
        return decoded_token
    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


async def require_role(required_role: str):
    """Factory for role-based access control dependency."""
    async def role_checker(
        token: dict = Depends(verify_firebase_token),
    ) -> dict:
        user_role = token.get("role", "")
        if user_role != required_role and user_role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {required_role}",
            )
        return token
    return role_checker


def require_student():
    return Depends(require_role("student"))


def require_parent():
    return Depends(require_role("parent"))


def require_instructor():
    return Depends(require_role("instructor"))


def require_admin():
    return Depends(require_role("admin"))
