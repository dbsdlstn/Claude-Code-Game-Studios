#!/usr/bin/env python3
"""Line-by-line port of src/core/card_validator.gd + CardLoader.filter_for_mode.

Purpose: check, without running Godot, what the *GDScript* validator says about a
card JSON file. Since decision-log D17 the GDScript validator implements the same
predicates as tools/validate_cards.py; this port lets you confirm that without an
editor. Godot 4's JSON parser returns every number as float, so this port loads
numbers as float too. Keep it in step with card_validator.gd (or delete it).

Usage:
    python3 tools/gd_card_validator_port.py <cards.json> [--release]
            [--config assets/data/config/game_config.json]
    python3 tools/gd_card_validator_port.py --parity
            (runs tests/fixtures/validator_parity_cases.json through this port)

Prints each error as `[rule N] id: message` and the CardSet summary
(anchors / playable / disputed). Emits observations only; exit 0 when no
error (or all parity cases match), 1 otherwise, 2 on file/JSON error.
"""
import copy
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

TYPES=["event","artifact","person","myth"]; KINDS=["description","relation","direct"]
NULLS=["explanation","date_label","verified_by","disputed_note","image","image_source","image_license"]
def is_true(v): return v is True
def is_false(v): return v is False
def nes(v): return isinstance(v,str) and v.strip()!=""
def intlike(v): return (isinstance(v,(int,float)) and not isinstance(v,bool)) and float(v)==math.floor(float(v))
def floatify(o):
    if isinstance(o,bool) or o is None: return o
    if isinstance(o,int): return float(o)
    if isinstance(o,list): return [floatify(x) for x in o]
    if isinstance(o,dict): return {k:floatify(v) for k,v in o.items()}
    return o
def validate(raw,nids,eids,nl,el):
    E=[]; cards=[]; by={}
    err=lambda r,c,m:E.append((r,c,m))
    lab=lambda c,i: c.get("id") if nes(c.get("id")) else "#%d"%i
    for i,c in enumerate(raw):
        if not isinstance(c,dict): err(0,"#%d"%i,"obj"); continue
        cards.append(c); cid=lab(c,i); schema(c,cid,el,err)
        rid=c.get("id")
        if isinstance(rid,str) and rid!="":
            if rid in by: err(1,cid,"dup")
            else: by[rid]=c
    banned=list(nl.values())+list(el.values())
    for i,c in enumerate(cards):
        cid=lab(c,i); anc=is_true(c.get("anchor"))
        answer(c,cid,nids,eids,err); clues(c,cid,anc,err)
        if not anc: refs(c,cid,by,err); first(c,cid,banned,err)
        disp(c,cid,err); img(c,cid,err)
        if is_true(c.get("verified")) and not nes(c.get("verified_by")): err(9,cid,"vb")
    counts=cell_counts(cards)
    for n in nids:
        for e in eids:
            if counts.get(f"{n}/{e}",0)<1: err(8,f"{n}/{e}","cov")
    return E
def cell_counts(raw):
    out={}
    for c in raw:
        if not isinstance(c,dict): continue
        if not is_false(c.get("anchor")) or not is_false(c.get("disputed")): continue
        a=c.get("answer")
        if not isinstance(a,dict): continue
        n,e=a.get("nation"),a.get("era")
        if not isinstance(n,str) or not isinstance(e,str): continue
        out[f"{n}/{e}"]=out.get(f"{n}/{e}",0)+1
    return out
def schema(c,cid,el,err):
    if not nes(c.get("id")): err(0,cid,"id")
    if c.get("type") not in TYPES: err(0,cid,"type")
    if not nes(c.get("title")): err(0,cid,"title")
    for k in ["anchor","verified","disputed"]:
        if not isinstance(c.get(k),bool): err(0,cid,k)
    if not isinstance(c.get("answer"),dict): err(0,cid,"answer")
    if not isinstance(c.get("clues"),list): err(0,cid,"clues")
    for k in NULLS:
        v=c.get(k)
        if v is not None and not isinstance(v,str): err(0,cid,k)
    if "tags" in c:
        t=c.get("tags"); ok=isinstance(t,list) and all(isinstance(x,str) for x in t)
        if not ok: err(0,cid,"tags")
    src=c.get("source")
    if not isinstance(src,dict): err(0,cid,"src")
    else:
        if not nes(src.get("name")): err(0,cid,"name")
        if "url" not in src or (src.get("url") is not None and not isinstance(src.get("url"),str)): err(0,cid,"url")
        elif isinstance(src.get("url"),str):
            u=src["url"]
            if not u.startswith("http://") and not u.startswith("https://"): err(0,cid,"urlp")
        if not isinstance(src.get("note"),str): err(0,cid,"note")
    d=c.get("difficulty")
    if not intlike(d) or int(d)<1 or int(d)>3: err(0,cid,"diff")
    if not is_true(c.get("anchor")):
        ex=c.get("explanation")
        if not nes(ex): err(0,cid,"exp")
        else:
            a=c.get("answer"); era=a.get("era") if isinstance(a,dict) else None
            if isinstance(era,str) and era in el and el[era] not in ex: err(0,cid,"explabel")
def answer(c,cid,nids,eids,err):
    a=c.get("answer")
    if not isinstance(a,dict): return
    if not isinstance(a.get("nation"),str) or a.get("nation") not in nids: err(2,cid,"n")
    if not isinstance(a.get("era"),str) or a.get("era") not in eids: err(2,cid,"e")
def clues(c,cid,anc,err):
    cl=c.get("clues")
    if not isinstance(cl,list): return
    if anc:
        if cl: err(3,cid,"anc")
        return
    if len(cl)!=3: err(3,cid,"n"); return
    for i,x in enumerate(cl):
        if not isinstance(x,dict): err(3,cid,"obj"); continue
        lv=x.get("level")
        if not intlike(lv) or int(lv)!=i+1: err(3,cid,"lv")
        if not (isinstance(x.get("kind"),str) and x.get("kind")==KINDS[i]): err(3,cid,"kind")
        if not nes(x.get("text")): err(3,cid,"text")
def refs(c,cid,by,err):
    cl=c.get("clues")
    if not isinstance(cl,list): return
    for x in cl:
        if not isinstance(x,dict): continue
        r=x.get("refs")
        if not isinstance(r,list): err(4,cid,"notlist"); continue
        text=x.get("text") if isinstance(x.get("text"),str) else ""
        if not (isinstance(x.get("kind"),str) and x.get("kind")=="relation"):
            if r: err(4,cid,"nonrel")
            continue
        if not r: err(4,cid,"empty"); continue
        for ref in r:
            if not isinstance(ref,str) or ref not in by: err(4,cid,"missing"); continue
            t=by[ref]
            if not is_true(t.get("anchor")): err(4,cid,"nonanchor")
            if is_true(t.get("disputed")): err(4,cid,"disp")
            tt=t.get("title") if isinstance(t.get("title"),str) else ""
            if f"[{tt}]" not in text: err(4,cid,"title")
def first(c,cid,banned,err):
    cl=c.get("clues")
    if not isinstance(cl,list) or not cl: return
    f=cl[0]
    if not isinstance(f,dict) or not intlike(f.get("level")) or int(f.get("level"))!=1: return
    if not nes(f.get("text")): return
    t=f["text"]; ti=c.get("title")
    if nes(ti) and ti in t: err(5,cid,"title")
    for w in banned:
        if nes(w) and w in t: err(5,cid,w)
def disp(c,cid,err):
    if is_true(c.get("disputed")):
        if not nes(c.get("disputed_note")): err(6,cid,"note")
        if is_true(c.get("anchor")): err(6,cid,"anc")
    elif c.get("disputed_note") is not None: err(6,cid,"nn")
def img(c,cid,err):
    if c.get("image") is None: return
    if not nes(c.get("image_source")): err(7,cid,"s")
    if not nes(c.get("image_license")): err(7,cid,"l")


def load_config(path):
    cfg = json.loads(Path(path).read_text(encoding="utf-8"))
    nids = [n["id"] for n in cfg["nations"]]
    eids = [e["id"] for e in cfg["eras"]]
    nl = {n["id"]: n["label"] for n in cfg["nations"]}
    el = {e["id"]: e["label"] for e in cfg["eras"]}
    return nids, eids, nl, el


def filter_for_mode(raw, release):
    if not release:
        return list(raw)
    return [c for c in raw if isinstance(c, dict) and c.get("verified") is True and c.get("disputed") is False]


def parity(cfg):
    from validator_parity import apply
    spec = json.loads((ROOT / "tests/fixtures/validator_parity_cases.json").read_text(encoding="utf-8"))
    base = json.loads((ROOT / spec["base"].replace("res://", "")).read_text(encoding="utf-8"))
    bad = 0
    for case in spec["cases"]:
        cards = copy.deepcopy(base)
        for op in case["ops"]:
            apply(cards, op)
        rules = {e[0] for e in validate(floatify(cards), *cfg)}
        ok = (not rules) if case["expect"] is None else case["expect"] in rules
        if not ok:
            bad += 1
            print(f"MISMATCH {case['name']}: expected {case['expect']}, got {sorted(rules)}")
    print(f"{len(spec['cases']) - bad}/{len(spec['cases'])} cases match")
    return 1 if bad else 0


def main(argv):
    config_path = ROOT / "assets/data/config/game_config.json"
    if "--config" in argv:
        config_path = Path(argv[argv.index("--config") + 1])
    cfg = load_config(config_path)
    if "--parity" in argv:
        return parity(cfg)
    files = [a for a in argv if not a.startswith("--") and Path(a) != config_path]
    if not files:
        print(__doc__)
        return 2
    try:
        raw = json.loads(Path(files[0]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"ERROR reading {files[0]}: {e}")
        return 2
    cards = filter_for_mode(floatify(raw), "--release" in argv)
    errors = validate(cards, *cfg)
    for rule, cid, msg in errors:
        print(f"[rule {rule}] {cid}: {msg}")
    good = [c for c in cards if isinstance(c, dict)]
    anchors = sum(1 for c in good if c.get("anchor") is True)
    disputed = sum(1 for c in good if c.get("anchor") is not True and c.get("disputed") is True)
    print(f"{len(errors)} errors; anchors {anchors}, playable {len(good) - anchors - disputed}, disputed {disputed}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
