import multiprocessing
import sys
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uvicorn

from app.core.config import settings
from app.api import auth, tests, submissions, files, analytics

# Lifespan manager for startup and shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 GradeGuard Pro API starting up...")
    print(f"📊 Database URL: {settings.supabase_url}")
    print(f"🤖 AI Grading: {'Enabled' if settings.hugging_face_api_key else 'Disabled'}")
    
    yield
    
    # Shutdown
    print("🛑 GradeGuard Pro API shutting down...")

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="Backend API for GradeGuard Pro - AI-Powered Exam Grading System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(",") if isinstance(settings.cors_origins, str) else settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal server error",
            "detail": str(exc) if settings.debug else "An unexpected error occurred"
        }
    )

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "GradeGuard Pro API",
        "version": "1.0.0"
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Welcome to GradeGuard Pro API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health"
    }

# Include API routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(tests.router, prefix="/api/v1")
app.include_router(submissions.router, prefix="/api/v1")
app.include_router(files.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")

if __name__ == "__main__":
    # Windows multiprocessing support - must be first
    if sys.platform.startswith('win'):
        multiprocessing.freeze_support()
        # Use spawn method to avoid import conflicts
        multiprocessing.set_start_method('spawn', force=True)
    
    # Run server with string import to avoid app object issues
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=False,  # Never use reload on Windows
        workers=1,     # Single worker to avoid multiprocessing
        log_level="info"
    )