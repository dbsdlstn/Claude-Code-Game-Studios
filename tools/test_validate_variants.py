#!/usr/bin/env python3
"""Mutation tests for the passage-variant rules V16-V21 (design/card-variants-spec.md §8.7-8)
and the 삼국사기 volume range rule V13a (D154).

Usage: python3 tools/test_validate_variants.py   (stdlib unittest, no file writes)
"""
import copy
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import validate_cards_v2 as v  # noqa: E402

PATHS, _, ERRS = v.read_manifest()
assert not ERRS, ERRS
BASE = [c for p in PATHS for c in json.loads(Path(p).read_text(encoding="utf-8"))["cards"]]
CID = "goguryeo-src-09"


def run(mutate):
    cards = copy.deepcopy(BASE)
    card = next(c for c in cards if c["id"] == CID)
    mutate(card)
    errors, warnings, _, _ = v.validate(cards)
    return errors, warnings


def codes(lines):
    return {l.split("]")[0].lstrip("[") for l in lines}


def var(card, **kw):
    card["variants"][0].update(kw)


class VariantRules(unittest.TestCase):
    def test_current_data_has_no_variant_errors(self):
        errors, warnings = run(lambda c: None)
        self.assertFalse({"V16", "V17", "V18", "V19", "V20"} & codes(errors + warnings))

    def test_no_variants_field_behaves_as_before(self):
        errors, _ = run(lambda c: c.pop("variants"))
        self.assertEqual(errors, [])

    def test_variant_with_title_anchor_or_year_is_error(self):
        for bad in ("평양 천도 뒤 나라가 남쪽으로 힘을 뻗었다는 이야기이다.",
                    "장수왕이 도읍을 옮겨 남쪽으로 힘을 뻗어 나갔다는 이야기이다.",
                    "427년에 도읍을 옮겨 남쪽으로 힘을 뻗어 나갔다는 이야기이다."):
            errors, _ = run(lambda c, t=bad: var(c, text=t))
            self.assertIn("V16", codes(errors), bad)

    def test_variant_equal_to_base_text_is_error(self):
        errors, _ = run(lambda c: var(c, text="  " + c["source_text"] + " "))
        self.assertIn("V16", codes(errors))

    def test_bad_text_basis_is_error(self):
        errors, _ = run(lambda c: var(c, text_basis="translation"))
        self.assertIn("V17", codes(errors))

    def test_three_variants_or_repeated_angle_or_v1_id_is_error(self):
        def three(c):
            base = c["variants"][0]
            c["variants"] = [dict(base, id=f"v{i}", angle=a, text=base["text"] + f" ({a})")
                             for i, a in ((2, "record"), (3, "actor"), (3, "scene"))]
        self.assertIn("V18", codes(run(three)[0]))

        def repeat(c):
            base = c["variants"][0]
            c["variants"].append(dict(base, id="v3", text=base["text"] + " 다른 문장."))
        self.assertIn("V18", codes(run(repeat)[0]))
        self.assertIn("V18", codes(run(lambda c: var(c, id="v1"))[0]))

    def test_neighbouring_anchor_name_is_warning(self):
        _, warnings = run(lambda c: var(c, text="뒷날 문자명왕 때까지 이어질 남쪽 진출의 발판이 이때 마련되었다고 본다."))
        self.assertIn("V19", codes(warnings))

    def test_verified_variant_needs_matching_hash(self):
        def m(c):
            var(c, verification={"verified": True, "verified_by": ["a", "b"], "verified_at": "2026-11-05",
                                 "original_checked": True, "exam_notation_checked": True, "content_hash": "x"})
        self.assertIn("V20", codes(run(m)[0]))

        def ok(c):
            var(c, verification={"verified": True, "verified_by": ["a", "b"], "verified_at": "2026-11-05",
                                 "original_checked": True, "exam_notation_checked": True,
                                 "content_hash": v.variant_hash(c["variants"][0])})
        self.assertNotIn("V20", codes(run(ok)[0]))

    def test_card_hash_ignores_variants(self):
        card = copy.deepcopy(next(c for c in BASE if c["id"] == CID))
        h = v.content_hash(card)
        card["variants"][0]["text"] += " 덧붙인 문장."
        self.assertEqual(v.content_hash(card), h)


class VolumeRange(unittest.TestCase):
    """V13a (D154): 삼국사기 권 number must fit the section."""

    def check(self, cid, vol):
        cards = copy.deepcopy(BASE)
        next(c for c in cards if c["id"] == cid)["source_ref"]["volume"] = vol
        return codes(v.validate(cards)[0])

    def test_baekje_bongi_section_number_is_error(self):
        self.assertIn("V13a", self.check("baekje-src-25", 3))

    def test_goguryeo_and_silla_out_of_range_is_error(self):
        self.assertIn("V13a", self.check("goguryeo-src-09", 5))
        self.assertIn("V13a", self.check("silla-src-04", 13))

    def test_in_range_volume_passes(self):
        self.assertNotIn("V13a", self.check("baekje-src-25", 25))


if __name__ == "__main__":
    unittest.main()
