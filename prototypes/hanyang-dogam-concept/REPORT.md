<!-- PROTOTYPE - NOT FOR PRODUCTION -->
<!-- Question: 단서 카드를 나라×시기 칸에 놓는 것이 암기 퀴즈가 아니라 추리처럼 느껴지는가? -->
<!-- Date: 2026-11-04 -->

# Concept Prototype Report: 한양 도감

> **Date**: 2026-11-04
> **Prototype Path**: HTML
> **Concept File**: design/game-brief.md

---

## Hypothesis

플레이어가 단서 카드를 읽고 나라×시기 칸에 끌어다 놓으면 추리하는 재미를 느낀다. 처음 10장 안에 정답률이 50~85%이고, 오답 해설을 읽은 뒤 다음 카드에 반영하면 맞는 것이다.

---

## Riskiest Assumption Tested

배치가 암기 퀴즈로 느껴지지 않을까? (단서 난이도 설계)

결과: 부분적으로만 성립. 정답이 바로 보이는 카드가 있어 추리가 아니라 암기 확인에 가까웠다.

---

## Approach

단일 `prototype.html`: 4국×3시기 보드, 하드코딩된 카드 10장, 드래그/클릭 배치, 정답 판정, 먹물(5), 단서 더 보기, 정답률 로그.

**Path chosen:** HTML
**Reason for path:** 가설이 타이밍이 아니라 단서 난이도였고, 클라우드 세션에서는 엔진을 실행할 수 없어 브라우저 단일 파일이 가장 빠르게 검증할 수 있었다.

**Shortcuts taken (intentional):**
- 카드와 값 전부 하드코딩, 메뉴·저장·도감 화면·사운드·일러스트 없음
- 건국 연대는 삼국사기 전승 기준이며 사실 확인은 하지 않음

---

## Result

- 기능은 모두 정상 동작했다.
- 플레이어 평가: "암기용으로 공부하기 좋고, 더 상세했으면 좋겠다." "추리 쪽 재미라면 더 강화되어야 할 듯."
- 가장 좋았던 순간: 도감 보드가 채워질 때.
- 가장 아쉬웠던 순간: 정답이 바로 보였을 때.
- 예상 밖: 카드를 잡았을 때의 시각 효과가 나중에 보충되어야 한다.
- 헤드리스 점검(자동): 콘솔 에러 없음, 한 판 정상 완주(정답 9, 오답 1).

---

## Metrics

| Metric | Value |
|--------|-------|
| Path used | HTML |
| Iterations to playable | N/A |
| Prototype duration | 이 세션 내 |
| Playtesters | 1 internal / 0 external |
| Feel assessment | 학습 도구로는 적합. 정답이 바로 보이는 카드는 추리 요소가 약함. 카드 잡는 순간의 시각 피드백 부족. |
| 정답률 / 단서 추가 횟수 | NOT REPORTED (플레이어가 수치를 전달하지 않음) |
| Hypothesis verdict | PARTIALLY CONFIRMED |

---

## Recommendation: PIVOT

재미의 뼈대(보드 채우기, 도감 수집)는 작동했지만, 핵심 가정인 "추리처럼 느껴지는가"는 정답이 바로 보이는 카드 때문에 충분히 검증되지 않았다. 플레이어가 직접 추리 쪽 강화와 더 상세한 정보를 요청했다. 판정 이유는 플레이어의 피드백에서 정리한 것이며 플레이어가 별도 문장을 남기지는 않았다. 외부 테스터가 없어 근거는 1명의 피드백에 한정된다.

---

## If Pivoting

**Pivot direction:** 카드 한 장에서 단서를 곧바로 정답으로 연결하지 못하게 만든다. 단서를 여러 카드에 나누거나 모호하게 쓰고, 카드마다 배경·원인·결과 등 더 상세한 정보를 준다. 한 칸에 들어갈 후보가 2개 이상 보이도록 설계한다.
**What to keep:** 나라×시기 보드, 도감이 채워지는 구조, 오답 후 해설, 먹물 규칙.
**Next step:** `/prototype` (PIVOT-NOTE.md의 수정 가설 사용)

---

## Lessons Learned

- **What assumptions were broken by actually building this?**
  배치 퍼즐은 단서가 정직하면 곧바로 암기 확인이 된다. 추리 재미는 보드 구조가 아니라 단서 설계에서 나온다.

- **What surprised us that didn't show up in the brainstorm?**
  학습 도구로서의 가치가 퍼즐로서의 재미보다 먼저 확인되었다.

- **What would we test differently next time?**
  정답률과 단서 사용 횟수를 반드시 받고, 한국사를 잘 모르는 외부 테스터도 최소 1명 포함한다.

---

> *Prototype code location: `prototypes/hanyang-dogam-concept/`*
> *This code is throwaway. Never refactor into production.*
