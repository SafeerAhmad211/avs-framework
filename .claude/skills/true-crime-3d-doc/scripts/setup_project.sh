#!/bin/bash
# Create a new film project with the 3D engine, vendored libraries, fonts and free assets.
# usage: bash setup_project.sh <project dir> "<Rocketbox avatars>" "<Rocketbox anims>"
#   e.g. bash setup_project.sh ~/films/case2 "Business_Male_01 Female_Adult_11" "m_idle_neutral_01 f_walk_neutral_01"
# Needs: node/npm, git, python3 + Pillow (set PYTHON for a venv), network to npm, GitHub and Poly Haven.
set -euo pipefail
mkdir -p "$1"; P=$(cd "$1" && pwd); HERE=$(cd "$(dirname "$0")/.." && pwd)
A=$P/f3d/assets; mkdir -p $A/js $A/fonts $P/fr $P/parts $P/cap $P/f3d/renders/chapters
cp $HERE/engine/*.js $A/js/; cp $HERE/engine/ov.css $A/; cp $HERE/engine/fonts/* $A/fonts/
cp $HERE/engine/act.html.example $P/f3d/act1.html
# vendor three.js r181 + GSAP locally: headless Chrome in the container fails CDN TLS, and renders must be offline-deterministic
T=$(mktemp -d); (cd $T && npm pack -s three@0.181.2 gsap@3.14.2 >/dev/null && tar xzf three-0.181.2.tgz && mkdir g && tar xzf gsap-3.14.2.tgz -C g)
mkdir -p $A/js/three/build; cp $T/package/build/three.module.js $T/package/build/three.core.js $A/js/three/build/
cp -r $T/package/examples/jsm $A/js/three/jsm; cp $T/g/package/dist/gsap.min.js $A/js/; rm -rf $T
python3 $HERE/scripts/fetch_polyhaven.py $A
bash $HERE/scripts/fetch_rocketbox.sh $A/rb "$2" "$3"
echo "project ready: $P  (serve with: cd $P/f3d && http-server -p 8123 -s .)"
