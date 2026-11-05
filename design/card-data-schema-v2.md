# Card Data Schema v2 (초안)

> **상태**: 초안(2026-11-05). M1 사람 테스트 결과로 확정한다(`production/playtest/m1-plan.md`). 확정 전에는 필드를 바꿔도 되지만 바꿀 때마다 `docs/decision-log.md`에 적는다.
> **근거**: D56(`docs/decision-log.md`), 브리프 v3(`design/game-brief.md`), 평가 보고서 5절의 품질 게이트(`docs/reviews/evaluation-hanneungeom.md`).
> **v1과의 관계**: v0 빌드(`web/`, `src/`)는 v1(`design/card-data-schema.md`)을 그대로 쓰며 동결이다. v1 파일과 v1 검증기(`tools/validate_cards.py`)는 건드리지 않는다. v2는 별도 파일과 별도 검증기를 쓴다(아래 "파일", "검증 규칙").

## 개념

- **왕대 앵커(`kind: "anchor"`)**: 나라별 왕대 연표의 기준 카드. 연표 위에 처음부터 놓여 있고 이름이 보인다. 즉위 연도(`reign.start`)가 칸의 경계가 된다.
- **사료 카드(`kind: "source"`)**: 앞면이 이름 없는 사료 지문이다. 플레이어는 이 카드를 **앵커 사이의 칸**에 꽂는다. 칸 k는 "앵커 k의 즉위 연도 이상, 앵커 k+1의 즉위 연도 미만"이다. 마지막 앵커의 칸은 위쪽 경계가 없다.
- **칸의 해상도 한계**: 앵커 사이에 여러 왕이 들어가면 그 칸은 그 왕들을 모두 담는다(예: 고국천왕 앵커와 소수림왕 앵커 사이에는 고국천왕 뒤의 여러 왕이 있다). 칸의 이름은 "앵커 이후 ~ 다음 앵커 이전"으로 표시하고, 정확한 왕대는 해설의 `reign_label`이 말한다. 해상도를 높이려면 앵커를 추가한다.
- **관계 단서의 구조적 한계**: 앵커 하나에 대한 "먼저/나중"은 연표를 한 점에서 반으로만 가른다. M1 후보 12장으로 계산하면(앵커 10개) 중간 칸에 있는 카드(소수림왕·광개토왕 칸 등)는 단일 관계로 후보를 2~4칸으로 좁힐 수 없고 5칸 이상이 남는다. 그래서 1단계 단서는 **구간(앵커 1~2개)**을 허용한다. 구간으로는 12장 모두 후보를 3칸으로 좁힐 수 있다(`production/playtest/m1-plan.md`의 후보표).
- **숙련도(상자, 등급)는 카드 데이터가 아니라 저장 데이터**다(`design/leitner-spec.md`). 카드 JSON에는 플레이 상태를 넣지 않는다.
- v1의 `difficulty`는 v2에 없다. 모델 점검에서 풀이 단계를 예측하지 못했고(`production/playtest/clue-difficulty-precheck.md`), 난이도는 플레이 기록에서 계산한다.

## 파일

- 데이터: `assets/data/cards/v2/<이름>.json` (객체 하나: `{ "schema": 2, "cards": [ ... ] }`, 앵커와 사료 카드를 같은 배열에 둔다). M1은 `assets/data/cards/v2/goguryeo-m1.json`.
- 검증기: `tools/validate_cards_v2.py`(D67, 표준 라이브러리, V1~V15와 release R1~R3, 앵커 상한 10). 종료 코드는 `validate_cards.py`와 같게 한다(0 통과, 1 위반, 2 파일 오류).
- 연도는 정수. **기원전은 음수**(기원전 37년 = `-37`), 서기는 양수이며 `0`은 쓰지 않는다.

## 공통 필드

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | string | 예 | 고유 ID. 앵커 `<nation>-reign-<slug>`(예: `goguryeo-reign-jangsu`), 사료 카드 `<nation>-src-<nn>`(예: `goguryeo-src-07`). id는 칸을 알려 주지 않아야 하므로 시기·왕대를 넣지 않는다. 한 번 정하면 바꾸지 않는다. |
| `kind` | enum | 예 | `anchor` / `source` |
| `nation` | enum | 예 | `goguryeo` / `baekje` / `silla` / `gaya` / `usilla`(통일신라) / `balhae`(발해) / `goryeo`(고려) (남북국 두 값은 D183·설계 D133, 고려는 D190) |
| `title` | string | 예 | 앵커는 왕 이름, 사료 카드는 정답 공개 후 표시되는 사건 이름. 플레이 중 사료 카드의 제목은 숨겨진다. |
| `source_ref` | object | 예 | 근거 사료. 아래 "출처". |
| `verification` | object | 예 | 사실 확인 상태. 아래 "사실 확인". |
| `image`, `image_source`, `image_license` | string\|null | 아니오 | v1과 같다. `image`가 있으면 나머지 둘이 필요하다. |
| `v1_id` | string\|null | 아니오 | 이 카드가 v1 카드에서 나왔으면 그 id(추적용). 값은 가져오지 않고 새로 쓴다. |

## 왕대 앵커

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `order` | int | 예 | 같은 나라 앵커의 연표 순서(1부터 빈틈없이). |
| `reign` | object | 예 | `{ "start": int, "end": int, "basis": "chronicle\|inscription\|consensus" }`. 즉위·재위 끝 연도와 근거(삼국사기 기년 / 금석문 / 통설·기출 표기). |
| `summary` | string | 예 | 정답 공개 후 보이는 한 줄(예: `고구려 제2대 왕.`). 칸을 알려 주는 사건을 쓰지 않는다. |
| `reign_alt` | array | 아니오 | 재위 이설(D68 정식 필드). `[{ "start": int, "end": int, "note": string }]`. 자료마다 다른 재위(예: 광개토왕 392~413, 태조왕 53~165 사망 기준)를 근거와 함께 둔다. **판정에는 쓰지 않고** 연표 표시와 해설에만 쓴다. 없으면 `[]`. |

```json
{
  "schema": 2,
  "cards": [
    {
      "id": "goguryeo-reign-jangsu",
      "kind": "anchor",
      "nation": "goguryeo",
      "title": "장수왕",
      "order": 7,
      "reign": { "start": 413, "end": 491, "basis": "chronicle" },
      "summary": "고구려 제20대 왕.",
      "source_ref": { "work": "삼국사기", "section": "고구려본기", "volume": null, "entry": "장수왕조", "url": null, "db_id": null, "note": "권 번호와 재위 연도는 원문 대조 전(검증 전)" },
      "verification": { "verified": false, "verified_by": [], "verified_at": null, "original_checked": false, "exam_notation_checked": false, "content_hash": null },
      "image": null, "image_source": null, "image_license": null, "v1_id": null
    }
  ]
}
```

> **콘텐츠 초안 형식의 필드(D65)**: 이전 초안(`assets/data/cards/v2-draft/`)은 앵커에 표시용 `reign_range`(문자열), 다른 값 목록 `reign_range_alt`, 출처 메모 `reign_note`를 썼다. 스키마 v2에서는 정식 필드 `reign`(판정용 start/end)과 `reign_alt`로 대체되었고 출처 메모는 `source_ref.note`에 둔다. 세 필드는 v2 파일에 넣지 않는다. 웹 로더는 초안 형식을 읽을 때만 이 필드를 읽는다.

## 사료 카드

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `year` | int | 예 | **정답 표기 연도.** 최근 기출의 표기를 따른다(평가 보고서 5절). 한 해로 말할 수 있는 사건만 카드로 쓴다(기간 사건은 시작이나 끝 한 해를 골라 `year_note`에 밝힌다). |
| `year_alt` | array | 아니오 | 이설. `[{ "year": int, "note": string }]`. 정답 판정에는 쓰지 않는다. **정답 칸과 같은 칸에 드는 연도만 둔다**(D185): 다른 칸에 드는 이설은 여기에 넣지 않고 `year_note`·해설에 "다른 견해(○년)"로만 적는다. 해설에 이설을 쓰면 "시험에서는 ○년 기준"을 함께 적는다. 검증기가 칸이 다른 `year_alt`를 오류로 잡는다(콘텐츠 구현). |
| `year_basis` | enum | 예 | `chronicle`(삼국사기 기년) / `inscription`(금석문) / `consensus`(통설·기출 표기) / `disputed`(학설이 갈림). |
| `year_note` | string\|null | 아니오 | 연도 표기에 관한 한 줄(예: `전승 연대`, `착공 연도`). |
| `reign_label` | string | 예 | 해설에 나오는 정확한 왕대(예: `장수왕 15년`). 판정에는 쓰지 않는다. |
| `source_text` | string | 예 | **카드 앞면 사료 지문.** 원문을 근거로 **직접 풀어 쓴** 문장 2~4개(권장 40~200자). 번역문을 옮기지 않는다(D4). 사건 이름, 왕 이름, 연도를 쓰지 않는다. |
| `text_basis` | enum | 예 | `own_paraphrase_from_original`만 허용. 번역문 인용이 섞이면 이 값을 쓰지 못한다. |
| `clues` | array(2) | 예 | 단서 2개. 아래 "단서". |
| `answer` | object | 예 | 연표 위 정답 칸. `{ "after": <앵커 id>, "before": <다음 앵커 id 또는 null>, "same_year": null \| "before_next_accession" }`. `same_year`(D68 정식 필드, 선택)는 사건이 **다음 앵커의 즉위와 같은 해**에 있었지만 즉위 **앞**에 일어난 경우에만 `"before_next_accession"`으로 둔다(예: 고국원왕 전사 371 → 소수림왕 즉위 371 이전). 이 값이 있으면 `year == before.reign.start`가 허용된다(V6). 다른 값은 오류. |
| `explanation` | string | 예 | 정답 후 해설. `reign_label`과 연도, 왜 그 칸인지, 시험에서 연결되는 내용을 담는다. |
| `exam_tags` | array(enum) | 예 | 출제 주제, 하나 이상: `institution`(제도·정치) / `person`(인물) / `war`(전쟁·대외) / `culture`(문화·종교·사회). 새 값을 넣으려면 결정 기록이 필요하다. |
| `disputed` | bool | 예 | 학설이 갈려 판정에서 뺀다. `year_basis`가 `disputed`이면 true. |
| `disputed_note` | string\|null | disputed면 예 | 갈리는 견해 요약. 플레이어에게 보이는 문장이므로 작업 메모는 `source_ref.note`에 쓴다. |
| `tags` | array(string) | 아니오 | 검색용. |

### 출처 (`source_ref`)

```json
{ "work": "삼국사기", "section": "고구려본기", "volume": null, "entry": "장수왕 15년조",
  "url": null, "db_id": null, "exam_rounds": [], "note": "..." }
```

- `work`, `section`, `entry`는 필수다. 권·조 단위가 목표이므로 `volume`(권)은 **release 모드에서 필수**다.
- `url`(공개 링크)과 `db_id`(한국사데이터베이스 식별자) 중 하나는 **release 모드에서 필수**다(출처 URL이 없으면 release 실패).
- `exam_rounds`: 이 사건이 나온 기출 회차 태그(선택). 기출 지문과 해설을 옮겨 적지 않고 회차 번호만 둔다.

### 단서 (`clues`)

```json
[
  { "level": 1, "kind": "relation",
    "relations": [ { "op": "after", "ref": "goguryeo-reign-sosurim" },
                   { "op": "before", "ref": "goguryeo-reign-yeongyang" } ],
    "text": "[소수림왕]이 즉위한 뒤, [영양왕]이 즉위하기 전의 일이다." },
  { "level": 2, "kind": "direct", "text": "장수왕 15년(427년). 국내성에서 평양으로." }
]
```

| 단계 | `kind` | 규칙 | 숙련도 비용(`leitner-spec.md`) |
|---|---|---|---|
| 1 | `relation` | **후보 칸을 2~3개로 좁히는 구간**(D68, D62의 "한쪽만"을 대체). `relations`는 `after` 하나와 `before` 하나(필요하면 한쪽만)로, 각각 `op`가 `before`(앵커의 즉위 **이전**) 또는 `after`(앵커의 즉위 **이후**), `ref`가 같은 나라의 앵커 id다. `after`의 앵커는 `before`의 앵커보다 앞 순서이고, 두 앵커 사이의 **틈이 2~3개**가 되게 고른다(정답 틈의 바로 앞뒤 두 앵커를 함께 말해 후보를 1칸으로 만드는 것은 **금지**: 정답을 그대로 알려 준다). 본문에 쓴 모든 `ref`의 `[앵커 제목]`이 들어간다. 후보가 4칸 이상이면 경고. | 열고 맞히면 승급 없음 |
| 2 | `direct` | 연도·왕·인물 등 직접 힌트. 정답을 거의 확정해도 된다. | 열고 맞히면 한 상자 강등 |

사료 지문(앞면)은 단서가 아니라 문제이므로 비용이 없다.

### 사료 카드 예시

```json
{
  "id": "goguryeo-src-07",
  "kind": "source",
  "nation": "goguryeo",
  "title": "평양 천도",
  "year": 427,
  "year_alt": [],
  "year_basis": "chronicle",
  "year_note": null,
  "reign_label": "장수왕 15년",
  "source_text": "왕이 자리에 오른 지 열다섯 해가 되던 해, 오래 도읍이던 국내성을 떠나 남쪽의 평양성으로 도읍을 옮겼다.",
  "text_basis": "own_paraphrase_from_original",
  "clues": [
    { "level": 1, "kind": "relation",
      "relations": [ { "op": "after", "ref": "goguryeo-reign-sosurim" }, { "op": "before", "ref": "goguryeo-reign-yeongyang" } ],
      "text": "[소수림왕]이 즉위한 뒤, [영양왕]이 즉위하기 전의 일이다." },
    { "level": 2, "kind": "direct", "text": "장수왕 15년(427년). 국내성에서 평양으로." }
  ],
  "answer": { "after": "goguryeo-reign-jangsu", "before": "goguryeo-reign-yeongyang" },
  "explanation": "장수왕 15년(427년)에 도읍을 국내성에서 평양으로 옮긴 일. 남쪽으로 진출하는 발판이 되어 475년 한성 함락으로 이어진다.",
  "exam_tags": ["institution"],
  "source_ref": { "work": "삼국사기", "section": "고구려본기", "volume": null, "entry": "장수왕 15년조", "url": null, "db_id": null, "exam_rounds": [], "note": "연도와 문구는 원문 대조 전(검증 전)" },
  "disputed": false,
  "disputed_note": null,
  "verification": { "verified": false, "verified_by": [], "verified_at": null, "original_checked": false, "exam_notation_checked": false, "content_hash": null },
  "image": null, "image_source": null, "image_license": null,
  "v1_id": "goguryeo-peak-01",
  "tags": ["고구려", "천도"]
}
```

## 사실 확인 (`verification`)

평가 보고서 5절의 품질 게이트를 데이터에 담는다. **확인은 사람만 한다.** 모델 대조는 보조 자료로만 쓰고 `verified_by`에 쓰지 않는다.

| 필드 | 설명 |
|---|---|
| `verified` | 확인 완료 여부. release는 true인 카드만 싣는다. |
| `verified_by` | 확인한 사람 이름 배열. true이려면 **서로 다른 두 사람 이상**(1차 확인과 교차 확인). |
| `verified_at` | 확인 날짜(ISO). |
| `original_checked` | 1차 자료 원문(한국사데이터베이스의 삼국사기 원문, 비문 판독문 등)과 대조했는가. |
| `exam_notation_checked` | 최근 기출의 표기와 대조했는가. 기출에 없는 사건이면 `exam_tags`가 아니라 `year_note`에 "기출 범위 밖"을 적고 true로 둔다. |
| `content_hash` | 확인한 내용의 해시. 계산: `sha256(utf8(json.dumps({"source_text", "year", "answer", "explanation", "source_ref": {"work", "section", "entry"}}, sort_keys=True, ensure_ascii=False)))`. 확인을 끝낼 때 도구가 채운다. |

**문구가 바뀌면 `verified`는 자동으로 풀린다.** 검증기는 `verified`가 true인데 `content_hash`가 현재 내용과 다르면 오류를 낸다(편집 도구가 false로 되돌리고 `verified_by`를 비운다). 사람이 다시 확인해야 한다.

## 검증 규칙 (초안)

> **검증기와의 차이(e099b43 기준)**: 검증기는 아직 D62 동작(기본 `relations` 1개, `--allow-two-relations`로 2개)이고 "후보 1칸 오류, 4칸 이상 경고"(D68)는 반영 전이다. 위 표가 정답 규칙이고 검증기가 따라온다. 현재 검증기는 후보 칸 수를 관찰값(OBS)으로만 출력한다.

규칙 번호는 `tools/validate_cards_v2.py`와 헤드리스 테스트가 같이 쓴다.

| # | 규칙 |
|---|---|
| V1 | `id`가 모든 v2 파일에서 고유하고, v1 id(`samguk.json`, `tutorial.json`)와 겹치지 않는다. |
| V2 | `nation`이 정해진 값 중 하나다. |
| V3 | `kind`가 `anchor` 또는 `source`이고, 종류별 필수 필드가 있다. |
| V4 | 한 나라의 앵커는 `order`가 1부터 빈틈없이 이어지고, `reign.start`가 `order`와 함께 **엄격히 증가**하며, `start ≤ end`, 앞 앵커의 `end ≤` 다음 앵커의 `start`다. |
| V5 | 사료 카드의 `answer.after`는 같은 나라 앵커 id이고, `answer.before`는 그 앵커 바로 다음 순서의 앵커 id다. `after`가 마지막 앵커일 때만 `before`는 null이다. |
| V6 | `year`가 정답 칸 안에 있다: `after.reign.start ≤ year`이고, `before`가 있으면 `year < before.reign.start`다. 예외(D67·D68): `answer.same_year`가 `"before_next_accession"`이면 `year == before.reign.start`도 허용한다. `year`는 0이 아니다. |
| V7 | `year_basis`가 `disputed`이면 `disputed`는 true다. `disputed`가 true이면 `disputed_note`가 있다. |
| V8 | `source_text`에 **카드 `title`**, **`answer.after` 앵커의 `title`**, **연도 표현**(`\d{3,4}\s*년`, `기원전`, `서기`)이 없다. 길이는 20~200자(범위를 벗어나면 경고). |
| V9 | `text_basis`가 `own_paraphrase_from_original`이다. |
| V10 | `clues`가 정확히 2개이고 `level`이 1, 2이며 `kind`가 `relation`, `direct`다. `relations`의 각 `op`가 `before`/`after`, `ref`가 같은 나라의 앵커이며 **모든 관계가 참이다**(`before`: `year < ref.reign.start`, `after`: `year ≥ ref.reign.start`, `same_year`이면 정답 `before` 앵커에 한해 `year == start`도 참). 두 개이면 `after` 하나와 `before` 하나이고 `after`의 순서가 `before`의 순서보다 앞선다. 본문에 모든 `ref`의 `[앵커 제목]`이 있다. `direct` 본문이 비어 있지 않다. **관계 단서 뒤 후보 칸이 1이면 오류, 4 이상이면 경고**(D68). |
| V11 | `exam_tags`가 비어 있지 않고 정해진 값의 부분집합이다. |
| V12 | `explanation`이 비어 있지 않고 `reign_label`을 포함한다. |
| V13 | `source_ref`에 `work`, `section`, `entry`가 있다. |
| V14 | `verification.verified`가 true이면 `verified_by`에 서로 다른 이름이 둘 이상이고, `verified_at`이 있으며, `original_checked`와 `exam_notation_checked`가 true이고, `content_hash`가 현재 내용의 해시와 같다. |
| V15 | `image`가 있으면 `image_source`와 `image_license`가 비어 있지 않다. |

**release 모드(`--release`)**는 추가로 요구한다: (R1) 싣는 모든 카드와 그 카드가 가리키는 앵커가 `verified`이고 `disputed`가 아니다. (R2) `source_ref.volume`이 있고 `url`이나 `db_id` 중 하나가 있다. (R3) `exam_tags`가 있는 카드의 `exam_notation_checked`가 true다.

**관찰(오류 아님)**: 검증기는 판정 대신 사실만 출력한다. 예: 1단계 관계 단서 뒤에 남는 후보 칸 수(1이면 2단계가 필요 없는 카드), 사료 지문에 나온 다른 앵커의 이름, 칸마다 카드 수, 앵커 사이 구간 길이(해상도).

## 아직 정하지 않은 것
- 앵커를 정적 목록으로 둘지, 맞힌 카드가 연표에 합류하는 Timeline 방식(판정을 연도 순서로)으로 갈지. M1은 정적 앵커로 시작한다.
- 한 카드에 사료 지문이 둘 이상인 변형(문항 형태). M1 범위 밖.
- 남북국 이후의 `nation` 값과 앵커의 단위(왕이 아니라 시대·사건이 되는 구간).
- 사진·유물 카드(`kind`를 늘릴지). M3 전에 정한다.
