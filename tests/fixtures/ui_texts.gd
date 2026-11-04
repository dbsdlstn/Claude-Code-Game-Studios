extends RefCounted
## 테스트용: 노드 트리에서 실제로 보이는 글(Label·Button 글자, 툴팁)을 트리 순서대로 모은다.
## 노드가 씬 트리 밖에 있어도 쓸 수 있게 visible을 조상까지 직접 따라간다.
## 쓰는 법: const UiTexts = preload("res://tests/fixtures/ui_texts.gd")


static func visible_texts(root: Node) -> PackedStringArray:
	var out := PackedStringArray()
	for n: Node in root.find_children("*", "", true, false):
		if not _shown(n, root):
			continue
		if n is Label:
			out.append((n as Label).text)
		elif n is Button:
			out.append((n as Button).text)
		if n is Control and not (n as Control).tooltip_text.is_empty():
			out.append((n as Control).tooltip_text)
	if root is Control and not (root as Control).tooltip_text.is_empty():
		out.append((root as Control).tooltip_text)
	return out


static func _shown(n: Node, root: Node) -> bool:
	var cur: Node = n
	while cur != null:
		if cur is CanvasItem and not (cur as CanvasItem).visible:
			return false
		if cur == root:
			return true
		cur = cur.get_parent()
	return true
