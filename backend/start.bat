@echo off
REM GradeGuard Pro Backend Startup Script for Windows

echo 🚀 Starting GradeGuard Pro Backend...

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo 📦 Creating virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo ❌ Failed to create virtual environment
        pause
        exit /b 1
    )
)

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo ❌ Failed to activate virtual environment
    pause
    exit /b 1
)

REM Install dependencies
echo 📥 Installing dependencies...
pip install --upgrade pip
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  Warning: .env file not found. Please create one with your configuration.
    echo 📋 You can use the provided .env as a template.
    echo.
)

REM Start the server
echo 🌐 Starting FastAPI server...
echo 📊 API Documentation will be available at: http://localhost:8000/docs
echo 📖 ReDoc will be available at: http://localhost:8000/redoc
echo ✅ All systems ready!
echo.

python main.py

if %errorlevel% neq 0 (
    echo ❌ Server failed to start
)

pause