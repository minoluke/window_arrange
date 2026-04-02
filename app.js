// ── State ──────────────────────────────────────────────
const state = {
  wall: { widthCm: 360, heightCm: 230 },
  scale: 1,
  paintings: [],
  nextId: 1,
  selectedId: null,
};

const dragState = {
  active: false,
  paintingId: null,
  startMouseX: 0,
  startMouseY: 0,
  startPxX: 0,
  startPxY: 0,
  paintingPxW: 0,
  paintingPxH: 0,
};

let isUpdatingSidebar = false;

// ── Helpers ────────────────────────────────────────────
function paintingTotalCm(p) {
  return { widthCm: p.paintingWidthCm, heightCm: p.paintingHeightCm };
}


function computeScale() {
  const area = document.getElementById('canvas-area');
  const pad = window.innerWidth <= 680 ? 24 : 64;
  const availW = area.clientWidth  - pad;
  const availH = area.clientHeight - pad;
  const sw = availW / state.wall.widthCm;
  const sh = availH / state.wall.heightCm;
  state.scale = Math.max(0.05, Math.min(sw, sh, 5));
}

function getWallPx() {
  return {
    w: Math.round(state.wall.widthCm  * state.scale),
    h: Math.round(state.wall.heightCm * state.scale),
  };
}

// ── Painting factory ───────────────────────────────────
function createPainting() {
  const offset = (state.paintings.length % 6) * 10;
  return {
    id:               state.nextId++,
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
    colorGlass:    '#b8cdd4',
    colorMullion:  '#2d2d2d',
    colorFrame:    '#4a3728',
  };
}

// ── Rendering ──────────────────────────────────────────
function renderAll() {
  computeScale();
  renderWall();
  state.paintings.forEach(p => {
    ensurePaintingElement(p);
    positionPaintingElement(p);
    drawPainting(p);
  });
  syncDOMToState();
  renderSidebar();
}

function renderWall() {
  const wall = document.getElementById('wall');
  const { w, h } = getWallPx();
  wall.style.width  = w + 'px';
  wall.style.height = h + 'px';
}

function drawPainting(p) {
  const div = document.querySelector(`.painting[data-id="${p.id}"]`);
  if (!div) return;
  const canvas = div.querySelector('canvas');
  const s = state.scale;
  const { widthCm, heightCm } = paintingTotalCm(p);
  const pxW = Math.round(widthCm  * s);
  const pxH = Math.round(heightCm * s);

  canvas.width  = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d');

  const fw = p.frameWidthCm  * s;
  const mw = p.mullionCm     * s;
  const bw = p.blockWidthCm  * s;
  const bh = p.blockHeightCm * s;

  // 1. 額縁
  ctx.fillStyle = p.colorFrame;
  ctx.fillRect(0, 0, pxW, pxH);

  // 2. ガラス窓エリア全体をマリオン色で塗りつぶす
  const ox = fw, oy = fw;
  const cw = pxW - 2 * fw;
  const ch = pxH - 2 * fw;
  ctx.fillStyle = p.colorMullion;
  ctx.fillRect(ox, oy, cw, ch);

  // 3. 左上始点をオフセットしてブロックを描画。はみ出た分はクリップで切る
  const periodX = bw + mw;
  const periodY = bh + mw;
  const offX = ((p.offsetXCm * s) % periodX + periodX) % periodX;
  const offY = ((p.offsetYCm * s) % periodY + periodY) % periodY;

  // 1周期前から描き始めて端の欠けブロックをカバー
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
}

function ensurePaintingElement(p) {
  if (document.querySelector(`.painting[data-id="${p.id}"]`)) return;

  const div = document.createElement('div');
  div.className = 'painting';
  div.dataset.id = p.id;

  const label = document.createElement('div');
  label.className = 'painting-label';
  label.textContent = `絵 ${p.id}`;
  div.appendChild(label);

  const canvas = document.createElement('canvas');
  div.appendChild(canvas);

  document.getElementById('wall').appendChild(div);
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
  div.classList.toggle('selected', p.id === state.selectedId);
}

function syncDOMToState() {
  const ids = new Set(state.paintings.map(p => String(p.id)));
  document.querySelectorAll('.painting').forEach(el => {
    if (!ids.has(el.dataset.id)) el.remove();
  });
}

function syncSelectedOutlines() {
  state.paintings.forEach(p => positionPaintingElement(p));
}

// ── Drag ───────────────────────────────────────────────
function startDrag(p, clientX, clientY) {
  const { widthCm, heightCm } = paintingTotalCm(p);
  state.selectedId      = p.id;
  dragState.active      = true;
  dragState.paintingId  = p.id;
  dragState.startMouseX = clientX;
  dragState.startMouseY = clientY;
  dragState.startPxX    = Math.round(p.xCm * state.scale);
  dragState.startPxY    = Math.round(p.yCm * state.scale);
  dragState.paintingPxW = Math.round(widthCm  * state.scale);
  dragState.paintingPxH = Math.round(heightCm * state.scale);
  syncSelectedOutlines();
  renderSidebar();
}

function moveDrag(clientX, clientY) {
  const p = state.paintings.find(x => x.id === dragState.paintingId);
  if (!p) return;
  const { w: wallW, h: wallH } = getWallPx();
  const dx = clientX - dragState.startMouseX;
  const dy = clientY - dragState.startMouseY;
  const rawX = dragState.startPxX + dx;
  const rawY = dragState.startPxY + dy;
  p.xCm = Math.max(0, Math.min(wallW - dragState.paintingPxW, rawX)) / state.scale;
  p.yCm = Math.max(0, Math.min(wallH - dragState.paintingPxH, rawY)) / state.scale;
  positionPaintingElement(p);
}

function attachPaintingListeners(div, p) {
  div.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(p, e.clientX, e.clientY);
  });

  div.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(p, e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
}

// ── Sidebar ────────────────────────────────────────────
function renderSidebar() {
  const section = document.getElementById('painting-settings');
  if (state.selectedId === null) {
    section.classList.add('hidden');
    return;
  }
  const p = state.paintings.find(x => x.id === state.selectedId);
  if (!p) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  isUpdatingSidebar = true;

  document.getElementById('sel-label').textContent    = p.id;
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
// fix: v < 0 instead of v <= 0 so frameWidthCm=0 is allowed
function bindNum(id, field, isFloat, callback) {
  document.getElementById(id).addEventListener('input', (e) => {
    if (isUpdatingSidebar) return;
    const p = state.paintings.find(x => x.id === state.selectedId);
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
    const p = state.paintings.find(x => x.id === state.selectedId);
    if (!p) return;
    p[field] = e.target.value;
    drawPainting(p);
  });
}

// ── Init ───────────────────────────────────────────────
function init() {
  // Wall inputs
  document.getElementById('wall-w').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (isNaN(v) || v < 50) return;
    state.wall.widthCm = v;
    renderAll();
  });
  document.getElementById('wall-h').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (isNaN(v) || v < 50) return;
    state.wall.heightCm = v;
    renderAll();
  });

  // Painting numeric fields
  const redrawAndPreview = p => { positionPaintingElement(p); drawPainting(p); updateSizePreview(p); };
  bindNum('p-pw',      'paintingWidthCm',  true, redrawAndPreview);
  bindNum('p-ph',      'paintingHeightCm', true, redrawAndPreview);
  bindNum('p-bw',      'blockWidthCm',     true, redrawAndPreview);
  bindNum('p-bh',      'blockHeightCm', true,  redrawAndPreview);
  bindNum('p-mullion', 'mullionCm',     true,  redrawAndPreview);
  bindNum('p-frame',   'frameWidthCm',  true,  redrawAndPreview);
  bindNum('p-offx',    'offsetXCm',     true,  redrawAndPreview);
  bindNum('p-offy',    'offsetYCm',     true,  redrawAndPreview);

  // Color pickers
  bindColor('p-color-glass',   'colorGlass');
  bindColor('p-color-mullion', 'colorMullion');
  bindColor('p-color-frame',   'colorFrame');

  // Add / Remove buttons
  document.getElementById('add-btn').addEventListener('click', () => {
    const p = createPainting();
    state.paintings.push(p);
    state.selectedId = p.id;
    renderAll();
  });

  document.getElementById('remove-btn').addEventListener('click', () => {
    state.paintings = state.paintings.filter(p => p.id !== state.selectedId);
    state.selectedId = null;
    syncDOMToState();
    renderSidebar();
  });

  // Drag: mouse
  document.addEventListener('mousemove', (e) => {
    if (!dragState.active) return;
    moveDrag(e.clientX, e.clientY);
  });

  document.addEventListener('mouseup', () => {
    dragState.active = false;
  });

  // Drag: touch
  document.addEventListener('touchmove', (e) => {
    if (!dragState.active) return;
    e.preventDefault();
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  document.addEventListener('touchend', () => {
    dragState.active = false;
  });

  // 壁の空白クリック/タップで選択解除
  const wall = document.getElementById('wall');
  const deselectWall = (e) => {
    if (e.target === wall) {
      state.selectedId = null;
      syncSelectedOutlines();
      renderSidebar();
    }
  };
  wall.addEventListener('mousedown', deselectWall);
  wall.addEventListener('touchstart', deselectWall);

  // モバイル: ボトムシート開閉
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const mobileOverlay = document.getElementById('mobile-overlay');

  function openSheet()  { sidebar.classList.add('open');    mobileOverlay.classList.add('visible'); }
  function closeSheet() { sidebar.classList.remove('open'); mobileOverlay.classList.remove('visible'); }

  toggle.addEventListener('click', closeSheet);
  mobileOverlay.addEventListener('click', closeSheet);

  document.getElementById('mob-menu').addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSheet() : openSheet();
  });

  document.getElementById('mob-add').addEventListener('click', () => {
    const np = createPainting();
    state.paintings.push(np);
    state.selectedId = np.id;
    renderAll();
  });

  // ウィンドウリサイズ
  window.addEventListener('resize', () => renderAll());

  // 初期の絵を1枚追加
  const p = createPainting();
  state.paintings.push(p);
  state.selectedId = p.id;
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
