# 한양 도감: 결과 요약

> 메인 디렉터(총괄 세션)가 갱신한다. 자세한 기록은 `docs/decision-log.md`, `docs/orchestration-log.md`.
> 마지막 갱신: 2026-11-05 16:01 UTC

## ✅ M1 사람 테스트 준비 완료
고구려 사료 카드 12장으로 "이 게임이 단순 플래시카드보다 한능검 공부에 나은가"를 확인하는 테스트를 할 수 있다. 차단 항목은 모두 해소됐고(평가 세션 재확인), 남은 준비는 아래 "사용자가 할 일"의 사람만 가능한 두 가지다.

**테스트 방법 (5줄 요약)**
1. 테스트용 고정 버전은 브랜치 `claude/m1-test-build`(`git checkout claude/m1-test-build`). PC에서 `py prototypes/m1-timeline/build.py` 후 `py -m http.server 8000 --directory dist/m1`(Mac/Linux는 `python3`)
2. 참가자 휴대폰(같은 와이파이)에서 `http://<PC IP>:8000/index.html?study=1`, 진행자 코드 `1592`
3. 진행자 안내서: `prototypes/m1-timeline/STUDY.md`(한 장), 자세한 계획: `production/playtest/m1-plan.md`
4. 참가자 한능검 준비생 1~2명. **Day 0 90분**(사전 시험 → 두 방식 학습 → 직후 시험) + **다음 날 20분**(재인출 시험)
5. 진행자 메뉴의 "기록 내보내기(JSONL)"를 Day 0·Day 1 끝에 받아 저장소 `production/playtest/`에 올리면 분석은 디렉터가 한다.

## 지금 상태
- **M2 시작(사용자 피드백 반영)**: 타이틀 화면, 학습을 해치지 않는 보상 시스템(경험치·레벨·연속일·업적), 한능검 기출 근거로 카드 확대(고구려 36장 → 백제·신라·가야).
- 사람 테스트용 M1은 브랜치 `claude/m1-test-build`로 고정 보존(새 기능은 테스트 모드에서 꺼짐).
- 진행 중: 보상·타이틀 설계와 구현, 기출 주제 빈도 조사, 고구려 카드 묶음 2(12장).

## 최근 결정
- D79 M2: 타이틀 화면, 보상은 "단서 없는 정답 > 단서 쓴 정답 > 오답" 순, 기출은 주제·빈도 근거로만(문항 복제 안 함), 고구려 36장부터 단계 확대
- D78 테스트 계획서 최종 정리
- D74 재평가 차단 항목 처리
- D68 관계 단서는 후보 2~3칸
- D56 한능검 1급 대상으로 전환

## 그냥 해 보기 (PC)
```
git clone https://github.com/dbsdlstn/Claude-Code-Game-Studios.git
cd Claude-Code-Game-Studios
git checkout claude/integration
python3 -m http.server 8000   # Windows는 py -m http.server 8000
```
- M1(새 방향): http://localhost:8000/prototypes/m1-timeline/
- v0(옛 나라×시기 보드, 동결): http://localhost:8000/web/
- 화면 미리보기: `production/qa/evidence/m1/`

## 사용자가 할 일 (사람만 가능한 것)
- **원문 대조 1인 (1~2시간, 테스트 전 권장)**: 고구려 카드 12장을 한국사데이터베이스 원문과 맞춰 보기(`design/fact-check-report-m1.md`). 출시 전에는 2인 확인 필요.
- **실기기 리허설 (15분, 테스트 전 필수)**: 휴대폰으로 테스트 모드를 한 번 끝까지(`STUDY.md`).
- **참가자 모집**: 한능검 준비생 1~2명.
- **네트워크 허용 (1분, 선택)**: 원문 자동 대조용 `db.history.go.kr`, `ko.wikisource.org`. 세션 제목 줄의 클라우드 환경 메뉴 → Edit → Network access → Allowed domains(https://code.claude.com/docs/en/cloud-environments#network-access).

## 다음 작업
- 설계: 보상 명세, 타이틀 화면, 카드 확대 계획
- 콘텐츠: 기출 이용 조건, 삼국 기출 주제 빈도표, 고구려 묶음 2 → 대조 → 다음 묶음
- 웹: 타이틀 화면, 여러 덱 로딩, 보상 구현
