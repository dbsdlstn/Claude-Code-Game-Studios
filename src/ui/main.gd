extends Control
## 한양 도감 메인 화면. 규칙은 src/core 의 순수 클래스가 맡고, 여기서는 연결과 표시만 한다.
## 흐름: 설정 읽기 → 카드 읽기·검증 → 진행 불러오기 → 라운드 시작 → 배치 → 저장.

var _config: GameConfig
var _cards: CardSet
var _progress: ProgressData
var _store: SaveStore
var _session: RoundSession
var _rng := RandomNumberGenerator.new()
## cell_key -> BoardCell
var _cells: Dictionary = {}

var _ink_label: Label
var _count_label: Label
var _notice_label: Label
var _message_label: Label
var _card_view: CardView
var _game_body: HBoxContainer
var _dogam_view: DogamView


func _ready() -> void:
	theme = HanjiTheme.build()
	var bg := ColorRect.new()
	bg.color = HanjiTheme.PAPER
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)

	_config = GameConfig.load_file()
	if not _config.is_valid():
		_show_fatal("설정 파일 오류", _config.errors)
		return
	var release_mode := _config.effective_release_mode(OS.is_debug_build())
	var cards_path := CardLoader.resolve_path(_config, release_mode)
	_cards = CardLoader.load_file(cards_path, _config.nation_ids(), _config.era_ids(), release_mode)
	if not _cards.is_valid():
		var lines: Array[String] = []
		for e: Dictionary in _cards.errors:
			lines.append("[규칙 %d] %s: %s" % [int(e["rule"]), e["id"], e["message"]])
		_show_fatal("카드 데이터 오류 (%s)" % cards_path, lines)
		return

	_store = SaveStore.new(_config.save_path)
	_progress = _store.load_progress()
	_rng.randomize()

	var notices: Array[String] = []
	if not release_mode:
		notices.append("개발 모드: 검증 전 카드 포함")
	if cards_path != _config.cards_path:
		notices.append("콘텐츠 파일이 없어 테스트 픽스처 사용 (%s)" % cards_path)
	if not _store.last_error.is_empty():
		notices.append(_store.last_error)
	_build_ui(" · ".join(notices))
	_start_round()


# --- 화면 구성 -------------------------------------------------------------

func _build_ui(notice: String) -> void:
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side: String in ["margin_left", "margin_right", "margin_top", "margin_bottom"]:
		margin.add_theme_constant_override(side, 16)
	add_child(margin)

	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 10)
	margin.add_child(root)

	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 20)
	root.add_child(top)
	var title := Label.new()
	title.text = "한양 도감 — 삼국시대"
	title.add_theme_font_size_override("font_size", 24)
	top.add_child(title)
	_ink_label = Label.new()
	_ink_label.add_theme_font_size_override("font_size", 20)
	top.add_child(_ink_label)
	_count_label = Label.new()
	top.add_child(_count_label)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(spacer)
	var dogam_button := Button.new()
	dogam_button.text = "도감"
	dogam_button.pressed.connect(_open_dogam)
	top.add_child(dogam_button)
	var new_round_button := Button.new()
	new_round_button.text = "새 라운드"
	new_round_button.pressed.connect(_start_round)
	top.add_child(new_round_button)

	_notice_label = HanjiTheme.small_label(notice)
	_notice_label.visible = not notice.is_empty()
	root.add_child(_notice_label)

	_game_body = HBoxContainer.new()
	_game_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_game_body.add_theme_constant_override("separation", 16)
	root.add_child(_game_body)
	_game_body.add_child(_build_board())

	var side_panel := VBoxContainer.new()
	side_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	side_panel.add_theme_constant_override("separation", 12)
	_game_body.add_child(side_panel)
	_card_view = CardView.new()
	_card_view.more_clues_requested.connect(_on_more_clues)
	side_panel.add_child(_card_view)
	_message_label = Label.new()
	_message_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_message_label.custom_minimum_size = Vector2(380, 0)
	side_panel.add_child(_message_label)

	_dogam_view = DogamView.new()
	_dogam_view.visible = false
	_dogam_view.closed.connect(_close_dogam)
	root.add_child(_dogam_view)


## 나라 × 시기 보드. 열 머리글에는 시기 정의를 항상 보여 준다(decision-log D2).
func _build_board() -> GridContainer:
	var grid := GridContainer.new()
	grid.columns = _config.era_ids().size() + 1
	grid.add_theme_constant_override("h_separation", 6)
	grid.add_theme_constant_override("v_separation", 6)
	grid.add_child(Control.new())  # 왼쪽 위 빈 칸
	for e in _config.era_ids():
		var header := VBoxContainer.new()
		header.custom_minimum_size = Vector2(176, 0)
		var name_label := Label.new()
		name_label.text = _config.era_label(e)
		name_label.add_theme_font_size_override("font_size", 18)
		name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		header.add_child(name_label)
		var def_label := HanjiTheme.small_label(_config.era_definition(e))
		def_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		def_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		def_label.custom_minimum_size = Vector2(176, 0)
		header.add_child(def_label)
		grid.add_child(header)
	for n in _config.nation_ids():
		var row_label := Label.new()
		row_label.text = _config.nation_label(n)
		row_label.add_theme_font_size_override("font_size", 18)
		row_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		row_label.custom_minimum_size = Vector2(64, 0)
		grid.add_child(row_label)
		for e in _config.era_ids():
			var titles := PackedStringArray()
			for a: CardData in _cards.anchors_for_cell(n, e):
				titles.append(a.title)
			var cell := BoardCell.new()
			cell.setup(n, e, titles)
			cell.card_dropped.connect(_on_cell_target)
			cell.cell_clicked.connect(_on_cell_clicked)
			_cells[CardData.make_cell_key(n, e)] = cell
			grid.add_child(cell)
	return grid


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


# --- 라운드 진행 -------------------------------------------------------------

func _start_round() -> void:
	var queue := RoundBuilder.build_queue(_cards, _config.nation_ids(), _config.era_ids(), _rng, _progress.collected)
	_session = RoundSession.new(queue, _config.start_ink, _config.nation_ids(), _config.era_ids())
	for cell: BoardCell in _cells.values():
		cell.show_empty()
	_message_label.text = "단서를 읽고, 보드의 기준 카드와의 관계를 따져 칸을 고르세요."
	_close_dogam()
	_refresh()


func _refresh() -> void:
	var left := _session.ink.current
	_ink_label.text = "먹물 " + "●".repeat(left) + "○".repeat(maxi(_session.ink.max_ink - left, 0))
	_count_label.text = "카드 %d / %d" % [mini(_session.placed_count() + 1, _session.total_cards()), _session.total_cards()]
	var card := _session.current_card()
	if card == null:
		if _session.status == RoundSession.Status.FAILED:
			_card_view.show_none("먹물이 바닥났습니다. '새 라운드'로 재도전하세요.")
		else:
			_card_view.show_none("라운드 클리어! '새 라운드'로 다시 하거나 도감을 보세요.")
	else:
		_card_view.show_card(card, _session.visible_clues(), _session.can_reveal_more())


func _on_more_clues() -> void:
	if _session.reveal_more():
		_refresh()


func _on_cell_clicked(nation: String, era: String) -> void:
	if _card_view.selected:
		_on_cell_target(nation, era)


func _on_cell_target(nation: String, era: String) -> void:
	var r := _session.place_current(nation, era)
	if not r["accepted"]:
		if r["reason"] == RoundSession.REJECT_OCCUPIED:
			_message_label.text = "이미 카드가 놓인 칸입니다."
		return
	var card: CardData = r["card"]
	var answer_cell: BoardCell = _cells.get(card.cell_key())
	if answer_cell != null:
		answer_cell.show_placed(card.title, r["correct"])
	if r["correct"]:
		_progress.collect(card.id)
		_message_label.text = "정답! [%s]\n%s" % [card.title, card.explanation]
	else:
		var chosen: BoardCell = _cells.get(CardData.make_cell_key(nation, era))
		if chosen != null:
			chosen.flash_wrong()
		_message_label.text = "오답 (먹물 -1). [%s]의 자리는 %s %s입니다.\n%s" % [
			card.title, _config.nation_label(card.nation), _config.era_label(card.era), card.explanation]

	if _session.is_over():
		var cleared := _session.status == RoundSession.Status.CLEARED
		_progress.record_round(cleared)
		var summary := "정답 %d / %d, 단서 더 보기 %d회, 남은 먹물 %d" % [
			_session.correct_count, _session.total_cards(), _session.hints_used, _session.ink.current]
		_message_label.text += "\n\n%s %s" % ["[도감 완성]" if cleared else "[실패]", summary]
	_save()
	_refresh()


func _save() -> void:
	if _store.save(_progress) != OK:
		_notice_label.text = _store.last_error
		_notice_label.visible = true


# --- 도감 ------------------------------------------------------------------

func _open_dogam() -> void:
	_dogam_view.show_dogam(_config, _cards, _progress)
	_game_body.visible = false
	_dogam_view.visible = true


func _close_dogam() -> void:
	_dogam_view.visible = false
	_game_body.visible = true
