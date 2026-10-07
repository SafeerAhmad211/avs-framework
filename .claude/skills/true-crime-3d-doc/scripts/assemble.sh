#!/bin/bash
# Join the cold open (parts/act0_video.mp4 + parts/act0_audio.wav, optional) and every chapter master
# (parts/aN_master.mp4) into f3d/renders/${NAME}_full.mp4. Re-encodes; output is large (crf 16, ~6 GB for 10 min).
S=${PROJ:-$(pwd)}; P=$S/parts; NAME=${NAME:-FILM}
ins=""; f=""; n=0
if [ -f $P/act0_video.mp4 ]; then ins="-i $P/act0_video.mp4 -i $P/act0_audio.wav"; f="[0:v][1:a]"; n=1; idx=2; else idx=0; fi
for m in $(ls $P/a*_master.mp4 | sort -V); do ins="$ins -i $m"; f="$f[$idx:v][$idx:a]"; idx=$((idx+1)); n=$((n+1)); done
nice -n 5 ffmpeg -y -v error $ins -filter_complex "${f}concat=n=$n:v=1:a=1[v][a0];[a0]aresample=48000[a]" -map "[v]" -map "[a]" \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart $S/f3d/renders/${NAME}_full.mp4 \
  && echo "$(date +%T) FULL FILM ASSEMBLED" && ls -la $S/f3d/renders/${NAME}_full.mp4
