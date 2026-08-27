// main.js -- bootstrap, screen/state wiring, RAF loop
(function () {
  'use strict';
  let state = 'menu'; // menu | howto | levels | game | editor
  let returnTo = 'menu';
  let idleCam = 0;

  const game = new SS.Game();
  const editor = new SS.Editor();
  SS.Input.init(SS.canvas);
  window.SSApp = { game, editor, get state() { return state; } }; // debug hook

  function unlockAudioOnce() {
    SS.Audio.unlock();
    document.removeEventListener('pointerdown', unlockAudioOnce);
    document.removeEventListener('keydown', unlockAudioOnce);
  }
  document.addEventListener('pointerdown', unlockAudioOnce);
  document.addEventListener('keydown', unlockAudioOnce);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function goto(screenId, newState) {
    state = newState;
    SS.Screens.show(screenId);
  }

  function enterEditor() {
    editor.enter();
    goto('screen-editor', 'editor');
  }

  function renderLevelList() {
    const wrap = document.getElementById('level-list');
    wrap.innerHTML = '';
    SS.Levels.getAllLevels().forEach(lv => {
      const div = document.createElement('div');
      div.className = 'level-item';
      div.innerHTML =
        `<div><div class="li-name">${escapeHtml(lv.name)}</div>` +
        `<div class="li-meta">${lv.builtin ? 'Built-in' : 'Custom'} &middot; Speed ${lv.scrollSpeed} &middot; Starts ${lv.startMode}</div></div>` +
        `<div class="li-actions"></div>`;
      const actions = div.querySelector('.li-actions');
      const playBtn = document.createElement('button');
      playBtn.className = 'btn btn-primary'; playBtn.textContent = 'Play';
      playBtn.onclick = () => startLevel(lv);
      actions.appendChild(playBtn);
      if (!lv.builtin) {
        const editBtn = document.createElement('button');
        editBtn.className = 'btn'; editBtn.textContent = 'Edit';
        editBtn.onclick = () => { editor.loadLevel(lv); enterEditor(); };
        actions.appendChild(editBtn);
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-ghost'; delBtn.textContent = 'Delete';
        delBtn.onclick = () => {
          if (confirm('Delete "' + lv.name + '"?')) { SS.Storage.deleteCustomLevel(lv.id); renderLevelList(); }
        };
        actions.appendChild(delBtn);
      }
      wrap.appendChild(div);
    });
  }

  function startLevel(lv) {
    returnTo = 'levels';
    game.load(lv, false, null);
    goto('screen-game', 'game');
  }

  function startEndless() {
    returnTo = 'menu';
    game.load({ startMode: 'bolt', scrollSpeed: SS.C.DEFAULT_SCROLL_SPEED }, true, null);
    goto('screen-game', 'game');
  }

  function exitGame() {
    SS.Screens.hideOverlay('screen-pause');
    SS.Screens.hideOverlay('screen-result');
    game.running = false;
    if (returnTo === 'editor') { enterEditor(); }
    else if (returnTo === 'levels') { renderLevelList(); goto('screen-levels', 'levels'); }
    else { goto('screen-menu', 'menu'); }
  }

  //// Menu wiring ///////////////////////////////////////////////////////
  document.getElementById('btn-play').onclick = () => { renderLevelList(); goto('screen-levels', 'levels'); };
  document.getElementById('btn-endless').onclick = startEndless;
  document.getElementById('btn-editor').onclick = enterEditor;
  document.getElementById('btn-howto').onclick = () => goto('screen-howto', 'howto');
  document.getElementById('btn-howto-back').onclick = () => goto('screen-menu', 'menu');
  document.getElementById('btn-levels-back').onclick = () => goto('screen-menu', 'menu');
  document.getElementById('btn-levels-new').onclick = () => { editor.newLevel(); enterEditor(); };

  //// Game HUD / pause / result ////////////////////////////////////////
  document.getElementById('btn-pause').onclick = () => game.pause();
  document.getElementById('btn-resume').onclick = () => game.resume();
  document.getElementById('btn-restart').onclick = () => { SS.Screens.hideOverlay('screen-pause'); game.restart(false); };
  document.getElementById('btn-quit').onclick = exitGame;
  document.getElementById('btn-result-retry').onclick = () => game.restart(false);
  document.getElementById('btn-result-quit').onclick = exitGame;

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (state === 'game') {
      if (game.paused) game.resume();
      else if (game.running) game.pause();
    }
  });

  //// Editor wiring /////////////////////////////////////////////////////
  document.getElementById('btn-ed-back').onclick = () => goto('screen-menu', 'menu');
  document.getElementById('btn-ed-save').onclick = () => editor.save();
  document.getElementById('btn-ed-export').onclick = () => editor.exportJSON();
  document.getElementById('btn-ed-clear').onclick = () => editor.clear();
  document.getElementById('btn-ed-import').onclick = () => document.getElementById('ed-import-file').click();
  document.getElementById('ed-import-file').onchange = (e) => {
    const file = e.target.files[0];
    if (file) editor.importJSON(file, () => {});
    e.target.value = '';
  };
  document.getElementById('btn-ed-play').onclick = () => {
    editor._syncLevelFromForm();
    const testLevel = JSON.parse(JSON.stringify(editor.level));
    returnTo = 'editor';
    game.load(testLevel, false, null);
    goto('screen-game', 'game');
  };

  //// Main loop /////////////////////////////////////////////////////////
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.033);
    const t = now / 1000;
    idleCam += dt * 45;

    if (state === 'game') game.update(dt, SS.Input);
    else if (state === 'editor') editor.update(dt);

    if (state === 'game') game.render(t);
    else if (state === 'editor') editor.render(t);
    else {
      const layout = SS.Entities.makeLayout();
      SS.Entities.drawBackground(SS.ctx, layout, { backgroundColor: '#0b0e1a' }, idleCam, t);
    }

    SS.Input.consumeFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
