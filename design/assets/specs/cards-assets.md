# Asset Specs — Card Illustrations

> **Source**: `design/game-brief.md`, `design/card-data-schema.md`
> **Art Bible**: `design/art/art-bible.md` (§1 한 줄 규칙, §4 색, §8 에셋 규격, 부록 A 고증)
> **Generated**: 2026-11-04
> **Status**: 공통 템플릿 확정. **카드별 프롬프트 44장은 `design/assets/specs/cards-prompts.md`에 있다**(`assets/data/cards/samguk.json` 기준, 전부 Needed). 이 파일 아래의 ASSET-001~003 예시는 초기 임시 id를 썼으므로 실제 id는 `cards-prompts.md`를 따른다. 이미지를 넣는 절차는 `design/assets/image-workflow.md`.
> **Technical-artist 검증**: NOT RUN. 성능 예산은 `project.yaml`과 art-bible §8의 계산만 반영했다.

## 1. 공통 규격

| 항목 | 값 |
|---|---|
| 종류 | 카드 일러스트 (2D) |
| 크기·비율 | 1024×768 px, 4:3 |
| 형식 | PNG, sRGB, 알파 없음 (웹 변환본은 WebP 품질 85) |
| 파일명 | `assets/art/cards/<card id>.png` |
| 용량 목표 | 700KB 이하 |
| 그림 속 글자 | 금지 (한글, 한자, 서명, 워터마크 모두) |
| 여백 | 가장자리 15%는 먹 번짐 또는 한지색으로 비움 |

## 2. 공통 프롬프트 템플릿

영어 프롬프트를 쓴다(대부분의 이미지 도구가 영어에서 더 안정적이라는 일반 경험칙이며, 사용할 도구를 확인한 것은 아니다).

### 2.1 화풍 고정 문구 (모든 카드에 그대로 붙인다)

```
flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```

### 2.2 네거티브 프롬프트 (모든 카드에 그대로 붙인다)

```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting
```

### 2.3 카드별 프롬프트 형식

```
[장면 한 문장], [주요 소재 1개 + 배경 요소 최대 2개], [구도], [화풍 고정 문구]
Negative: [네거티브 프롬프트] + [카드별 추가 금지]
```

규칙:
1. 장면 문장에는 나라 이름이나 연도를 넣지 않는다. 이미지에 글자가 생길 위험이 있고, 화풍이 흔들린다.
2. 인물은 뒷모습, 실루엣, 소품으로 표현한다(art-bible §5, 부록 A.7).
3. 건국 전승 카드는 신화적, 평면적 연출로 한다(부록 A.6).
4. 부록 A의 금지 목록을 카드별 추가 금지에 옮겨 적는다.
5. 불교 요소는 건국기 카드에 쓰지 않는다(부록 A.3).

### 2.4 이미지 선정 기준
- 그림 속에 글자가 있으면 폐기한다.
- 현대적 소재나 조선식 복식이 보이면 폐기한다.
- 썸네일(120×90)로 줄여도 소재가 한 덩어리로 읽혀야 한다.
- 다크 테마에서 한지색 매트 위에 올렸을 때 가장자리가 어색하지 않아야 한다.

## 3. 출처와 라이선스 기록 방법

생성한 이미지마다 카드 JSON(`design/card-data-schema.md`)의 필드를 아래처럼 채운다.

| 필드 | 값 형식 | 예 |
|---|---|---|
| `image` | `assets/art/cards/<id>.png` | `assets/art/cards/goguryeo-founding-01.png` |
| `image_source` | `AI-generated: <도구 이름> <모델/버전>, <생성일>, 프롬프트 ID <id>` | `AI-generated: (도구명) (모델), 2026-11-05, prompt goguryeo-founding-01-v1` |
| `image_license` | `AI-generated, 사용자 소유 (도구 약관 확인 필요)` 처럼 확인 상태가 드러나게 | `AI-generated, 상업 이용 가능 여부 확인 필요` |

- 이미지 파일마다 프롬프트 전문을 `assets/art/cards/PROMPTS.md`에 한 줄씩 보관한다(id, 도구, 날짜, 프롬프트, 네거티브, 선택한 시드/버전).
- 라이선스 칸에 "확인 필요"가 남아 있으면 해당 카드는 출시 빌드에 넣지 않는다.
- 공공누리 이미지나 박물관 사진은 쓰지 않는다. 일러스트만 쓴다(art-bible §9). 쓰게 된다면 유형별 조건을 먼저 확인한다(`docs/decision-log.md` D4).
- AI 생성 이미지의 저작권 지위와 Steam의 AI 사용 공개 요건은 확인하지 못했다. 배포 전에 직접 확인한다.

---

## ASSET-001 — 졸본에서의 건국 (예시)

| Field | Value |
|-------|-------|
| Category | Sprite (카드 일러스트) |
| Dimensions | 1024×768 px |
| Format | PNG |
| Naming | `assets/art/cards/goguryeo-founding-01.png` (id 예시, 콘텐츠 세션 확정 시 교체) |
| Texture Res | art-bible §8 카드 일러스트 규격 |

**Visual Description:**
깊은 산골짜기 강가에 서 있는 활 쏘는 인물의 뒷모습 실루엣. 멀리 겹겹이 산, 가까이 활과 화살통. 전승 장면이므로 신화적이고 평면적으로 그린다.

**Art Bible Anchors:**
- §1 한 줄 규칙: 한지 위 먹 그림처럼 평면적이고 차분하게
- §4 Color System: 고구려 주홍은 아주 작은 포인트(깃, 장식)로만 쓴다
- §5 인물: 얼굴 묘사 없음, 뒷모습

**Generation Prompt:**
```
A silhouette of a lone archer seen from behind standing by a river in a deep mountain valley, layered distant mountains, a bow and a quiver as the main props, centered composition with wide empty margin, [화풍 고정 문구]
Negative: [네거티브 프롬프트], temple, pagoda, Buddhist elements, castle wall
```

**Status:** Needed

## ASSET-002 — 진흥왕 순수비 (예시)

| Field | Value |
|-------|-------|
| Category | Sprite (카드 일러스트) |
| Dimensions | 1024×768 px |
| Format | PNG |
| Naming | `assets/art/cards/silla-peak-02.png` (id 예시) |
| Texture Res | art-bible §8 카드 일러스트 규격 |

**Visual Description:**
산 정상에 선 돌비석 하나와 그 앞에 서서 멀리 강과 들판을 내려다보는 두세 명의 실루엣. 비석에는 글자가 없다(빈 돌면으로 그린다). 뒤로 펼쳐진 땅이 확장을 암시한다.

**Art Bible Anchors:**
- §3 Shape Language: 비석이 영웅 형태, 나머지는 단순한 보조 형태
- §4 Color System: 신라 금색을 하늘의 옅은 번짐에 아주 약하게 사용
- §8 그림 속 글자 금지: 비석 표면은 비워 둔다

**Generation Prompt:**
```
A tall plain stone monument standing on a mountain summit, a few small silhouettes of officials looking out over a wide river valley below, no inscription on the stone, wide landscape feeling with ink wash sky, [화풍 고정 문구]
Negative: [네거티브 프롬프트], carved characters on the stone, writing on the stele, pagoda, modern signboard
```

**Status:** Needed

## ASSET-003 — 대가야의 멸망 (예시)

| Field | Value |
|-------|-------|
| Category | Sprite (카드 일러스트) |
| Dimensions | 1024×768 px |
| Format | PNG |
| Naming | `assets/art/cards/gaya-ending-01.png` (id 예시) |
| Texture Res | art-bible §8 카드 일러스트 규격 |

**Visual Description:**
산성 위로 넘어오는 깃발들과 성문 앞에 선 작은 실루엣들. 불과 연기는 먹 번짐의 짙은 선으로만 표현하고 잔혹한 묘사는 하지 않는다. 가야의 철제 투구와 창이 보조 소품이다. 정답 공개 후 해설이 사건을 설명하므로 그림은 분위기만 담는다.

**Art Bible Anchors:**
- §2 결말기 분위기: 담담하고 차분하게, 벌주지 않는 톤
- §4 Color System: 가야 녹청을 포인트로, 나머지는 먹과 한지색
- 부록 A.4: 철제 무기(활, 창), 화약 무기 금지

**Generation Prompt:**
```
Banners rising over the wall of a mountain fortress, small silhouettes of soldiers with iron helmets and spears gathered at the fortress gate, thin ink smoke rising, calm and restrained mood with no gore, [화풍 고정 문구]
Negative: [네거티브 프롬프트], blood, corpses, explosions, cannons
```

**Status:** Needed

---

## 대기 목록
- 카드별 명세: 작성 완료 → `design/assets/specs/cards-prompts.md`(44장).
- 기준 카드 4장(광개토대왕릉비, 황산벌 전투, 박혁거세 신화, 수로왕 탄생 신화)은 이름과 일러스트가 처음부터 보이므로 우선순위가 높다.
- 대체 문양 4종은 `assets/art/placeholders/`에 있다(art-bible §7.1).
- UI 에셋(인장 4종, 먹 번짐 마스크, 한지 질감): 별도 명세가 필요하다.
- 이 명세의 예시 id(ASSET-001~003)는 임시다. 예: `silla-peak-02`는 실제 카드에서 이차돈 카드이고 진흥왕 순수비는 `silla-peak-03`이다.
