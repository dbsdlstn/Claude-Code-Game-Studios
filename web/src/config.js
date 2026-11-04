/**
 * 웹 플레이 빌드 설정. 데이터 경로와 게임 수치는 여기 한 곳에서 바꾼다.
 * 경로는 index.html(= /web/) 기준 상대 경로다. 정적 서버는 저장소 루트에서 띄운다.
 */
export const CONFIG = Object.freeze({
  /** 앞에서부터 차례로 시도해 처음 읽히는 파일을 쓴다. `?data=경로`로 덮어쓸 수 있다. */
  cardDataUrls: Object.freeze([
    '../assets/data/cards/samguk.json',
    'data/sample-cards.json',
  ]),
  /** 라운드 시작 먹물. 브리프 MVP 4번. */
  startInk: 5,
  /** true면 verified: true 카드만 판정 대상으로 쓴다(출시 빌드 규칙 9). 플레이테스트 빌드는 false. */
  onlyVerified: false,
  /**
   * 튜토리얼에 쓸 기준 카드와 연습 카드 id. 데이터에 없으면 "기준 카드를 relation으로 가리키는 첫 카드"로 대신한다.
   * 연습 카드는 본게임에도 나온다(튜토리얼에서 맞혀도 도감에는 넣지 않는다).
   */
  tutorial: Object.freeze({ anchorId: 'goguryeo-peak-anchor', cardId: 'goguryeo-founding-01' }),
  /** localStorage 키. 저장 형식을 바꾸면 버전을 올린다. */
  storageKey: 'hanyang-dogam:save:v1',
});
