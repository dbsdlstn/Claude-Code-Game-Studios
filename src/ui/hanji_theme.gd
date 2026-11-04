class_name HanjiTheme
extends RefCounted
## 한지·고지도 톤의 기본 테마. 색 값은 아트 바이블(design/art/art-bible.md §4) 하나를 따른다
## (웹 빌드도 같은 hex, decision-log D37). 주석의 hex가 기준이고 Color()는 그 값을 255로 나눈 것이다.
## 색은 표시용 값이라 게임 규칙 설정(game_config.json)에 넣지 않았다.

const PAPER := Color(0.9373, 0.9020, 0.8235)     # 한지 바탕 #efe6d2
const CARD := Color(1.0000, 0.9804, 0.9412)  # 카드 면 #fffaf0 (바이블에 없음: 칸보다 밝게 둔 구현 선택)
const CELL := Color(0.9686, 0.9412, 0.8706)      # 빈 칸 #f7f0de
const ANCHOR := Color(0.8902, 0.8392, 0.7059)    # 기준 카드 #e3d6b4
const INK := Color(0.1686, 0.1294, 0.0941)       # 먹색 글자 #2b2118
const MUTED := Color(0.3569, 0.2902, 0.2078)     # 보조 글자 #5b4a35
const BORDER := Color(0.5412, 0.4275, 0.2314)    # 테두리 #8a6d3b
const CORRECT := Color(0.8118, 0.9098, 0.7686)   # 정답 #cfe8c4
const WRONG := Color(0.9529, 0.7686, 0.7529)     # 오답 #f3c4c0
const HOVER := Color(1.0000, 0.9137, 0.6588)       # 끌어 놓기 대상 #ffe9a8
const ACCENT := Color(0.7529, 0.2235, 0.1686)    # 선택 표시 #c0392b
## 금은 두 값이다(decision-log D42). GOLD는 한지 대비 약 2.2라 장식(선, 인장 바탕, 클리어 연출)에만,
## 글자와 키보드 초점에는 GOLD_DARK(대비 4.5 이상)를 쓴다.
const GOLD := Color(0.7804, 0.6039, 0.1804)  # 금 #C79A2E
const GOLD_DARK := Color(0.4902, 0.3529, 0.0706)  # 강조(글자·포커스) 짙은 금 #7D5A12
## 관계 단서 참조와 그 기준 카드 칸 강조(웹 --indigo, 바이블 백제 청과 같은 값).
const INDIGO := Color(0.1843, 0.3647, 0.4863)  # 참조 #2F5D7C
const REF_TARGET_BG := Color(0.8902, 0.9255, 0.9490)  # 참조 칸 강조 바탕 #E3ECF2 (웹과 같은 값)
const FOCUS_BG := Color(0.9725, 0.9294, 0.8000)  # 키보드 초점 칸 바탕 #F8EDCC (웹과 같은 값)
const SEAL_LIGHT_TEXT := Color(1, 1, 1)  # 인장 글자(어두운 나라색 바탕) #FFFFFF
const CORRECT_TEXT := Color(0.1804, 0.3529, 0.1647)  # 정답 글자 #2E5A2A
const WRONG_TEXT := Color(0.5412, 0.1647, 0.1333)  # 오답 글자 #8A2A22
const INK_EMPTY := Color(0.7882, 0.7373, 0.6078)  # 먹물 게이지 빈 칸 #C9BC9B
## 나라 색(아트 바이블 §4.2). 보드 행 머리글과 공개 후 카드에만 쓴다(숨김 카드에는 쓰지 않는다).
const NATION_COLORS := {
	"goguryeo": Color(0.6353, 0.2314, 0.1647),  # #A23B2A
	"baekje": Color(0.1843, 0.3647, 0.4863),  # #2F5D7C
	"silla": Color(0.7804, 0.6039, 0.1804),  # #C79A2E
	"gaya": Color(0.3098, 0.4784, 0.3333),  # #4F7A55
}
## 카드 유형 표시 이름. 정답 공개 후(해설, 도감)에만 보인다(decision-log D37).
const TYPE_LABELS := {"event": "사건", "artifact": "유물", "person": "인물", "myth": "전승"}

## 한글이 있는 시스템 글꼴 이름(우선순위 순). 한글 판정은 이 목록만으로 한다.
const KOREAN_FONT_NAMES := [
	"Noto Sans CJK KR", "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo",
	"NanumGothic", "NanumBarunGothic", "UnDotum",
]
## 테마에 넣는 이름: 한글 목록 뒤에 일반 글꼴을 붙인다. "sans-serif"는 라틴 글꼴로 풀릴 수 있어
## 판정에는 쓰지 않는다(리뷰 2 L3). 실제 그리기는 OS 대체 글꼴로 한글이 보일 수도 있다.
const FALLBACK_FONT_NAME := "sans-serif"
## 글꼴이 한글을 그릴 수 있는지 볼 때 쓰는 글자('한', U+D55C).
const HANGUL_PROBE := 0xD55C
## pick_font()가 고른 글꼴의 출처.
const FONT_SOURCE_BUNDLED := "bundled"
const FONT_SOURCE_SYSTEM := "system"
const FONT_SOURCE_MISSING := "missing"

## 마지막으로 만든 테마. 노드 트리 밖(드래그 미리보기 등)에서 같은 테마를 쓰기 위해 둔다.
static var _current: Theme = null


## 나라 색. 모르는 나라면 선 색.
static func nation_color(nation_id: String) -> Color:
	return NATION_COLORS.get(nation_id, BORDER)


## 인장 글자: 나라 라벨의 첫 글자(고구려 → 고). 색만으로 구분하지 않게 한다(바이블 §3).
static func seal_char(nation_label: String) -> String:
	return nation_label.substr(0, 1)


## 인장 글자색: 나라 바탕과 대비 4.5 이상이 되는 쪽(흰색 또는 먹). 신라(금 바탕)는 먹 글자(D42, 웹과 같음).
static func seal_text_color(nation_id: String) -> Color:
	var bg := nation_color(nation_id)
	return SEAL_LIGHT_TEXT if contrast_ratio(SEAL_LIGHT_TEXT, bg) >= contrast_ratio(INK, bg) else INK


## WCAG 대비율(1~21). 사용 예: HanjiTheme.contrast_ratio(HanjiTheme.INK, HanjiTheme.PAPER)
static func contrast_ratio(a: Color, b: Color) -> float:
	var la := _luminance(a)
	var lb := _luminance(b)
	return (maxf(la, lb) + 0.05) / (minf(la, lb) + 0.05)


static func _luminance(c: Color) -> float:
	return 0.2126 * _channel(c.r) + 0.7152 * _channel(c.g) + 0.0722 * _channel(c.b)


static func _channel(v: float) -> float:
	return v / 12.92 if v <= 0.03928 else pow((v + 0.055) / 1.055, 2.4)


## 인장(지름 30px 원, 나라 색 바탕, 대비를 맞춘 글자색).
static func seal(nation_id: String, nation_label: String) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = nation_color(nation_id)
	p.add_theme_stylebox_override("panel", sb)
	sb.set_corner_radius_all(15)
	p.custom_minimum_size = Vector2(30, 30)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var l := Label.new()
	l.text = seal_char(nation_label)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.add_theme_color_override("font_color", seal_text_color(nation_id))
	l.add_theme_font_size_override("font_size", 16)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.add_child(l)
	return p


## 카드 유형 표시 이름.
static func type_label(card_type: String) -> String:
	return TYPE_LABELS.get(card_type, card_type)


## 색과 테두리로 StyleBoxFlat을 만든다.
static func box(bg: Color, border: Color = BORDER, border_width: int = 1, margin: float = 8.0) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(border_width)
	sb.set_corner_radius_all(4)
	sb.set_content_margin_all(margin)
	return sb


## 한글 글꼴을 고른다. 순서: 1) bundled_path의 번들 글꼴 2) 시스템 한글 글꼴
## 3) 둘 다 없으면 시스템 글꼴을 그대로 쓰되 출처를 "missing"으로 알린다(화면에 안내).
## 돌려주는 값: { "font": Font, "source": FONT_SOURCE_* }
## 사용 예: var pick := HanjiTheme.pick_font(cfg.ui_font_path); theme = HanjiTheme.build(pick["font"])
static func pick_font(bundled_path: String) -> Dictionary:
	var system := SystemFont.new()
	var names := PackedStringArray(KOREAN_FONT_NAMES)
	names.append(FALLBACK_FONT_NAME)
	system.font_names = names
	var probe := SystemFont.new()
	probe.font_names = PackedStringArray(KOREAN_FONT_NAMES)
	if not bundled_path.is_empty() and ResourceLoader.exists(bundled_path):
		var bundled := load(bundled_path) as Font
		if bundled != null and bundled.has_char(HANGUL_PROBE):
			# 번들 글꼴에 없는 글자(한자 등)는 시스템 글꼴로 보충한다.
			var with_fallback := bundled.duplicate() as Font
			if with_fallback != null:
				var chain: Array[Font] = [system]
				with_fallback.fallbacks = chain
				return {"font": with_fallback, "source": FONT_SOURCE_BUNDLED}
			return {"font": bundled, "source": FONT_SOURCE_BUNDLED}
	if probe.has_char(HANGUL_PROBE):
		return {"font": system, "source": FONT_SOURCE_SYSTEM}
	push_warning("목록의 한글 글꼴을 찾지 못했다. 글자가 네모로 보이면 한글 TTF를 %s 에 둔다." % bundled_path)
	return {"font": system, "source": FONT_SOURCE_MISSING}


## 게임 전체 테마. font가 null이면 시스템 한글 글꼴을 쓴다.
static func build(font: Font = null) -> Theme:
	var t := Theme.new()
	if font == null:
		font = pick_font("")["font"]
	t.default_font = font
	t.default_font_size = 16

	t.set_color("font_color", "Label", INK)
	t.set_stylebox("panel", "PanelContainer", box(CARD))
	t.set_stylebox("panel", "Panel", box(PAPER, PAPER, 0, 0.0))

	t.set_stylebox("normal", "Button", box(CARD, BORDER, 1, 6.0))
	t.set_stylebox("hover", "Button", box(HOVER, BORDER, 1, 6.0))
	t.set_stylebox("pressed", "Button", box(ANCHOR, BORDER, 2, 6.0))
	t.set_stylebox("disabled", "Button", box(CELL, ANCHOR, 1, 6.0))
	t.set_stylebox("focus", "Button", box(Color(0, 0, 0, 0), GOLD_DARK, 3, 6.0))
	t.set_color("font_color", "Button", INK)
	t.set_color("font_hover_color", "Button", INK)
	t.set_color("font_pressed_color", "Button", INK)
	t.set_color("font_focus_color", "Button", INK)
	t.set_color("font_disabled_color", "Button", MUTED)
	t.set_stylebox("panel", "ScrollContainer", box(Color(0, 0, 0, 0), Color(0, 0, 0, 0), 0, 0.0))
	_current = t
	return t


## 게임 테마. 아직 만들지 않았으면 시스템 글꼴로 만든다.
## 사용 예: preview.theme = HanjiTheme.current()
static func current() -> Theme:
	if _current == null:
		return build()
	return _current



## 작은 보조 글자 라벨.
static func small_label(text: String, size: int = 13) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_color_override("font_color", MUTED)
	l.add_theme_font_size_override("font_size", size)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l
