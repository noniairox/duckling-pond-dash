// The game's rules and state, with no drawing and no browser in it: the duckling hopping
// between lily pads, the pads' sink-and-regrow cycle, the breadcrumbs, the heron's swoops and
// the cat's leaps, score, lives and level. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react without the world knowing about screens or
// sound. Nothing here allocates after createWorld returns.
import { CAT, CRUMB, FIELD, HERON, HOME_PAD, HOP, LEVEL_MAX, LEVEL_POINTS, LIVES, PAD, WIN_SCORE } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_CRUMB = 2;
export const EVENT_OVER = 4;
export const EVENT_WIN = 8;
export const EVENT_LEVEL = 16;

export const PAD_HEALTHY = 0;
export const PAD_WOBBLE = 1;
export const PAD_SINKING = 2;
export const PAD_GONE = 3;
export const PAD_REGROW = 4;

/** The duckling's home pad, in the pads list as index -1. */
export const HOME_INDEX = -1;

function padLifetime(random, level) {
  const base = PAD.healthyMin + random() * (PAD.healthyMax - PAD.healthyMin);
  return base / (1 + 0.15 * (level - 1));
}

export function createWorld(random) {
  const pads = [];
  for (let row = 0; row < PAD.rows.length; row += 1) {
    for (let col = 0; col < PAD.cols.length; col += 1) {
      pads.push({
        x: PAD.cols[col] + (random() - 0.5) * 2 * PAD.jitter,
        y: PAD.rows[row] + (random() - 0.5) * 2 * PAD.jitter,
        radius: PAD.radius,
        state: PAD_HEALTHY,
        timer: 0,
        hasCrumb: false,
        flower: random() < 0.22,
      });
    }
  }
  const duckling = { pad: HOME_INDEX, x: HOME_PAD.x, y: HOME_PAD.y, hop: null, invulnerable: 0, facing: 1 };
  const heron = { state: 'perch', x: HERON.perch.x, y: HERON.perch.y, fromX: 0, fromY: 0, toX: 0, toY: 0, target: -1, timer: 2 };
  const cat = { state: 'hidden', x: 0, y: CAT.bankY, fromX: 0, fromY: 0, toX: 0, toY: 0, target: -1, timer: 6 };
  const state = {
    pads, duckling, heron, cat,
    score: 0, lives: LIVES, level: 1, elapsed: 0,
    crumbTimer: 1.2, catTimer: 6, over: false, won: false,
  };

  /** The pad (or the home pad) an id names: HOME_INDEX is the nest pad. */
  function padOf(id) {
    return id === HOME_INDEX ? { x: HOME_PAD.x, y: HOME_PAD.y, radius: HOME_PAD.radius, state: PAD_HEALTHY, hasCrumb: false } : pads[id];
  }

  function reset() {
    for (let index = 0; index < pads.length; index += 1) {
      const pad = pads[index];
      pad.state = PAD_HEALTHY;
      pad.timer = padLifetime(random, 1) * (0.4 + random() * 0.6);
      pad.hasCrumb = false;
    }
    duckling.pad = HOME_INDEX;
    duckling.x = HOME_PAD.x;
    duckling.y = HOME_PAD.y;
    duckling.hop = null;
    duckling.invulnerable = 0;
    duckling.facing = 1;
    heron.state = 'perch';
    heron.x = HERON.perch.x;
    heron.y = HERON.perch.y;
    heron.target = -1;
    heron.timer = 2;
    cat.state = 'hidden';
    cat.timer = 6;
    state.score = 0;
    state.lives = LIVES;
    state.level = 1;
    state.elapsed = 0;
    state.crumbTimer = 1.2;
    state.catTimer = 6;
    state.over = false;
    state.won = false;
    spawnCrumb();
    spawnCrumb();
  }

  function crumbsOnPads() {
    let count = 0;
    for (const pad of pads) if (pad.hasCrumb) count += 1;
    return count;
  }

  function spawnCrumb() {
    if (crumbsOnPads() >= CRUMB.max) return;
    for (let tries = 0; tries < 12; tries += 1) {
      const pad = pads[Math.floor(random() * pads.length)];
      if (pad.state === PAD_HEALTHY && !pad.hasCrumb) {
        pad.hasCrumb = true;
        return;
      }
    }
  }

  /** Start a hop to the pad `id` (HOME_INDEX or a pad index); false when it cannot start. */
  function hopTo(id) {
    if (duckling.hop !== null) return false;
    const target = padOf(id);
    const dx = target.x - duckling.x;
    const dy = target.y - duckling.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 10 || dist > HOP.range) return false;
    if (id === duckling.pad) return false;
    duckling.hop = { to: id, fromX: duckling.x, fromY: duckling.y, toX: target.x, toY: target.y, t: 0, dur: HOP.duration };
    duckling.facing = dx >= 0 ? 1 : -1;
    return true;
  }

  /** The nearest pad in the direction (dx, dy) from the duckling, or HOME_INDEX for the nest. */
  function padInDirection(dx, dy) {
    let best = null;
    let bestScore = Infinity;
    const candidates = [{ id: HOME_INDEX, x: HOME_PAD.x, y: HOME_PAD.y }];
    for (let index = 0; index < pads.length; index += 1) candidates.push({ id: index, x: pads[index].x, y: pads[index].y });
    for (const cand of candidates) {
      if (cand.id === duckling.pad) continue;
      const vx = cand.x - duckling.x;
      const vy = cand.y - duckling.y;
      const dist = Math.hypot(vx, vy);
      if (dist < 10 || dist > HOP.range) continue;
      const dot = (vx * dx + vy * dy) / dist;
      if (dot < 0.5) continue;
      const score = dist - dot * 60;
      if (score < bestScore) {
        bestScore = score;
        best = cand.id;
      }
    }
    return best;
  }

  /** Hop in the direction (dx, dy); false when no pad lies that way. */
  function hopDir(dx, dy) {
    const target = padInDirection(dx, dy);
    return target === null ? false : hopTo(target);
  }

  /** The pad whose centre is nearest (x, y) within `maxDist`, or null. */
  function padNear(x, y, maxDist) {
    let best = null;
    let bestDist = maxDist;
    const candidates = [{ id: HOME_INDEX, x: HOME_PAD.x, y: HOME_PAD.y }];
    for (let index = 0; index < pads.length; index += 1) candidates.push({ id: index, x: pads[index].x, y: pads[index].y });
    for (const cand of candidates) {
      const dist = Math.hypot(cand.x - x, cand.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = cand.id;
      }
    }
    return best;
  }

  /** Hop to the pad near (x, y) when it is in jump range; false when there is none. */
  function hopToPoint(x, y) {
    const target = padNear(x, y, 90);
    return target === null ? false : hopTo(target);
  }

  /** The duckling loses a life and respawns at the nest; returns EVENT_OVER when that was the last. */
  function loseLife() {
    state.lives -= 1;
    duckling.pad = HOME_INDEX;
    duckling.x = HOME_PAD.x;
    duckling.y = HOME_PAD.y;
    duckling.hop = null;
    duckling.invulnerable = 2;
    if (state.lives <= 0) {
      state.over = true;
      return EVENT_OVER;
    }
    return 0;
  }

  function pickHeronTarget() {
    if (duckling.pad !== HOME_INDEX && duckling.hop === null && random() < HERON.huntChance) return duckling.pad;
    const withCrumb = [];
    for (let index = 0; index < pads.length; index += 1) if (pads[index].hasCrumb) withCrumb.push(index);
    if (withCrumb.length > 0 && random() < 0.5) return withCrumb[Math.floor(random() * withCrumb.length)];
    return Math.floor(random() * pads.length);
  }

  function heronSpeed() {
    return 1 + 0.1 * (state.level - 1);
  }

  function stepHeron(dt, harmless) {
    const speed = heronSpeed();
    if (heron.state === 'perch') {
      heron.timer -= dt;
      if (heron.timer <= 0) {
        heron.target = pickHeronTarget();
        const pad = pads[heron.target];
        heron.fromX = heron.x;
        heron.fromY = heron.y;
        heron.toX = pad.x;
        heron.toY = pad.y - 95;
        heron.timer = HERON.fly / speed;
        heron.state = 'fly';
      }
      return 0;
    }
    if (heron.state === 'fly') {
      heron.timer -= dt;
      const t = Math.min(1, Math.max(0, 1 - heron.timer / (HERON.fly / speed)));
      heron.x = heron.fromX + (heron.toX - heron.fromX) * t;
      heron.y = heron.fromY + (heron.toY - heron.fromY) * t;
      if (heron.timer <= 0) {
        heron.state = 'hover';
        heron.timer = HERON.hover;
      }
      return 0;
    }
    if (heron.state === 'hover') {
      heron.timer -= dt;
      if (heron.timer <= 0) {
        const pad = pads[heron.target];
        heron.fromX = heron.x;
        heron.fromY = heron.y;
        heron.toX = pad.x;
        heron.toY = pad.y - 18;
        heron.timer = HERON.swoop / speed;
        heron.state = 'swoop';
      }
      return 0;
    }
    if (heron.state === 'swoop') {
      heron.timer -= dt;
      const t = Math.min(1, Math.max(0, 1 - heron.timer / (HERON.swoop / speed)));
      heron.x = heron.fromX + (heron.toX - heron.fromX) * t;
      heron.y = heron.fromY + (heron.toY - heron.fromY) * t;
      if (heron.timer <= 0) {
        heron.state = 'stand';
        heron.timer = HERON.stand;
        if (!harmless && duckling.hop === null && duckling.pad === heron.target && duckling.invulnerable === 0) {
          return loseLife();
        }
      }
      return 0;
    }
    if (heron.state === 'stand') {
      heron.timer -= dt;
      if (heron.timer <= 0) {
        heron.fromX = heron.x;
        heron.fromY = heron.y;
        heron.toX = HERON.perch.x;
        heron.toY = HERON.perch.y;
        heron.timer = HERON.fly / speed;
        heron.state = 'return';
      }
      return 0;
    }
    heron.timer -= dt;
    const t = Math.min(1, Math.max(0, 1 - heron.timer / (HERON.fly / speed)));
    heron.x = heron.fromX + (heron.toX - heron.fromX) * t;
    heron.y = heron.fromY + (heron.toY - heron.fromY) * t;
    if (heron.timer <= 0) {
      heron.state = 'perch';
      heron.timer = HERON.perchWait / speed;
      heron.target = -1;
    }
    return 0;
  }

  function stepCat(dt, harmless) {
    if (state.level < CAT.minLevel) return 0;
    const speed = 1 + 0.08 * (state.level - CAT.minLevel);
    if (cat.state === 'hidden') {
      cat.timer -= dt;
      if (cat.timer <= 0) {
        cat.target = duckling.pad !== HOME_INDEX && duckling.hop === null ? duckling.pad : Math.floor(random() * pads.length);
        const pad = pads[cat.target];
        cat.x = pad.x;
        cat.y = CAT.bankY;
        cat.timer = CAT.crouch / speed;
        cat.state = 'crouch';
      }
      return 0;
    }
    if (cat.state === 'crouch') {
      cat.timer -= dt;
      if (cat.timer <= 0) {
        const pad = pads[cat.target];
        cat.fromX = cat.x;
        cat.fromY = cat.y;
        cat.toX = pad.x;
        cat.toY = pad.y - 6;
        cat.timer = CAT.leap / speed;
        cat.state = 'leap';
      }
      return 0;
    }
    if (cat.state === 'leap') {
      cat.timer -= dt;
      const t = Math.min(1, Math.max(0, 1 - cat.timer / (CAT.leap / speed)));
      cat.x = cat.fromX + (cat.toX - cat.fromX) * t;
      cat.y = cat.fromY + (cat.toY - cat.fromY) * t - Math.sin(t * Math.PI) * 70;
      if (cat.timer <= 0) {
        cat.state = 'land';
        cat.timer = CAT.land;
        if (!harmless && duckling.hop === null && duckling.pad === cat.target && duckling.invulnerable === 0) {
          return loseLife();
        }
      }
      return 0;
    }
    if (cat.state === 'land') {
      cat.timer -= dt;
      if (cat.timer <= 0) {
        cat.fromX = cat.x;
        cat.fromY = cat.y;
        cat.toX = cat.x;
        cat.toY = CAT.bankY;
        cat.timer = CAT.leap / speed;
        cat.state = 'return';
      }
      return 0;
    }
    cat.timer -= dt;
    const t = Math.min(1, Math.max(0, 1 - cat.timer / (CAT.leap / speed)));
    cat.x = cat.fromX + (cat.toX - cat.fromX) * t;
    cat.y = cat.fromY + (cat.toY - cat.fromY) * t - Math.sin(t * Math.PI) * 70;
    if (cat.timer <= 0) {
      cat.state = 'hidden';
      cat.timer = Math.max(4, CAT.interval * (1 - 0.08 * (state.level - CAT.minLevel)));
    }
    return 0;
  }

  function stepPads(dt) {
    for (const pad of pads) {
      pad.timer -= dt;
      if (pad.state === PAD_HEALTHY && pad.timer <= 0) {
        pad.state = PAD_WOBBLE;
        pad.timer = PAD.wobble;
      } else if (pad.state === PAD_WOBBLE && pad.timer <= 0) {
        pad.state = PAD_SINKING;
        pad.timer = 0.6;
        pad.hasCrumb = false;
      } else if (pad.state === PAD_SINKING && pad.timer <= 0) {
        pad.state = PAD_GONE;
        pad.timer = PAD.gone;
      } else if (pad.state === PAD_GONE && pad.timer <= 0) {
        pad.state = PAD_REGROW;
        pad.timer = PAD.regrow;
      } else if (pad.state === PAD_REGROW && pad.timer <= 0) {
        pad.state = PAD_HEALTHY;
        pad.timer = padLifetime(random, state.level);
      }
    }
  }

  /**
   * One fixed step. With `harmless` set (the title screen's backdrop) the pond lives but
   * nothing scores, nothing catches the duckling and no life is lost.
   */
  function step(dt, harmless) {
    let events = 0;
    state.elapsed += dt;
    const level = Math.min(LEVEL_MAX, 1 + Math.floor(state.score / LEVEL_POINTS));
    if (!harmless && level !== state.level) {
      state.level = level;
      events |= EVENT_LEVEL;
    } else {
      state.level = level;
    }
    if (duckling.invulnerable > 0) duckling.invulnerable = Math.max(0, duckling.invulnerable - dt);

    stepPads(dt);

    // The pad under the duckling sank away.
    if (!harmless && duckling.hop === null && duckling.pad !== HOME_INDEX) {
      const pad = pads[duckling.pad];
      if (pad.state === PAD_GONE || pad.state === PAD_SINKING) {
        events |= loseLife();
        if (events & EVENT_OVER) return events;
      }
    }

    // A hop in flight: arc to the target pad, then land (or splash, or get caught).
    if (duckling.hop !== null) {
      const hop = duckling.hop;
      hop.t += dt;
      const t = Math.min(1, hop.t / hop.dur);
      duckling.x = hop.fromX + (hop.toX - hop.fromX) * t;
      duckling.y = hop.fromY + (hop.toY - hop.fromY) * t - Math.sin(t * Math.PI) * 55;
      if (hop.t >= hop.dur) {
        duckling.hop = null;
        duckling.x = hop.toX;
        duckling.y = hop.toY;
        duckling.pad = hop.to;
        if (!harmless) {
          if (hop.to !== HOME_INDEX) {
            const pad = pads[hop.to];
            if (pad.state === PAD_GONE || pad.state === PAD_SINKING) {
              events |= loseLife();
              if (events & EVENT_OVER) return events;
            } else {
              if (pad.hasCrumb) {
                pad.hasCrumb = false;
                state.score += CRUMB.points;
                events |= EVENT_CRUMB;
              }
              if (heron.state === 'stand' && heron.target === hop.to && duckling.invulnerable === 0) {
                events |= loseLife();
                if (events & EVENT_OVER) return events;
              } else if (cat.state === 'land' && cat.target === hop.to && duckling.invulnerable === 0) {
                events |= loseLife();
                if (events & EVENT_OVER) return events;
              }
            }
          }
          if (state.score >= WIN_SCORE && !state.won) {
            state.won = true;
            events |= EVENT_WIN;
          }
        }
      }
    }

    events |= stepHeron(dt, harmless);
    if (events & EVENT_OVER) return events;
    events |= stepCat(dt, harmless);
    if (events & EVENT_OVER) return events;

    state.crumbTimer -= dt;
    if (state.crumbTimer <= 0) {
      spawnCrumb();
      state.crumbTimer = CRUMB.interval + random() * 0.8;
    }
    return events;
  }

  reset();
  return { state, reset, step, hopTo, hopDir, hopToPoint, padOf, random };
}
