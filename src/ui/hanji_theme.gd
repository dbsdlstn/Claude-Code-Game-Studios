class_name HanjiTheme
extends RefCounted
## 한지·고지도 톤의 기본 테마(placeholder). 아트 에셋이 생기면 교체한다.
## 색은 표시용 값이라 게임 규칙 설정(game_config.json)에 넣지 않았다.

const PAPER := Color(0.937, 0.902, 0.824)     # 한지 바탕 #efe6d2
const CARD := Color(1.0, 0.98, 0.941)         # 카드 #fffaf0
const CELL := Color(0.969, 0.941, 0.871)      # 빈 칸 #f7f0de
const ANCHOR := Color(0.890, 0.839, 0.706)    # 기준 카드 #e3d6b4
const INK := Color(0.169, 0.129, 0.094)       # 먹색 글자 #2b2118
const MUTED := Color(0.357, 0.290, 0.208)     # 보조 글자 #5b4a35
const BORDER := Color(0.541, 0.427, 0.231)    # 테두리 #8a6d3b
const CORRECT := Color(0.812, 0.910, 0.769)   # 정답 #cfe8c4
const WRONG := Color(0.953, 0.769, 0.753)     # 오답 #f3c4c0
const HOVER := Color(1.0, 0.914, 0.659)       # 끌어 놓기 대상 #ffe9a8
const ACCENT := Color(0.753, 0.224, 0.169)    # 선택 표시 #c0392b

## 한글이 있는 시스템 글꼴을 우선 찾는다. 없으면 엔진 기본 글꼴의 시스템 대체 글꼴을 쓴다.
const FONT_NAMES := ["Noto Sans CJK KR", "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", "NanumGothic", "sans-serif"]


## 색과 테두리로 StyleBoxFlat을 만든다.
static func box(bg: Color, border: Color = BORDER, border_width: int = 1, margin: float = 8.0) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(border_width)
	sb.set_corner_radius_all(4)
	sb.set_content_margin_all(margin)
	return sb


## 게임 전체 테마.
static func build() -> Theme:
	var t := Theme.new()
	var font := SystemFont.new()
	font.font_names = PackedStringArray(FONT_NAMES)
	t.default_font = font
	t.default_font_size = 16

	t.set_color("font_color", "Label", INK)
	t.set_stylebox("panel", "PanelContainer", box(CARD))
	t.set_stylebox("panel", "Panel", box(PAPER, PAPER, 0, 0.0))

	t.set_stylebox("normal", "Button", box(CARD, BORDER, 1, 6.0))
	t.set_stylebox("hover", "Button", box(HOVER, BORDER, 1, 6.0))
	t.set_stylebox("pressed", "Button", box(ANCHOR, BORDER, 2, 6.0))
	t.set_stylebox("disabled", "Button", box(CELL, ANCHOR, 1, 6.0))
	t.set_stylebox("focus", "Button", box(Color(0, 0, 0, 0), ACCENT, 2, 6.0))
	t.set_color("font_color", "Button", INK)
	t.set_color("font_hover_color", "Button", INK)
	t.set_color("font_pressed_color", "Button", INK)
	t.set_color("font_focus_color", "Button", INK)
	t.set_color("font_disabled_color", "Button", MUTED)
	return t


## 작은 보조 글자 라벨.
static func small_label(text: String, size: int = 13) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_color_override("font_color", MUTED)
	l.add_theme_font_size_override("font_size", size)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l
