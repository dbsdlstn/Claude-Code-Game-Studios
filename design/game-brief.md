# Game Brief: 한양 도감

**One-sentence pitch:** 흩어진 유물과 사건 카드를 올바른 나라·시기에 맞춰 삼국시대 도감을 완성한다.

## Core loop
- 카드를 뽑아 단서(유물·사건·인물)를 읽는다.
- 나라(고구려·백제·신라·가야) × 시기(초기·전성기·후기) 보드에 배치한다.
- 정답이면 도감 칸이 채워지고 해설이 열린다. 오답이면 먹물이 줄어든다.

## Player goal & fail state — what "working" looks like
- 12칸 도감을 모두 채우면 클리어.
- 먹물(오답 한도)이 0이 되면 해당 라운드 실패, 재도전.

## MVP — what must exist to be the game
1. 카드 데이터 구조 (외부 JSON)
2. 나라×시기 배치 보드
3. 정답 판정과 먹물
4. 도감 수집 화면과 해설
5. 삼국시대 카드 약 36장 (칸당 3장)
6. 진행 저장

## Out of scope — not building this
- 삼국 외 시대 (고조선, 고려, 조선 등은 MVP 이후 확장)
- 전투, 경영, 멀티플레이, 음성 해설

## Build order
1. 배치 보드 + 정답 판정 (카드 10장 하드코딩으로 재미 검증)
2. 먹물과 실패 조건
3. 카드 JSON 로딩
4. 도감 화면과 해설
5. 콘텐츠 36장
6. 진행 저장

---
**Who it's for / what they feel:** 한국사를 가볍게 복습하려는 사람. "아는 만큼 도감이 채워지는" 뿌듯함.

**Art & audio direction:** 고지도·한지 질감의 2D 일러스트, 국악 소품.

**Reference game:** Timeline류 카드 게임. "근거를 읽고 배치한다"는 부분만 가져온다.
