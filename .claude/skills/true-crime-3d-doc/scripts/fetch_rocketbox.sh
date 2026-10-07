#!/bin/bash
# Fetch only the Rocketbox avatars + animations a film needs (MIT licence, github.com/microsoft/microsoft-rocketbox).
# A full clone is ~27 GB and fills the disk; this does a sparse, blob-filtered clone instead.
# usage: fetch_rocketbox.sh <dest assets/rb dir> "<Avatar_Name ...>" "<anim_name ...>"
#   e.g. fetch_rocketbox.sh f3d/assets/rb "Business_Male_01 Female_Adult_11" "m_idle_neutral_01 f_walk_neutral_01"
# Needs: git, python3 with Pillow (or set PYTHON=/path/to/python) (converts TGA textures to 1024px JPG/PNG that three.js FBXLoader can read).
set -euo pipefail
DEST=$(realpath -m "$1"); AVATARS=$2; ANIMS=$3
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
git clone -q --depth 1 --filter=blob:none --sparse https://github.com/microsoft/microsoft-rocketbox "$TMP/rb"
cd "$TMP/rb"
pats=(); declare -A DIR
for a in $AVATARS; do
  d=$(git ls-tree -d -r --name-only HEAD Assets/Avatars | grep -E "/$a$" | head -1)
  [ -n "$d" ] || { echo "avatar not found: $a" >&2; exit 1; }
  DIR[$a]=$d; pats+=("/$d/Export/$a.fbx" "/$d/Textures/*.tga")
done
for n in $ANIMS; do
  # walking/running clips keep XY root motion (stage.js strips it); idles/sits are the static variants
  case $n in *walk*|*run*) sub=all_animations_max_motextr_xy ;; *) sub=all_animations_max_motextr_static ;; esac
  pats+=("/Assets/Animations/$sub/$n.max.fbx")
done
git sparse-checkout set --no-cone "${pats[@]}"
mkdir -p "$DEST/anim"
for n in $ANIMS; do cp Assets/Animations/*/"$n".max.fbx "$DEST/anim/" 2>/dev/null || echo "anim not found: $n" >&2; done
for a in $AVATARS; do
  d=${DIR[$a]}
  mkdir -p "$DEST/$a/Textures"; cp "$d/Export/$a.fbx" "$DEST/$a/"
  ${PYTHON:-python3} - "$d/Textures" "$DEST/$a/Textures" <<'PY'
import sys, glob, os
from PIL import Image
src, dst = sys.argv[1:]
for f in glob.glob(src + "/*.tga"):
    b = os.path.basename(f)[:-4]
    if "wrinkle" in b or "specular" in b: continue
    im = Image.open(f)
    if "opacity" in b: im.convert("RGBA").resize((1024, 1024)).save(f"{dst}/{b}.png")
    else: im.convert("RGB").resize((1024, 1024)).save(f"{dst}/{b}.jpg", quality=90)
PY
done
du -sh "$DEST"
