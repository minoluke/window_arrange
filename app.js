// ── State ──────────────────────────────────────────────
const state = {
  walls: [],
  scale: 1,
  fitScale: 1,     // 全壁が収まる自動フィット倍率
  zoom: 1,         // ユーザー操作のズーム倍率 (scale = fitScale * zoom)
  paintings: [],
  nextId: 1,
  selectedPaintingId: null,
  selectedWallId: null,
};

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 8;

const dragState = {
  active: false,
  kind: null,          // 'painting' | 'wall'
  targetId: null,
  startMouseX: 0,
  startMouseY: 0,
  startPxX: 0,
  startPxY: 0,
  paintingPxW: 0,
  paintingPxH: 0,
  wallPxW: 0,
  wallPxH: 0,
};

let isUpdatingSidebar = false;

// ── Helpers ────────────────────────────────────────────
function paintingTotalCm(p) {
  const rot = ((p.rotation || 0) % 360 + 360) % 360;
  if (rot === 90 || rot === 270) {
    return { widthCm: p.paintingHeightCm, heightCm: p.paintingWidthCm };
  }
  return { widthCm: p.paintingWidthCm, heightCm: p.paintingHeightCm };
}

function computeScale() {
  const area = document.getElementById('canvas-area');
  const pad = window.innerWidth <= 680 ? 24 : 64;
  const availW = area.clientWidth  - pad;
  const availH = area.clientHeight - pad;

  let boundsW = 100, boundsH = 100;
  state.walls.forEach(w => {
    boundsW = Math.max(boundsW, w.xCm + w.widthCm);
    boundsH = Math.max(boundsH, w.yCm + w.heightCm);
  });

  const sw = availW / boundsW;
  const sh = availH / boundsH;
  state.fitScale = Math.max(0.05, Math.min(sw, sh, 5));
  state.scale = state.fitScale * (state.zoom || 1);

  const wc = document.getElementById('wall-container');
  if (wc) {
    wc.style.width  = Math.ceil(boundsW * state.scale) + 'px';
    wc.style.height = Math.ceil(boundsH * state.scale) + 'px';
  }

  updateZoomDisplay();
}

function updateZoomDisplay() {
  const el = document.getElementById('zoom-level');
  if (!el) return;
  el.textContent = Math.round(state.zoom * 100) + '%';
}

function setZoom(newZoom) {
  state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
  renderAll();
}

function currentWallId() {
  if (state.selectedWallId !== null && state.walls.some(w => w.id === state.selectedWallId)) {
    return state.selectedWallId;
  }
  return state.walls[0] ? state.walls[0].id : null;
}

// ── Factories ──────────────────────────────────────────
function createWall() {
  const offset = state.walls.length * 30;
  return {
    id: state.nextId++,
    widthCm: 360,
    heightCm: 230,
    xCm: offset,
    yCm: offset,
  };
}

function createPainting(wallId) {
  const count = state.paintings.filter(p => p.wallId === wallId).length;
  const offset = (count % 6) * 10;
  const id = state.nextId++;
  return {
    id,
    wallId,
    name:             `絵 ${id}`,
    xCm:              10 + offset,
    yCm:              10 + offset,
    paintingWidthCm:  50,
    paintingHeightCm: 62,
    blockWidthCm:     10,
    blockHeightCm:    10,
    mullionCm:        2,
    frameWidthCm:     0,
    offsetXCm:        0,
    offsetYCm:        0,
    rotation:         0,
    colorGlass:    '#b8cdd4',
    colorMullion:  '#2d2d2d',
    colorFrame:    '#4a3728',
  };
}

// ── Rendering ──────────────────────────────────────────
function renderAll() {
  computeScale();
  state.walls.forEach(w => {
    ensureWallElement(w);
    positionWallElement(w);
  });
  state.paintings.forEach(p => {
    ensurePaintingElement(p);
    positionPaintingElement(p);
    drawPainting(p);
  });
  syncDOMToState();
  renderSidebar();
}

function ensureWallElement(w) {
  if (document.querySelector(`.wall[data-id="${w.id}"]`)) return;
  const div = document.createElement('div');
  div.className = 'wall';
  div.dataset.id = w.id;

  const label = document.createElement('div');
  label.className = 'wall-label';
  div.appendChild(label);

  document.getElementById('wall-container').appendChild(div);
  attachWallListeners(div, w);
}

function positionWallElement(w) {
  const div = document.querySelector(`.wall[data-id="${w.id}"]`);
  if (!div) return;
  const s = state.scale;
  div.style.left   = Math.round(w.xCm * s) + 'px';
  div.style.top    = Math.round(w.yCm * s) + 'px';
  div.style.width  = Math.round(w.widthCm  * s) + 'px';
  div.style.height = Math.round(w.heightCm * s) + 'px';
  div.classList.toggle('selected', w.id === state.selectedWallId);

  const lbl = div.querySelector('.wall-label');
  if (lbl) lbl.textContent = `壁 ${state.walls.indexOf(w) + 1}`;
}

function drawPainting(p) {
  const div = document.querySelector(`.painting[data-id="${p.id}"]`);
  if (!div) return;
  const canvas = div.querySelector('canvas');
  const s = state.scale;
  const { widthCm: effW, heightCm: effH } = paintingTotalCm(p);
  const pxW = Math.round(effW * s);
  const pxH = Math.round(effH * s);

  canvas.width  = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d');

  const rot = ((p.rotation || 0) % 360 + 360) % 360;
  const natW = Math.round(p.paintingWidthCm  * s);
  const natH = Math.round(p.paintingHeightCm * s);

  ctx.save();
  ctx.translate(pxW / 2, pxH / 2);
  ctx.rotate(rot * Math.PI / 180);
  ctx.translate(-natW / 2, -natH / 2);

  const fw = p.frameWidthCm  * s;
  const mw = p.mullionCm     * s;
  const bw = p.blockWidthCm  * s;
  const bh = p.blockHeightCm * s;

  ctx.fillStyle = p.colorFrame;
  ctx.fillRect(0, 0, natW, natH);

  const ox = fw, oy = fw;
  const cw = natW - 2 * fw;
  const ch = natH - 2 * fw;
  ctx.fillStyle = p.colorMullion;
  ctx.fillRect(ox, oy, cw, ch);

  const periodX = bw + mw;
  const periodY = bh + mw;
  const offX = ((p.offsetXCm * s) % periodX + periodX) % periodX;
  const offY = ((p.offsetYCm * s) % periodY + periodY) % periodY;

  const startX = ox + offX - periodX;
  const startY = oy + offY - periodY;
  const cols = Math.ceil((cw + periodX) / periodX) + 1;
  const rows = Math.ceil((ch + periodY) / periodY) + 1;

  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, cw, ch);
  ctx.clip();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = startX + mw + c * periodX;
      const cy = startY + mw + r * periodY;
      ctx.fillStyle = p.colorGlass;
      ctx.fillRect(cx, cy, bw, bh);
    }
  }

  ctx.restore();
  ctx.restore();
}

function ensurePaintingElement(p) {
  if (document.querySelector(`.painting[data-id="${p.id}"]`)) return;
  const wallDiv = document.querySelector(`.wall[data-id="${p.wallId}"]`);
  if (!wallDiv) return;

  const div = document.createElement('div');
  div.className = 'painting';
  div.dataset.id = p.id;

  const label = document.createElement('div');
  label.className = 'painting-label';
  label.textContent = p.name;
  div.appendChild(label);

  const canvas = document.createElement('canvas');
  div.appendChild(canvas);

  wallDiv.appendChild(div);
  attachPaintingListeners(div, p);
}

function positionPaintingElement(p) {
  const div = document.querySelector(`.painting[data-id="${p.id}"]`);
  if (!div) return;
  const { widthCm, heightCm } = paintingTotalCm(p);
  div.style.left   = Math.round(p.xCm    * state.scale) + 'px';
  div.style.top    = Math.round(p.yCm    * state.scale) + 'px';
  div.style.width  = Math.round(widthCm  * state.scale) + 'px';
  div.style.height = Math.round(heightCm * state.scale) + 'px';
  div.classList.toggle('selected', p.id === state.selectedPaintingId);
}

function syncDOMToState() {
  const paintingIds = new Set(state.paintings.map(p => String(p.id)));
  document.querySelectorAll('.painting').forEach(el => {
    if (!paintingIds.has(el.dataset.id)) el.remove();
  });
  const wallIds = new Set(state.walls.map(w => String(w.id)));
  document.querySelectorAll('.wall').forEach(el => {
    if (!wallIds.has(el.dataset.id)) el.remove();
  });
}

function syncSelectedOutlines() {
  state.paintings.forEach(p => positionPaintingElement(p));
  state.walls.forEach(w => positionWallElement(w));
}

// ── Drag ───────────────────────────────────────────────
function startPaintingDrag(p, clientX, clientY) {
  const { widthCm, heightCm } = paintingTotalCm(p);
  const wall = state.walls.find(w => w.id === p.wallId);
  if (!wall) return;

  state.selectedPaintingId = p.id;
  state.selectedWallId     = null;

  dragState.active        = true;
  dragState.kind          = 'painting';
  dragState.targetId      = p.id;
  dragState.startMouseX   = clientX;
  dragState.startMouseY   = clientY;
  dragState.startPxX      = Math.round(p.xCm * state.scale);
  dragState.startPxY      = Math.round(p.yCm * state.scale);
  dragState.paintingPxW   = Math.round(widthCm  * state.scale);
  dragState.paintingPxH   = Math.round(heightCm * state.scale);
  dragState.wallPxW       = Math.round(wall.widthCm  * state.scale);
  dragState.wallPxH       = Math.round(wall.heightCm * state.scale);

  syncSelectedOutlines();
  renderSidebar();
}

function startWallDrag(w, clientX, clientY) {
  state.selectedWallId     = w.id;
  state.selectedPaintingId = null;

  dragState.active      = true;
  dragState.kind        = 'wall';
  dragState.targetId    = w.id;
  dragState.startMouseX = clientX;
  dragState.startMouseY = clientY;
  dragState.startPxX    = Math.round(w.xCm * state.scale);
  dragState.startPxY    = Math.round(w.yCm * state.scale);

  syncSelectedOutlines();
  renderSidebar();
}

function moveDrag(clientX, clientY) {
  if (!dragState.active) return;
  const dx = clientX - dragState.startMouseX;
  const dy = clientY - dragState.startMouseY;

  if (dragState.kind === 'painting') {
    const p = state.paintings.find(x => x.id === dragState.targetId);
    if (!p) return;
    const rawX = dragState.startPxX + dx;
    const rawY = dragState.startPxY + dy;
    p.xCm = Math.max(0, Math.min(dragState.wallPxW - dragState.paintingPxW, rawX)) / state.scale;
    p.yCm = Math.max(0, Math.min(dragState.wallPxH - dragState.paintingPxH, rawY)) / state.scale;
    positionPaintingElement(p);
  } else if (dragState.kind === 'wall') {
    const w = state.walls.find(x => x.id === dragState.targetId);
    if (!w) return;
    w.xCm = Math.max(0, (dragState.startPxX + dx) / state.scale);
    w.yCm = Math.max(0, (dragState.startPxY + dy) / state.scale);
    positionWallElement(w);
  }
}

function attachPaintingListeners(div, p) {
  div.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    startPaintingDrag(p, e.clientX, e.clientY);
  });

  div.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    startPaintingDrag(p, e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
}

function attachWallListeners(div, w) {
  div.addEventListener('mousedown', (e) => {
    if (e.target !== div) return;
    e.preventDefault();
    startWallDrag(w, e.clientX, e.clientY);
  });

  div.addEventListener('touchstart', (e) => {
    if (e.target !== div) return;
    e.preventDefault();
    startWallDrag(w, e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
}

// ── Sidebar ────────────────────────────────────────────
function rebuildWallsList() {
  const list = document.getElementById('walls-list');
  list.innerHTML = '';
  state.walls.forEach((w, i) => {
    const item = document.createElement('div');
    item.className = 'wall-item';
    item.dataset.id = w.id;
    item.innerHTML = `
      <div class="wall-item-header">
        <span class="wall-item-title">壁 ${i + 1}</span>
        <button class="wall-item-remove">削除</button>
      </div>
      <div class="field-row">
        <label>幅</label>
        <input type="number" class="wall-w" min="50" max="2000" step="10">
        <span class="field-unit">cm</span>
      </div>
      <div class="field-row">
        <label>高さ</label>
        <input type="number" class="wall-h" min="50" max="2000" step="10">
        <span class="field-unit">cm</span>
      </div>
    `;

    const wInput = item.querySelector('.wall-w');
    const hInput = item.querySelector('.wall-h');
    wInput.value = w.widthCm;
    hInput.value = w.heightCm;

    item.querySelector('.wall-item-title').addEventListener('click', () => {
      state.selectedWallId     = w.id;
      state.selectedPaintingId = null;
      syncSelectedOutlines();
      updateWallListSelection();
      renderPaintingSection();
    });

    item.querySelector('.wall-item-remove').addEventListener('click', () => {
      if (state.walls.length <= 1) return;
      state.walls    = state.walls.filter(x => x.id !== w.id);
      state.paintings = state.paintings.filter(p => p.wallId !== w.id);
      if (state.selectedWallId === w.id)     state.selectedWallId     = null;
      rebuildWallsList();
      renderAll();
    });

    wInput.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (isNaN(v) || v < 50) return;
      w.widthCm = v;
      computeScale();
      state.walls.forEach(ww => positionWallElement(ww));
      state.paintings.forEach(p => { positionPaintingElement(p); drawPainting(p); });
    });

    hInput.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (isNaN(v) || v < 50) return;
      w.heightCm = v;
      computeScale();
      state.walls.forEach(ww => positionWallElement(ww));
      state.paintings.forEach(p => { positionPaintingElement(p); drawPainting(p); });
    });

    list.appendChild(item);
  });
  updateWallListSelection();
}

function updateWallListSelection() {
  document.querySelectorAll('.wall-item').forEach(el => {
    const id = parseInt(el.dataset.id, 10);
    el.classList.toggle('selected', id === state.selectedWallId);
  });
}

function renderSidebar() {
  updateWallListSelection();
  renderPaintingSection();
}

function renderPaintingSection() {
  const section = document.getElementById('painting-settings');
  if (state.selectedPaintingId === null) {
    section.classList.add('hidden');
    return;
  }
  const p = state.paintings.find(x => x.id === state.selectedPaintingId);
  if (!p) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  isUpdatingSidebar = true;

  document.getElementById('sel-label').textContent    = p.id;
  document.getElementById('p-name').value             = p.name;
  document.getElementById('p-pw').value               = p.paintingWidthCm;
  document.getElementById('p-ph').value               = p.paintingHeightCm;
  document.getElementById('p-bw').value               = p.blockWidthCm;
  document.getElementById('p-bh').value               = p.blockHeightCm;
  document.getElementById('p-mullion').value          = p.mullionCm;
  document.getElementById('p-frame').value            = p.frameWidthCm;
  document.getElementById('p-offx').value             = p.offsetXCm;
  document.getElementById('p-offy').value             = p.offsetYCm;
  document.getElementById('p-color-glass').value      = p.colorGlass;
  document.getElementById('p-color-mullion').value    = p.colorMullion;
  document.getElementById('p-color-frame').value      = p.colorFrame;

  isUpdatingSidebar = false;
  updateSizePreview(p);
}

function updateSizePreview(p) {
  document.getElementById('size-preview').textContent =
    `${p.paintingWidthCm.toFixed(1)} × ${p.paintingHeightCm.toFixed(1)} cm`;
}

// ── Sidebar bindings ───────────────────────────────────
function bindNum(id, field, isFloat, callback) {
  document.getElementById(id).addEventListener('input', (e) => {
    if (isUpdatingSidebar) return;
    const p = state.paintings.find(x => x.id === state.selectedPaintingId);
    if (!p) return;
    const v = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
    if (isNaN(v)) return;
    p[field] = v;
    callback(p);
  });
}

function bindColor(id, field) {
  document.getElementById(id).addEventListener('input', (e) => {
    if (isUpdatingSidebar) return;
    const p = state.paintings.find(x => x.id === state.selectedPaintingId);
    if (!p) return;
    p[field] = e.target.value;
    drawPainting(p);
  });
}

// ── Export / Import ────────────────────────────────────
async function exportJSON() {
  const data = {
    walls: state.walls.map(w => ({ ...w })),
    paintings: state.paintings.map(p => ({ ...p })),
    nextId: state.nextId,
    version: 2,
  };
  const json = JSON.stringify(data, null, 2);

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: '個展配置.json',
        types: [{
          description: 'JSON Files',
          accept: { 'application/json': ['.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
    } catch (err) {
      if (err.name !== 'AbortError') alert('保存に失敗しました: ' + err.message);
    }
    return;
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '個展配置.json';
  a.click();
  URL.revokeObjectURL(url);
}

function migrateImportData(data) {
  // 旧フォーマット: { wall: {widthCm, heightCm}, paintings: [...], nextId }
  // 新フォーマット: { walls: [{id, widthCm, heightCm, xCm, yCm}], paintings: [{..., wallId}], nextId }
  if (data.wall && !data.walls) {
    const nextId = data.nextId || 1;
    const wallId = nextId;
    data.walls = [{ id: wallId, widthCm: data.wall.widthCm, heightCm: data.wall.heightCm, xCm: 0, yCm: 0 }];
    (data.paintings || []).forEach(p => { if (p.wallId == null) p.wallId = wallId; });
    data.nextId = nextId + 1;
    delete data.wall;
  }
  return data;
}

function importJSON(rawData) {
  const data = migrateImportData(rawData);
  document.querySelectorAll('.painting, .wall').forEach(el => el.remove());
  state.walls              = data.walls;
  state.paintings          = data.paintings;
  state.nextId             = data.nextId;
  state.selectedPaintingId = null;
  state.selectedWallId     = null;
  rebuildWallsList();
  renderAll();
}

function loadJSONFile(file) {
  if (!file || !file.name.endsWith('.json')) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      importJSON(JSON.parse(ev.target.result));
    } catch {
      alert('JSONファイルの読み込みに失敗しました');
    }
  };
  reader.readAsText(file);
}

// ── Init ───────────────────────────────────────────────
function init() {
  // 初期の壁1枚
  state.walls.push(createWall());

  // 壁追加ボタン
  document.getElementById('add-wall-btn').addEventListener('click', () => {
    const w = createWall();
    state.walls.push(w);
    state.selectedWallId = w.id;
    rebuildWallsList();
    renderAll();
  });

  // 絵の名前
  document.getElementById('p-name').addEventListener('input', (e) => {
    if (isUpdatingSidebar) return;
    const p = state.paintings.find(x => x.id === state.selectedPaintingId);
    if (!p) return;
    p.name = e.target.value;
    const div = document.querySelector(`.painting[data-id="${p.id}"]`);
    if (div) {
      const lbl = div.querySelector('.painting-label');
      if (lbl) lbl.textContent = p.name;
    }
  });

  // 絵の数値フィールド
  const redrawAndPreview = p => { positionPaintingElement(p); drawPainting(p); updateSizePreview(p); };
  bindNum('p-pw',      'paintingWidthCm',  true, redrawAndPreview);
  bindNum('p-ph',      'paintingHeightCm', true, redrawAndPreview);
  bindNum('p-bw',      'blockWidthCm',     true, redrawAndPreview);
  bindNum('p-bh',      'blockHeightCm',    true, redrawAndPreview);
  bindNum('p-mullion', 'mullionCm',        true, redrawAndPreview);
  bindNum('p-frame',   'frameWidthCm',     true, redrawAndPreview);
  bindNum('p-offx',    'offsetXCm',        true, redrawAndPreview);
  bindNum('p-offy',    'offsetYCm',        true, redrawAndPreview);

  bindColor('p-color-glass',   'colorGlass');
  bindColor('p-color-mullion', 'colorMullion');
  bindColor('p-color-frame',   'colorFrame');

  // 絵の追加 / 削除
  document.getElementById('add-btn').addEventListener('click', () => {
    const wallId = currentWallId();
    if (wallId == null) return;
    const p = createPainting(wallId);
    state.paintings.push(p);
    state.selectedPaintingId = p.id;
    renderAll();
  });

  document.getElementById('remove-btn').addEventListener('click', () => {
    state.paintings = state.paintings.filter(p => p.id !== state.selectedPaintingId);
    state.selectedPaintingId = null;
    syncDOMToState();
    renderSidebar();
  });

  // 回転：中心を軸に回す
  document.getElementById('rotate-btn').addEventListener('click', () => {
    const p = state.paintings.find(x => x.id === state.selectedPaintingId);
    if (!p) return;

    const before = paintingTotalCm(p);
    const cx = p.xCm + before.widthCm  / 2;
    const cy = p.yCm + before.heightCm / 2;

    p.rotation = ((p.rotation || 0) + 90) % 360;

    const after = paintingTotalCm(p);
    p.xCm = cx - after.widthCm  / 2;
    p.yCm = cy - after.heightCm / 2;

    // 壁からはみ出ないようクランプ
    const wall = state.walls.find(w => w.id === p.wallId);
    if (wall) {
      p.xCm = Math.max(0, Math.min(wall.widthCm  - after.widthCm,  p.xCm));
      p.yCm = Math.max(0, Math.min(wall.heightCm - after.heightCm, p.yCm));
    }

    positionPaintingElement(p);
    drawPainting(p);
  });

  // 複製
  document.getElementById('duplicate-btn').addEventListener('click', () => {
    const src = state.paintings.find(x => x.id === state.selectedPaintingId);
    if (!src) return;
    const wall = state.walls.find(w => w.id === src.wallId);
    const copy = { ...src, id: state.nextId++, name: `${src.name} のコピー` };
    if (wall) {
      copy.xCm = Math.min(wall.widthCm  - 1, src.xCm + 10);
      copy.yCm = Math.min(wall.heightCm - 1, src.yCm + 10);
    }
    state.paintings.push(copy);
    state.selectedPaintingId = copy.id;
    renderAll();
  });

  // ドラッグ: マウス
  document.addEventListener('mousemove', (e) => {
    if (!dragState.active) return;
    moveDrag(e.clientX, e.clientY);
  });

  document.addEventListener('mouseup', () => {
    const wasWallDrag = dragState.active && dragState.kind === 'wall';
    dragState.active = false;
    if (wasWallDrag) renderAll();  // 壁の位置が変わって bounds が広がった場合に再スケール
  });

  // ドラッグ: タッチ
  document.addEventListener('touchmove', (e) => {
    if (!dragState.active) return;
    e.preventDefault();
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  document.addEventListener('touchend', () => {
    const wasWallDrag = dragState.active && dragState.kind === 'wall';
    dragState.active = false;
    if (wasWallDrag) renderAll();
  });

  // 何もないキャンバスをクリックで選択解除
  document.getElementById('canvas-area').addEventListener('mousedown', (e) => {
    if (e.target.id === 'canvas-area' || e.target.id === 'wall-container') {
      state.selectedPaintingId = null;
      state.selectedWallId     = null;
      syncSelectedOutlines();
      renderSidebar();
    }
  });

  // ズーム: Cmd/Ctrl + ホイール or トラックパッド ピンチ（ピンチは ctrlKey=true で届く）
  const canvasAreaEl = document.getElementById('canvas-area');
  canvasAreaEl.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();

    const rect = canvasAreaEl.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const worldX = canvasAreaEl.scrollLeft + cx;
    const worldY = canvasAreaEl.scrollTop  + cy;

    const oldScale = state.scale;
    // deltaY に比例（ゆっくり回せば細かく、速く回せば大きく）。指数関数で滑らかに
    const factor = Math.min(1.6, Math.max(0.625, Math.exp(-e.deltaY * 0.005)));
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoom * factor));
    if (newZoom === state.zoom) return;
    state.zoom = newZoom;
    renderAll();

    const ratio = state.scale / oldScale;
    canvasAreaEl.scrollLeft = worldX * ratio - cx;
    canvasAreaEl.scrollTop  = worldY * ratio - cy;
  }, { passive: false });

  // ズーム: ボタン
  document.getElementById('zoom-in').addEventListener('click',    () => setZoom(state.zoom * 1.15));
  document.getElementById('zoom-out').addEventListener('click',   () => setZoom(state.zoom / 1.15));
  document.getElementById('zoom-reset').addEventListener('click', () => setZoom(1));

  // モバイル: ボトムシート開閉
  const toggle        = document.getElementById('sidebar-toggle');
  const sidebar       = document.getElementById('sidebar');
  const mobileOverlay = document.getElementById('mobile-overlay');

  function openSheet()  { sidebar.classList.add('open');    mobileOverlay.classList.add('visible'); }
  function closeSheet() { sidebar.classList.remove('open'); mobileOverlay.classList.remove('visible'); }

  toggle.addEventListener('click', closeSheet);
  mobileOverlay.addEventListener('click', closeSheet);

  document.getElementById('mob-menu').addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSheet() : openSheet();
  });

  document.getElementById('mob-add').addEventListener('click', () => {
    const wallId = currentWallId();
    if (wallId == null) return;
    const np = createPainting(wallId);
    state.paintings.push(np);
    state.selectedPaintingId = np.id;
    renderAll();
  });

  // Export / Import
  document.getElementById('export-btn').addEventListener('click', exportJSON);

  document.getElementById('import-input').addEventListener('change', (e) => {
    loadJSONFile(e.target.files[0]);
    e.target.value = '';
  });

  // ファイルのドラッグ&ドロップ
  let dragFileCounter = 0;
  const dropOverlay = document.getElementById('drop-overlay');

  document.addEventListener('dragenter', (e) => {
    if (e.dataTransfer.types.includes('Files')) {
      dragFileCounter++;
      dropOverlay.classList.add('visible');
    }
  });

  document.addEventListener('dragleave', () => {
    dragFileCounter = Math.max(0, dragFileCounter - 1);
    if (dragFileCounter === 0) dropOverlay.classList.remove('visible');
  });

  document.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragFileCounter = 0;
    dropOverlay.classList.remove('visible');
    if (e.dataTransfer.files.length > 0) loadJSONFile(e.dataTransfer.files[0]);
  });

  window.addEventListener('resize', () => renderAll());

  // 初期の絵を1枚追加
  const firstWallId = state.walls[0].id;
  const p = createPainting(firstWallId);
  state.paintings.push(p);
  state.selectedPaintingId = p.id;

  rebuildWallsList();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
