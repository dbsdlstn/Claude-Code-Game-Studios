#!/usr/bin/env python3
"""Line-by-line port of src/core/card_validator.gd + CardLoader.filter_for_mode.

Purpose: check, without running Godot, whether a card JSON file passes the
*GDScript* validator (not tools/validate_cards.py, which is stricter and
different). Godot 4's JSON parser returns every number as float, so this port
loads numbers as float too.

Usage:
    python3 tools/gd_card_validator_port.py <cards.json> [--release]
            [--config assets/data/config/game_config.json]

Prints each error as `[rule N] id: message` and a summary of the CardSet the
loader would build (anchors / playable / disputed). Emits observations only;
exit 0 when no error, 1 otherwise, 2 on file/JSON error.
"""
import json
import math
import sys

RULE_SCHEMA, RULE_UNIQUE_ID, RULE_ANSWER, RULE_CLUES = 0, 1, 2, 3
RULE_RELATION_REFS, RULE_TITLE_IN_FIRST_CLUE = 4, 5
RULE_DISPUTED_NOTE, RULE_IMAGE_CREDITS, RULE_CELL_COVERAGE = 6, 7, 8
CARD_TYPES = ["event", "artifact", "person", "myth"]
CLUE_KINDS = ["description", "relation", "direct"]


def is_true(v):
    return isinstance(v, bool) and v


def is_str(v):
    return isinstance(v, str)


def nonempty_str(v):
    return is_str(v) and v != ""


def int_like(v):
    if isinstance(v, bool):
        return False
    if isinstance(v, int):
        return True
    return isinstance(v, float) and math.isclose(v, math.floor(v))


def err(rule, cid, msg):
    return {"rule": rule, "id": cid, "message": msg}


def label(card, i):
    v = card.get("id")
    return v if nonempty_str(v) else "#%d" % i


def check_schema(card, cid, errors):
    if not nonempty_str(card.get("id")):
        errors.append(err(0, cid, "id가 없다"))
    if card.get("type") not in CARD_TYPES:
        errors.append(err(0, cid, "type enum"))
    if not nonempty_str(card.get("title")):
        errors.append(err(0, cid, "title이 없다"))
    for key in ("anchor", "verified", "disputed"):
        if not isinstance(card.get(key), bool):
            errors.append(err(0, cid, "%s가 bool이 아니다" % key))
    if not isinstance(card.get("clues"), list):
        errors.append(err(0, cid, "clues가 배열이 아니다"))
    src = card.get("source")
    if not isinstance(src, dict) or not nonempty_str(src.get("name")):
        errors.append(err(0, cid, "source.name이 없다"))
    d = card.get("difficulty")
    if not int_like(d) or int(d) < 1 or int(d) > 3:
        errors.append(err(0, cid, "difficulty"))
    if not is_true(card.get("anchor")) and not nonempty_str(card.get("explanation")):
        errors.append(err(0, cid, "explanation 없음"))


def check_answer(card, cid, nations, eras, errors):
    a = card.get("answer")
    if not isinstance(a, dict):
        errors.append(err(2, cid, "answer가 객체가 아니다"))
        return
    n, e = a.get("nation"), a.get("era")
    if not is_str(n) or n not in nations:
        errors.append(err(2, cid, "nation %r" % (n,)))
    if not is_str(e) or e not in eras:
        errors.append(err(2, cid, "era %r" % (e,)))


def check_clues(card, cid, is_anchor, errors):
    clues = card.get("clues")
    if not isinstance(clues, list):
        return
    if is_anchor:
        if clues:
            errors.append(err(3, cid, "기준 카드 clues 비어야 함"))
        return
    if len(clues) != 3:
        errors.append(err(3, cid, "단서 %d개" % len(clues)))
        return
    for i, clue in enumerate(clues):
        if not isinstance(clue, dict):
            errors.append(err(3, cid, "단서 %d 객체 아님" % (i + 1)))
            continue
        lv = clue.get("level")
        if not int_like(lv) or int(lv) != i + 1:
            errors.append(err(3, cid, "level"))
        if not (is_str(clue.get("kind")) and clue.get("kind") == CLUE_KINDS[i]):
            errors.append(err(3, cid, "kind"))
        if not nonempty_str(clue.get("text")):
            errors.append(err(3, cid, "text"))
        if not isinstance(clue.get("refs"), list):
            errors.append(err(3, cid, "refs 배열 아님"))


def check_relation_refs(card, cid, by_id, errors):
    clues = card.get("clues")
    if not isinstance(clues, list):
        return
    for clue in clues:
        if not isinstance(clue, dict) or clue.get("kind") != "relation":
            continue
        refs = clue.get("refs")
        if not isinstance(refs, list) or not refs:
            errors.append(err(4, cid, "relation 단서에 refs가 없다"))
            continue
        for ref in refs:
            if not is_str(ref) or ref not in by_id:
                errors.append(err(4, cid, "없는 카드 %r" % (ref,)))
                continue
            if not is_true(by_id[ref].get("anchor")):
                errors.append(err(4, cid, "기준 카드가 아님 %s" % ref))


def check_first_clue(card, cid, errors):
    clues, title = card.get("clues"), card.get("title")
    if not isinstance(clues, list) or not clues or not nonempty_str(title):
        return
    first = clues[0]
    if not isinstance(first, dict) or not is_str(first.get("text")):
        return
    if title in first["text"]:
        errors.append(err(5, cid, "1단계 단서에 title"))


def validate(raw, nations, eras):
    errors, cards, by_id = [], [], {}
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            errors.append(err(0, "#%d" % i, "카드가 객체가 아니다"))
            continue
        cards.append(item)
        cid = label(item, i)
        check_schema(item, cid, errors)
        rid = item.get("id")
        if nonempty_str(rid):
            if rid in by_id:
                errors.append(err(1, cid, "id 중복"))
            else:
                by_id[rid] = item
    for i, card in enumerate(cards):
        cid = label(card, i)
        anchor = is_true(card.get("anchor"))
        check_answer(card, cid, nations, eras, errors)
        check_clues(card, cid, anchor, errors)
        if not anchor:
            check_relation_refs(card, cid, by_id, errors)
            check_first_clue(card, cid, errors)
        if is_true(card.get("disputed")) and not nonempty_str(card.get("disputed_note")):
            errors.append(err(6, cid, "disputed_note 없음"))
        if nonempty_str(card.get("image")):
            if not nonempty_str(card.get("image_source")):
                errors.append(err(7, cid, "image_source 없음"))
            if not nonempty_str(card.get("image_license")):
                errors.append(err(7, cid, "image_license 없음"))
    counts = {}
    for card in cards:
        if is_true(card.get("anchor")) or is_true(card.get("disputed")):
            continue
        a = card.get("answer")
        if not isinstance(a, dict) or not is_str(a.get("nation")) or not is_str(a.get("era")):
            continue
        k = "%s/%s" % (a["nation"], a["era"])
        counts[k] = counts.get(k, 0) + 1
    for n in nations:
        for e in eras:
            if counts.get("%s/%s" % (n, e), 0) < 1:
                errors.append(err(8, "%s/%s" % (n, e), "판정 대상 없음"))
    return errors


def filter_for_mode(raw, release):
    if not release:
        return list(raw)
    return [c for c in raw if isinstance(c, dict) and is_true(c.get("verified"))
            and isinstance(c.get("disputed"), bool) and not c.get("disputed")]


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    release = "--release" in argv
    cfg_path = "assets/data/config/game_config.json"
    if "--config" in argv:
        cfg_path = argv[argv.index("--config") + 1]
        args.remove(cfg_path)
    if not args:
        print(__doc__)
        return 2
    try:
        cfg = json.load(open(cfg_path, encoding="utf-8"))
        raw = json.load(open(args[0], encoding="utf-8"), parse_int=float)
    except (OSError, ValueError) as exc:
        print("file/JSON error:", exc)
        return 2
    if not isinstance(raw, list):
        print("[rule 0] (file): 최상위가 배열이 아니다")
        return 1
    nations = [x["id"] for x in cfg["nations"]]
    eras = [x["id"] for x in cfg["eras"]]
    filtered = filter_for_mode(raw, release)
    errors = validate(filtered, nations, eras)
    for e in errors:
        print("[rule %d] %s: %s" % (e["rule"], e["id"], e["message"]))
    if errors:
        print("RESULT: %d error(s); CardSet would be empty" % len(errors))
        return 1
    anchors = [c for c in filtered if c["anchor"]]
    disputed = [c for c in filtered if not c["anchor"] and c["disputed"]]
    playable = [c for c in filtered if not c["anchor"] and not c["disputed"]]
    print("RESULT: 0 errors; all=%d anchors=%d playable=%d disputed=%d (release=%s)"
          % (len(filtered), len(anchors), len(playable), len(disputed), release))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
