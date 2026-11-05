// PROTOTYPE - NOT FOR PRODUCTION (M1, decision-log D56)
/**
 * M1 프로토타입 설정. 데이터 경로와 학습 수치는 여기 한 곳에서 바꾼다.
 * design/leitner-spec.md가 오면 이 값을 그 명세에 맞춘다(지금은 보수적 초기값, decision-log D59).
 */
export const CONFIG = Object.freeze({
  /** 앞에서부터 처음 읽히는 파일을 쓴다. `?data=경로`로 덮어쓸 수 있다. 경로는 index.html 기준. */
  dataUrls: Object.freeze([
    '../../assets/data/m1/goguryeo.json',
    'data/sample.json',
  ]),
  /** 한 세션의 카드 수(짧은 세션). 카드가 더 적으면 있는 만큼. */
  sessionSize: 8,
  /** Leitner 상자 수. 1이 가장 자주, 마지막이 가장 드물게 나온다. */
  boxCount: 5,
  /** 상자별 재출제 간격(세션 수). index = 상자 번호. 상자 b에서 세션 s에 답했으면 s + intervals[b] 세션부터 다시 나온다. */
  intervals: Object.freeze([0, 1, 2, 4, 8, 16]),
  /** 정답일 때 승급 폭. index = 이번 카드에서 연 단서 수. 단서를 볼수록 덜 오른다(단서 비용). */
  promoteByClues: Object.freeze([2, 1, 0]),
  /** 오답이면 이 상자로 내려간다. */
  wrongBox: 1,
  /** 처음 보는 카드의 출발 상자(승급은 여기서 계산). */
  startBox: 1,
  /** 숙련 도감 등급: 상자 번호 하한. */
  mastery: Object.freeze({ bronze: 2, silver: 4, gold: 5 }),
  /** true면 이번 세션에 놓은 카드도 연표에 들어가 이후 틈이 잘게 나뉜다(Timeline 방식). */
  placedJoinTimeline: true,
  storageKey: 'hanyang-m1:save:v1',
});
