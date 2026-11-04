#!/usr/bin/env python3
"""Run tests/fixtures/validator_parity_cases.json through tools/validate_cards.py.

The same cases run in Godot (tests/integration/cards/validator_parity_test.gd)
through CardValidator, so both validators are checked against one expected
outcome per case. expect: rule number (0 = FIELD) that must appear, or null = pass.
Usage: python3 tools/validator_parity.py   (exit 0 = all cases match)
"""
import copy
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import validate_cards  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RULE = {"FIELD": 0, "R1": 1, "R2": 2, "R3": 3, "R4": 4, "R5": 5, "R6": 6, "R7": 7, "R8": 8, "R9": 9}


def apply(cards, op):
    find = lambda cid: next(c for c in cards if c.get("id") == cid)
    kind = op["op"]
    if kind == "remove_card":
        cards.remove(find(op["card"]))
        return
    if kind == "copy_card":
        dup = copy.deepcopy(find(op["card"]))
        dup["id"] = op["as"]
        cards.append(dup)
        return
    node = find(op["card"])
    path = op["path"]
    for key in path[:-1]:
        node = node[key]
    if kind == "set":
        node[path[-1]] = copy.deepcopy(op["value"])
    elif kind == "delete":
        del node[path[-1]]
    elif kind == "pop":
        node[path[-1]].pop()
    else:
        raise ValueError(kind)


def main():
    spec = json.loads((ROOT / "tests/fixtures/validator_parity_cases.json").read_text(encoding="utf-8"))
    base = json.loads((ROOT / spec["base"].replace("res://", "")).read_text(encoding="utf-8"))
    bad = 0
    for case in spec["cases"]:
        cards = copy.deepcopy(base)
        for op in case["ops"]:
            apply(cards, op)
        errors, _, _, _ = validate_cards.validate(cards)
        rules = {RULE[e[1:e.index("]")]] for e in errors}
        exp = case["expect"]
        ok = (not rules) if exp is None else (exp in rules)
        if not ok:
            bad += 1
            print(f"MISMATCH {case['name']}: expected {exp}, got {sorted(rules)}")
            for e in errors:
                print("    " + e)
    print(f"{len(spec['cases']) - bad}/{len(spec['cases'])} cases match")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
