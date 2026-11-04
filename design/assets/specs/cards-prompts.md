# 카드별 이미지 생성 프롬프트 (44장)

> **Source**: `assets/data/cards/samguk.json` (`id`, `title`, `type`, `answer`)
> **규격**: `design/assets/specs/cards-assets.md` §1, 화풍 규칙: `design/art/art-bible.md`
> **Generated**: 2026-11-04 (`id` 순서는 카드 데이터 순서)
> **Status**: 카드 44장 전부 `Needed`. 이미지는 사용자가 외부 도구로 생성한다. 절차는 `design/assets/image-workflow.md`.

## 사용법
1. 카드 블록의 **Prompt**를 복사해 이미지 도구에 붙여 넣는다. 화풍 고정 문구가 이미 들어 있다.
2. **Negative**를 네거티브 프롬프트 칸에 붙여 넣는다(공통 + 카드별 추가).
3. 결과를 `assets/art/cards/<id>.png`로 저장한다(1024×768, 4:3).
4. **고증 주의**를 보고 결과를 검수한다. "확인 필요"는 자료로 확인되지 않았다는 뜻이다. 확인되기 전에는 그 표현을 이미지에 넣지 않는다.

- 장면 문장에는 나라 이름·연도·글자를 넣지 않는다(art-bible §8, cards-assets §2.3).
- **disputed** 표시 카드(4장)는 판정에서 제외되는 카드지만 도감에는 나오므로 이미지가 필요하다.
- **anchor** 표시 카드(4장)는 처음부터 이름과 일러스트가 보이므로 가장 먼저 만든다.
- 고증 주의는 외부 자료를 읽어 확인한 것이 아니라 일반 통설에 기반한 것이다(art-bible 부록 A와 같은 한계).
- 사건 설명의 근거는 각 카드의 `source`(카드 JSON)에 있다. 이 문서는 그림 장면만 다룬다.


---

## 고구려

### goguryeo-peak-anchor — 광개토대왕릉비

`artifact` · 전성기 · anchor · 파일 `assets/art/cards/goguryeo-peak-anchor.png` · Status: Needed

**Prompt**
```
A massive tall upright stone stele standing alone on a wide open plain, a few tiny silhouettes at its base for scale, wide sky, the stone surface left blank, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, carved characters, inscription, writing on the stele, roofed pavilion
```
**고증 주의**: 비신 4면에 글이 있으나 이미지에는 글자 금지: 표면을 비워 그린다. 비의 세부 형태와 비각(보호각) 표현은 확인 필요.

### goguryeo-founding-01 — 졸본에서의 건국

`myth` · 건국기 · 파일 `assets/art/cards/goguryeo-founding-01.png` · Status: Needed

**Prompt**
```
A silhouette of a lone archer seen from behind standing by a river in a deep mountain valley, layered distant mountains, a bow and a quiver as the main props, centered composition, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue, castle wall
```
**고증 주의**: 전승 연출. 새 깃 모자(절풍)는 4~5세기 고분벽화 근거이므로 건국기 인물에는 쓰지 않고 실루엣으로 단순화(확인 필요).

### goguryeo-founding-02 — 국내성 천도

`event` · 건국기 · 파일 `assets/art/cards/goguryeo-founding-02.png` · Status: Needed

**Prompt**
```
A small caravan of carts and people silhouettes crossing a river toward a walled hill town on the far bank, early morning mist, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue
```
**고증 주의**: 국내성은 강변 도성과 산성이 짝을 이룬다는 설명이 있으나 성벽 세부는 확인 필요. 원경 실루엣으로만 그린다.

### goguryeo-founding-03 — 진대법 실시

`event` · 건국기 · 파일 `assets/art/cards/goguryeo-founding-03.png` · Status: Needed

**Prompt**
```
A raised-floor granary building in spring fields, villagers in simple clothes receiving sacks of grain, one official silhouette watching, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue
```
**고증 주의**: 창고(부경 계열) 형태는 확인 필요: 높은 마루 창고를 단순한 실루엣으로. 복식은 단순한 저고리·바지로.

### goguryeo-peak-01 — 평양 천도

`event` · 전성기 · 파일 `assets/art/cards/goguryeo-peak-01.png` · Status: Needed

**Prompt**
```
A long procession of banners and carts moving south along a big river toward a wide plain with a distant walled city, mountains behind, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, castle with curved Joseon roofs, pagoda
```
**고증 주의**: 평양 도성의 구조와 궁궐 형태는 확인 필요: 도성은 원경 윤곽만. 조선식 궁궐 지붕 금지.

### goguryeo-peak-02 — 한성 함락

`event` · 전성기 · 파일 `assets/art/cards/goguryeo-peak-02.png` · Status: Needed

**Prompt**
```
A walled riverside city on a plain besieged by cavalry silhouettes, banners over the wall, thin ink smoke, restrained mood, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, blood, execution, king captured
```
**고증 주의**: 한성(풍납토성 등)의 성벽은 흙으로 쌓은 토성이라는 설명이 있으나 확인 필요. 개로왕 처형 장면은 그리지 않는다.

### goguryeo-peak-03 — 광개토왕의 신라 구원

`event` · 전성기 · 파일 `assets/art/cards/goguryeo-peak-03.png` · Status: Needed

**Prompt**
```
Rows of riders and foot soldiers silhouettes marching south down a long road, banners, a distant southern coast, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, gore
```
**고증 주의**: 병력 숫자(5만)를 그림에 쓰지 않는다. 기병 장비(등자, 말갑옷)의 시기별 형태는 확인 필요: 단순한 실루엣으로.

### goguryeo-ending-01 — 살수대첩

`event` · 결말기 · 파일 `assets/art/cards/goguryeo-ending-01.png` · Status: Needed

**Prompt**
```
A wide river with tiny army silhouettes wading across, a lone general figure standing on a far bank hill, wave lines in the water, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, blood, corpses, drowning bodies
```
**고증 주의**: 수나라 군대와 고구려군의 복식 구분은 확인 필요이므로 깃발·실루엣 크기로 구분한다. 물을 막았다 터뜨렸다는 서술은 전승이므로 단정하지 않는다.

### goguryeo-ending-02 — 안시성 전투

`event` · 결말기 · 파일 `assets/art/cards/goguryeo-ending-02.png` · Status: Needed

**Prompt**
```
A small fortress on a hilltop with a huge earth mound piled against its wall, a large besieging army far below, banners, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, blood, emperor face, gore
```
**고증 주의**: 토산(흙 언덕)을 쌓았다는 기록은 확인 필요. 황제·성주의 얼굴 묘사 금지.

### goguryeo-ending-03 — 평양성 함락

`event` · 결말기 · 파일 `assets/art/cards/goguryeo-ending-03.png` · Status: Needed

**Prompt**
```
A mountain-and-river fortified capital at dusk surrounded by encamped armies, long shadows, one banner lowered on the wall, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, blood, king kneeling, execution
```
**고증 주의**: 항복 장면의 인물은 그리지 않는다. 도성 구조는 확인 필요: 원경 윤곽만.


---

## 백제

### baekje-ending-anchor — 황산벌 전투

`event` · 결말기 · anchor · 파일 `assets/art/cards/baekje-ending-anchor.png` · Status: Needed

**Prompt**
```
A small band of foot soldiers with spears and bows standing in a line on a wide plain facing a much larger distant army, banners in the wind, restrained mood, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, blood, corpses, gore
```
**고증 주의**: 철제 창·활만 쓴다(화약 무기 금지). 병력 숫자(5천)를 그림에 쓰지 않는다. 깃발의 문양·글자는 확인 필요이므로 무늬 없는 깃발로 그린다.

### baekje-founding-01 — 온조의 위례성 건국

`myth` · 건국기 · 파일 `assets/art/cards/baekje-founding-01.png` · Status: Needed

**Prompt**
```
A group of small silhouettes arriving at a broad river valley, a few stakes marking out a settlement, wide river and plain, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue
```
**고증 주의**: 풍납토성·몽촌토성 도성은 확인 필요: 목책과 움집 정도로 단순화한다.

### baekje-founding-02 — 비류의 미추홀 정착

`myth` · 건국기 · 파일 `assets/art/cards/baekje-founding-02.png` · Status: Needed

**Prompt**
```
A small coastal settlement on salt marsh mudflats with a few simple huts, tide pools, a gray sea, a lone figure looking inland, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue
```
**고증 주의**: 미추홀의 위치(인천 비정 등)는 학설이 갈리므로 특정 지명을 연상시키는 표지를 넣지 않는다.

### baekje-founding-03 — 십제에서 백제로

`myth` · 건국기 · 파일 `assets/art/cards/baekje-founding-03.png` · Status: Needed

**Prompt**
```
Ten small ink circles on the left changing into a hundred tiny ink circles on the right, joined by a flowing river, abstract composition, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue, numerals
```
**고증 주의**: 숫자 개념(십→백)을 점의 개수로만 표현한다. 한자 十·百 같은 글자 금지.

### baekje-founding-d1 — 고이왕의 관제 정비

`event` · 건국기 · disputed · 파일 `assets/art/cards/baekje-founding-d1.png` · Status: Needed

**Prompt**
```
Rows of officials seen from behind in robes of different muted colors standing in lines before a plain wooden hall, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue
```
**고증 주의**: disputed 카드(연대 이견). 관복 색(자·비·청) 구분 기록은 있으나 복식 형태는 확인 필요: 뒷모습 실루엣으로.

### baekje-peak-01 — 평양성 공격

`event` · 전성기 · 파일 `assets/art/cards/baekje-peak-01.png` · Status: Needed

**Prompt**
```
A mounted king silhouette at the head of marching banners heading north across a river toward a distant hilltop fortress, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, blood, king face
```
**고증 주의**: 근초고왕의 얼굴 금지. 기병·갑옷 형태는 확인 필요: 실루엣으로.

### baekje-peak-02 — 무령왕릉

`artifact` · 전성기 · 파일 `assets/art/cards/baekje-peak-02.png` · Status: Needed

**Prompt**
```
A brick-lined tomb chamber seen from the entrance, arched ceiling, small lamp niches in the wall, a plain stone slab lying near the entrance, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, inscription on the slab, writing, lotus ornament, Chinese tomb guardian statues
```
**고증 주의**: 벽돌무덤의 아치형 천장과 등감(등잔 칸)은 확인 필요. 지석(묘지석)의 글자 금지. 껴묻거리(금제 장식 등)의 정확한 모양은 확인 필요이므로 그리지 않는다.

### baekje-peak-03 — 사비 천도

`event` · 전성기 · 파일 `assets/art/cards/baekje-peak-03.png` · Status: Needed

**Prompt**
```
A broad river bend with a new walled city on a plain, boats on the river, a procession arriving, a round-topped mountain behind, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, pagoda, temple roofs
```
**고증 주의**: 사비도성의 나성과 구조는 확인 필요: 원경 윤곽만. 사찰과 탑은 시기·형태 확인 전이므로 그리지 않는다.

### baekje-peak-d1 — 칠지도

`artifact` · 전성기 · disputed · 파일 `assets/art/cards/baekje-peak-d1.png` · Status: Needed

**Prompt**
```
A seven-branched ceremonial sword with three branches on each side lying on a plain cloth, the blade surface left blank, two simple hands presenting it, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, inscription, gold writing, characters on the blade
```
**고증 주의**: disputed 카드(제작 연도·성격 해석). 칠지도의 형태(좌우 가지 셋씩 + 끝)는 확인 필요. 금으로 새긴 글자는 이미지에 쓰지 않는다.

### baekje-ending-01 — 대야성 공격

`event` · 결말기 · 파일 `assets/art/cards/baekje-ending-01.png` · Status: Needed

**Prompt**
```
A hilltop fortress overlooked by an advancing army in a river valley, banners, dusk light, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, blood, hostages, couple executed
```
**고증 주의**: 대야성의 위치와 규모는 확인 필요. 김품석 부부 사건 등 개별 인물 장면은 그리지 않는다.

### baekje-ending-02 — 사비성 함락

`event` · 결말기 · 파일 `assets/art/cards/baekje-ending-02.png` · Status: Needed

**Prompt**
```
A capital city seen from a hill with thin ink smoke over its roofs, small silhouettes of people fleeing north on a road, a wide river, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, cliff jumping, women falling from cliff, gore
```
**고증 주의**: 낙화암·삼천궁녀 장면은 사료 근거가 약하고 선정적이므로 금지. 도성 구조는 확인 필요.

### baekje-ending-03 — 백강 전투

`event` · 결말기 · 파일 `assets/art/cards/baekje-ending-03.png` · Status: Needed

**Prompt**
```
A river mouth meeting the sea with many wooden ships burning as ink-line fire and smoke, wide horizon, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, corpses, gore
```
**고증 주의**: 선박의 형태는 확인 필요: 단순한 목선 실루엣으로. 불(화공) 표현은 기록이 있는 것으로 알려져 있으나 확인 필요.


---

## 신라

### silla-founding-anchor — 박혁거세 신화

`myth` · 건국기 · anchor · 파일 `assets/art/cards/silla-founding-anchor.png` · Status: Needed

**Prompt**
```
A large softly glowing egg resting in a forest clearing beside a well, a white horse bowing nearby, six small village silhouettes at the edge of the clearing, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue
```
**고증 주의**: 신화 연출이므로 알 크기의 과장은 허용. 불교 요소 금지. 우물(나정) 형태는 확인 필요.

### silla-founding-01 — 석탈해 전승

`myth` · 건국기 · 파일 `assets/art/cards/silla-founding-01.png` · Status: Needed

**Prompt**
```
A wooden chest drifting on a calm sea toward a rocky shore at dawn, magpies flying above it, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue
```
**고증 주의**: 전승 연출. 상자(궤)의 형태는 확인 필요. 까치는 전승 모티프.

### silla-founding-02 — 김알지 전승

`myth` · 건국기 · 파일 `assets/art/cards/silla-founding-02.png` · Status: Needed

**Prompt**
```
A golden box hanging from a tree branch in a quiet forest, a white rooster crowing below, soft morning light, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue
```
**고증 주의**: 전승 연출. 계림의 숲은 단순화한 실루엣으로.

### silla-founding-03 — 가배의 시작

`event` · 건국기 · 파일 `assets/art/cards/silla-founding-03.png` · Status: Needed

**Prompt**
```
Two teams of women in simple clothes spinning thread and weaving in an open courtyard, evening festival with hanging lanterns, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue, Joseon hanbok, long chima-jeogori
```
**고증 주의**: 여성 복식의 시기별 형태는 확인 필요: 실루엣으로. 베틀·실잣기 도구는 확인 필요. 조선식 한복(짧은 저고리·긴 치마) 금지.

### silla-peak-01 — 우산국 복속

`event` · 전성기 · 파일 `assets/art/cards/silla-peak-01.png` · Status: Needed

**Prompt**
```
A large wooden lion statue on the deck of a wooden warship approaching a steep small island, tiny islanders silhouettes on the shore, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, blood, gore
```
**고증 주의**: 사자 모양은 전승 모티프(사자 형상 확인 필요). 선박 형태는 확인 필요. 우산국(울릉도)의 지형은 단순화.

### silla-peak-02 — 이차돈의 순교와 불교 공인

`event` · 전성기 · 파일 `assets/art/cards/silla-peak-02.png` · Status: Needed

**Prompt**
```
A quiet hilltop with a single small stone and white lotus petals drifting in the air, no people, restrained and calm, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, execution, beheading, blood, Buddha statue face
```
**고증 주의**: 순교 장면의 직접 묘사 금지. 흰 피 전승은 연꽃잎·흰 빛으로 상징한다. 불교는 이 카드에서 공인된 시점이므로 연꽃 표현은 허용. 사찰 형태는 확인 필요.

### silla-peak-03 — 진흥왕 순수비

`artifact` · 전성기 · 파일 `assets/art/cards/silla-peak-03.png` · Status: Needed

**Prompt**
```
A tall plain stone monument standing on a mountain summit, a few small silhouettes of officials looking out over a wide river valley, the stone surface left blank, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, carved characters on the stone, writing on the stele, pagoda
```
**고증 주의**: 비석 표면은 비워 둔다(글자 금지). 비의 형태(자연석에 가까운 모양)는 확인 필요.

### silla-ending-01 — 나당 동맹

`event` · 결말기 · 파일 `assets/art/cards/silla-ending-01.png` · Status: Needed

**Prompt**
```
A small sailing ship crossing a wide sea toward a distant continental coast, a single envoy silhouette at the bow holding a scroll, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, scroll text, writing on the scroll
```
**고증 주의**: 사신선의 형태는 확인 필요. 당나라와 신라 복식 구분은 확인 필요: 인물은 실루엣으로. 두루마리에 글자 금지.

### silla-ending-02 — 매소성 전투

`event` · 결말기 · 파일 `assets/art/cards/silla-ending-02.png` · Status: Needed

**Prompt**
```
A wide field with captured horses penned in ink-line rows and banners on a hill, a retreating army column far in the distance, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, blood, corpses
```
**고증 주의**: 말 3만 필이라는 숫자는 그림에 쓰지 않는다. 마구의 형태는 확인 필요.

### silla-ending-03 — 기벌포 전투

`event` · 결말기 · 파일 `assets/art/cards/silla-ending-03.png` · Status: Needed

**Prompt**
```
Wooden ships at a river mouth, banners on the shore, small silhouettes pushing a retreating army back toward the sea, no gore, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, blood, corpses, gore
```
**고증 주의**: 선박·갑옷 형태는 확인 필요: 실루엣으로. 승패의 잔혹 묘사 금지.


---

## 가야

### gaya-founding-anchor — 수로왕 탄생 신화

`myth` · 건국기 · anchor · 파일 `assets/art/cards/gaya-founding-anchor.png` · Status: Needed

**Prompt**
```
A golden box descending from the sky on a cord onto a small hilltop, a crowd of tiny silhouettes bowing below, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue
```
**고증 주의**: 신화 연출. 구지가 가사는 글자로 넣지 않는다. 금합 형태는 확인 필요.

### gaya-founding-01 — 허황옥의 도래

`myth` · 건국기 · 파일 `assets/art/cards/gaya-founding-01.png` · Status: Needed

**Prompt**
```
A ship with a red sail crossing the sea toward a shore, a small robed figure at the bow, a distant mountain, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue, Indian temple, Taj Mahal style dome
```
**고증 주의**: 붉은 돛은 전승 모티프. 인도계 의복 표현은 확인 필요이므로 실루엣으로. 불교·인도 건축 요소 금지.

### gaya-founding-02 — 수로왕과 탈해의 술법 겨루기

`myth` · 건국기 · 파일 `assets/art/cards/gaya-founding-02.png` · Status: Needed

**Prompt**
```
A hawk and an eagle in the sky above a river, a sparrow and a sparrowhawk below, an abstract dance of birds in ink lines, no humans, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue
```
**고증 주의**: 신화 연출이며 인물은 그리지 않고 새로만 표현한다.

### gaya-founding-03 — 대가야 시조 이진아시왕

`myth` · 건국기 · 파일 `assets/art/cards/gaya-founding-03.png` · Status: Needed

**Prompt**
```
A mountain-ringed inland valley village with a single hilltop where a small gathering stands, mist in the valley, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue
```
**고증 주의**: 대가야의 지리(내륙 고령 일대)는 확인 필요: 지명을 연상시키는 표지를 넣지 않는다.

### gaya-founding-d1 — 포상팔국의 난

`event` · 건국기 · disputed · 파일 `assets/art/cards/gaya-founding-d1.png` · Status: Needed

**Prompt**
```
Eight small boats from different coastal inlets converging on a single harbor town while a relief force approaches by land, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue, gore
```
**고증 주의**: disputed 카드(연대와 공격 대상에 이견). 선박과 항구 형태는 확인 필요: 실루엣으로.

### gaya-peak-01 — 가라왕의 남제 사신

`event` · 전성기 · 파일 `assets/art/cards/gaya-peak-01.png` · Status: Needed

**Prompt**
```
An envoy ship and a small procession carrying a scroll toward a distant palace gate, calm mood, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, scroll text, writing
```
**고증 주의**: 남제 궁궐·복식은 확인 필요: 원경 윤곽과 실루엣으로. 두루마리에 글자 금지.

### gaya-peak-02 — 가야금 제작

`artifact` · 전성기 · 파일 `assets/art/cards/gaya-peak-02.png` · Status: Needed

**Prompt**
```
A long twelve-string zither lying on a low table, a musician's hands plucking the strings seen from behind, a mountain in the background, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, sheet music, notation, characters
```
**고증 주의**: 가야금의 줄 수(12)와 안족(줄받침) 형태는 확인 필요. 악보 표기 금지. 악사는 뒷모습.

### gaya-peak-03 — 고령 지산동 고분군

`artifact` · 전성기 · 파일 `assets/art/cards/gaya-peak-03.png` · Status: Needed

**Prompt**
```
A ridge line with rows of large round burial mounds under a wide sky, tiny silhouettes standing on the path between them, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, skeletons, sacrifice, human burial, gore
```
**고증 주의**: 봉분의 크기와 배열은 확인 필요. 순장 장면은 그리지 않는다.

### gaya-peak-d1 — 덩이쇠 수출

`event` · 전성기 · disputed · 파일 `assets/art/cards/gaya-peak-d1.png` · Status: Needed

**Prompt**
```
Flat ingot-shaped iron bars stacked in bundles on a quay beside a wooden boat, tiny workers carrying them, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, Buddhist temple, pagoda, lotus ornament, Buddha statue
```
**고증 주의**: disputed 카드(전성기 시기 구분). 덩이쇠의 형태(납작한 판 모양)는 확인 필요. 제련 장면의 도구는 그리지 않는다.

### gaya-ending-01 — 금관가야의 항복

`event` · 결말기 · 파일 `assets/art/cards/gaya-ending-01.png` · Status: Needed

**Prompt**
```
A small walled hill fort with a short procession leaving through the gate carrying chests, a neighboring army camp in the distance, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, king kneeling, blood, gore
```
**고증 주의**: 왕과 가족 인물은 그리지 않는다. 성의 형태는 확인 필요: 원경 윤곽만.

### gaya-ending-02 — 대가야의 멸망

`event` · 결말기 · 파일 `assets/art/cards/gaya-ending-02.png` · Status: Needed

**Prompt**
```
Banners rising over the wall of a mountain fortress, small silhouettes of soldiers with iron helmets and spears gathered at the fortress gate, thin ink smoke rising, calm and restrained mood, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, blood, corpses, explosions, cannons
```
**고증 주의**: 철제 투구·창은 확인 필요(시기별 형태). 화약 무기 금지.

### gaya-ending-03 — 우륵의 귀순

`person` · 결말기 · 파일 `assets/art/cards/gaya-ending-03.png` · Status: Needed

**Prompt**
```
A lone musician silhouette carrying a long string instrument across a mountain pass toward a distant palace, flat 2D illustration, ink outlines (sumi-e brush line) with muted mineral pigment colors, aged Hanji paper texture with visible fibers, soft ink-wash bleed at the edges, generous empty margin around the subject, simple silhouette composition, limited palette of warm paper beige, ink brown, muted vermilion, muted indigo, muted gold and muted jade green, calm and quiet mood, 4:3 composition, no text
```
**Negative**
```
photorealistic, 3D render, anime, manga, cartoon, glossy, neon, high saturation, text, letters, Korean text, hangul, Chinese characters, calligraphy, signature, watermark, seal stamp, logo, modern objects, Joseon dynasty gat hat, black horsehair hat, topknot with netted headband, firearms, cannons, western armor, generic fantasy armor, detailed realistic face, facial expression, cluttered scene, dark gloomy lighting, sheet music, notation, characters
```
**고증 주의**: 가야금 형태는 확인 필요. 우륵의 얼굴 금지, 뒷모습 실루엣으로.
