// editor.js -- in-browser level editor
var SS = SS || {};
(function () {
  'use strict';
  const C = SS.C;

  const PALETTE = [
    { id: 'spike', label: 'Spike', kind: 'obj', color: '#ff4d6d' },
    { id: 'block', label: 'Block', kind: 'obj', color: '#3a4680' },
    { id: 'orb', label: 'Orb', kind: 'obj', color: '#ffdd4f' },
    { id: 'pad', label: 'Pad', kind: 'obj', color: '#ff5fa2' },
    { id: 'portal_bolt', label: 'Bolt', kind: 'obj', color: '#4fd1ff' },
    { id: 'portal_pulsar', label: 'Pulsar', kind: 'obj', color: '#ffb14f' },
    { id: 'portal_comet', label: 'Comet', kind: 'obj', color: '#ff9a4f' },
    { id: 'portal_anchor', label: 'Anchor', kind: 'obj', color: '#c14fff' },
    { id: 'portal_phase', label: 'Phase', kind: 'obj', color: '#5fe8ff' },
    { id: 'portal_grav', label: 'Grav', kind: 'obj', color: '#ffffff' },
    { id: 'finish', label: 'Finish', kind: 'obj', color: '#5fffa0' },
    { id: 'pit', label: 'Pit', kind: 'tool', color: '#666' },
    { id: 'eraser', label: 'Erase', kind: 'tool', color: '#888' },
    { id: 'pan', label: 'Pan', kind: 'tool', color: '#aaa' }
  ];

  function snap(v) { return Math.round(v / C.GRID) * C.GRID; }

  function Editor() {
    this.level = null;
    this.panX = 0;
    this.tool = 'spike';
    this.dragging = false;
    this.dragStartX = 0;
    this.dragStartPan = 0;
    this.moved = false;
    this.undoStack = [];
    this.hoverWorld = { x: 0, y: 0 };
    this._built = false;
    this._bind();
  }

  Editor.prototype._buildPalette = function () {
    if (this._built) return;
    this._built = true;
    const wrap = document.getElementById('ed-palette');
    PALETTE.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'pal-btn';
      btn.dataset.id = p.id;
      btn.title = p.label;
      btn.innerHTML = `<span class="pal-swatch" style="background:${p.color}"></span><span>${p.label}</span>`;
      btn.addEventListener('click', () => this.setTool(p.id));
      wrap.appendChild(btn);
    });
    this._refreshPalette();
  };

  Editor.prototype._refreshPalette = function () {
    document.querySelectorAll('.pal-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.id === this.tool);
    });
  };

  Editor.prototype.setTool = function (id) {
    this.tool = id;
    this._refreshPalette();
  };

  Editor.prototype.newLevel = function () {
    this.level = SS.Levels.emptyLevel('My Level');
    this.panX = 0;
    this.undoStack = [];
    this._syncFormFromLevel();
  };

  Editor.prototype.loadLevel = function (level) {
    this.level = JSON.parse(JSON.stringify(level));
    this.level.builtin = false;
    this.panX = 0;
    this.undoStack = [];
    this._syncFormFromLevel();
  };

  Editor.prototype._syncFormFromLevel = function () {
    document.getElementById('ed-name').value = this.level.name;
    document.getElementById('ed-speed').value = this.level.scrollSpeed;
    document.getElementById('ed-mode').value = this.level.startMode;
  };

  Editor.prototype._syncLevelFromForm = function () {
    this.level.name = document.getElementById('ed-name').value.trim() || 'Untitled Level';
    this.level.scrollSpeed = parseInt(document.getElementById('ed-speed').value, 10);
    this.level.startMode = document.getElementById('ed-mode').value;
  };

  Editor.prototype.enter = function () {
    this._buildPalette();
    if (!this.level) this.newLevel();
  };

  Editor.prototype._bind = function () {
    const canvas = SS.canvas;
    canvas.addEventListener('contextmenu', (e) => { if (this._isEditorActive()) e.preventDefault(); });
    canvas.addEventListener('mousedown', (e) => this._onDown(e.clientX, e.clientY, e.button));
    window.addEventListener('mousemove', (e) => this._onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', () => this._onUp());
    canvas.addEventListener('wheel', (e) => {
      if (!this._isEditorActive()) return;
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      this.panX = SS.clamp(this.panX + delta, 0, 1e6);
    }, { passive: false });
    canvas.addEventListener('touchstart', (e) => {
      if (!this._isEditorActive()) return;
      const t = e.touches[0]; this._onDown(t.clientX, t.clientY, 0);
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (!this._isEditorActive()) return;
      const t = e.touches[0]; this._onMove(t.clientX, t.clientY);
    }, { passive: true });
    canvas.addEventListener('touchend', () => this._onUp());

    window.addEventListener('keydown', (e) => {
      if (!this._isEditorActive()) return;
      if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.undo(); }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.panX = Math.max(0, this.panX + 60);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.panX = Math.max(0, this.panX - 60);
    });
  };

  Editor.prototype._isEditorActive = function () {
    return document.getElementById('screen-editor').classList.contains('active');
  };

  Editor.prototype._onDown = function (clientX, clientY, button) {
    if (!this._isEditorActive()) return;
    if (clientY < 100) return; // toolbar area
    this.dragging = true;
    this.moved = false;
    this.dragStartX = clientX;
    this.dragStartPan = this.panX;
    this._pendingButton = button;
    this._downClientX = clientX; this._downClientY = clientY;
  };

  Editor.prototype._onMove = function (clientX, clientY) {
    const layout = SS.Entities.makeLayout();
    const worldX = this.panX + clientX;
    const worldY = layout.groundScreenY - clientY;
    this.hoverWorld.x = worldX;
    this.hoverWorld.y = worldY;
    if (!this.dragging) return;
    const dx = clientX - this.dragStartX;
    if (Math.abs(dx) > 4) this.moved = true;
    if (this.tool === 'pan' || this._pendingButton === 1) {
      this.panX = Math.max(0, this.dragStartPan - dx);
    }
  };

  Editor.prototype._onUp = function () {
    if (!this.dragging) return;
    const wasClick = !this.moved;
    this.dragging = false;
    if (wasClick && this._isEditorActive() && this._downClientY >= 100) {
      if (this._pendingButton === 2) {
        this._eraseNear(this.hoverWorld.x, this.hoverWorld.y);
      } else {
        this._applyTool(this.hoverWorld.x, this.hoverWorld.y);
      }
    }
  };

  Editor.prototype._pushUndo = function (action) {
    this.undoStack.push(action);
    if (this.undoStack.length > 60) this.undoStack.shift();
  };

  Editor.prototype.undo = function () {
    const a = this.undoStack.pop();
    if (!a) return;
    if (a.type === 'add') {
      const idx = this.level.objects.indexOf(a.obj);
      if (idx >= 0) this.level.objects.splice(idx, 1);
    } else if (a.type === 'remove') {
      this.level.objects.splice(a.index, 0, a.obj);
    } else if (a.type === 'gap-add') {
      const i = this.level.groundGaps.indexOf(a.cell);
      if (i >= 0) this.level.groundGaps.splice(i, 1);
    } else if (a.type === 'gap-remove') {
      this.level.groundGaps.push(a.cell);
    }
  };

  Editor.prototype._eraseNear = function (wx, wy) {
    const objs = this.level.objects;
    let bestIdx = -1, bestD = 40;
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      const cx = o.x + (o.w || 0) / 2, cy = o.y + (o.h || 0) / 2;
      const d = Math.hypot(cx - wx, cy - wy);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    if (bestIdx >= 0) {
      const obj = objs[bestIdx];
      objs.splice(bestIdx, 1);
      this._pushUndo({ type: 'remove', obj, index: bestIdx });
      return;
    }
    // maybe erase a gap
    if (wy > -C.GRID && wy < C.GRID) {
      const cell = Math.floor(wx / C.GRID);
      const gi = this.level.groundGaps.indexOf(cell);
      if (gi >= 0) {
        this.level.groundGaps.splice(gi, 1);
        this._pushUndo({ type: 'gap-remove', cell });
      }
    }
  };

  Editor.prototype._applyTool = function (wx, wy) {
    const layout = SS.Entities.makeLayout();
    const H = SS.Levels.helpers;
    const sx = snap(wx);
    const sy = SS.clamp(snap(wy), 0, layout.worldCeil - C.GRID);

    if (this.tool === 'pan') return;
    if (this.tool === 'eraser') { this._eraseNear(wx, wy); return; }
    if (this.tool === 'pit') {
      if (Math.abs(wy) > C.GRID) { SS.toast('Pits are on the ground row'); return; }
      const cell = Math.floor(wx / C.GRID);
      const gi = this.level.groundGaps.indexOf(cell);
      if (gi >= 0) {
        this.level.groundGaps.splice(gi, 1);
        this._pushUndo({ type: 'gap-remove', cell });
      } else {
        this.level.groundGaps.push(cell);
        this._pushUndo({ type: 'gap-add', cell });
      }
      return;
    }

    let obj = null;
    if (this.tool === 'spike') obj = H.spike(sx, sy);
    else if (this.tool === 'block') obj = H.block(sx, sy);
    else if (this.tool === 'orb') obj = H.orb(sx, SS.clamp(snap(wy), 40, layout.worldCeil - 40));
    else if (this.tool === 'pad') obj = H.pad(sx, sy);
    else if (this.tool === 'finish') obj = H.finish(sx);
    else if (this.tool === 'portal_grav') obj = H.portalGrav(sx);
    else if (this.tool.startsWith('portal_')) obj = H.portalMode(sx, this.tool.replace('portal_', ''));

    if (obj) {
      this.level.objects.push(obj);
      this._pushUndo({ type: 'add', obj });
    }
  };

  Editor.prototype.save = function () {
    this._syncLevelFromForm();
    if (!this.level.id || this.level.builtin) this.level.id = SS.uid();
    this.level.builtin = false;
    SS.Storage.saveCustomLevel(this.level);
    SS.toast('Level saved: ' + this.level.name);
  };

  Editor.prototype.exportJSON = function () {
    this._syncLevelFromForm();
    const blob = new Blob([JSON.stringify(this.level, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (this.level.name || 'level').replace(/[^a-z0-9_-]+/gi, '_') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  Editor.prototype.importJSON = function (file, done) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.objects || !Array.isArray(data.objects)) throw new Error('bad format');
        data.id = SS.uid();
        data.builtin = false;
        if (!data.groundGaps) data.groundGaps = [];
        this.loadLevel(data);
        SS.toast('Imported ' + (data.name || 'level'));
      } catch (e) {
        SS.toast('Import failed: invalid level file');
      }
      if (done) done();
    };
    reader.readAsText(file);
  };

  Editor.prototype.clear = function () {
    if (!confirm('Clear all objects in this level?')) return;
    this.level.objects = [];
    this.level.groundGaps = [];
    this.undoStack = [];
  };

  Editor.prototype.update = function (dt) {
    this._syncLevelFromForm();
  };

  Editor.prototype.render = function (t) {
    const ctx = SS.ctx;
    const layout = SS.Entities.makeLayout();
    SS.Entities.drawBackground(ctx, layout, this.level, this.panX, t);
    SS.Entities.drawGroundGaps(ctx, layout, this.level, this.panX);
    SS.Entities.drawObjects(ctx, layout, this.level, this.panX, t);

    // start marker
    const startSX = 0 - this.panX;
    if (startSX > -40 && startSX < SS.W + 40) {
      ctx.fillStyle = 'rgba(79,209,255,0.6)';
      ctx.fillRect(startSX, layout.ceilScreenY, 3, layout.groundScreenY - layout.ceilScreenY);
      ctx.fillStyle = '#4fd1ff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('START', startSX + 6, layout.ceilScreenY + 14);
    }

    // ghost preview
    if (this.hoverWorld && this._isEditorActive()) {
      const sx = snap(this.hoverWorld.x) - this.panX;
      const sy = SS.clamp(snap(this.hoverWorld.y), 0, layout.worldCeil - C.GRID);
      ctx.globalAlpha = 0.4;
      if (['spike', 'block', 'orb', 'pad', 'finish'].includes(this.tool) || this.tool.startsWith('portal_')) {
        ctx.fillStyle = '#4fd1ff';
        ctx.fillRect(sx, SS.Entities.worldToScreenY(layout, sy) - C.GRID, C.GRID, C.GRID);
      }
      ctx.globalAlpha = 1;
    }

    // ruler / distance markers
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '10px sans-serif';
    const startCell = Math.floor(this.panX / (C.GRID * 5));
    for (let i = startCell; i < startCell + Math.ceil(SS.W / (C.GRID * 5)) + 1; i++) {
      const wx = i * C.GRID * 5;
      const sx = wx - this.panX;
      ctx.fillText(wx + 'px', sx + 2, layout.groundScreenY + 20);
    }
  };

  SS.Editor = Editor;
})();
