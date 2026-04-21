def test_initial_has_one_wall(app):
    assert app.locator(".wall").count() == 1
    assert app.evaluate("() => state.walls.length") == 1


def test_add_wall_creates_second(app):
    app.locator("#add-wall-btn").click()
    assert app.locator(".wall").count() == 2
    assert app.evaluate("() => state.walls.length") == 2


def test_new_wall_is_draggable_and_moves_independently(app):
    app.locator("#add-wall-btn").click()
    second_id = app.evaluate("() => state.walls[1].id")
    before = app.evaluate(
        f"() => {{const w = state.walls.find(x => x.id === {second_id}); return {{x: w.xCm, y: w.yCm}};}}"
    )

    div = app.locator(f'.wall[data-id="{second_id}"]')
    box = div.bounding_box()

    # Drag the wall by clicking at its top-left (which is wall area, not a painting)
    app.mouse.move(box["x"] + 5, box["y"] + 5)
    app.mouse.down()
    app.mouse.move(box["x"] + 100, box["y"] + 80, steps=5)
    app.mouse.up()

    after = app.evaluate(
        f"() => {{const w = state.walls.find(x => x.id === {second_id}); return {{x: w.xCm, y: w.yCm}};}}"
    )
    assert after["x"] != before["x"] or after["y"] != before["y"], "壁がドラッグで動いていない"

    # 1枚目の壁は動いていない
    first = app.evaluate("() => ({x: state.walls[0].xCm, y: state.walls[0].yCm})")
    assert first["x"] == 0 and first["y"] == 0


def test_painting_belongs_to_first_wall_by_default(app):
    first_wall_id = app.evaluate("() => state.walls[0].id")
    painting_wall_id = app.evaluate("() => state.paintings[0].wallId")
    assert painting_wall_id == first_wall_id


def test_add_painting_assigns_to_selected_wall(app):
    app.locator("#add-wall-btn").click()
    # 2枚目を選択状態にしてから絵を追加
    app.locator(".wall-item-title").nth(1).click()
    app.locator("#add-btn").click()

    last_painting_wall = app.evaluate("() => state.paintings.at(-1).wallId")
    second_wall_id = app.evaluate("() => state.walls[1].id")
    assert last_painting_wall == second_wall_id


def test_remove_wall_also_removes_its_paintings(app):
    app.locator("#add-wall-btn").click()
    # 2枚目の壁に絵を追加
    app.locator(".wall-item-title").nth(1).click()
    app.locator("#add-btn").click()
    assert app.locator(".painting").count() == 2

    # 2枚目の壁を削除
    app.locator(".wall-item-remove").nth(1).click()
    assert app.locator(".wall").count() == 1
    assert app.locator(".painting").count() == 1


def test_cannot_remove_last_wall(app):
    # 壁1枚の状態で削除ボタンを押しても消えない
    app.locator(".wall-item-remove").first.click()
    assert app.locator(".wall").count() == 1


def test_legacy_json_import_migrates_to_walls_array(app):
    result = app.evaluate("""
      () => {
        importJSON({
          wall: { widthCm: 400, heightCm: 250 },
          paintings: [],
          nextId: 5
        });
        return { wallsLength: state.walls.length, firstWallW: state.walls[0].widthCm, hasOldWall: 'wall' in state };
      }
    """)
    assert result["wallsLength"] == 1
    assert result["firstWallW"] == 400
    assert result["hasOldWall"] is False
