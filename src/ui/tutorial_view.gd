class_name TutorialView
extends VBoxContainer
## 첫 실행 튜토리얼 화면. 기준 카드 1장과 튜토리얼 전용 연습 카드 1장으로
## "시기 정의 → 단서 1 → 관계 단서로 칸 좁히기 → 배치 → 해설"을 해 본다.
## 먹물·도감·플레이 기록에 영향을 주지 않는다. 언제든 건너뛸 수 있다.
## 규칙은 TutorialSession(src/core)이 맡는다.
##
## 사용 예:
##   var tv := TutorialView.new()
##   tv.setup(cfg, tutorial_data)
##   tv.finished.connect(_on_tutorial_finished)

## 튜토리얼이 끝났다. skipped: 건너뛰었으면 true, 다 했으면 false.
signal finished(skipped: bool)

enum Step { BOARD, CLUE1, RELATION, DONE }

var _config: GameConfig
var _data: TutorialData
var _session: TutorialSession
var _step: Step = Step.BOARD
var _board: BoardView
var _card_view: CardView
var _guide: Label
var _next_button: Button


## 화면을 만든다.
func setup(config: GameConfig, data: TutorialData) -> void:
	_config = config
	_data = data
	_session = TutorialSession.new(data.card)
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 10)

	var top := HBoxContainer.new()
	add_child(top)
	var title := Label.new()
	title.text = "튜토리얼 — 연습 카드 한 장"
	title.add_theme_font_size_override("font_size", 24)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(title)
	var skip := Button.new()
	skip.text = "건너뛰기"
	skip.pressed.connect(func() -> void: finished.emit(true))
	top.add_child(skip)

	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 16)
	add_child(body)
	var anchors: Array[CardData] = [data.anchor]
	_board = BoardView.new()
	_board.setup(config, anchors)
	_board.cell_targeted.connect(_on_cell_targeted)
	body.add_child(_board)

	var scroll := ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	body.add_child(scroll)
	var side := VBoxContainer.new()
	side.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	side.add_theme_constant_override("separation", 12)
	scroll.add_child(side)
	var guide_panel := PanelContainer.new()
	guide_panel.add_theme_stylebox_override("panel", HanjiTheme.box(HanjiTheme.ANCHOR, HanjiTheme.BORDER, 1, 12.0))
	side.add_child(guide_panel)
	_guide = Label.new()
	_guide.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_guide.custom_minimum_size = Vector2(360, 0)
	guide_panel.add_child(_guide)
	_next_button = Button.new()
	_next_button.text = "다음"
	_next_button.pressed.connect(_on_next)
	side.add_child(_next_button)
	_card_view = CardView.new()
	_card_view.more_clues_requested.connect(_on_more)
	side.add_child(_card_view)
	_render()


func _render() -> void:
	var a := _data.anchor
	var where := "%s %s" % [_config.nation_label(a.nation), _config.era_label(a.era)]
	match _step:
		Step.BOARD:
			var defs := PackedStringArray()
			for e in _config.era_ids():
				defs.append("· %s — %s" % [_config.era_label(e), _config.era_definition(e)])
			_guide.text = (
				"보드 읽기\n세로는 나라, 가로는 시기입니다. 시기는 연도가 아니라 사건의 성격으로 나눕니다.\n%s\n\n"
				+ "진하게 표시된 칸의 [%s]는 이름이 보이는 기준 카드(%s)입니다. 단서가 가리키는 이정표입니다."
			) % ["\n".join(defs), a.title, where]
			_next_button.visible = true
			_next_button.text = "다음"
		Step.CLUE1:
			_guide.text = "단서 1 — 장면\n카드 이름은 숨겨져 있습니다. 1단계 단서는 나라와 시기를 말하지 않고 장면만 보여 줍니다. 모르겠으면 '단서 더 보기'를 누르거나 '다음'으로 넘어가세요."
			_next_button.visible = true
		Step.RELATION:
			_guide.text = "단서 2 — 관계\n관계 단서는 기준 카드 [%s](%s)를 기준으로 칸을 좁혀 줍니다. 이제 카드를 알맞은 칸에 끌어다 놓아 보세요. 틀려도 먹물은 줄지 않습니다." % [a.title, where]
			_next_button.visible = false
		Step.DONE:
			var c := _session.card
			_guide.text = (
				"정답! [%s]\n%s\n\n"
				+ "본게임에서는 틀리면 먹물이 1 줄고, 카드는 정답 칸에 공개된 뒤 사라집니다. 먹물 %d개로 카드 %d장을 놓아 보세요."
			) % [c.title, c.explanation, _config.start_ink, _config.round_size]
			_next_button.visible = true
			_next_button.text = "본게임 시작"
	if _session.solved:
		_card_view.show_none("연습 카드를 맞혔습니다.")
	else:
		_card_view.show_card(_session.card, _session.visible_clues(), _session.can_reveal_more())


func _on_next() -> void:
	match _step:
		Step.BOARD:
			_step = Step.CLUE1
		Step.CLUE1:
			_step = Step.RELATION
			if _session.revealed_clues < 2:
				_session.reveal_more()
		Step.DONE:
			finished.emit(false)
			return
	_render()


func _on_more() -> void:
	if _session.reveal_more():
		if _step == Step.CLUE1 and _session.revealed_clues >= 2:
			_step = Step.RELATION
		_render()


func _on_cell_targeted(nation: String, era: String, by_drop: bool) -> void:
	if _session.solved or (not by_drop and not _card_view.selected):
		return
	var c := _session.card
	if _session.place(nation, era):
		_board.show_placed(c.nation, c.era, c.title, true)
		_step = Step.DONE
		_render()
	else:
		_board.flash_wrong(nation, era)
		if _step != Step.RELATION:
			_step = Step.RELATION
		_render()
		_guide.text += "\n\n그 칸이 아닙니다. 3단계 단서까지 열었습니다. 다시 놓아 보세요."
