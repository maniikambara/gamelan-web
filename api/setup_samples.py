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
            "Dong.wav",
            "Deng.wav", 
            "Dung.wav",
            "Dang.wav",
            "Ding.wav",
            "Dong'.wav",
            "Deng'.wav",
            "Dung'.wav",
            "Dang'.wav",
            "Ding'.wav",
        ],
        "kendang": [
            "Tut_muka.wav",
            "Pak_muka.wav",
            "Dag_belakang.wav",
            "Dug_belakang.wav",
        ],
        "suling": [
            "Deng 1.wav",
            "Dung 1.wav",
            "Dang 1.wav",
            "Ding 1.wav",
            "Dong 1.wav",
            "Deng 2.wav",
            "Dung 2.wav",
            "Dang 2.wav",
            "Ding 2.wav",
            "Dong 2.wav",
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
