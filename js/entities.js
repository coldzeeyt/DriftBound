// entities.js -- player physics (unified across modes) + world objects
var SS = SS || {};
(function () {
  'use strict';
  const C = SS.C;

  // ---- Layout: maps world Y (0=ground, up positive) to screen space -------
  function makeLayout() {
    const playH = SS.H - C.GROUND_MARGIN - C.CEIL_MARGIN;
    return {
      groundScreenY: SS.H - C.GROUND_MARGIN,
      ceilScreenY: C.CEIL_MARGIN,
      worldCeil: playH,
      playH: playH
    };
  }

  function worldToScreenY(layout, y) { return layout.groundScreenY - y; }

  // Modes that rest on a surface (floor/ceiling) between moves.
  // bolt: jumps off it. pulsar: charges from it. anchor: arcs away from it.
  function isSolidGroundMode(mode) { return mode === 'bolt' || mode === 'pulsar' || mode === 'anchor'; }

  // ---- Player ---------------------------------------------------------------
  function createPlayer(mode) {
    return {
      mode: mode || 'bolt',
      y: 0,
      vy: 0,
      gravityDir: 1,      // 1 = normal (rests on ground), -1 = flipped (rests on ceiling)
      grounded: true,
      size: C.PLAYER_SIZE,
      rotation: 0,
      squash: 1,
      trail: [],
      triggered: new Set(), // indices of one-shot objects already triggered this run
      dead: false,
      won: false,
      holdTime: 0,        // bolt: how long the current jump has been extended
      chargeTime: 0,       // pulsar: how long the current charge has built up
      boostCooldown: 0,    // comet: time until the next boost tap is accepted
      arcActive: false,    // anchor: mid-leap between surfaces
      arcT: 0, arcFrom: 0, arcTo: 0, arcDir: 1
    };
  }

  function restPosition(layout, player) {
    return player.gravityDir === 1 ? 0 : (layout.worldCeil - player.size);
  }

  function resetPlayer(player, level) {
    player.mode = level.startMode || 'bolt';
    player.gravityDir = 1;
    player.vy = 0;
    player.grounded = true;
    player.rotation = 0;
    player.trail = [];
    player.triggered = new Set();
    player.dead = false;
    player.won = false;
    player.holdTime = 0;
    player.chargeTime = 0;
    player.boostCooldown = 0;
    player.arcActive = false;
    player.arcT = 0;
    const layout = makeLayout();
    player.y = restPosition(layout, player);
  }

  // Returns true if worldX (screen-fixed player x) lies within a ground gap
  function inGap(level, worldX) {
    if (!level.groundGaps || !level.groundGaps.length) return false;
    const cell = Math.floor(worldX / C.GRID);
    return level.groundGaps.indexOf(cell) !== -1;
  }

  function updatePlayer(player, dt, level, playerWorldX, input, fx) {
    if (player.dead || player.won) return;
    const layout = makeLayout();
    const mode = player.mode;
    const solidGround = isSolidGroundMode(mode);

    // squash decay (per-mode code below can override rotation)
    player.squash = SS.lerp(player.squash, 1, Math.min(1, dt * 10));

    if (mode === 'pulsar') {
      player.vy += (-C.GRAVITY * player.gravityDir) * dt;
      if (player.grounded) {
        if (input.held) {
          player.chargeTime = Math.min(C.PULSAR_MAX_CHARGE_TIME, player.chargeTime + dt);
          player.squash = 1 + 0.3 * (player.chargeTime / C.PULSAR_MAX_CHARGE_TIME);
        }
        if (input.justReleased) {
          const ct = player.chargeTime / C.PULSAR_MAX_CHARGE_TIME;
          const power = SS.lerp(C.PULSAR_MIN_LAUNCH, C.PULSAR_MAX_LAUNCH, ct);
          player.vy = power * player.gravityDir;
          player.grounded = false;
          player.chargeTime = 0;
          player.squash = 1.5;
          SS.Audio.jump();
        }
      }
      player.y += player.vy * dt;
    } else if (mode === 'comet') {
      player.boostCooldown = Math.max(0, player.boostCooldown - dt);
      if (input.justPressed && player.boostCooldown <= 0) {
        player.vy = C.COMET_BOOST_SPEED * player.gravityDir;
        player.boostCooldown = C.COMET_BOOST_COOLDOWN;
        player.squash = 1.3;
        SS.Audio.jump();
      }
      player.vy += (-C.GRAVITY * player.gravityDir) * dt * 0.5;
      const descending = player.vy * player.gravityDir < 0;
      if (descending && Math.abs(player.vy) > C.COMET_TERMINAL_FALL) {
        player.vy = -C.COMET_TERMINAL_FALL * player.gravityDir;
      }
      player.rotation = SS.clamp(-player.vy * player.gravityDir / 1400, -0.5, 0.5);
      player.y += player.vy * dt;
    } else if (mode === 'anchor') {
      if (player.arcActive) {
        player.arcT += dt;
        const tt = SS.clamp(player.arcT / C.ANCHOR_ARC_TIME, 0, 1);
        const eased = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
        const bulge = Math.sin(tt * Math.PI) * C.ANCHOR_ARC_BULGE;
        player.y = SS.lerp(player.arcFrom, player.arcTo, eased) + bulge;
        player.rotation = tt * Math.PI * 2 * player.arcDir;
        if (tt >= 1) {
          player.arcActive = false;
          player.y = player.arcTo;
          player.vy = 0;
          player.grounded = true;
          player.rotation = 0;
        }
      } else if (input.justPressed && player.grounded) {
        player.arcActive = true;
        player.arcT = 0;
        player.arcFrom = player.y;
        player.gravityDir *= -1;
        player.arcTo = restPosition(layout, player);
        player.arcDir = player.gravityDir;
        player.grounded = false;
        player.squash = 1.2;
        SS.Audio.flip();
      }
    } else if (mode === 'phase') {
      const desiredDir = input.held ? player.gravityDir : -player.gravityDir;
      player.vy += C.PHASE_ACCEL * desiredDir * dt;
      player.vy = SS.clamp(player.vy, -C.PHASE_MAX_SPEED, C.PHASE_MAX_SPEED);
      player.rotation = SS.clamp(-player.vy / 700, -0.6, 0.6);
      player.y += player.vy * dt;
    } else { // bolt
      let gmul = 1;
      if (input.held && !player.grounded && player.holdTime < C.BOLT_MAX_HOLD_TIME && player.vy * player.gravityDir > 0) {
        gmul = C.BOLT_HOLD_GRAVITY_MULT;
        player.holdTime += dt;
      }
      player.vy += (-C.GRAVITY * player.gravityDir) * gmul * dt;
      if (input.justPressed && player.grounded) {
        player.vy = C.JUMP_SPEED * player.gravityDir;
        player.grounded = false;
        player.holdTime = 0;
        player.squash = 1.35;
        SS.Audio.jump();
      }
      player.rotation += dt * (player.grounded ? 0 : 5.5) * player.gravityDir;
      player.y += player.vy * dt;
    }

    // ground / ceiling resolution (skipped mid-arc: anchor's arc owns player.y)
    const midArc = (mode === 'anchor' && player.arcActive);
    if (!midArc) {
      const rest = restPosition(layout, player);
      const movingTowardRest = (player.gravityDir === 1) ? (player.y <= 0) : (player.y >= rest);
      if (solidGround) {
        const gapHere = player.gravityDir === 1 && inGap(level, playerWorldX);
        if (!gapHere && movingTowardRest) {
          player.y = rest;
          player.vy = 0;
          player.grounded = true;
        } else {
          player.grounded = false;
        }
        // still clamp against opposite boundary
        if (player.gravityDir === 1 && player.y > layout.worldCeil - player.size) {
          player.y = layout.worldCeil - player.size; player.vy = 0;
        }
        if (player.gravityDir === -1 && player.y < 0 && !gapHere) {
          player.y = 0; player.vy = 0;
        }
        if (player.y < C.PIT_DEATH_Y) { fx.onDeath('fell'); return; }
      } else {
        // flying modes: touching ground or ceiling kills
        if (player.y <= 0 || player.y >= layout.worldCeil - player.size) {
          fx.onDeath('boundary');
          return;
        }
      }
    }

    // trail
    player.trail.push({ y: player.y, life: 1 });
    if (player.trail.length > 14) player.trail.shift();
    player.trail.forEach(p => p.life -= dt * 3.2);
    player.trail = player.trail.filter(p => p.life > 0);

    checkObjectCollisions(player, level, playerWorldX, input, fx, layout);
  }

  function playerRect(player, playerWorldX, layout) {
    return { x: playerWorldX - player.size / 2, y: player.y, w: player.size, h: player.size };
  }

  function checkObjectCollisions(player, level, playerWorldX, input, fx, layout) {
    const pr = playerRect(player, playerWorldX, layout);
    const objs = level.objects;
    const midArc = (player.mode === 'anchor' && player.arcActive);
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (Math.abs(o.x - playerWorldX) > 200) continue;

      if (o.type === 'spike') {
        const inset = 7;
        if (SS.aabb(pr.x + inset, pr.y + inset, pr.w - inset * 2, pr.h - inset * 2, o.x, o.y, o.w, o.h)) {
          fx.onDeath('spike'); return;
        }
      } else if (o.type === 'block') {
        if (SS.aabb(pr.x, pr.y, pr.w, pr.h, o.x, o.y, o.w, o.h)) {
          const solid = isSolidGroundMode(player.mode) && !midArc;
          if (!solid) { fx.onDeath('block'); return; }
          // landing on top?
          const landingFromAbove = player.gravityDir === 1
            ? (player.vy <= 0 && (pr.y + 2) >= o.y + o.h - 12)
            : (player.vy >= 0 && (pr.y + pr.h - 2) <= o.y + 12);
          if (landingFromAbove) {
            if (player.gravityDir === 1) player.y = o.y + o.h;
            else player.y = o.y - player.size;
            player.vy = 0;
            player.grounded = true;
          } else {
            fx.onDeath('block'); return;
          }
        }
      } else if (o.type === 'orb') {
        if (player.triggered.has(i)) continue;
        const cx = playerWorldX, cy = player.y + player.size / 2;
        const dx = cx - o.x, dy = cy - o.y;
        if (dx * dx + dy * dy < C.ORB_TRIGGER_RADIUS * C.ORB_TRIGGER_RADIUS) {
          if (input.justPressed && player.mode !== 'phase' && player.mode !== 'anchor') {
            player.vy = C.JUMP_SPEED * player.gravityDir * (o.orbDir || 1);
            player.squash = 1.4;
            player.triggered.add(i);
            SS.Audio.orb();
          }
        }
      } else if (o.type === 'pad') {
        if (player.triggered.has(i)) continue;
        if (SS.aabb(pr.x, pr.y, pr.w, pr.h, o.x, o.y, o.w, o.h) && player.mode !== 'phase' && player.mode !== 'anchor') {
          player.vy = C.JUMP_SPEED * 1.25 * player.gravityDir;
          player.squash = 1.5;
          player.triggered.add(i);
          SS.Audio.pad();
        } else if (!SS.aabb(pr.x, pr.y, pr.w, pr.h, o.x - 4, o.y - 4, o.w + 8, o.h + 8)) {
          player.triggered.delete(i);
        }
      } else if (o.type === 'portalMode') {
        if (player.triggered.has(i)) continue;
        if (playerWorldX >= o.x) {
          player.triggered.add(i);
          player.mode = o.mode;
          player.grounded = false;
          player.arcActive = false;
          SS.Audio.portal();
        }
      } else if (o.type === 'portalGravity') {
        if (player.triggered.has(i)) continue;
        if (playerWorldX >= o.x) {
          player.triggered.add(i);
          player.gravityDir *= -1;
          player.grounded = false;
          SS.Audio.portal();
        }
      } else if (o.type === 'finish') {
        if (playerWorldX >= o.x) { fx.onWin(); return; }
      }
    }
  }

  //// Rendering /////////////////////////////////////////////////////////////
  const MODE_COLORS = {
    bolt: '#4fd1ff', pulsar: '#ffb14f', comet: '#ff9a4f', anchor: '#c14fff', phase: '#5fe8ff'
  };

  function drawBackground(ctx, layout, level, camOffset, t) {
    const grad = ctx.createLinearGradient(0, 0, 0, SS.H);
    const bg = level.backgroundColor || '#0b0e1a';
    grad.addColorStop(0, bg);
    grad.addColorStop(1, '#05060c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SS.W, SS.H);

    // parallax stripes
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    const spacing = 90;
    const off = (camOffset * 0.4) % spacing;
    for (let x = -off; x < SS.W; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 60, SS.H); ctx.stroke();
    }
    ctx.restore();

    // ground + ceiling bands
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, layout.groundScreenY, SS.W, C.GROUND_MARGIN);
    ctx.fillRect(0, 0, SS.W, layout.ceilScreenY);

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, layout.groundScreenY); ctx.lineTo(SS.W, layout.groundScreenY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, layout.ceilScreenY); ctx.lineTo(SS.W, layout.ceilScreenY); ctx.stroke();

    // ground grid ticks scrolling
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    const gspacing = C.GRID;
    const goff = camOffset % gspacing;
    for (let x = -goff; x < SS.W; x += gspacing) {
      ctx.beginPath(); ctx.moveTo(x, layout.groundScreenY); ctx.lineTo(x, layout.groundScreenY + 8); ctx.stroke();
    }
  }

  function drawGroundGaps(ctx, layout, level, camOffset) {
    if (!level.groundGaps) return;
    ctx.fillStyle = '#05060c';
    level.groundGaps.forEach(cell => {
      const wx = cell * C.GRID;
      const sx = wx - camOffset;
      if (sx < -C.GRID || sx > SS.W + C.GRID) return;
      ctx.fillRect(sx, layout.groundScreenY, C.GRID, C.GROUND_MARGIN);
      ctx.fillStyle = 'rgba(255,77,109,0.35)';
      ctx.fillRect(sx, layout.groundScreenY, C.GRID, 4);
      ctx.fillStyle = '#05060c';
    });
  }

  function drawObjects(ctx, layout, level, camOffset, t) {
    level.objects.forEach(o => {
      const sx = o.x - camOffset;
      if (o.type === 'finish') {
        if (sx < -80 || sx > SS.W + 80) return;
      } else if (sx < -100 || sx > SS.W + 100) return;

      if (o.type === 'spike') {
        const sy = worldToScreenY(layout, o.y + o.h);
        ctx.fillStyle = '#ff4d6d';
        ctx.beginPath();
        ctx.moveTo(sx, sy + o.h);
        ctx.lineTo(sx + o.w / 2, sy);
        ctx.lineTo(sx + o.w, sy + o.h);
        ctx.closePath(); ctx.fill();
      } else if (o.type === 'block') {
        const sy = worldToScreenY(layout, o.y + o.h);
        const grad = ctx.createLinearGradient(sx, sy, sx, sy + o.h);
        grad.addColorStop(0, '#3a4680'); grad.addColorStop(1, '#232a4d');
        ctx.fillStyle = grad;
        ctx.fillRect(sx, sy, o.w, o.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeRect(sx + 1, sy + 1, o.w - 2, o.h - 2);
      } else if (o.type === 'orb') {
        const sy = worldToScreenY(layout, o.y);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(t * 2);
        ctx.fillStyle = 'rgba(255,221,79,0.25)';
        ctx.beginPath(); ctx.arc(0, 0, C.ORB_RADIUS + 6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffdd4f';
        ctx.beginPath(); ctx.arc(sx, sy, C.ORB_RADIUS, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, C.ORB_RADIUS, 0, Math.PI * 2); ctx.stroke();
      } else if (o.type === 'pad') {
        const sy = worldToScreenY(layout, o.y + o.h);
        ctx.fillStyle = '#ff5fa2';
        ctx.fillRect(sx, sy, o.w, o.h);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(sx, sy, o.w, 3);
      } else if (o.type === 'portalMode') {
        drawPortal(ctx, layout, sx, MODE_COLORS[o.mode] || '#4fd1ff', o.mode.toUpperCase());
      } else if (o.type === 'portalGravity') {
        drawPortal(ctx, layout, sx, '#ffffff', 'GRAV');
      } else if (o.type === 'finish') {
        drawFinish(ctx, layout, sx, t);
      }
    });
  }

  function drawPortal(ctx, layout, sx, color, label) {
    const top = layout.ceilScreenY, bot = layout.groundScreenY;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    ctx.fillRect(sx - C.PORTAL_W / 2, top, C.PORTAL_W, bot - top);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(sx - C.PORTAL_W, top, C.PORTAL_W * 2, bot - top);
    ctx.restore();
    ctx.save();
    ctx.translate(sx, (top + bot) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#04060c';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, 4);
    ctx.restore();
  }

  function drawFinish(ctx, layout, sx, t) {
    const bot = layout.groundScreenY, top = layout.ceilScreenY;
    ctx.strokeStyle = '#5fffa0';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(sx, bot); ctx.lineTo(sx, top); ctx.stroke();
    ctx.fillStyle = '#5fffa0';
    ctx.beginPath();
    ctx.moveTo(sx, top + 10);
    ctx.lineTo(sx + 34, top + 22 + Math.sin(t * 4) * 2);
    ctx.lineTo(sx, top + 40);
    ctx.closePath(); ctx.fill();
  }

  function drawPlayer(ctx, layout, player, screenX) {
    const sy = worldToScreenY(layout, player.y + player.size);
    const color = MODE_COLORS[player.mode] || '#4fd1ff';

    // trail
    player.trail.forEach(p => {
      const ty = worldToScreenY(layout, p.y + player.size / 2);
      ctx.globalAlpha = Math.max(0, p.life) * 0.35;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(screenX - 10, ty, player.size * 0.28 * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    const cx = screenX, cy = sy + player.size / 2, s = player.size;

    // pulsar charge ring drawn outside the squash/rotate transform
    if (player.mode === 'pulsar' && player.chargeTime > 0) {
      const ct = player.chargeTime / C.PULSAR_MAX_CHARGE_TIME;
      ctx.strokeStyle = 'rgba(255,177,79,' + (0.3 + ct * 0.5) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, s / 2 + 6 + ct * 14, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(player.rotation);
    ctx.scale(1 / player.squash, player.squash);

    if (player.mode === 'bolt') {
      const r = 6;
      ctx.fillStyle = color;
      roundRect(ctx, -s / 2, -s / 2, s, s, r);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      roundRect(ctx, -s / 2, -s / 2, s, s, r);
      ctx.stroke();
      ctx.fillStyle = '#04121a';
      ctx.beginPath();
      ctx.moveTo(2, -9); ctx.lineTo(-4, 1); ctx.lineTo(1, 1);
      ctx.lineTo(-3, 9); ctx.lineTo(5, -2); ctx.lineTo(0, -2);
      ctx.closePath(); ctx.fill();
    } else if (player.mode === 'pulsar') {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(0, 0, s / 5, 0, Math.PI * 2); ctx.fill();
    } else if (player.mode === 'comet') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(s * 0.12, 0, s / 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, -s / 3.2);
      ctx.lineTo(-s / 2, 0);
      ctx.lineTo(-s * 0.15, s / 3.2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(s * 0.2, -2, 4, 0, Math.PI * 2); ctx.fill();
    } else if (player.mode === 'anchor') {
      ctx.fillStyle = color;
      polygon(ctx, 0, 0, s / 1.9, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      polygon(ctx, 0, 0, s / 1.9, 6);
      ctx.stroke();
    } else if (player.mode === 'phase') {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -s / 2);
      ctx.lineTo(s / 2.3, 0);
      ctx.lineTo(0, s / 2);
      ctx.lineTo(-s / 2.3, 0);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function polygon(ctx, cx, cy, r, sides) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  SS.Entities = {
    makeLayout, worldToScreenY, createPlayer, resetPlayer, updatePlayer,
    drawBackground, drawGroundGaps, drawObjects, drawPlayer, MODE_COLORS, isSolidGroundMode
  };
})();
