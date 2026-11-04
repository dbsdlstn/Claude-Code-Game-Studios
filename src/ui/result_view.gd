class_name ResultView
extends PanelContainer
## 라운드 결과 화면: 정답 수, 남은 먹물, 새로 모은 카드, 단서 단계 분포, 오답 해설.
## 숫자는 RoundSession.summary()에서 받는다(웹 빌드 D20과 같은 항목).

signal new_round_pressed
signal dogam_pressed
signal title_pressed

var _body: VBoxContainer


func _init() -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_stylebox_override("panel", HanjiTheme.box(HanjiTheme.CARD, HanjiTheme.BORDER, 1, 20.0))
	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 12)
	add_child(root)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	root.add_child(scroll)
	_body = VBoxContainer.new()
	_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_body.add_theme_constant_override("separation", 8)
	scroll.add_child(_body)
	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 12)
	root.add_child(buttons)
	_button(buttons, "새 라운드", func() -> void: new_round_pressed.emit())
	_button(buttons, "도감", func() -> void: dogam_pressed.emit())
	_button(buttons, "타이틀", func() -> void: title_pressed.emit())


## 결과를 그린다. new_ids: 이번 라운드에 새로 모은 카드. completed: 이번에 도감을 완성했는지.
func show_result(config: GameConfig, cards: CardSet, summary: Dictionary, new_ids: Array, completed: bool, last_message: String) -> void:
	for child in _body.get_children():
		child.queue_free()
	var cleared: bool = summary["cleared"]
	_heading("라운드 클리어" if cleared else "먹물이 바닥났습니다 — 실패", 30)
	if completed:
		_heading("[도감 완성] 판정 카드 %d장을 모두 모았습니다!" % cards.playable.size(), 22)
	_line("정답 %d / %d · 남은 먹물 %d · 새로 모은 카드 %d장 · 단서 더 보기 %d회" % [
		int(summary["correct"]), int(summary["placed"]), int(summary["ink_left"]), new_ids.size(), int(summary["hints"])])
	var dist := [0, 0, 0]
	for lv: Variant in summary["clue_levels"]:
		var i := clampi(int(lv), 1, 3) - 1
		dist[i] += 1
	_line("놓을 때 본 단서: 1단계 %d장 · 2단계 %d장 · 3단계 %d장" % [dist[0], dist[1], dist[2]])
	if not last_message.is_empty():
		_line("")
		_line("마지막 카드: " + last_message)
	if not new_ids.is_empty():
		_heading("새로 모은 카드", 20)
		for id: Variant in new_ids:
			var c := cards.get_card(str(id))
			if c != null:
				_line("· %s (%s %s)" % [c.title, config.nation_label(c.nation), config.era_label(c.era)])
	var wrong: Array = summary["wrong_ids"]
	if not wrong.is_empty():
		_heading("틀린 카드 해설", 20)
		for id: Variant in wrong:
			var c := cards.get_card(str(id))
			if c != null:
				_line("· %s — %s %s\n  %s" % [c.title, config.nation_label(c.nation), config.era_label(c.era), c.explanation])


func _button(parent: Control, text: String, on_press: Callable) -> void:
	var b := Button.new()
	b.text = text
	b.pressed.connect(on_press)
	parent.add_child(b)


func _heading(text: String, size: int) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_body.add_child(l)


func _line(text: String) -> void:
	var l := Label.new()
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(600, 0)
	_body.add_child(l)
