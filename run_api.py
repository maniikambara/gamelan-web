#!/usr/bin/env python3
"""
Development server launcher for Gamelan Synthesizer API
Runs FastAPI on localhost:8000
"""

import sys
from pathlib import Path

# Add api directory to path
api_dir = Path(__file__).parent / "api"
sys.path.insert(0, str(api_dir))

if __name__ == "__main__":
    import uvicorn
    from index import app
    
    print("\n" + "="*60)
    print("Gamelan Bali Synthesizer - API Backend")
    print("="*60)
    print("\nStarting FastAPI server...")
    print("API Documentation: http://localhost:8000/docs")
    print("="*60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
