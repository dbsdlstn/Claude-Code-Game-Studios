#!/usr/bin/env python3
"""Generate design/human-review-guide.md: the 1-hour review batches for the human fact-check.

Reads assets/data/cards/v2/*.json and design/fact-check-report-*.md. It only ORDERS the work
(uncertain items first); it does not check any fact. Re-run it after cards change:

    python3 tools/gen_review_guide.py            # writes design/human-review-guide.md
    python3 tools/gen_review_guide.py --stdout   # print instead

Standard library only. Time estimates per item are guesses, not measurements.
"""
import argparse
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = sorted(p for p in glob.glob(str(ROOT / "assets/data/cards/v2/*.json"))
              if Path(p).name not in ("manifest.json", "events.json"))
OUT = ROOT / "design/human-review-guide.md"

# report file -> (id prefix of the deck, accepted number range, id builder)
REPORTS = [
    ("fact-check-report-m1.md", "goguryeo", (1, 12), "m1"),
    ("fact-check-report-m2.md", "goguryeo", (13, 24), "src"),
    ("fact-check-report-m2-b3.md", "goguryeo", (25, 36), "src"),
    ("fact-check-report-baekje-b1.md", "baekje", (1, 12), "src"),
    ("fact-check-report-baekje-b2.md", "baekje", (13, 24), "src"),
    ("fact-check-report-silla-b1.md", "silla", (1, 12), "src"),
    ("fact-check-report-silla-b2.md", "silla", (13, 24), "src"),
]
# anchors the reports cover by summary only (no per-anchor row) -> treated as "일치(요약)"
SUMMARY_ANCHORS = {"baekje": "보고서 요약: 앵커 전부 일치", "silla": "보고서 요약: 앵커 전부 일치"}
# goguryeo anchor rows in the M1 report use the old id pattern goguryeo-anchor-<slug>
GOGURYEO_ANCHOR_ALIAS = {"dongmyeong", "sosurim", "gwanggaeto", "jangsu", "bojang", "taejo", "gogukcheon", "dongcheon", "micheon"}

MIN = {  # estimated minutes per item (guess)
    ("source", 1): 8, ("anchor", 1): 6, ("variant", 1): 6,
    ("source", 2): 6, ("anchor", 2): 4, ("variant", 2): 5,
    ("source", 3): 5, ("anchor", 3): 3, ("variant", 3): 4,
}
VARIANT_REPORT = "fact-check-report-variants-m1.md"
BATCH_MIN = 60
DECK_ORDER = {"goguryeo": 0, "baekje": 1, "silla": 2}


def clean(s):
    return re.sub(r"[`*]", "", s).strip()


def parse_reports():
    """id -> (verdict, detail). Only the first matching row of each report counts."""
    verdicts = {}
    for fname, deck, (lo, hi), kind in REPORTS:
        path = ROOT / "design" / fname
        if not path.exists():
            continue
        seen = set()
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.startswith("|"):
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) < 4:
                continue
            first = clean(cells[0])
            m = re.match(r"^(?:goguryeo-m1|src)-(\d+)$", first)
            cid = None
            if m and lo <= int(m.group(1)) <= hi:
                cid = f"{deck}-src-{int(m.group(1)):02d}"
            else:
                m2 = re.match(r"^goguryeo-anchor-([a-z]+)$", first)
                if kind == "m1" and m2 and m2.group(1) in GOGURYEO_ANCHOR_ALIAS:
                    cid = f"goguryeo-reign-{m2.group(1)}"
            if not cid or cid in seen:
                continue
            verdict = clean(cells[2])
            if not re.match(r"^(일치|수정|불확실|확인)", verdict):
                continue
            seen.add(cid)
            verdicts[cid] = (verdict, clean(cells[3]))
    return verdicts


def parse_variant_report():
    """card id -> (verdict, new-facts note) from the 변형별 대조 table (goguryeo M1 variants only)."""
    out = {}
    path = ROOT / "design" / VARIANT_REPORT
    if not path.exists():
        return out
    in_table = False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## 변형별 대조"):
            in_table = True
            continue
        if in_table and line.startswith("## "):
            break
        if in_table and line.startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            m = re.match(r"^src-(\d+)", clean(cells[0])) if cells else None
            if m and len(cells) >= 6:
                cid = f"goguryeo-src-{int(m.group(1)):02d}"
                out[cid] = (clean(cells[-1]), clean(cells[2]))
    return out


def year_text(y):
    return f"기원전 {-y}" if isinstance(y, int) and y < 0 else str(y)


def load_items():
    cards = []
    for f in DATA:
        for c in json.loads(Path(f).read_text(encoding="utf-8"))["cards"]:
            cards.append(c)
    anchors = {c["id"]: c for c in cards if c["kind"] == "anchor"}
    return cards, anchors


def tier_of(cid, nation, kind, verdicts):
    if cid in verdicts:
        v = verdicts[cid][0]
        return (1, v) if re.match(r"^(수정|불확실|확인 못)", v) else (3, v)
    if kind == "anchor" and nation in SUMMARY_ANCHORS:
        return 3, SUMMARY_ANCHORS[nation]
    return 2, "보고서에 없음"


def claim(c, anchors):
    if c["kind"] == "anchor":
        r = c["reign"]
        alt = "; ".join(f"{year_text(a['start'])}~{year_text(a['end'])}" for a in (c.get("reign_alt") or []))
        return f"즉위 {year_text(r['start'])}년 · 재위 {year_text(r['end'])}년까지" + (f" (이설: {alt})" if alt else "")
    after = anchors.get(c["answer"]["after"], {}).get("title", "?")
    before = anchors.get(c["answer"].get("before") or "", {}).get("title")
    alt = "; ".join(str(a.get("year")) for a in (c.get("year_alt") or []) if isinstance(a, dict))
    return (f"{year_text(c['year'])}년 · {c.get('reign_label', '')} · 정답 칸 '{after} 즉위 ~ "
            + (f"{before} 즉위 전'" if before else "끝'") + (f" (이설: {alt})" if alt else ""))


def search_term(c):
    ref = c.get("source_ref") or {}
    vol = f"권{ref['volume']} " if ref.get("volume") else ""
    work = ref.get("work") or "삼국사기"
    return f"{work} {ref.get('section', '')} {ref.get('entry', '')}".replace("  ", " ").strip() + (f" ({vol.strip()})" if vol else "")


INTRO = """# 사람 사실 확인 가이드 (비전문가용)

> **상태**: 2026-11-05 생성(`tools/gen_review_guide.py`, D127). 카드나 보고서가 바뀌면 `python3 tools/gen_review_guide.py`로 다시 만든다.
> **이 문서의 목적**: M2-B의 사람 사실 확인(`production/milestones/m2.md` B1)을 **누구나 따라 할 수 있게** 1시간 단위로 쪼갠 작업표다. 카드 {ncard}장 + 연표 앵커(왕) {nanchor}개 + **지문 변형 {nvariant}개** = {n}개 항목.
> **한계**: 시간은 **추정**(측정 안 함)이다. 한국사데이터베이스(db.history.go.kr)의 화면 구성은 이 세션이 접속하지 못해 확인하지 못했으니 메뉴 이름은 바뀌었을 수 있다. 표의 "보고서 판정"은 **모델 세션이 웹 검색으로 한 대조**이며 사람 확인이 아니다. 이 문서도 어떤 사실이 맞다고 보증하지 않는다.

## 1. 무엇을 하는가 (3줄 요약)
1. 카드에 적힌 **연도·왕·사건**이 맞는지 **원문(삼국사기 등)**과 비교한다.
2. **사건 이름·왕 이름 표기**가 한능검 해설에서 쓰이는 표기와 같은지 한 번 본다.
3. 확인한 사람의 이름을 **`tools/mark_verified.py`로 기록**한다. **서로 다른 두 사람**이 각자 확인해야 카드가 "확인됨"이 된다.

> **중요**: 이 일은 **사람만** 할 수 있다. 모델(Claude 등)에게 시키거나 이름을 대신 적게 하지 않는다. 모르겠으면 "확인 못 함"으로 두는 것이 거짓으로 "확인됨"을 적는 것보다 훨씬 낫다.

## 2. 준비물
- 컴퓨터(파일을 고칠 수 있는 환경), 이 저장소, 인터넷.
- **한국사데이터베이스**(국사편찬위원회 db.history.go.kr)에서 *삼국사기*를 검색할 수 있는 브라우저.
- 이름을 정해 둔다. **확인자 2명**이 서로 다른 날 또는 다른 시간에 각자 합니다. 한 사람이 두 이름으로 하는 것은 안 된다.
- 선택: 한능검 기출 해설 페이지(검색으로 찾음)를 볼 수 있는 브라우저.

## 3. 한 항목을 확인하는 법 (약 3~8분)

표의 한 줄이 한 항목이다. **왼쪽부터** 따라 한다.

1. **`확인할 한 줄`**을 읽는다. 카드가 말하는 연도·왕·정답 칸이다.
2. **`검색어`**를 한국사DB 검색창에 넣고 *삼국사기*(또는 표에 적힌 책)로 좁힌다. 해당 본기의 해당 왕 해당 연도 기사를 연다.
3. **원문(또는 번역문)에서 같은 기사를 찾아 읽고 세 가지만 본다.**
   - (가) **연도**: 기사의 연도(왕 몇 년)가 카드의 연도와 같은가? 왕의 즉위년과 더해 계산이 맞는가?
   - (나) **왕·사건**: 기사의 왕과 사건이 카드와 같은가?
   - (다) **정답 칸**: 카드가 놓인 "ㅇㅇ왕 즉위 ~ ㅇㅇ왕 즉위 전" 사이에 그 연도가 들어가는가?
4. **표기 확인**: 인터넷에서 `한능검 {카드 제목}`을 검색해 해설에서 쓰는 사건 이름·왕 이름 표기가 카드와 **같은지** 본다. 다르면 표기 메모만 남긴다(틀린 것이 아니다).
5. **판정**을 정한다.
   - **맞음**: (가)(나)(다)가 모두 맞다. → 기록한다(아래 6절).
   - **다름·불확실**: 하나라도 다르거나 원문을 못 찾았다. → **기록하지 말고** 아래 5절 양식으로 메모만 남긴다.
6. 한국사DB의 해당 기사 **주소(URL)**를 복사해 둔다. 기록할 때 같이 넣는다(출시 검사에 필요).

> **막히면**: 원문을 못 찾으면 번역문으로, 그래도 못 찾으면 "못 찾음"으로 메모하고 넘어간다. 한 항목에 15분 넘게 쓰지 않는다.
> **원문 문장을 그대로 베끼지 않는다.** 이 저장소의 카드 지문은 원문을 직접 풀어 쓴 것이고 번역문은 저작권이 따로 있다(D4). 메모에는 "무엇이 다른지"만 한 줄로 쓴다.

## 3b. 지문 변형 항목 (`카드id#v2` 형식 id)을 확인하는 법

표에서 id에 `#`이 붙은 줄은 **카드 하나의 다른 지문(변형)**이다(`design/card-variants-spec.md`). 변형은 카드와 **따로** 확인한다(변형마다 두 사람). 규칙은 D180이다: **변형은 원 카드와 같은 기사의 내용만** 담아야 한다.

1. 표의 **변형 지문**을 읽는다. 오른쪽 검색어로 **원 카드가 가리키는 기사**(같은 권·조)를 연다.
2. 아래 **세 가지만** 본다. 하나라도 걸리면 **기록하지 말고** 5절 양식으로 메모한다.
   - (가) **새 사실이 없는가**: 변형 문장의 모든 내용이 **그 기사에 실려 있는가**. 기사에 없는 배경·이후 영향·학자의 해석은 안 된다. (해설에만 있는 내용도 안 된다. 카드의 해설을 옆에 놓고, 그 문장이 해설에서 온 것이 아닌지 본다.)
   - (나) **다른 카드·다른 사료의 사실이 섞이지 않았는가**: 같은 왕 때 다른 사건(다른 카드)이나, 삼국유사·일본서기·비문 같은 **다른 책의 이야기**가 들어 있으면 안 된다.
   - (다) **같은 덱 다른 카드의 이름이 없는가**: 같은 나라의 다른 카드 제목이나 그 카드에만 나오는 사건·인물 이름이 있으면 안 된다(목록에서 비슷한 제목을 찾아 본다).
3. 정답이 **같은 칸**인지, 왕 이름·연도가 **드러나지 않는지**도 본다(카드와 같은 기준).
4. 기록은 카드와 똑같지만 **id에 `#v2`까지 붙여** 쓴다. `--url`은 필요 없다(원 카드의 출처를 그대로 쓴다).

```sh
python3 tools/mark_verified.py --reviewer "홍길동" --date 2026-11-06 \
    --original-checked --exam-notation-checked goguryeo-src-09#v2 --write
```

> 변형의 보고서 판정이 *수정 필요*였던 항목은 콘텐츠 담당이 문장을 고쳤는지 먼저 확인한다. **고치기 전 문장은 기록하지 않는다**(고친 뒤에 바뀐 문장을 확인한다. 문장이 바뀌면 이전 확인은 자동으로 무효가 된다).
> 확인되지 않은 변형은 게임에서 **자동으로 쓰이지 않는다**(그 카드는 원래 지문만 나온다). 그러니 변형 확인은 급하지 않다.

## 4. 순서와 규칙
- **위에서 아래로 한 묶음(약 1시간)씩** 한다. 묶음 1이 가장 중요하다(보고서에서 "불확실·수정 필요·확인 못 함"이었던 것, 즉 틀릴 가능성이 높은 것).
- 한 묶음은 한 번에 끝내지 않아도 된다. 항목마다 체크하고(표의 ☐) 마지막에 한꺼번에 기록해도 된다.
- 보고서가 "수정 필요"라고 한 항목은 이미 문장이 고쳐졌을 수 있다. **지금 카드에 적힌 문장**이 맞는지를 본다.
- 두 번째 확인자는 **첫 번째 확인자의 메모를 보지 않고** 똑같이 한다(독립 확인).

## 5. 틀리거나 불확실하면 (메모 양식)
카드 내용을 **직접 고치지 않는다**(고치면 이미 한 확인이 무효가 된다). 아래 한 줄을 `production/review/human-review-log.md`(없으면 만든다)에 추가하고 콘텐츠 담당에게 넘긴다.

```
| 날짜 | 확인자 | 항목 id | 판정(다름/불확실/못 찾음) | 무엇이 다른가 (한 줄, 원문 인용 없이) | 근거 주소 |
| 2026-11-06 | 홍길동 | goguryeo-src-09 | 다름 | 카드는 427년인데 기사의 왕 연차로 계산하면 426년 | https://db.history.go.kr/... |
```

## 6. 확인했으면 기록하는 법 (`tools/mark_verified.py`)
**맞음으로 판정한 항목만** 기록한다. 터미널에서 저장소 폴더로 가서:

```sh
# 1) 연습: 아무것도 바꾸지 않고 결과만 보여 준다 (기본값)
python3 tools/mark_verified.py --reviewer "홍길동" --date 2026-11-06 \\
    --original-checked --exam-notation-checked \\
    --url "https://db.history.go.kr/해당기사주소" goguryeo-src-09

# 2) 결과가 맞으면 같은 명령 끝에 --write 를 붙여 실제로 기록한다
python3 tools/mark_verified.py --reviewer "홍길동" --date 2026-11-06 \\
    --original-checked --exam-notation-checked \\
    --url "https://db.history.go.kr/해당기사주소" goguryeo-src-09 --write
```

- `--reviewer`에는 **본인 이름**을 쓴다. `--date`는 오늘 날짜(YYYY-MM-DD).
- `--original-checked`는 "원문(또는 번역문)과 비교했다", `--exam-notation-checked`는 "기출 표기를 봤다"는 뜻이다. **하지 않은 것은 붙이지 않는다.**
- 항목 여러 개는 id를 이어서 쓰거나 `--ids-file 파일.txt`(한 줄에 id 하나)로 준다. **`--url`은 줄에 쓴 모든 항목에 똑같이 들어가므로 항목 하나씩 또는 같은 기사 쪽만 묶어서** 쓴다.
- **기록되는 것**(`verification` 필드): `verified_by`(확인자 이름 목록), `original_checked`, `exam_notation_checked`, `verified_at`, `content_hash`(카드 내용의 지문, 자동 계산), `source_ref.url`.
- **첫 번째 사람**이 기록하면 "한 명 기록됨"이 되고 `verified`는 **아직 false**다. **두 번째 다른 사람**이 같은 항목을 기록하고 두 사람 모두 두 확인을 했으면 `verified`가 **true**가 된다.
- 카드 내용(지문, 연도, 정답 칸, 해설, 출처)이 **나중에 바뀌면** 확인은 자동으로 무효가 되고(검증기가 불일치를 알려 준다) 이전 확인자는 다시 해야 한다.
- 잘못 기록했으면 파일을 직접 고치지 말고 `git`으로 되돌린 뒤 다시 한다(`git checkout -- assets/data/cards/v2`).

### 기록 뒤 점검
```sh
python3 tools/validate_cards_v2.py          # 오류 0이어야 한다
python3 tools/validate_cards_v2.py --release  # 아직 실패가 정상이다(미확인 항목이 있는 동안)
```
`--release`가 통과하려면 카드마다 확인 2명, 원문 확인, 기출 표기 확인, `source_ref.url`이 있어야 한다. 앵커는 `source_ref.volume`도 필요하다(이미 채워져 있는지 검증기가 알려 준다).

## 7. 우선순위 규칙 (이 표가 정렬된 방식)
1. **1순위**: 모델 보고서가 *불확실 / 수정 필요 / 확인 못 함*으로 본 항목(변형 포함).
2. **2순위**: 보고서에 **아예 없는** 항목(대조되지 않음. 백제·신라 변형이 여기에 많다).
3. **3순위**: 보고서가 *일치*로 본 항목(모델 대조이며 사람 확인은 필요하다).
같은 순위 안에서는 고구려 → 백제 → 신라, 앵커 → 카드 → 변형, 번호 순이다. 한 묶음은 약 60분 분량(항목별 추정 시간: 1순위 카드 8분·앵커 6분·변형 6분, 2순위 카드 6분·앵커 4분·변형 5분, 3순위 카드 5분·앵커 3분·변형 4분).

"""


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--stdout", action="store_true")
    a = ap.parse_args(argv)
    verdicts = parse_reports()
    cards, anchors = load_items()
    items = []
    for c in cards:
        if c["kind"] == "source" and c.get("disputed"):
            pass
        tier, v = tier_of(c["id"], c["nation"], c["kind"], verdicts)
        detail = verdicts.get(c["id"], ("", ""))[1]
        items.append(dict(card=c, tier=tier, verdict=v, detail=detail))
    vreport = parse_variant_report()
    for c in cards:
        if c["kind"] != "source":
            continue
        for var in c.get("variants") or []:
            vid = f"{c['id']}#{var['id']}"
            if (var.get("verification") or {}).get("verified") is True:
                continue
            rep_ = vreport.get(c["id"]) if var["id"] == "v2" else None
            if rep_:
                verdict, note = rep_
                tier = 1 if re.match(r"^(수정|불확실|확인 못)", verdict) else 3
                detail = note
            else:
                verdict, tier, detail = "보고서에 없음", 2, ""
            items.append(dict(card=c, variant=var, vid=vid, tier=tier, verdict=verdict, detail=detail))

    def sortkey(i):
        c = i["card"]
        if "variant" in i:
            return (i["tier"], DECK_ORDER.get(c["nation"], 9), 2, int(re.findall(r"\d+$", c["id"])[0]))
        return (i["tier"], DECK_ORDER.get(c["nation"], 9), 0 if c["kind"] == "anchor" else 1,
                c.get("order", 0) if c["kind"] == "anchor" else int(re.findall(r"\d+$", c["id"])[0]))
    items.sort(key=sortkey)
    batches, cur, used = [], [], 0
    for it in items:
        m = MIN[("variant" if "variant" in it else it["card"]["kind"], it["tier"])]
        if cur and used + m > BATCH_MIN:
            batches.append((cur, used))
            cur, used = [], 0
        cur.append(it)
        used += m
    if cur:
        batches.append((cur, used))

    nvar = sum(1 for i in items if "variant" in i)
    nsrc = sum(1 for i in items if i["card"]["kind"] == "source" and "variant" not in i)
    nanc = len(items) - nsrc - nvar
    out = [INTRO.replace('{ncard}', str(nsrc)).replace('{nanchor}', str(nanc)).replace('{nvariant}', str(nvar)).replace('{n}', str(len(items)))]
    tiers = {t: sum(1 for i in items if i["tier"] == t) for t in (1, 2, 3)}
    out.append("## 8. 전체 요약\n")
    out.append(f"- 항목 {len(items)}개 = 카드 {nsrc} + 앵커 {nanc} + 지문 변형 {nvar}. 묶음 {len(batches)}개, 추정 총 {sum(u for _, u in batches)}분(약 {sum(u for _, u in batches) / 60:.1f}시간, 확인자 한 명 기준).")
    out.append(f"- 1순위(불확실·수정 필요) {tiers[1]}개, 2순위(보고서에 없음) {tiers[2]}개, 3순위(보고서상 일치) {tiers[3]}개.")
    out.append("- **확인자 2명이 같은 목록을 각자 하므로** 전체 확인에는 위 시간의 2배가 든다(추정).\n")
    out.append("| 묶음 | 항목 수 | 추정 시간 | 순위 | 내용 |\n|---|---|---|---|---|")
    for bi, (b, used) in enumerate(batches, 1):
        ts = sorted({i["tier"] for i in b})
        decks = []
        for i in b:
            d = {"goguryeo": "고구려", "baekje": "백제", "silla": "신라"}.get(i["card"]["nation"], i["card"]["nation"])
            if d not in decks:
                decks.append(d)
        out.append(f"| {bi} | {len(b)} | {used}분 | {'/'.join(str(t) for t in ts)} | {', '.join(decks)} |")
    out.append("\n## 9. 묶음별 작업표\n")
    for bi, (b, used) in enumerate(batches, 1):
        out.append(f"### 묶음 {bi} (약 {used}분, 항목 {len(b)}개)\n")
        out.append("| ☐ | id | 제목 | 확인할 한 줄 | 한국사DB 검색어 | 보고서 판정 · 주의 |\n|---|---|---|---|---|---|")
        for it in b:
            c = it["card"]
            if "variant" in it:
                var = it["variant"]
                note = it["verdict"] + (f" · {it['detail'][:110]}…" if it["tier"] == 1 and it["detail"] else "")
                if it["tier"] == 1:
                    note += " · **보고서의 지적이 고쳐졌는지 먼저 본다**"
                vt = var.get("text", "")
                out.append(f"| ☐ | `{it['vid']}` | {c['title']} · 변형 {var['id']}({var.get('angle', '')}) | 변형 지문: “{vt}” (원 카드 `{c['id']}`의 기사와 비교) | {search_term(c)} | {note} |")
                continue
            note = it["verdict"] + (f" · {it['detail'][:110]}…" if it["tier"] == 1 and it["detail"] else "")
            if c["kind"] == "source" and c.get("disputed"):
                note += " · 판정 제외(disputed)"
            out.append(f"| ☐ | `{c['id']}` | {c['title']} | {claim(c, anchors)} | {search_term(c)} | {note} |")
        out.append("")
    out.append("## 10. 끝났을 때\n- 모든 묶음을 **두 사람**이 끝냈으면 `python3 tools/validate_cards_v2.py --release`가 통과하는지 본다. 통과하면 M2-B의 B1(사실 확인)이 충족된다.\n- 못 찾은 것·다른 것은 `production/review/human-review-log.md`에 모여 있어야 하고, 콘텐츠 담당이 고친 뒤 해당 항목을 **다시** 확인한다.\n- 확인을 마치지 못한 카드는 `verified: false`인 채로 두면 출시 빌드(`--release`)에서 자동으로 빠진다. 억지로 채우지 않는다.")
    text = "\n".join(out) + "\n"
    if a.stdout:
        sys.stdout.write(text)
    else:
        OUT.write_text(text, encoding="utf-8")
        print(f"wrote {OUT.relative_to(ROOT)}: {len(items)} items, {len(batches)} batches")
    return 0


if __name__ == "__main__":
    sys.exit(main())
