// The game's rules and state, with no drawing and no browser in it: the duckling hopping
// between lily pads, the pads' sink-and-regrow cycle, the breadcrumbs, the heron's swoops and
// the cat's leaps, the star crumb's Fever and the turtle that blocks a pad, score, lives and
// level. step() advances one fixed step and returns what happened as bit flags, so the caller
// can react without the world knowing about screens or sound. Nothing here allocates after
// createWorld returns.
import { CAT, COMBO, CRUMB, DRIFT, FEVER, FIELD, FISH, GOLDEN, HERON, HOME_PAD, HOP, LEVEL_MAX, LEVEL_POINTS, LIVES, PAD, SHIELD, STAR, TURTLE, WIN_SCORE } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_CRUMB = 2;
export const EVENT_OVER = 4;
export const EVENT_WIN = 8;
export const EVENT_LEVEL = 16;
/** A golden crumb was eaten (50 points). */
export const EVENT_GOLD = 32;
/** A shield bubble was picked up. */
export const EVENT_SHIELD = 64;
/** The shield absorbed a hit and broke (no life lost). */
export const EVENT_BREAK = 128;
/** A star crumb was eaten (100 points) and Fever started: double points for a while. */
export const EVENT_FEVER = 256;

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
      const x = PAD.cols[col] + (random() - 0.5) * 2 * PAD.jitter;
      pads.push({
        x,
        /** The pad's home x: drifting pads swing around it. */
        bx: x,
        y: PAD.rows[row] + (random() - 0.5) * 2 * PAD.jitter,
        /** Each pad keeps its own size, so the grid never looks stamped out. */
        radius: PAD.radius * (1 + (random() - 0.5) * 2 * PAD.radiusVar),
        /** The notch in the pad's rim points a different way per pad. */
        notch: random() * Math.PI * 2,
        state: PAD_HEALTHY,
        timer: 0,
        hasCrumb: false,
        hasGolden: false,
        hasStar: false,
        hasShield: false,
        /** True while the turtle sits on this pad: it cannot be hopped to. */
        turtle: false,
        flower: random() < 0.3,
        /** Set at reset: whether this pad drifts, and how far and in what phase. */
        moving: false,
        drift: 0,
        phase: 0,
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
    /** Crumbs eaten in a row without losing a life: a crumb scores 10 x combo (capped). */
    combo: 0,
    /** True while the shield bubble is held: it absorbs the next hit. */
    shield: false,
    /** Seconds of Fever left: while > 0 every point gain is doubled. */
    fever: 0,
    /** The turtle that blocks a pad: active while it sits somewhere, pad -1 when hidden. */
    turtle: { active: false, pad: -1, timer: 10, warn: false },
    /** The leaping fish (visual only): active while it is in the air. */
    fish: { active: false, x: 0, y: 0, t: 0, timer: 3 },
    /** The last point gain (points and where it happened), for a floating popup; null when none. */
    lastGain: null,
  };

  /** The pad (or the home pad) an id names: HOME_INDEX is the nest pad. */
  function padOf(id) {
    return id === HOME_INDEX ? { x: HOME_PAD.x, y: HOME_PAD.y, radius: HOME_PAD.radius, state: PAD_HEALTHY, hasCrumb: false, hasStar: false, turtle: false } : pads[id];
  }

  function reset() {
    for (let index = 0; index < pads.length; index += 1) {
      const pad = pads[index];
      pad.state = PAD_HEALTHY;
      pad.timer = padLifetime(random, 1) * (0.4 + random() * 0.6);
      pad.hasCrumb = false;
      pad.hasGolden = false;
      pad.hasStar = false;
      pad.hasShield = false;
      pad.turtle = false;
      pad.x = pad.bx;
      pad.moving = false;
      pad.drift = 0;
      pad.phase = 0;
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
    state.combo = 0;
    state.shield = false;
    state.fever = 0;
    state.turtle.active = false;
    state.turtle.pad = -1;
    state.turtle.timer = 10;
    state.turtle.warn = false;
    state.fish.active = false;
    state.fish.timer = 3;
    state.lastGain = null;
    spawnCrumb();
    spawnCrumb();
  }

  function crumbsOnPads() {
    let count = 0;
    for (const pad of pads) if (pad.hasCrumb) count += 1;
    return count;
  }

  function goldenOnPads() {
    for (const pad of pads) if (pad.hasGolden) return true;
    return false;
  }

  function starOnPads() {
    for (const pad of pads) if (pad.hasStar) return true;
    return false;
  }

  function spawnCrumb() {
    if (crumbsOnPads() >= CRUMB.max) return;
    for (let tries = 0; tries < 12; tries += 1) {
      const pad = pads[Math.floor(random() * pads.length)];
      if (pad.state === PAD_HEALTHY && !pad.hasCrumb && !pad.hasGolden && !pad.hasStar && !pad.hasShield && !pad.turtle) {
        // From level 2, a spawn is sometimes a star crumb: 100 points and Fever (double points).
        if (state.level >= STAR.minLevel && !starOnPads() && random() < STAR.chance) {
          pad.hasStar = true;
        } else if (state.level >= GOLDEN.minLevel && !goldenOnPads() && random() < GOLDEN.chance) {
          pad.hasGolden = true;
        } else {
          pad.hasCrumb = true;
        }
        return;
      }
    }
  }

  function shieldOnPads() {
    for (const pad of pads) if (pad.hasShield) return true;
    return false;
  }

  /** A shield bubble on a random healthy pad, from level 2, at most one at a time. */
  function spawnShield() {
    if (state.shield || shieldOnPads()) return;
    for (let tries = 0; tries < 12; tries += 1) {
      const pad = pads[Math.floor(random() * pads.length)];
      if (pad.state === PAD_HEALTHY && !pad.hasCrumb && !pad.hasGolden && !pad.hasStar && !pad.hasShield && !pad.turtle) {
        pad.hasShield = true;
        return;
      }
    }
  }

  /** From level 4, a share of pads starts drifting sideways around their home x. */
  function enableDrift() {
    for (const pad of pads) {
      if (!pad.moving && random() < DRIFT.chance) {
        pad.moving = true;
        pad.drift = DRIFT.minAmp + random() * (DRIFT.maxAmp - DRIFT.minAmp);
        pad.phase = random() * Math.PI * 2;
      }
    }
  }

  /**
   * The turtle: from level 3 it surfaces on a healthy, empty pad the duckling is not on,
   * warns, then sits there blocking it. Landing on its pad bumps the duckling off.
   * Returns a hit event when it bumps a duckling standing on its pad (defensive: the
   * spawn excludes the duckling's pad and hopTo refuses turtle pads, so this is the
   * last line of defence; the landing bump is handled where hops land).
   */
  function stepTurtle(dt, harmless) {
    const turtle = state.turtle;
    if (state.level < TURTLE.minLevel) return 0;
    if (!turtle.active) {
      turtle.timer -= dt;
      if (turtle.timer <= 0) {
        for (let tries = 0; tries < 12; tries += 1) {
          const index = Math.floor(random() * pads.length);
          const pad = pads[index];
          if (index === duckling.pad) continue;
          if (pad.state === PAD_HEALTHY && !pad.hasCrumb && !pad.hasGolden && !pad.hasStar && !pad.hasShield && !pad.turtle) {
            turtle.active = true;
            turtle.pad = index;
            turtle.warn = true;
            turtle.timer = TURTLE.warn;
            pad.turtle = true;
            return 0;
          }
        }
        turtle.timer = 2;
      }
      return 0;
    }
    turtle.timer -= dt;
    if (turtle.warn) {
      if (turtle.timer <= 0) {
        turtle.warn = false;
        turtle.timer = TURTLE.sit;
      }
      return 0;
    }
    if (!harmless && duckling.hop === null && duckling.pad === turtle.pad && duckling.invulnerable === 0) {
      return loseLife();
    }
    if (turtle.timer <= 0) {
      pads[turtle.pad].turtle = false;
      turtle.active = false;
      turtle.pad = -1;
      turtle.timer = TURTLE.interval * (0.8 + random() * 0.5);
    }
    return 0;
  }

  /** Start a hop to the pad `id` (HOME_INDEX or a pad index); false when it cannot start. */
  function hopTo(id) {
    if (duckling.hop !== null) return false;
    const target = padOf(id);
    if (target.turtle) return false;
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
      if (cand.id !== HOME_INDEX && pads[cand.id].turtle) continue;
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
      if (cand.id !== HOME_INDEX && pads[cand.id].turtle) continue;
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

  /**
   * A hit lands (heron, cat, turtle or sinking pad). A held shield absorbs it and breaks
   * instead of a life; otherwise the duckling loses a life and its combo, and respawns at
   * the nest. Returns EVENT_BREAK, EVENT_HIT, or EVENT_HIT | EVENT_OVER when that was
   * the last life.
   */
  function loseLife() {
    if (state.shield) {
      state.shield = false;
      duckling.invulnerable = 2;
      return EVENT_BREAK;
    }
    state.lives -= 1;
    state.combo = 0;
    state.fever = 0;
    duckling.pad = HOME_INDEX;
    duckling.x = HOME_PAD.x;
    duckling.y = HOME_PAD.y;
    duckling.hop = null;
    duckling.invulnerable = 2;
    if (state.lives <= 0) {
      state.over = true;
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
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
      if (pad.moving) pad.x = pad.bx + Math.sin(state.elapsed * DRIFT.speed + pad.phase) * pad.drift;
      pad.timer -= dt;
      if (pad.state === PAD_HEALTHY && pad.timer <= 0) {
        pad.state = PAD_WOBBLE;
        pad.timer = PAD.wobble;
      } else if (pad.state === PAD_WOBBLE && pad.timer <= 0) {
        pad.state = PAD_SINKING;
        pad.timer = 0.6;
        pad.hasCrumb = false;
        pad.hasGolden = false;
        pad.hasStar = false;
        pad.hasShield = false;
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

  /** The leaping fish: a jump every few seconds from level 2, visual only, never a hit. */
  function stepFish(dt) {
    const fish = state.fish;
    if (state.level < FISH.minLevel) return;
    if (fish.active) {
      fish.t += dt;
      if (fish.t >= FISH.leap) fish.active = false;
      return;
    }
    fish.timer -= dt;
    if (fish.timer <= 0) {
      fish.active = true;
      fish.x = 80 + random() * (FIELD.width - 160);
      fish.y = 190 + random() * 420;
      fish.t = 0;
      fish.timer = FISH.intervalMin + random() * (FISH.intervalMax - FISH.intervalMin);
    }
  }

  /**
   * One fixed step. With `harmless` set (the title screen's backdrop) the pond lives but
   * nothing scores, nothing catches the duckling and no life is lost.
   */
  function step(dt, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.lastGain = null;
    const level = Math.min(LEVEL_MAX, 1 + Math.floor(state.score / LEVEL_POINTS));
    if (!harmless && level !== state.level) {
      state.level = level;
      if (level >= DRIFT.minLevel) enableDrift();
      events |= EVENT_LEVEL;
    } else {
      state.level = level;
    }
    if (duckling.invulnerable > 0) duckling.invulnerable = Math.max(0, duckling.invulnerable - dt);
    if (state.fever > 0) state.fever = Math.max(0, state.fever - dt);

    stepPads(dt);
    stepFish(dt);
    events |= stepTurtle(dt, harmless);
    if (events & EVENT_OVER) return events;

    // The duckling rides a drifting pad it stands on.
    if (duckling.hop === null && duckling.pad !== HOME_INDEX) {
      const standing = pads[duckling.pad];
      if (standing.moving) {
        duckling.x = standing.x;
        duckling.y = standing.y;
      }
    }

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
            } else if (pad.turtle) {
              // The turtle surfaced here mid-hop: it bumps the duckling off.
              events |= loseLife();
              if (events & EVENT_OVER) return events;
            } else {
              // Fever doubles every point gain while it lasts.
              const mult = state.fever > 0 ? FEVER.mult : 1;
              if (pad.hasStar) {
                pad.hasStar = false;
                state.score += STAR.points * mult;
                state.combo += 1;
                state.fever = FEVER.duration;
                state.lastGain = { points: STAR.points * mult, x: duckling.x, y: duckling.y - 40, label: 'FEVER!' };
                events |= EVENT_FEVER;
              } else if (pad.hasGolden) {
                pad.hasGolden = false;
                state.score += GOLDEN.points * mult;
                state.combo += 1;
                state.lastGain = { points: GOLDEN.points * mult, x: duckling.x, y: duckling.y - 40 };
                events |= EVENT_GOLD;
              } else if (pad.hasCrumb) {
                pad.hasCrumb = false;
                // The combo pays: the first crumb in a row is 10, the next 20, then 30.
                state.combo += 1;
                const gained = CRUMB.points * Math.min(state.combo, COMBO.maxMult) * mult;
                state.score += gained;
                state.lastGain = { points: gained, x: duckling.x, y: duckling.y - 40 };
                events |= EVENT_CRUMB;
              }
              if (pad.hasShield) {
                pad.hasShield = false;
                state.shield = true;
                events |= EVENT_SHIELD;
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
    // A shield bubble drifts onto the pond now and then, from level 2.
    if (!harmless && state.level >= SHIELD.minLevel && random() < dt * SHIELD.chance * 0.6) spawnShield();
    return events;
  }

  reset();
  return { state, reset, step, hopTo, hopDir, hopToPoint, padOf, random };
}
