#!/bin/bash
# Restart-safe render pipeline: serve f3d/, render every chapter in acts.json in order (resumes from existing
# frames), encode each chapter as it completes, then assemble the full film.
# usage: PROJ=/path/to/project NAME=THE38 setsid nohup bash render_queue.sh >/dev/null 2>&1 &
# Run it with setsid/nohup: Claude Code background jobs are killed after 2 hours, a full film takes ~8-14 hours on CPU.
S=${PROJ:-$(pwd)}; HERE=$(cd "$(dirname "$0")" && pwd); export PROJ=$S NAME=${NAME:-FILM}
curl -s -o /dev/null http://127.0.0.1:8123/ || { (cd $S/f3d && setsid http-server -p 8123 -s . >/dev/null 2>&1 &); sleep 3; }
ACTS=$(python3 -c "import json;print(' '.join(k[1:] for k in json.load(open('$S/f3d/assets/acts.json'))))")
for a in $ACTS; do
  [ -f $S/f3d/renders/chapters/${NAME}_ch$a.mp4 ] && continue
  N=$(python3 -c "import json,math;print(math.ceil(json.load(open('$S/f3d/assets/acts.json'))['a$a']['dur']*24))")
  mkdir -p $S/fr/a$a
  for try in $(seq 1 20); do   # each node run has a 100-min budget, then resumes where it stopped
    have=$(ls $S/fr/a$a | grep -c '\.jpg$'); [ "$have" -ge "$N" ] && break
    echo "$(date +%T) act $a: $have/$N" >> $S/fr/queue.log
    node $HERE/render_frames.mjs $S/fr/a$a 24 $N 100 act$a.html >> $S/fr/a$a.log 2>&1
  done
  bash $HERE/finish_act.sh $a >> $S/fr/queue.log 2>&1 && echo "$(date +%T) CH$a ENCODED" >> $S/fr/queue.log
done
[ ! -f $S/f3d/renders/${NAME}_full.mp4 ] && bash $HERE/assemble.sh >> $S/fr/queue.log 2>&1
echo "$(date +%T) ALL DONE" >> $S/fr/queue.log
