# Card Data Schema (v1)

콘텐츠 작업과 Godot 구현이 함께 쓰는 카드 데이터 기준. 데이터는 외부 JSON이고 코드에 하드코딩하지 않는다.
시기 정의는 `docs/decision-log.md` D2를 따른다.

## 파일 구조

`assets/data/cards/samguk.json` (배열 하나, 카드 객체의 목록)

## 카드 객체

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | string | 예 | 고유 ID. 예: `goguryeo-founding-01`. 한 번 정하면 바꾸지 않는다. |
| `type` | enum | 예 | `event` / `artifact` / `person` / `myth` |
| `title` | string | 예 | 정답 공개 후 표시되는 이름. 플레이 중에는 숨겨진다. |
| `anchor` | bool | 예 | true면 보드에 미리 놓여 이름이 보인다. 단서와 판정이 없다. |
| `answer` | object | 예 | `{ "nation": "goguryeo\|baekje\|silla\|gaya", "era": "founding\|peak\|ending" }` |
| `clues` | array(3) | 일반 카드 예 | 단서 3개. 아래 규칙 참고. 기준 카드는 `[]`. |
| `explanation` | string | 일반 카드 예 | 정답 후 해설. 해당 시기로 분류되는 이유(사건 성격)를 한 문장 이상 포함한다. |
| `date_label` | string | 아니오 | 보조 표시용 연도. 예: `612년`, `전승 기원전 37년`. 판정 기준이 아니다. |
| `source` | object | 예 | `{ "name": string, "url": string\|null, "note": string }` 근거 자료. |
| `verified` | bool | 예 | 사실 확인 완료 여부. 출시 빌드는 true만 포함한다. |
| `verified_by` | string\|null | 아니오 | 확인한 사람/자료와 날짜. |
| `disputed` | bool | 예 | true면 판정에서 제외한다. 두 경우다: (1) 사료나 학설이 갈리는 경우, (2) 사실은 확실하지만 이 게임의 시기 정의(D2·D45)를 적용할 때 칸이 갈리는 경우. 보드에 올리지 않고 해설용으로만 쓴다(D50). |
| `disputed_note` | string\|null | disputed 시 예 | 갈리는 견해 요약. 플레이어에게 보이는 문장이므로 내부 결정 번호나 작업 메모는 넣지 않는다(그런 내용은 `source.note`). 위 (1)인지 (2)인지 분명히 적는다(D50). |
| `difficulty` | int 1~3 | 예 | 1 쉬움(단서 1에서 풀림), 2 보통(관계 단서 필요), 3 어려움(직접 단서 필요). 플레이 로그로 보정한다. |
| `image` | string\|null | 아니오 | `assets/art/cards/...` 상대 경로. |
| `image_source` | string\|null | image 있으면 예 | 이미지 출처(기관/저자/URL). |
| `image_license` | string\|null | image 있으면 예 | 라이선스. 예: `CC0`, `공공누리 제1유형`, `CC BY 4.0`. |
| `tags` | array(string) | 아니오 | 검색과 도감 필터용. |

## 단서 객체 (`clues[i]`)

```json
{ "level": 1, "kind": "description", "text": "...", "refs": [] }
```

| 단계 | `kind` | 규칙 |
|---|---|---|
| 1 | `description` | 이름·나라·시기를 말하지 않고 장면만 설명한다. |
| 2 | `relation` | 기준 카드나 다른 카드와의 관계로 칸을 좁힌다. `refs`에 그 카드의 `id`를 넣고, 본문에는 `[제목]` 형태로 쓴다. |
| 3 | `direct` | 연도, 인물, 나라 등 직접 힌트. 정답을 거의 확정하는 단서. |

`level`은 1, 2, 3 순서대로 정확히 하나씩 있어야 한다.

## 예시

```json
{
  "id": "goguryeo-founding-01",
  "type": "myth",
  "title": "졸본에서의 건국",
  "anchor": false,
  "answer": { "nation": "goguryeo", "era": "founding" },
  "clues": [
    { "level": 1, "kind": "description", "text": "압록강 중류 산악 지대에서 활 잘 쏘는 인물이 새 나라를 세운다는 이야기.", "refs": [] },
    { "level": 2, "kind": "relation", "text": "[광개토대왕릉비]를 세우게 되는 나라의 맨 처음이다.", "refs": ["goguryeo-peak-anchor"] },
    { "level": 3, "kind": "direct", "text": "건국 전승 연대는 기원전 37년.", "refs": [] }
  ],
  "explanation": "고구려 건국 전승(주몽). 나라가 시작되는 사건이므로 건국기.",
  "date_label": "전승 기원전 37년",
  "source": { "name": "삼국사기 고구려본기", "url": null, "note": "전승 연대. 검증 전" },
  "verified": false,
  "verified_by": null,
  "disputed": false,
  "disputed_note": null,
  "difficulty": 1,
  "image": null,
  "image_source": null,
  "image_license": null,
  "tags": ["건국", "고구려"]
}
```

## 검증 규칙 (헤드리스 테스트로 확인한다)

1. `id`가 전부 고유하다.
2. `answer.nation`과 `answer.era`가 정해진 값 중 하나다.
3. 일반 카드는 `clues`가 3개이고 `level`이 1·2·3이다. 기준 카드는 `clues`가 비어 있다.
4. `kind: relation` 단서의 `refs`가 실제 `id`를 가리키고, 가리키는 카드가 **기준 카드이거나 그 단서보다 먼저 놓이는 것이 보장된 카드**다. 기준 카드를 참조하는 것을 기본으로 한다.
5. 1단계 단서 본문에 `title`이 들어 있지 않다.
6. `disputed: true`면 `disputed_note`가 있고 판정 대상에서 제외된다.
7. `image`가 있으면 `image_source`와 `image_license`가 있다.
8. 12칸(나라 4 × 시기 3) 각각에 `disputed: false`인 카드가 1장 이상 있다. 목표는 칸당 3장이다.
9. 출시 빌드는 `verified: true`이고 `disputed: false`인 카드만 로드한다.

## 변경 규칙
- 필드를 추가할 때는 이 문서를 먼저 고치고, 필수 필드 변경은 `docs/decision-log.md`에 기록한다.
- 기존 `id`는 바꾸지 않는다(저장 데이터가 참조한다).
