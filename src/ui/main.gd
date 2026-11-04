extends Control
## 한양 도감 메인. 데이터를 읽고 화면(타이틀·튜토리얼·본게임·결과·도감·하는 방법)을 바꿔 끼운다.
## 규칙은 src/core 의 순수 클래스가 맡고, 여기서는 연결·저장 시점·화면 전환만 한다.
## 흐름: 설정 → 글꼴·테마 → 카드 읽기·검증 → 튜토리얼 데이터 → 진행 불러오기
##   → (첫 실행이면 튜토리얼, 아니면 타이틀) → 라운드 → 매 배치 후 저장 → 결과 화면.

var _config: GameConfig
var _cards: CardSet
var _tutorial: TutorialData
var _progress: ProgressData
var _store: SaveStore
var _session: RoundSession
var _rng := RandomNumberGenerator.new()
var _notice: String = ""
var _last_message: String = ""

var _screen_root: MarginContainer
var _title: TitleScreen
var _game: GameScreen
var _result: ResultView
var _dogam: DogamView
var _help: HelpView
var _tutorial_view: TutorialView
var _confirm_new: ConfirmationDialog
## 도감·하는 방법을 닫으면 돌아갈 화면.
var _return_to: Control


func _ready() -> void:
	var bg := ColorRect.new()
	bg.color = HanjiTheme.PAPER
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)

	_config = GameConfig.load_file()
	var font_pick := HanjiTheme.pick_font(_config.ui_font_path)
	theme = HanjiTheme.build(font_pick["font"])
	if not _config.is_valid():
		_show_fatal("설정 파일 오류", _config.errors)
		return
	var release_mode := _config.effective_release_mode(OS.is_debug_build())
	var cards_path := CardLoader.resolve_path(_config, release_mode)
	_cards = CardLoader.load_with_config(cards_path, _config, release_mode)
	if not _cards.is_valid():
		_show_card_errors(cards_path, release_mode)
		return

	var notices: Array[String] = []
	if not release_mode:
		notices.append("개발 모드: 검증 전 카드 포함")
	if cards_path != _config.cards_path:
		notices.append("콘텐츠 파일이 없어 테스트 픽스처 사용 (%s)" % cards_path)
	if font_pick["source"] == HanjiTheme.FONT_SOURCE_MISSING:
		notices.append("목록의 한글 글꼴을 찾지 못함: 글자가 네모로 보이면 한글 TTF를 %s 에 두세요" % _config.ui_font_path)
	_tutorial = _load_tutorial()
	if _tutorial == null and not _config.tutorial_path.is_empty():
		notices.append("튜토리얼 데이터 오류로 튜토리얼을 건너뜀")

	_store = SaveStore.new(_config.save_path)
	_progress = _store.load_progress()
	if not _store.last_error.is_empty():
		notices.append(_store.last_error)
	_notice = " · ".join(notices)
	_rng.randomize()

	_build_screens()
	var first_run := not _progress.tutorial_done and _progress.rounds_played == 0 and not _progress.has_current_round()
	if first_run and _tutorial != null:
		_open_tutorial()
	else:
		_show_title()


# --- 화면 구성 -------------------------------------------------------------

func _build_screens() -> void:
	_screen_root = MarginContainer.new()
	_screen_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side: String in ["margin_left", "margin_right", "margin_top", "margin_bottom"]:
		_screen_root.add_theme_constant_override(side, 16)
	add_child(_screen_root)

	_title = TitleScreen.new()
	_title.start_pressed.connect(_on_start_pressed)
	_title.continue_pressed.connect(_continue_round)
	_title.dogam_pressed.connect(_open_dogam)
	_title.help_pressed.connect(_open_help)
	_screen_root.add_child(_title)

	_game = GameScreen.new()
	_game.setup(_config, _cards, _notice)
	_game.placement_requested.connect(_on_placement)
	_game.more_clues_requested.connect(_on_more_clues)
	_game.dogam_pressed.connect(_open_dogam)
	_game.title_pressed.connect(_show_title)
	_screen_root.add_child(_game)

	_result = ResultView.new()
	_result.new_round_pressed.connect(_start_new_round)
	_result.dogam_pressed.connect(_open_dogam)
	_result.title_pressed.connect(_show_title)
	_screen_root.add_child(_result)

	_dogam = DogamView.new()
	_dogam.closed.connect(_close_overlay)
	_screen_root.add_child(_dogam)

	_help = HelpView.new()
	_help.setup(_config)
	_help.closed.connect(_close_overlay)
	_screen_root.add_child(_help)

	# 진행 중 라운드가 있을 때 "시작하기"는 확인을 받는다(리뷰 2 L8). 화면 목록과 섞이지 않게 Main에 붙인다.
	_confirm_new = ConfirmationDialog.new()
	_confirm_new.title = "새 라운드"
	_confirm_new.dialog_text = "진행 중인 라운드를 버리고 새로 시작할까요?\n(도감에 모은 카드는 그대로 남습니다.)"
	_confirm_new.ok_button_text = "새로 시작"
	_confirm_new.cancel_button_text = "취소"
	_confirm_new.theme = HanjiTheme.current()
	_confirm_new.confirmed.connect(_start_new_round)
	add_child(_confirm_new)


## 화면 하나만 보이게 한다.
func _show_only(screen: Control) -> void:
	for child in _screen_root.get_children():
		(child as Control).visible = child == screen
	# 화면마다 키보드 초점의 시작점을 준다(리뷰 2 L5).
	if screen.has_method("focus_default"):
		screen.call_deferred("focus_default")


func _show_title() -> void:
	_title.set_can_continue(_progress.has_current_round())
	_title.set_summary(_dogam_text())
	_show_only(_title)


func _open_dogam() -> void:
	_return_to = _visible_screen()
	_dogam.show_dogam(_config, _cards, _progress)
	_show_only(_dogam)


func _open_help() -> void:
	_return_to = _visible_screen()
	_show_only(_help)


func _close_overlay() -> void:
	if _return_to == null or _return_to == _dogam or _return_to == _help:
		_show_title()
		return
	if _return_to == _title:
		_show_title()
	else:
		_show_only(_return_to)


func _visible_screen() -> Control:
	for child in _screen_root.get_children():
		if (child as Control).visible:
			return child
	return null


# --- 튜토리얼 ------------------------------------------------------------

func _load_tutorial() -> TutorialData:
	var path := _config.tutorial_path
	if path.is_empty() or not FileAccess.file_exists(path):
		return null
	var t := TutorialData.parse(FileAccess.get_file_as_string(path), _cards, _config, _cards.release_mode)
	if not t.is_valid():
		for e: Dictionary in t.errors:
			push_warning("튜토리얼: [%d] %s %s" % [int(e["rule"]), e["id"], e["message"]])
		return null
	return t


func _open_tutorial() -> void:
	if _tutorial_view != null:
		_tutorial_view.queue_free()
	_tutorial_view = TutorialView.new()
	_tutorial_view.setup(_config, _tutorial)
	_tutorial_view.finished.connect(_on_tutorial_finished)
	_screen_root.add_child(_tutorial_view)
	_show_only(_tutorial_view)


func _on_tutorial_finished(skipped: bool) -> void:
	_progress.tutorial_done = true
	_save()
	if skipped:
		_show_title()
	else:
		_start_new_round()


# --- 라운드 진행 -------------------------------------------------------------

func _on_start_pressed() -> void:
	if _progress.has_current_round():
		_confirm_new.popup_centered()
	else:
		_start_new_round()


func _start_new_round() -> void:
	var queue := RoundBuilder.build_queue(_cards, _config.round_size, _rng, _progress.collected)
	_session = RoundSession.new(queue, _config.start_ink, _config.nation_ids(), _config.era_ids())
	_last_message = ""
	_save_round()
	_game.start_round()
	_refresh()
	_show_only(_game)


func _continue_round() -> void:
	var restored := RoundSession.from_dict(_progress.current_round, _cards, _config.nation_ids(), _config.era_ids())
	if restored == null:
		# 저장된 라운드를 쓸 수 없다(카드가 바뀜 등). 도감 기록은 그대로 두고 새 라운드.
		_progress.current_round = {}
		_start_new_round()
		_game.add_notice("저장된 라운드를 이어 갈 수 없어 새 라운드를 시작했습니다")
		return
	_session = restored
	_last_message = ""
	_game.restore_round(_session, _cards)
	_refresh()
	_show_only(_game)


func _refresh() -> void:
	_game.refresh(_session, _dogam_text())


func _on_more_clues() -> void:
	if _session != null and _session.reveal_more():
		_save_round()
		_refresh()


func _on_placement(nation: String, era: String) -> void:
	if _session == null:
		return
	var r := _session.place_current(nation, era)
	if not r["accepted"]:
		return
	var card: CardData = r["card"]
	var was_complete := _progress.is_complete(_playable_ids())
	if r["correct"] and _progress.collect(card.id):
		_session.note_new_collected(card.id)
	var completed_now := not was_complete and _progress.is_complete(_playable_ids())
	_game.show_placement(r, nation, era)
	_last_message = "[%s] %s" % [card.title, "정답" if r["correct"] else "오답"]

	if _session.is_over():
		var summary := _session.summary()
		_progress.record_round_result(summary, summary["new_ids"])
		_save()
		_result.show_result(_config, _cards, summary, summary["new_ids"], completed_now, _last_message)
		_show_only(_result)
		return
	_save_round()
	_refresh()
	if completed_now:
		# 게임 클리어(decision-log D16): 라운드 도중에 완성되면 알리고 라운드는 계속한다.
		_game.set_message("[도감 완성] 판정 카드 %d장을 모두 모았습니다! 라운드는 계속할 수 있습니다." % _playable_ids().size())


## 판정 카드 id 목록(도감 완성 기준).
func _playable_ids() -> PackedStringArray:
	var ids := PackedStringArray()
	for c: CardData in _cards.playable:
		ids.append(c.id)
	return ids


func _dogam_text() -> String:
	var ids := _playable_ids()
	return "도감 %d / %d" % [_progress.count_in(ids), ids.size()]


## 진행 중 라운드(이번 라운드에 새로 모은 카드 포함)를 저장한다.
func _save_round() -> void:
	_progress.current_round = _session.to_dict()
	_save()


func _save() -> void:
	if _store.save(_progress) != OK and _game != null:
		_game.add_notice(_store.last_error)


# --- 오류 화면 -------------------------------------------------------------

func _show_card_errors(cards_path: String, release_mode: bool) -> void:
	var rules := CardValidator.rules_of(_cards.errors)
	var only_coverage := not rules.is_empty()
	for r in rules:
		if r != CardValidator.RULE_CELL_COVERAGE:
			only_coverage = false
	var lines: Array[String] = []
	if release_mode and only_coverage:
		# 출시 빌드(디버그 아님)는 verified 카드만 읽는다. 사실 확인 전에는 이 화면이 정상이다(D11).
		lines.append("출시 빌드는 사실 확인(verified: true)이 끝난 카드만 씁니다.")
		lines.append("아직 확인된 카드가 부족해 보드의 일부 칸이 비어 시작할 수 없습니다.")
		lines.append("플레이테스트는 에디터 실행이나 디버그 내보내기로 하세요(docs/run-locally.md).")
		lines.append("")
	for e: Dictionary in _cards.errors:
		lines.append("[규칙 %d] %s: %s" % [int(e["rule"]), e["id"], e["message"]])
	_show_fatal("카드 데이터 오류 (%s)" % cards_path, lines)


func _show_fatal(heading: String, lines: Array[String]) -> void:
	var scroll := ScrollContainer.new()
	scroll.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(scroll)
	var l := Label.new()
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(1000, 0)
	l.text = heading + "\n\n" + "\n".join(lines)
	scroll.add_child(l)
	push_error(l.text)
