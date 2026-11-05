extends SceneTree
## CI 화면 캡처(decision-log D55). 게임 코드는 바꾸지 않고 main.tscn을 띄워 Main의 함수로 상태를 만든 뒤
## 뷰포트를 PNG로 저장한다. gdUnit4 테스트가 아니다(파일 이름이 *_test.gd가 아니라 스위트로 잡히지 않는다).
##
## 실행(가상 디스플레이 필요, --headless 금지):
##   xvfb-run -a -s "-screen 0 1280x720x24" godot --path . --rendering-driver opengl3 \
##     --resolution 1280x720 -s res://tests/screens/capture_screens.gd -- --out=<절대 경로>
## 첫 실행 상태(저장 없음)에서 시작해야 튜토리얼이 먼저 뜬다. CI는 매번 새 user:// 이다.

var _out_dir: String = ""
var _main: Node
var _count: int = 0


func _initialize() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):
			_out_dir = arg.substr("--out=".length())
	if _out_dir.is_empty():
		_out_dir = ProjectSettings.globalize_path("res://production/qa/evidence/godot")
	DirAccess.make_dir_recursive_absolute(_out_dir)
	_run.call_deferred()


func _run() -> void:
	_main = (load("res://src/main.tscn") as PackedScene).instantiate()
	root.add_child(_main)
	await _settle(0.6)

	# 1. 첫 실행 튜토리얼(보드 읽기)
	await _shot("01-tutorial-board")
	var tv: Node = _main.get("_tutorial_view")
	if tv != null:
		tv.call("_on_next")  # 단서 1
		tv.call("_on_next")  # 단서 2(관계)
		await _settle(0.3)
		await _shot("02-tutorial-relation")
	# 튜토리얼을 건너뛴 것으로 하고 타이틀로
	_main.call("_on_tutorial_finished", true)
	await _settle(0.3)
	await _shot("03-title")

	# 2. 본게임: 단서 모두 펼침
	_main.call("_start_new_round")
	await _settle(0.3)
	await _shot("04-board-start")
	_main.call("_on_more_clues")
	_main.call("_on_more_clues")
	await _settle(0.3)
	await _shot("05-board-clues")

	# 3. 관계 단서 강조(현재 카드의 relation 단서가 가리키는 기준 카드)
	var session: RoundSession = _main.get("_session")
	var game: GameScreen = _main.get("_game")
	var board: BoardView = game.get("_board")
	var anchor_id := _relation_ref(session.current_card())
	if not anchor_id.is_empty():
		board.show_ref(anchor_id, true)
		await _settle(0.2)
		await _shot("06-board-ref-highlight")
		board.clear_ref()

	# 4. 정답 배치
	var card := session.current_card()
	_main.call("_on_placement", card.nation, card.era)
	await _settle(0.3)
	await _shot("07-after-correct")

	# 5. 오답 배치(다른 나라 칸)
	card = session.current_card()
	var wrong := _wrong_cell(card)
	_main.call("_on_placement", wrong[0], wrong[1])
	await _settle(0.15)
	await _shot("08-after-wrong")

	# 6. 남은 카드를 오답으로 놓아 라운드를 끝낸다 → 결과 화면
	var guard := 0
	while not session.is_over() and guard < 30:
		card = session.current_card()
		wrong = _wrong_cell(card)
		_main.call("_on_placement", wrong[0], wrong[1])
		guard += 1
	await _settle(0.4)
	await _shot("09-round-result")

	# 7. 도감(모은 카드 하나 상세)
	_main.call("_open_dogam")
	await _settle(0.3)
	var dogam: DogamView = _main.get("_dogam")
	var progress: ProgressData = _main.get("_progress")
	var cards: CardSet = _main.get("_cards")
	for c: CardData in cards.playable:
		if progress.is_collected(c.id):
			dogam.call("_show_detail", c)
			break
	await _settle(0.3)
	await _shot("10-dogam")

	# 8. 하는 방법
	_main.call("_open_help")
	await _settle(0.3)
	await _shot("11-help")

	print("captured %d screens into %s" % [_count, _out_dir])
	quit(0)


func _settle(seconds: float) -> void:
	await create_timer(seconds).timeout
	await process_frame
	await process_frame


func _shot(shot_name: String) -> void:
	await RenderingServer.frame_post_draw
	var img := root.get_texture().get_image()
	var path := _out_dir.path_join("%s.png" % shot_name)
	var err := img.save_png(path)
	if err != OK:
		push_error("save_png failed (%d): %s" % [err, path])
		quit(1)
		return
	_count += 1
	print("saved %s (%dx%d)" % [path, img.get_width(), img.get_height()])


func _relation_ref(card: CardData) -> String:
	if card == null:
		return ""
	for clue: Dictionary in card.clues:
		if str(clue["kind"]) == "relation" and not (clue["refs"] as PackedStringArray).is_empty():
			return (clue["refs"] as PackedStringArray)[0]
	return ""


func _wrong_cell(card: CardData) -> Array:
	var cfg: GameConfig = _main.get("_config")
	for n in cfg.nation_ids():
		if n != card.nation:
			return [n, card.era]
	return [card.nation, card.era]
