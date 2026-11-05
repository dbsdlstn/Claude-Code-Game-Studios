# 한양 도감: 결과 요약

> 메인 디렉터(총괄 세션)가 갱신한다. 자세한 기록은 `docs/decision-log.md`, `docs/orchestration-log.md`.
> 마지막 갱신: 2026-11-05 21:30 UTC

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
- **M2-A(개발) 완료(D190)**: **5개 나라 151장**(고구려 36·백제 29·신라 33·통일신라 22·고려 31, 모델 대조 완료·사람 확인 전), 타이틀·보상·도감·하루 학습량·결과 한 화면·접근성. 테스트 154개·CI 통과.
- 남은 M2-B(사람 몫): 사실 확인, 실기기 리허설, 사람 테스트(`docs/m2b-checklist.md`). 모델 쪽은 고려 카드 시작.

## 최근 결정
- D194 사람 테스트는 고구려·고려 2개 나라로(사람 확인 부담 축소). 고구려 36장+왕 12명은 확인 필수
- D192 사람 테스트 전 수정: 시작 버튼 첫 화면 안, 하루 권장 24장, 질문 "연표 어디에 들어갈까?", 해설에 "실제로는 ○○왕 때"
- D190 M2-A 개발 완료 판정
- D184 경험치 상한을 하루 24장으로(나라를 번갈아 해도 손해 없게)
- D183 남북국은 통일신라 먼저, 발해는 원문 확인 어려워 보류
- D98 보상 조정: 처음 보는 카드 승급 보너스 없음(찍기 유리 방지), 결과 화면 한 화면, 만회 보너스
- D97 같은 사건을 나라별로 묻는 카드 4쌍은 유지
- D96 가야는 별도 연표 없이 신라·백제 카드에 "가야" 표시로 포함(가야 왕 연대 근거가 약함)
- D95 일반 모드는 새 카드와 복습을 섞음
- D120 보상 확정: 세션 완료 보너스 없음, 정답 XP는 하루 2세션까지, 승급·등급 보너스는 항상, 휴식권, 업적 17·칭호 7
- D93 휴대폰 연표를 한 줄씩 압축, 타이틀에 "오늘 복습 n장 · 새 카드 m장" 우선 표시
- D85 고구려 연표 왕 10→12(문자명왕·영류왕 추가). 장수왕·영양왕 칸에 카드가 몰려서
- D83 기출 회차는 문항까지 확인된 것만 표기
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
py -m http.server 8000      # Mac/Linux는 python3 -m http.server 8000
```
- 최신 M2(5개 나라 151장): http://localhost:8000/prototypes/m1-timeline/
- **사람 테스트용(고구려·고려만, D194)**: http://localhost:8000/prototypes/m1-timeline/?manifest=../../assets/data/cards/v2/manifest-m2test.json
- 자주 막히는 것(404, py 없음, 포트, 휴대폰 접속 등): `prototypes/m1-timeline/README.md`
- 화면 미리보기: `production/qa/evidence/m2/`

## 사용자가 할 일 (사람만 가능한 것)
- **사람 테스트 전 체크리스트 한 장**: `docs/m2b-checklist.md`(최소 사실 확인 범위 = 고구려 36장+왕 12명, 2명).
- **원문 대조 1인 (1~2시간, 테스트 전 권장)**: 고구려 카드 12장을 한국사데이터베이스 원문과 맞춰 보기(`design/fact-check-report-m1.md`). 출시 전에는 2인 확인 필요.
- **전체 사실 확인 (선택, 약 10시간·1시간씩 나눠서)**: `design/human-review-guide.md`가 133개 항목을 1시간 묶음 12개로 정리했다. 묶음 1~3(모델이 불확실로 본 18개)부터. 기록은 `py tools/mark_verified.py`(안내서에 방법).
- **실기기 리허설 (15분, 테스트 전 필수)**: 휴대폰으로 테스트 모드를 한 번 끝까지(`STUDY.md`).
- **참가자 모집**: 한능검 준비생 1~2명.
- **네트워크 허용 (1분, 선택)**: 원문 자동 대조용 `db.history.go.kr`, `ko.wikisource.org`. 세션 제목 줄의 클라우드 환경 메뉴 → Edit → Network access → Allowed domains(https://code.claude.com/docs/en/cloud-environments#network-access).

## 다음 작업
- 설계: 보상 명세, 타이틀 화면, 카드 확대 계획
- 콘텐츠: 기출 이용 조건, 삼국 기출 주제 빈도표, 고구려 묶음 2 → 대조 → 다음 묶음
- 웹: 타이틀 화면, 여러 덱 로딩, 보상 구현
