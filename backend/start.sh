#!/bin/bash

# GradeGuard Pro Backend Startup Script

echo "🚀 Starting GradeGuard Pro Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Please create one with your configuration."
    echo "📋 You can use the provided .env as a template."
fi

# Start the server
echo "🌐 Starting FastAPI server..."
echo "📊 API Documentation will be available at: http://localhost:8000/docs"
echo "📖 ReDoc will be available at: http://localhost:8000/redoc"
echo ""

python main.py