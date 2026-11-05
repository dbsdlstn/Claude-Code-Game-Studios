# Godot CI 실행 기록

워크플로: `.github/workflows/ci.yml` (decision-log D52). 클라우드 세션은 Godot을 실행할 수 없으므로 GitHub Actions 러너에서 처음으로 실제 실행한다.

| 회차 | 커밋 | 실행 | data-and-web | godot | 고친 것 |
|---|---|---|---|---|---|
| 1 | f72d4f4 | [41944309398](https://github.com/dbsdlstn/Claude-Code-Game-Studios/actions/runs/41944309398) | 통과 | 실패: import 중 파싱 오류. `progress_data.gd`가 파싱되지 않아 `main.gd`가 연쇄 실패(`ProgressData` 해석 불가, `:=` 추론 실패). Godot 4.7.2 다운로드·gdUnit4 6.2.2 설치·import 자체는 성공 | `progress_data.gd:67` `var cleared := ... and summary["cleared"]`: Variant가 섞인 `and`는 타입을 추론하지 못한다 → `: bool`로 명시. 같은 패턴 6곳 모두 명시. CI에 스크립트별 `--check-only` 파싱 단계를 더해 한 번에 모든 오류를 보게 함 |
| 2 | 80e30ef | [41945077083](https://github.com/dbsdlstn/Claude-Code-Game-Studios/actions/runs/41945077083) | 통과 | 실패(105): 여전히 `ProgressData`만 파싱 실패, 연쇄로 `main.gd`·테스트 3개(round_session, progress_data, save_store) 로드 실패. **다른 스크립트·테스트 파일은 모두 파싱됨.** 파일별 파싱 단계는 Actions 기본 셸 `bash -e` 때문에 첫 파일에서 멈춰 원인 줄을 못 보여 줌 | 원인: `ProgressData.from_dict`에서 바깥 `var ids`와 안쪽 블록 `var ids`가 겹침(GDScript는 바깥 지역 변수를 가리는 선언을 오류로 본다). 바깥을 `raw_collected`로 바꿈. 같은 패턴을 찾는 스캐너로 다른 곳 없음 확인. CI 셸 단계에 `set +e` |
