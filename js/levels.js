// levels.js -- level data format + built-in levels + persistence helpers
var SS = SS || {};
(function () {
  'use strict';
  const G = SS.C.GRID;

  function emptyLevel(name) {
    return {
      id: SS.uid(),
      name: name || 'Untitled Level',
      author: 'You',
      scrollSpeed: SS.C.DEFAULT_SCROLL_SPEED,
      backgroundColor: '#0b0e1a',
      startMode: 'cube',
      length: 4000,
      groundGaps: [],
      objects: [],
      builtin: false
    };
  }

  // ---- tiny helpers for building built-in levels -----------------------
  function spike(x, y) { return { type: 'spike', x, y: y || 0, w: G - 4, h: G - 4 }; }
  function spikeRow(xStart, count, y, gap) {
    const arr = []; gap = gap || G;
    for (let i = 0; i < count; i++) arr.push(spike(xStart + i * gap, y));
    return arr;
  }
  function block(x, y, w, h) { return { type: 'block', x, y: y || 0, w: w || G, h: h || G }; }
  function orb(x, y, dir) { return { type: 'orb', x, y, orbDir: dir || 1 }; }
  function pad(x, y) { return { type: 'pad', x, y: y || 0, w: SS.C.PAD_W, h: SS.C.PAD_H }; }
  function portalMode(x, mode) { return { type: 'portalMode', x, mode }; }
  function portalGrav(x) { return { type: 'portalGravity', x }; }
  function finish(x) { return { type: 'finish', x }; }
  function gapsRange(cellStart, count) {
    const arr = []; for (let i = 0; i < count; i++) arr.push(cellStart + i); return arr;
  }

  //// Level 1: First Steps (cube fundamentals) ///////////////////////////
  function level1() {
    const objs = [];
    objs.push(spike(500));
    objs.push(spike(700));
    objs.push(...spikeRow(1000, 2, 0));
    objs.push(block(1450, 0, G, G));
    objs.push(spike(1450, G));
    objs.push(...spikeRow(1800, 3, 0));
    objs.push(orb(2350, 140));
    objs.push(block(2600, 0, G * 3, G));
    objs.push(spike(2760, G));
    objs.push(pad(3100, 0));
    objs.push(spike(3500));
    objs.push(spike(3620));
    objs.push(finish(3950));
    return {
      id: 'builtin_1', name: 'First Steps', author: 'Wave Rush', builtin: true,
      scrollSpeed: 340, backgroundColor: '#0b1a2e', startMode: 'cube',
      length: 4100, groundGaps: gapsRange(52, 3), objects: objs
    };
  }

  //// Level 2: Skyward (ship focus) ///////////////////////////////////////
  function level2() {
    const objs = [];
    objs.push(spike(400));
    objs.push(orb(700, 160, 1));
    objs.push(portalMode(950, 'ship'));
    for (let i = 0; i < 5; i++) {
      const cx = 1250 + i * 260;
      objs.push(block(cx, 220 - (i % 2) * 40, G, G * 3));
      objs.push(block(cx, -80, G, G * 2));
    }
    objs.push(portalGrav(2650));
    for (let i = 0; i < 4; i++) {
      const cx = 2850 + i * 240;
      objs.push(block(cx, 40, G, G * 2));
    }
    objs.push(portalGrav(3850));
    objs.push(portalMode(4100, 'cube'));
    objs.push(...spikeRow(4300, 3, 0));
    objs.push(pad(4650, 0));
    objs.push(finish(5050));
    return {
      id: 'builtin_2', name: 'Skyward', author: 'Wave Rush', builtin: true,
      scrollSpeed: 380, backgroundColor: '#0e1533', startMode: 'cube',
      length: 5150, groundGaps: [], objects: objs
    };
  }

  //// Level 3: Gravity Flux (ball + gravity portals) //////////////////////
  function level3() {
    const objs = [];
    objs.push(portalMode(350, 'ball'));
    objs.push(spike(600));
    objs.push(block(850, 0, G, G));
    objs.push(portalGrav(1150));
    objs.push(spike(1400, 280));
    objs.push(spike(1520, 280));
    objs.push(block(1800, 240, G * 2, G));
    objs.push(portalGrav(2200));
    objs.push(...spikeRow(2450, 3, 0));
    objs.push(orb(2900, 140, 1));
    objs.push(portalGrav(3200));
    objs.push(block(3450, 200, G, G));
    objs.push(spike(3450, 240));
    objs.push(portalMode(3800, 'ufo'));
    objs.push(block(4000, 40, G, G * 2));
    objs.push(block(4300, 160, G, G * 2));
    objs.push(block(4600, 0, G, G * 2));
    objs.push(portalMode(4900, 'cube'));
    objs.push(pad(5100, 0));
    objs.push(finish(5450));
    return {
      id: 'builtin_3', name: 'Gravity Flux', author: 'Wave Rush', builtin: true,
      scrollSpeed: 360, backgroundColor: '#1a0e33', startMode: 'ball',
      length: 5550, groundGaps: [], objects: objs
    };
  }

  //// Level 4: Mode Rush (all modes, harder) ///////////////////////////////
  function level4() {
    const objs = [];
    objs.push(...spikeRow(400, 2, 0));
    objs.push(orb(650, 150));
    objs.push(block(900, 0, G, G));
    objs.push(portalMode(1150, 'ufo'));
    objs.push(block(1350, 40, G, G));
    objs.push(block(1550, 160, G, G));
    objs.push(block(1750, 40, G, G));
    objs.push(spike(1950));
    objs.push(portalMode(2150, 'wave'));
    objs.push(block(2350, 80, G, G));
    objs.push(block(2350, 240, G, G));
    objs.push(block(2600, -40, G, G));
    objs.push(block(2600, 200, G, G));
    objs.push(block(2850, 80, G, G));
    objs.push(portalMode(3100, 'ship'));
    for (let i = 0; i < 4; i++) {
      const cx = 3300 + i * 230;
      objs.push(block(cx, 260, G, G * 2));
      objs.push(block(cx, -80, G, G * 2));
    }
    objs.push(portalMode(4250, 'ball'));
    objs.push(portalGrav(4450));
    objs.push(...spikeRow(4650, 3, 0));
    objs.push(portalGrav(4950));
    objs.push(portalMode(5150, 'cube'));
    objs.push(orb(5350, 140));
    objs.push(block(5600, 0, G * 2, G));
    objs.push(spike(5750, G));
    objs.push(pad(6000, 0));
    objs.push(...spikeRow(6300, 4, 0));
    objs.push(finish(6750));
    return {
      id: 'builtin_4', name: 'Mode Rush', author: 'Wave Rush', builtin: true,
      scrollSpeed: 420, backgroundColor: '#160b1e', startMode: 'cube',
      length: 6850, groundGaps: gapsRange(112, 3), objects: objs
    };
  }

  const BUILTIN_LEVELS = [level1(), level2(), level3(), level4()];

  function getAllLevels() {
    return BUILTIN_LEVELS.concat(SS.Storage.getCustomLevels());
  }
  function getLevel(id) {
    return getAllLevels().find(l => l.id === id) || null;
  }

  SS.Levels = {
    emptyLevel, getAllLevels, getLevel, BUILTIN_LEVELS,
    helpers: { spike, spikeRow, block, orb, pad, portalMode, portalGrav, finish, gapsRange }
  };
})();
