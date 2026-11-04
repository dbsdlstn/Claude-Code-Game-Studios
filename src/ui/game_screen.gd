class_name GameScreen
extends VBoxContainer
## 본게임 화면: 상단 정보(먹물, 카드 n/12, 도감 m/36), 보드, 카드, 메시지.
## 상태는 갖지 않는다. Main이 RoundSession을 넘겨 다시 그리게 하고, 입력은 시그널로 알린다.
##
## 사용 예:
##   var screen := GameScreen.new()
##   screen.setup(cfg, card_set, "")
##   screen.placement_requested.connect(_on_place)
##   screen.refresh(session, "도감 3 / 36")

## 현재 카드를 (nation, era)에 놓으려 한다.
signal placement_requested(nation: String, era: String)
## "단서 더 보기".
signal more_clues_requested
## "도감" 버튼.
signal dogam_pressed
## "타이틀" 버튼.
signal title_pressed

var _config: GameConfig
var _board: BoardView
var _card_view: CardView
var _ink_label: Label
var _ink_empty_label: Label
var _reveal: RevealView
var _count_label: Label
var _dogam_label: Label
var _notice_label: Label
var _message_label: Label


## 화면을 만든다. notice: 상단 안내(개발 모드, 글꼴 등). 비우면 숨긴다.
func setup(config: GameConfig, cards: CardSet, notice: String) -> void:
	_config = config
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 10)

	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 20)
	add_child(top)
	var title := Label.new()
	title.text = "한양 도감 — 삼국시대"
	title.add_theme_font_size_override("font_size", 24)
	top.add_child(title)
	# 먹물 게이지: 채움은 먹색, 빈 칸은 옅은 색(바이블 §4.3). 개수(●○)로도 읽힌다.
	var ink_box := HBoxContainer.new()
	ink_box.add_theme_constant_override("separation", 0)
	top.add_child(ink_box)
	_ink_label = Label.new()
	_ink_label.add_theme_font_size_override("font_size", 20)
	ink_box.add_child(_ink_label)
	_ink_empty_label = Label.new()
	_ink_empty_label.add_theme_font_size_override("font_size", 20)
	_ink_empty_label.add_theme_color_override("font_color", HanjiTheme.INK_EMPTY)
	ink_box.add_child(_ink_empty_label)
	_count_label = Label.new()
	top.add_child(_count_label)
	_dogam_label = Label.new()
	top.add_child(_dogam_label)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(spacer)
	var dogam_button := Button.new()
	dogam_button.text = "도감"
	dogam_button.pressed.connect(func() -> void: dogam_pressed.emit())
	top.add_child(dogam_button)
	var title_button := Button.new()
	title_button.text = "타이틀"
	title_button.pressed.connect(func() -> void: title_pressed.emit())
	top.add_child(title_button)

	_notice_label = HanjiTheme.small_label(notice)
	_notice_label.visible = not notice.is_empty()
	add_child(_notice_label)

	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 16)
	add_child(body)
	_board = BoardView.new()
	_board.setup(config, cards.anchors)
	_board.cell_targeted.connect(_on_cell_targeted)
	body.add_child(_board)

	# 해설이 길어도 넘치지 않게 옆 패널은 세로 스크롤.
	var scroll := ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	body.add_child(scroll)
	var side := VBoxContainer.new()
	side.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	side.add_theme_constant_override("separation", 12)
	scroll.add_child(side)
	_card_view = CardView.new()
	_card_view.set_ref_titles(ref_titles(cards.anchors))
	_card_view.anchor_ref_focused.connect(_board.highlight_anchor)
	_card_view.more_clues_requested.connect(func() -> void: more_clues_requested.emit())
	_card_view.selection_changed.connect(_on_selection_changed)
	side.add_child(_card_view)
	_reveal = RevealView.new()
	side.add_child(_reveal)
	_message_label = Label.new()
	_message_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_message_label.custom_minimum_size = Vector2(360, 0)
	side.add_child(_message_label)


## 기준 카드 id → 제목(관계 단서 버튼용).
static func ref_titles(anchors: Array[CardData]) -> Dictionary:
	var out: Dictionary = {}
	for a: CardData in anchors:
		out[a.id] = a.title
	return out


## 새 라운드: 보드를 비우고 안내를 띄운다.
func start_round() -> void:
	_board.reset()
	_reveal.clear()
	set_message("단서를 읽고, 보드의 기준 카드와의 관계를 따져 칸을 고르세요.")


## 이어하기: 저장된 라운드에서 이미 놓인 카드를 보드에 다시 그린다.
func restore_round(session: RoundSession, cards: CardSet) -> void:
	_board.reset()
	_reveal.clear()
	for n in _config.nation_ids():
		for e in _config.era_ids():
			for entry: Variant in session.cell_cards(n, e):
				var c := cards.get_card(str(entry["card_id"]))
				if c != null:
					_board.show_placed(n, e, c.title, bool(entry["correct"]))
	set_message("이어서 합니다.")


## 세션 상태로 상단 정보와 카드를 다시 그린다.
func refresh(session: RoundSession, dogam_text: String) -> void:
	var left := session.ink.current
	_ink_label.text = "먹물 " + "●".repeat(left)
	_ink_empty_label.text = "○".repeat(maxi(session.ink.max_ink - left, 0))
	_count_label.text = "카드 %d / %d" % [mini(session.placed_count() + 1, session.total_cards()), session.total_cards()]
	_dogam_label.text = dogam_text
	var card := session.current_card()
	if card == null:
		_card_view.show_none("라운드가 끝났습니다.")
	else:
		_card_view.show_card(card, session.visible_clues(), session.can_reveal_more())


## 배치 결과를 보드와 메시지에 반영한다. r: RoundSession.place_current()의 결과.
func show_placement(r: Dictionary, chosen_nation: String, chosen_era: String) -> void:
	var card: CardData = r["card"]
	var correct: bool = r["correct"]
	_board.show_placed(card.nation, card.era, card.title, correct)
	_reveal.show_card(_config, card, correct)
	if correct:
		set_message("정답! [%s]\n%s" % [card.title, card.explanation])
	else:
		_board.flash_wrong(chosen_nation, chosen_era)
		set_message("오답 (먹물 -1). [%s]의 자리는 %s %s입니다.\n%s" % [
			card.title, _config.nation_label(card.nation), _config.era_label(card.era), card.explanation])


## 메시지 칸.
func set_message(text: String) -> void:
	_message_label.text = text


## 상단 안내를 덧붙인다(저장 실패 등).
func add_notice(text: String) -> void:
	if text.is_empty():
		return
	_notice_label.text = text if _notice_label.text.is_empty() else _notice_label.text + " · " + text
	_notice_label.visible = true


## 키보드 초점을 카드에 둔다(화면을 열 때, 키보드로 놓은 뒤).
func focus_default() -> void:
	_card_view.grab_focus()


func _on_cell_targeted(nation: String, era: String, by_drop: bool, by_keyboard: bool) -> void:
	if by_drop or _card_view.selected:
		_card_view.set_selected(false)
		placement_requested.emit(nation, era)
		if by_keyboard:
			# 키보드로 놓았으면 다음 카드를 바로 고를 수 있게 초점을 카드로 돌려준다(리뷰 2 L5).
			_card_view.grab_focus.call_deferred()


func _on_selection_changed(is_selected: bool, by_keyboard: bool) -> void:
	# 키보드로 고르면 초점을 보드 첫 칸으로 옮겨 방향키로 칸을 고를 수 있게 한다.
	# 마우스로 고르면 초점을 옮기지 않는다(리뷰 2 L4).
	if is_selected and by_keyboard:
		_board.focus_first_cell(_config)
