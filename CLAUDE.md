# CLAUDE.md

このリポジトリで作業する Claude Code 向けのガイド。

## プロジェクト概要

ガラス窓の絵を複数並べて個展レイアウトを検討するローカルアプリ。
`index.html` をブラウザで開くだけで動く。フレームワーク・ビルドツールは使わない。

- `index.html` — UI（サイドバー + 壁キャンバス）
- `app.js` — 状態管理・描画・ドラッグ・JSON import/export
- `style.css` — スタイル
- `tests/` — E2Eテスト（pytest-playwright）

座標の正規単位は **cm**。描画時だけ `state.scale` で px に変換する。

## 開発ルール

- **機能を追加・変更したら、必ず E2E テストを走らせる**（下記「E2Eテスト」参照）
- 新機能を追加したら、対応するテストも追加する
- フレームワークや npm 依存を持ち込まない（素の HTML/CSS/JS を維持）
- テストは Python (pytest-playwright) のみ。`node_modules` は作らない

## E2Eテスト

### セットアップ（初回のみ）

```bash
pip install pytest-playwright
playwright install chromium
```

`playwright install` は `~/Library/Caches/ms-playwright/` にブラウザバイナリを置く。
リポジトリは汚れない。

### 実行（うまくいった手順）

プロジェクトルートで：

```bash
pytest tests/ -v
```

これだけで通る。3〜5秒で完走。

**ポイント**
- `file://` で `index.html` を直接開いているのでサーバー起動不要。ポート競合なし
- `conftest.py` の `app` フィクスチャが page を用意する。各テストは `app.locator(...)` から始める
- 数値・テキスト入力は `fill()` の後に `dispatch_event("input")` が必要（アプリが `input` イベントで反応するため）
- JS 側の `state` を直接確認したい時は `app.evaluate("() => state.xxx")` が一番確実

### うまくいかなかった/ハマりそうなパターン

- `page.goto("index.html")` のような相対パス → file URL にする必要あり。`conftest.py` で `Path().as_uri()` 使用
- `fill()` だけだと DOM は変わるが `input` イベントが発火しないため、状態が反映されない。必ず `dispatch_event("input")` をセットで呼ぶ
- `page.click(".painting")` は要素が複数ある時に曖昧。`.first` か具体的な `data-id` で絞る

### テスト失敗時のデバッグ

```bash
pytest tests/ --headed          # ブラウザを表示して実行
pytest tests/ --slowmo 500      # ミリ秒単位でスロー再生
pytest tests/ -v --tracing on   # トレース保存、後で playwright show-trace で再生
```

**ドラッグ系のテスト**を書く時は `page.mouse.move(x, y)` → `page.mouse.down()` → `page.mouse.move(x2, y2, steps=5)` → `page.mouse.up()` の順で。`steps` を入れないとドラッグイベントが連続発火せず、アプリ側の状態更新がトリガーされないことがある。

### テストを追加する時

`tests/test_xxx.py` を作る。`app` フィクスチャを引数に取れば page が渡ってくる。

```python
def test_something(app):
    app.locator("#add-btn").click()
    assert app.locator(".painting").count() == 2
```

## 主な state 構造（app.js）

```js
state = {
  walls: [{ id, widthCm, heightCm, xCm, yCm }],   // 複数壁、各壁はキャンバス内の位置を持つ
  scale,                                           // cm → px 変換係数（全壁の外接矩形から決定）
  paintings: [{                                    // 絵の配列（各絵は wallId で所属壁を指す）
    id, wallId, name, xCm, yCm,                    // xCm/yCm は所属壁の原点基準
    paintingWidthCm, paintingHeightCm,
    blockWidthCm, blockHeightCm,
    mullionCm, frameWidthCm,
    offsetXCm, offsetYCm,
    rotation,                                      // 0 / 90 / 180 / 270
    colorGlass, colorMullion, colorFrame,
  }],
  nextId,                                          // wall/painting 共通のID採番
  selectedPaintingId,
  selectedWallId,
}
```

- 絵の描画は `drawPainting(p)` が Canvas 2D で実行。回転はキャンバス中心で `ctx.rotate`
- 回転操作時は **中心を保ったまま** 90°刻みで回す（rotate-btn ハンドラ参照）
- 壁ドラッグは `startWallDrag` / `moveDrag(kind='wall')`、絵ドラッグは `startPaintingDrag` / `moveDrag(kind='painting')`
- DOM 階層: `#wall-container > .wall > .painting` — 絵は所属壁の子要素として配置され、壁を動かせば中の絵も一緒に動く
- JSON import は `migrateImportData()` で旧 `{wall: {...}}` → `{walls: [...]}` の自動変換に対応
- ズーム: `scale = fitScale * zoom`。`fitScale` は全壁が収まる自動倍率（壁サイズ/位置で変わる）、`zoom` はユーザー操作分。Cmd/Ctrl+ホイール or トラックパッドピンチ、または右下の +/−/⊡ ボタン。リセットで `zoom=1`（= 自動フィット）
