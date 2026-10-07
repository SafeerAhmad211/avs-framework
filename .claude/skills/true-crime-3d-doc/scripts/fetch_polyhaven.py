#!/usr/bin/env python3
# Download the CC0 Poly Haven textures + models the street world uses (world.js / stage.js) into f3d/assets.
# usage: python3 fetch_polyhaven.py <f3d/assets dir> [extra texture ids...]
# Textures land as tex/<id>_diff.jpg, _nor.jpg, _rough.jpg (1k); models as models/<id>/<id>_1k.gltf (+ .bin, textures/).
import json, os, sys, urllib.request
ASSETS = sys.argv[1]
TEX = ["asphalt_02", "concrete_pavement", "dark_wood", "red_brick_03", "roof_slates_02", "white_rough_plaster"] + sys.argv[2:]
MODELS = ["street_lamp_01", "street_lamp_02", "fire_hydrant"]
UA = {"User-Agent": "video-pipeline/1.0"}
def get(url): return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
def save(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path): open(path, "wb").write(get(url))
for t in TEX:
    f = json.loads(get(f"https://api.polyhaven.com/files/{t}"))
    for key, suf in (("Diffuse", "diff"), ("nor_gl", "nor"), ("Rough", "rough")):
        save(f[key]["1k"]["jpg"]["url"], f"{ASSETS}/tex/{t}_{suf}.jpg")
    print("tex", t)
for m in MODELS:
    g = json.loads(get(f"https://api.polyhaven.com/files/{m}"))["gltf"]["1k"]["gltf"]
    save(g["url"], f"{ASSETS}/models/{m}/{m}_1k.gltf")
    for rel, inc in g.get("include", {}).items(): save(inc["url"], f"{ASSETS}/models/{m}/{rel}")
    print("model", m)
