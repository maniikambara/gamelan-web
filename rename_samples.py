import os
from pathlib import Path

gangsa_dir = Path(r"api/samples/gangsa")
kendang_dir = Path(r"api/samples/kendang")

# Gangsa renaming mapping
gangsa_mapping = {
    "Ding": "Dong",
    "Dong": "Deng",
    "Deng": "Dung",
    "Deung": "Dang",
    "Dung": "Ding",
    "Dang": "Dong'",
    "Daing": "Deng'",
    "Ding²": "Dung'",
    "Dong²": "Dang'",
    "Deng²": "Ding'"
}

print("Starting Gangsa rename...")
# First, rename all to intermediate tmp names to avoid collision
for old_stem in gangsa_mapping:
    old_file = gangsa_dir / f"{old_stem}.wav"
    tmp_file = gangsa_dir / f"_tmp_{old_stem}.wav"
    if old_file.exists():
        print(f"Renaming {old_file} to {tmp_file}")
        old_file.rename(tmp_file)
    else:
        print(f"Warning: {old_file} not found")

# Second, rename from tmp to final names
for old_stem, new_stem in gangsa_mapping.items():
    tmp_file = gangsa_dir / f"_tmp_{old_stem}.wav"
    new_file = gangsa_dir / f"{new_stem}.wav"
    if tmp_file.exists():
        print(f"Renaming {tmp_file} to {new_file}")
        tmp_file.rename(new_file)
    else:
        print(f"Warning: {tmp_file} not found")

# Kendang renaming mapping
kendang_mapping = {
    "Tung Tengah · Muka": "Tut_muka",
    "Tung Tengah · Belakang": "Dag_belakang",
    "Pak Pinggir · Muka": "Pak_muka",
    "Pak Pinggir · Belakang": "Dug_belakang"
}

print("\nStarting Kendang rename...")
for old_stem, new_stem in kendang_mapping.items():
    old_file = kendang_dir / f"{old_stem}.wav"
    new_file = kendang_dir / f"{new_stem}.wav"
    if old_file.exists():
        print(f"Renaming {old_file} to {new_file}")
        old_file.rename(new_file)
    else:
        print(f"Warning: {old_file} not found")

print("\nListing gangsa dir:")
for f in sorted(gangsa_dir.glob("*.wav")):
    print(f"  {f.name}")

print("\nListing kendang dir:")
for f in sorted(kendang_dir.glob("*.wav")):
    print(f"  {f.name}")
