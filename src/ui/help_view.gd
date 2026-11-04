class_name HelpView
extends PanelContainer
## "하는 방법" 화면. 시기 정의는 설정에서 읽는다.

signal closed

var _back: Button


## 내용을 만든다.
func setup(config: GameConfig) -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_stylebox_override("panel", HanjiTheme.box(HanjiTheme.CARD, HanjiTheme.BORDER, 1, 20.0))
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	add_child(box)
	var heading := Label.new()
	heading.text = "하는 방법"
	heading.add_theme_font_size_override("font_size", 28)
	box.add_child(heading)
	var lines := PackedStringArray([
		"1. 이름이 숨겨진 카드의 단서를 읽습니다. 1단계는 장면, 2단계는 기준 카드와의 관계, 3단계는 직접 힌트입니다.",
		"2. 카드를 나라 × 시기 칸에 끌어다 놓습니다(또는 카드를 누른 뒤 칸을 누릅니다).",
		"3. 정답이면 이름과 해설이 열리고 도감에 들어갑니다. 오답이면 먹물이 1 줄고, 카드는 정답 칸에 공개된 뒤 사라집니다.",
		"4. 한 라운드는 카드 %d장입니다. 먹물 %d개가 다 떨어지면 실패, 먹물이 남은 채 다 놓으면 클리어입니다." % [config.round_size, config.start_ink],
		"5. 판정 카드를 모두 모으면 도감 완성입니다. 모은 카드는 라운드가 실패해도 남습니다.",
		"",
		"시기는 연도가 아니라 사건의 성격으로 나눕니다.",
	])
	for e in config.era_ids():
		lines.append("· %s — %s" % [config.era_label(e), config.era_definition(e)])
	var body := Label.new()
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.custom_minimum_size = Vector2(600, 0)
	body.text = "\n".join(lines)
	box.add_child(body)
	_back = Button.new()
	_back.text = "돌아가기"
	_back.pressed.connect(func() -> void: closed.emit())
	box.add_child(_back)


## 키보드 초점을 "돌아가기"에 둔다.
func focus_default() -> void:
	_back.grab_focus()
