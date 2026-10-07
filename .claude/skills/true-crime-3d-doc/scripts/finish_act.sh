#!/bin/bash
# usage: finish_act.sh N   -> encodes chapter N master + <29MB review copy, then removes its frames
S=${PROJ:-$(pwd)}   # project root: holds f3d/, fr/, parts/, script.json
a=$1; D=$(python3 -c "import json;print(json.load(open('$S/f3d/assets/acts.json'))['a$a']['dur'])")
N=$(python3 -c "import math;print(math.ceil($D*24))"); have=$(ls $S/fr/a$a | grep -c '\.jpg$')
[ "$have" -lt "$N" ] && { echo "not complete $have/$N"; exit 1; }
nice -n 5 ffmpeg -y -v error -framerate 24 -i $S/fr/a$a/f%05d.jpg -i $S/parts/a${a}_audio.wav -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -c:a aac -b:a 256k -shortest -movflags +faststart $S/parts/a${a}_master.mp4 || exit 1
VB=$(python3 -c "print(int((28.5*8*1024*1024/$D - 160000)/1000))")
mkdir -p $S/f3d/renders/chapters
nice -n 5 ffmpeg -y -v error -i $S/parts/a${a}_master.mp4 -c:v libx264 -preset slow -b:v ${VB}k -maxrate $((VB*13/10))k -bufsize $((VB*2))k -c:a aac -b:a 160k -movflags +faststart $S/f3d/renders/chapters/${NAME:-FILM}_ch${a}.mp4 || exit 1
rm -rf $S/fr/a$a; ls -la $S/f3d/renders/chapters/${NAME:-FILM}_ch${a}.mp4
