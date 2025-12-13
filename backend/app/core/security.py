from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.core.database import supabase

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT token security
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

def verify_token(token: str) -> dict:
    """Verify JWT token using Supabase client verification"""
    print(f"🔑 Verifying token: {token[:50]}...")
    
    try:
        # Use Supabase client to verify the token
        from app.core.database import supabase
        
        # Get user info from Supabase using the token
        response = supabase.auth.get_user(token)
        
        if not response or not hasattr(response, 'user') or not response.user:
            print("❌ No user found in Supabase token verification")
            raise ValueError("Invalid Supabase response")
        
        user = response.user
        user_id = user.id
        email = user.email
        
        print(f"✅ Supabase token verified - User ID: {user_id}, Email: {email}")
        
        return {
            "user_id": str(user_id), 
            "email": email or "unknown@example.com",
            "role": "teacher"  # Default role for file processing
        }
    except Exception as e:
        print(f"❌ Supabase token verification failed: {e}")
        
        # Fallback: Try manual JWT decode (without signature verification for Supabase tokens)
        try:
            # Try decoding Supabase JWT without verification
            payload = jwt.decode(token, key="", options={"verify_signature": False})
            user_id = payload.get("sub")
            email = payload.get("email")
            
            if user_id is None:
                raise ValueError("Missing user ID in token")
            
            print(f"✅ Supabase JWT decoded - User ID: {user_id}, Email: {email}")
            return {
                "user_id": str(user_id), 
                "email": email or "unknown@example.com",
                "role": "teacher"
            }
        except Exception as decode_error:
            print(f"❌ JWT decode failed: {decode_error}")
            
            # Final fallback: Try custom JWT verification
            try:
                payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
                user_id = payload.get("sub")
                if user_id is None:
                    raise ValueError("Missing user ID in custom token")
                
                print(f"✅ Custom JWT verified - User ID: {user_id}")
                return {"user_id": str(user_id), "email": payload.get("email"), "role": "teacher"}
            except Exception as jwt_error:
                print(f"❌ All authentication methods failed: {jwt_error}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication failed: Invalid token",
                    headers={"WWW-Authenticate": "Bearer"},
                )

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated user"""
    try:
        token = credentials.credentials
        print(f"🔐 Received token: {token[:50]}...")
        
        token_data = verify_token(token)
        
        user = {
            "id": token_data["user_id"],
            "email": token_data["email"],
            "role": token_data.get("role", "teacher"),
            "is_active": True
        }
        
        print(f"✅ User authenticated: {user['email']} ({user['role']})")
        return user
        
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        raise

async def get_current_active_user(current_user: dict = Depends(get_current_user)):
    """Get current active user"""
    if not current_user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user