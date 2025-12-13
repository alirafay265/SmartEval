#!/usr/bin/env python3
"""
Simple server startup script for Windows that avoids multiprocessing issues
"""
import multiprocessing
import sys
import os

# Windows multiprocessing support
if __name__ == "__main__":
    if sys.platform.startswith('win'):
        multiprocessing.freeze_support()
        multiprocessing.set_start_method('spawn', force=True)
    
    import uvicorn
    
    # Run the server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        workers=1,
        log_level="info"
    )