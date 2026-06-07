#!/usr/bin/env python3
"""
setup_samples.py - Helper script to create default samples directory structure

Run this script to create the directory structure for default samples:
    python setup_samples.py

Then add your WAV files to the appropriate directories.
"""

import os
from pathlib import Path

def setup_samples_structure():
    """Create the samples directory structure."""
    
    base_dir = Path(__file__).parent / "samples"
    
    # Define instruments and their notes
    structure = {
        "gangsa": [
            "Ding.wav",
            "Dong.wav", 
            "Deng.wav",
            "Deung.wav",
            "Dung.wav",
            "Dang.wav",
            "Daing.wav",
            "Ding².wav",
            "Dong².wav",
            "Deng².wav",
        ],
        "kendang": [
            "Tung Tengah · Muka.wav",
            "Pak Pinggir · Muka.wav",
            "Tung Tengah · Belakang.wav",
            "Pak Pinggir · Belakang.wav",
        ],
        "suling": [
            "1 Do.wav",
            "3 Mi.wav",
            "4 Fa.wav",
            "5 Sol.wav",
            "7 Si.wav",
            "1 Do (oktaf).wav",
        ]
    }
    
    print("Creating samples directory structure...\n")
    
    for instrument, notes in structure.items():
        inst_dir = base_dir / instrument
        inst_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"✓ Created directory: {inst_dir}")
        print(f"  Expected files ({len(notes)}):")
        for note_file in notes:
            print(f"    - {note_file}")
        print()
    
    print("✓ Directory structure created successfully!")
    print(f"\nNext steps:")
    print(f"1. Add WAV files to each directory (44100 Hz, 16-bit, mono or stereo)")
    print(f"2. Restart the backend server")
    print(f"3. Samples will be automatically loaded on startup")

if __name__ == "__main__":
    setup_samples_structure()
