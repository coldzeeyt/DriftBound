// game.js -- runs a level (finite) or endless procedural mode
var SS = SS || {};
(function () {
  'use strict';
  const C = SS.C;
  const H = SS.Levels.helpers;

  //// Endless procedural generator ///////////////////////////////////////
  function makeEndlessGenerator() {
    const REACTION = 0.85; // seconds of safe flat ground before each obstacle, scales with speed
    function pattern(name, x, speed) {
      const objs = []; const gaps = []; let width = 0;
      switch (name) {
        case 'single': objs.push(H.spike(x)); width = 40; break;
        case 'double': objs.push(...H.spikeRow(x, 2)); width = 80; break;
        case 'triple': objs.push(...H.spikeRow(x, 3)); width = 120; break;
        case 'block': {
          objs.push(H.block(x, 0)); objs.push(H.spike(x + 40));
          width = 80; break;
        }
        case 'pit2': {
          const c0 = Math.round(x / C.GRID);
          gaps.push(c0, c0 + 1); width = 80; break;
        }
        case 'pit3orb': {
          objs.push(H.orb(x - 40, 140));
          const c0 = Math.round(x / C.GRID);
          gaps.push(c0, c0 + 1, c0 + 2); width = 120; break;
        }
        case 'padLaunch': {
          objs.push(H.pad(x));
          objs.push(H.spike(x + 260));
          width = 300; break;
        }
        case 'stairBlocks': {
          objs.push(H.block(x, 0)); objs.push(H.spike(x + 40, 40));
          objs.push(H.block(x + 140, 0, 80, 80));
          width = 220; break;
        }
        default: width = 40;
      }
      return { objs, gaps, width };
    }

    return {
      nextX: 900,
      tierPools: [
        ['single', 'double'],
        ['single', 'double', 'triple', 'block'],
        ['single', 'double', 'triple', 'block', 'pit2', 'padLaunch'],
        ['double', 'triple', 'block', 'pit2', 'pit3orb', 'padLaunch', 'stairBlocks']
      ],
      tierFor(dist) {
        if (dist < 1600) return 0;
        if (dist < 4200) return 1;
        if (dist < 9000) return 2;
        return 3;
      },
      ensureAhead(level, camOffset, speed) {
        const target = camOffset + SS.W + 800;
        while (this.nextX < target) {
          const pool = this.tierPools[this.tierFor(this.nextX)];
          const name = pool[Math.floor(Math.random() * pool.length)];
          const p = pattern(name, this.nextX, speed);
          level.objects.push(...p.objs);
          p.gaps.forEach(g => level.groundGaps.push(g));
          const safeGap = speed * REACTION * (0.8 + Math.random() * 0.6);
          this.nextX += p.width + Math.max(180, safeGap);
        }
      },
      prune(level, camOffset) {
        const keepFrom = camOffset - 400;
        level.objects = level.objects.filter(o => (o.x + (o.w || 60)) > keepFrom);
        level.groundGaps = level.groundGaps.filter(c => (c * C.GRID) > keepFrom);
      }
    };
  }

  //// Game controller ///////////////////////////////////////////////////
  function Game() {
    this.level = null;
    this.baseLevel = null;
    this.endless = false;
    this.player = null;
    this.camOffset = 0;
    this.speed = C.DEFAULT_SCROLL_SPEED;
    this.attempts = 1;
    this.time = 0;
    this.running = false;
    this.paused = false;
    this.shake = 0;
    this.gen = null;
    this.onExit = null; // callback(result)
  }

  Game.prototype.load = function (level, endless, onExit) {
    this.baseLevel = level;
    this.endless = !!endless;
    this.onExit = onExit || null;
    this._reset();
    document.getElementById('distance-counter').style.display = this.endless ? '' : 'none';
    document.getElementById('progress-bar').parentElement.style.display = this.endless ? 'none' : '';
  };

  Game.prototype._reset = function () {
    if (this.endless) {
      this.level = { groundGaps: [], objects: [], scrollSpeed: C.DEFAULT_SCROLL_SPEED, backgroundColor: '#0b0e1a' };
      this.gen = makeEndlessGenerator();
    } else {
      // deep-ish clone so triggered portals/gaps don't mutate stored level
      this.level = JSON.parse(JSON.stringify(this.baseLevel));
    }
    if (this.endless) this.level.startMode = 'bolt';
    this.player = SS.Entities.createPlayer(this.level.startMode || 'bolt');
    SS.Entities.resetPlayer(this.player, this.level);
    this.camOffset = 0;
    this.speed = this.level.scrollSpeed || C.DEFAULT_SCROLL_SPEED;
    this.time = 0;
    this.running = true;
    this.paused = false;
    this.shake = 0;
    document.getElementById('attempt-counter').textContent = 'Attempt ' + this.attempts;
    document.getElementById('mode-badge').textContent = this.player.mode.toUpperCase();
  };

  Game.prototype.restart = function (freshAttemptCount) {
    if (freshAttemptCount) this.attempts = 1; else this.attempts++;
    SS.Screens.hideOverlay('screen-result');
    this._reset();
  };

  Game.prototype.pause = function () {
    if (!this.running) return;
    this.paused = true;
    SS.Screens.showOverlay('screen-pause');
  };
  Game.prototype.resume = function () {
    this.paused = false;
    SS.Screens.hideOverlay('screen-pause');
  };

  Game.prototype._death = function (reason) {
    if (!this.running) return;
    this.player.dead = true;
    this.running = false;
    this.shake = 0.35;
    SS.Audio.death();
    let best = null;
    if (this.endless) {
      const dist = Math.floor(this.camOffset / 10);
      best = SS.Storage.getHiscore();
      if (dist > best) { SS.Storage.setHiscore(dist); best = dist; }
      this._showResult(false, { distance: Math.floor(this.camOffset / 10), best });
    } else {
      this._showResult(false, { percent: Math.min(100, Math.floor(100 * this.camOffset / this.level.length)) });
    }
  };

  Game.prototype._win = function () {
    if (!this.running) return;
    this.player.won = true;
    this.running = false;
    SS.Audio.win();
    this._showResult(true, { time: this.time, attempts: this.attempts });
  };

  Game.prototype._showResult = function (won, stats) {
    const title = document.getElementById('result-title');
    const body = document.getElementById('result-stats');
    title.textContent = won ? 'Level Complete!' : (this.endless ? 'Crashed' : 'Crashed');
    title.className = won ? 'win' : 'lose';
    if (won) {
      body.innerHTML = `Time: ${SS.fmtTime(stats.time)}<br>Attempts: ${stats.attempts}`;
    } else if (this.endless) {
      body.innerHTML = `Distance: ${stats.distance}m<br>Best: ${stats.best}m`;
    } else {
      body.innerHTML = `Progress: ${stats.percent}%<br>Attempts: ${this.attempts}`;
    }
    document.getElementById('btn-result-retry').style.display = '';
    SS.Screens.showOverlay('screen-result');
  };

  Game.prototype.update = function (dt, input) {
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (!this.running || this.paused) return;
    this.time += dt;

    if (this.endless) {
      this.speed = Math.min(680, C.DEFAULT_SCROLL_SPEED + this.camOffset / 60);
    }
    this.camOffset += this.speed * dt;

    if (this.endless) {
      this.gen.ensureAhead(this.level, this.camOffset, this.speed);
      this.gen.prune(this.level, this.camOffset);
    }

    const playerWorldX = this.camOffset + SS.W * C.PLAYER_SCREEN_X_RATIO;
    const fx = {
      onDeath: (reason) => this._death(reason),
      onWin: () => this._win()
    };
    SS.Entities.updatePlayer(this.player, dt, this.level, playerWorldX, input, fx);

    document.getElementById('mode-badge').textContent = this.player.mode.toUpperCase();
    if (this.endless) {
      document.getElementById('distance-counter').textContent = Math.floor(this.camOffset / 10) + 'm';
    } else {
      const pct = SS.clamp(100 * this.camOffset / this.level.length, 0, 100);
      document.getElementById('progress-bar').style.width = pct + '%';
    }
  };

  Game.prototype.render = function (t) {
    const ctx = SS.ctx;
    const layout = SS.Entities.makeLayout();
    ctx.save();
    if (this.shake > 0) {
      const m = this.shake * 10;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    SS.Entities.drawBackground(ctx, layout, this.level, this.camOffset, t);
    SS.Entities.drawGroundGaps(ctx, layout, this.level, this.camOffset);
    SS.Entities.drawObjects(ctx, layout, this.level, this.camOffset, t);
    const screenX = SS.W * C.PLAYER_SCREEN_X_RATIO;
    if (!this.player.dead) SS.Entities.drawPlayer(ctx, layout, this.player, screenX);
    ctx.restore();
  };

  SS.Game = Game;
})();
