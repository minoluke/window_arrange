def test_duplicate_creates_copy_with_same_size(app):
    app.locator(".painting").first.click()
    app.locator("#duplicate-btn").click()

    assert app.locator(".painting").count() == 2

    paintings = app.evaluate("() => state.paintings.map(p => ({w:p.paintingWidthCm,h:p.paintingHeightCm,name:p.name}))")
    assert paintings[0]["w"] == paintings[1]["w"]
    assert paintings[0]["h"] == paintings[1]["h"]
    assert "コピー" in paintings[1]["name"]


def test_duplicate_offsets_position(app):
    app.locator(".painting").first.click()
    orig = app.evaluate("() => ({x: state.paintings[0].xCm, y: state.paintings[0].yCm})")
    app.locator("#duplicate-btn").click()
    copy = app.evaluate("() => ({x: state.paintings[1].xCm, y: state.paintings[1].yCm})")
    assert copy["x"] != orig["x"] or copy["y"] != orig["y"]


def test_rotate_cycles_through_90_180_270_0(app):
    app.locator(".painting").first.click()

    for expected in [90, 180, 270, 0]:
        app.locator("#rotate-btn").click()
        rot = app.evaluate("() => state.paintings[0].rotation")
        assert rot == expected


def test_rotate_preserves_center(app):
    # 十分な大きさの壁を用意して絵を真ん中に置く
    wall_w = app.locator(".wall-w").first
    wall_h = app.locator(".wall-h").first
    wall_w.fill("600")
    wall_w.dispatch_event("input")
    wall_h.fill("600")
    wall_h.dispatch_event("input")

    app.locator(".painting").first.click()

    # 絵を座標 (100, 100) に移動。paintingTotalCm は 50x62 → 中心 (125, 131)
    app.evaluate("() => { state.paintings[0].xCm = 100; state.paintings[0].yCm = 100; renderAll(); }")

    before_center = app.evaluate("""
      () => {
        const p = state.paintings[0];
        const rot = (p.rotation || 0) % 360;
        const w = (rot === 90 || rot === 270) ? p.paintingHeightCm : p.paintingWidthCm;
        const h = (rot === 90 || rot === 270) ? p.paintingWidthCm  : p.paintingHeightCm;
        return { x: p.xCm + w / 2, y: p.yCm + h / 2 };
      }
    """)

    app.locator("#rotate-btn").click()

    after_center = app.evaluate("""
      () => {
        const p = state.paintings[0];
        const rot = (p.rotation || 0) % 360;
        const w = (rot === 90 || rot === 270) ? p.paintingHeightCm : p.paintingWidthCm;
        const h = (rot === 90 || rot === 270) ? p.paintingWidthCm  : p.paintingHeightCm;
        return { x: p.xCm + w / 2, y: p.yCm + h / 2 };
      }
    """)

    assert abs(after_center["x"] - before_center["x"]) < 0.01
    assert abs(after_center["y"] - before_center["y"]) < 0.01


def test_rotate_swaps_displayed_dimensions(app):
    app.locator(".painting").first.click()

    natural = app.evaluate("() => ({w: state.paintings[0].paintingWidthCm, h: state.paintings[0].paintingHeightCm})")
    assert natural["w"] != natural["h"], "このテストは縦長/横長が区別できる初期値前提"

    div = app.locator(".painting").first
    before_w = div.bounding_box()["width"]
    before_h = div.bounding_box()["height"]

    app.locator("#rotate-btn").click()

    after_w = div.bounding_box()["width"]
    after_h = div.bounding_box()["height"]

    # 90°回転で幅と高さが入れ替わっている（丸め誤差を許容）
    assert abs(after_w - before_h) <= 1
    assert abs(after_h - before_w) <= 1
