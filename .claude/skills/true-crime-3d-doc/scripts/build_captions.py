# Build SRT + ASS captions from the KNOWN narration script, timed by per-clip whisper transcripts.
# Before running: transcribe every VO clip into cap/<clip_id>/transcript.json (see SKILL.md, "Captions"),
# then edit the PER-FILM block below (cold-open clips, whisper fixes, cold-open length, number substitutions).
# usage: PROJ=/path/to/project NAME=THE38 python3 build_captions.py  -> cap/NAME_captions.srt + .ass
import json, re, os
S = os.environ.get("PROJ", os.getcwd()); NAME = os.environ.get("NAME", "FILM")
CAP = S + "/cap"
FPS = 24

def tj(n): return json.load(open(f"{CAP}/{n}/transcript.json"))

# ---- PER-FILM: clip list (film_start, clip_id, spoken_text or None) ----
# Cold-open clips have no script text here, so their whisper words are used directly with cold_fix corrections.
clips = []
cold = [(1.2, "v1"), (10.6, "v2"), (17.6, "v3"), (24.3, "v4"), (32.0, "v5"), (39.5, "v6"),
        (47.4, "v7"), (52.5, "v8"), (65.0, "v9"), (69.0, "v10"), (73.0, "v11")]
cold_fix = {"v4": {"hollies.": "Hollis."}, "v6": {"mostly": "Moseley"}, "v5": {"kerb": "curb", "her,": "her.", "it": "It"}}
for s, n in cold: clips.append((s, n, None))
acts = json.load(open(f"{S}/f3d/assets/acts.json")); script = json.load(open(f"{S}/script.json"))
off = 86.0  # PER-FILM: cold-open length in seconds (0 if none)
for k in sorted(acts, key=lambda k: int(k[1:])):
    for i, c in enumerate(acts[k]["cues"]):
        clips.append((off + c["s"], os.path.basename(c["f"])[:-4], script[k][i]))
    off += acts[k]["dur"]
TOTAL = off

# PER-FILM: spoken-number phrases -> how they should read on screen
SUBS = [
    (["july", "seventh"], "July 7"), (["nineteen", "thirty-five"], "1935"), (["nineteen", "sixty-four"], "1964"),
    (["nineteen", "sixty-eight"], "1968"), (["two-thirty"], "2:30"), (["three-fifty"], "3:50"), (["three-nineteen"], "3:19"),
    (["march", "twelfth"], "March 12"), (["march", "twenty-seventh"], "March 27"), (["march", "twenty-eighth"], "March 28"),
    (["forty-nine", "dollars"], "$49"), (["eighty-five", "percent"], "85%"), (["thirty-one", "percent"], "31%"),
    (["two", "thousand", "seven"], "2007"), (["two", "thousand", "sixteen"], "2016"), (["two", "thousand", "fifteen"], "2015"),
    (["twenty-eight"], "28"), (["twenty-nine"], "29"), (["thirty-eight"], "38"), (["eighty-one"], "81"),
    (["fifty-two"], "52"), (["eighteen"], "18"),
]
SUBS.sort(key=lambda x: -len(x[0]))
norm = lambda w: re.sub(r"[^a-z0-9'-]", "", w.lower())
letters = lambda w: len(re.sub(r"[^a-z]", "", w.lower())) + 2 * len(re.sub(r"[^0-9]", "", w))

def units_from_script(text):
    words = text.split(); out = []; i = 0
    while i < len(words):
        for ph, disp in SUBS:
            seg = words[i:i + len(ph)]
            if [norm(w) for w in seg] == ph:
                tail = re.sub(r".*?([.,!?;:]*)$", r"\1", seg[-1])
                if words[i][0].isupper() and disp[0].isalpha(): disp = disp[0].upper() + disp[1:]
                out.append((disp + tail, sum(letters(w) for w in seg))); i += len(ph); break
        else:
            out.append((words[i], letters(words[i]))); i += 1
    return out

def timeline(wl):
    # cumulative letter positions -> times, from whisper words
    pts = [(0, wl[0]["start"])]; acc = 0
    for w in wl:
        L = max(1, letters(w["text"])); pts.append((acc, w["start"])); acc += L; pts.append((acc, w["end"]))
    return pts, acc

def interp(pts, x):
    for (x0, t0), (x1, t1) in zip(pts, pts[1:]):
        if x0 <= x <= x1: return t0 if x1 == x0 else t0 + (t1 - t0) * (x - x0) / (x1 - x0)
    return pts[-1][1]

words = []  # (text, start, end) absolute
for start, n, text in clips:
    wl = tj(n)
    if text is None:
        for w in wl:
            t = cold_fix.get(n, {}).get(w["text"], w["text"]); words.append((t, start + w["start"], start + w["end"]))
        continue
    pts, tot = timeline(wl); us = units_from_script(text); su = sum(L for _, L in us) or 1; acc = 0
    for disp, L in us:
        a = interp(pts, acc / su * tot); acc += L; b = interp(pts, acc / su * tot)
        words.append((disp, start + a, start + b))

# ---- chunk into caption events: clauses, long ones split into balanced parts ----
import math
MAXC = 42; events = []; clauses = []; cur = []
for i, (w, a, b) in enumerate(words):
    if cur and a - cur[-1][2] > 0.6: clauses.append(cur); cur = []
    cur.append((w, a, b))
    if re.search(r"[.!?]$", w) or (re.search(r"[,;:]$", w) and len(cur) >= 3) or i == len(words) - 1: clauses.append(cur); cur = []
WEAK = {"the","a","an","of","to","in","on","at","for","and","or","but","her","his","she","he","was","is","that","with","by","from"}
for cl in clauses:
    txt = " ".join(w for w, _, _ in cl); n = math.ceil(len(txt) / MAXC)
    if n <= 1: events.append([txt, cl[0][1], cl[-1][2]]); continue
    target = len(txt) / n; parts = []; part = []
    for j, (w, a, b) in enumerate(cl):
        part.append((w, a, b)); L = len(" ".join(x for x, _, _ in part))
        nxt = cl[j + 1][0].lower() if j + 1 < len(cl) else None
        if len(parts) < n - 1 and nxt and L >= target * 0.8 and (L >= target * 1.15 or norm(w) not in WEAK):
            parts.append(part); part = []
    if part: parts.append(part)
    for pt in parts: events.append([" ".join(w for w, _, _ in pt), pt[0][1], pt[-1][2]])
for i, e in enumerate(events):
    e[2] = max(e[2] + 0.25, e[1] + 0.9)
    if i + 1 < len(events): e[2] = min(e[2], events[i + 1][1] - 0.04)

def ts(t, sep=","):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h:02d}:{m:02d}:{int(s):02d}{sep}{int(round((s % 1) * 1000)):03d}" if sep == "," else f"{h}:{m:02d}:{s:05.2f}"
with open(f"{CAP}/{NAME}_captions.srt", "w") as f:
    for i, (t, a, b) in enumerate(events, 1): f.write(f"{i}\n{ts(a)} --> {ts(b)}\n{t}\n\n")
ass = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter Medium,50,&H00F2F2F2,&H000000FF,&H00000000,&H96000000,0,0,0,0,100,100,0.5,0,1,2.2,1.5,2,200,200,62,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
for t, a, b in events:
    ass += f"Dialogue: 0,{ts(a, '.')},{ts(b, '.')},Cap,,0,0,0,,{{\\fad(120,120)}}{t}\n"
open(f"{CAP}/{NAME}_captions.ass", "w").write(ass)
print(len(events), "events; total", TOTAL)
