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
      startMode: 'bolt',
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

  //// Level 1: First Steps (bolt fundamentals) ///////////////////////////
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
      id: 'builtin_1', name: 'First Steps', author: 'Driftbound', builtin: true,
      scrollSpeed: 340, backgroundColor: '#0b1a2e', startMode: 'bolt',
      length: 4100, groundGaps: gapsRange(52, 3), objects: objs
    };
  }

  //// Level 2: Afterburn (comet focus -- tap-boost, floaty glide) /////////
  function level2() {
    const objs = [];
    objs.push(spike(400));
    objs.push(orb(700, 160, 1));
    objs.push(portalMode(950, 'comet'));
    // comet corridor: staggered block pairs to weave a boost-tap rhythm through
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
    objs.push(portalMode(4100, 'bolt'));
    objs.push(...spikeRow(4300, 3, 0));
    objs.push(pad(4650, 0));
    objs.push(finish(5050));
    return {
      id: 'builtin_2', name: 'Afterburn', author: 'Driftbound', builtin: true,
      scrollSpeed: 380, backgroundColor: '#0e1533', startMode: 'bolt',
      length: 5150, groundGaps: [], objects: objs
    };
  }

  //// Level 3: Surface Tension (anchor + gravity portals) //////////////////
  function level3() {
    const objs = [];
    objs.push(portalMode(350, 'anchor'));
    objs.push(spike(650));
    objs.push(block(900, 0, G, G));
    objs.push(portalGrav(1250));
    objs.push(spike(1500, 280));
    objs.push(spike(1620, 280));
    objs.push(block(1900, 240, G * 2, G));
    objs.push(portalGrav(2350));
    objs.push(...spikeRow(2600, 3, 0));
    objs.push(orb(3050, 140, 1));
    objs.push(portalGrav(3350));
    objs.push(block(3600, 200, G, G));
    objs.push(spike(3600, 240));
    objs.push(portalMode(3950, 'pulsar'));
    objs.push(block(4150, 40, G, G * 2));
    objs.push(block(4450, 160, G, G * 2));
    objs.push(block(4750, 0, G, G * 2));
    objs.push(portalMode(5050, 'bolt'));
    objs.push(pad(5250, 0));
    objs.push(finish(5600));
    return {
      id: 'builtin_3', name: 'Surface Tension', author: 'Driftbound', builtin: true,
      scrollSpeed: 360, backgroundColor: '#1a0e33', startMode: 'anchor',
      length: 5700, groundGaps: [], objects: objs
    };
  }

  //// Level 4: Momentum (all modes, harder) ///////////////////////////////
  function level4() {
    const objs = [];
    objs.push(...spikeRow(400, 2, 0));
    objs.push(orb(650, 150));
    objs.push(block(900, 0, G, G));
    objs.push(portalMode(1150, 'pulsar'));
    objs.push(block(1400, 40, G, G));
    objs.push(block(1650, 160, G, G));
    objs.push(block(1900, 40, G, G));
    objs.push(spike(2100));
    objs.push(portalMode(2300, 'phase'));
    objs.push(block(2500, 80, G, G));
    objs.push(block(2500, 240, G, G));
    objs.push(block(2750, -40, G, G));
    objs.push(block(2750, 200, G, G));
    objs.push(block(3000, 80, G, G));
    objs.push(portalMode(3250, 'comet'));
    for (let i = 0; i < 4; i++) {
      const cx = 3450 + i * 230;
      objs.push(block(cx, 260, G, G * 2));
      objs.push(block(cx, -80, G, G * 2));
    }
    objs.push(portalMode(4400, 'anchor'));
    objs.push(portalGrav(4600));
    objs.push(...spikeRow(4800, 3, 0));
    objs.push(portalGrav(5100));
    objs.push(portalMode(5300, 'bolt'));
    objs.push(orb(5500, 140));
    objs.push(block(5750, 0, G * 2, G));
    objs.push(spike(5900, G));
    objs.push(pad(6150, 0));
    objs.push(...spikeRow(6450, 4, 0));
    objs.push(finish(6900));
    return {
      id: 'builtin_4', name: 'Momentum', author: 'Driftbound', builtin: true,
      scrollSpeed: 420, backgroundColor: '#160b1e', startMode: 'bolt',
      length: 7000, groundGaps: gapsRange(114, 3), objects: objs
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
