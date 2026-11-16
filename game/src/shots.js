// The screenshot scenes behind ?shot=start|play|gold|end|action. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by an autopilot, so the
// frame is what a short game really looks like and the same seed always gives the same frame.
// The play scene's pilot hops to crumbs and away from the heron and the cat; the end scene's
// pilot chases the heron's target pad and ignores sinking pads, so it is caught out once the
// predators speed up, as a hurried player is. The action scene waits for the most dramatic
// moment — the heron mid-swoop while the duckling is mid-hop — and the gold scene stages the
// new depth (golden crumb, star crumb, shield, combo, Fever) on pads near the duckling.
import { HOP, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN, HOME_INDEX, PAD_GONE, PAD_HEALTHY, PAD_SINKING, PAD_WOBBLE } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;
/** The gold scene: the good pilot plays long enough to build a combo, then a golden crumb
 * and a shield are placed on pads near the duckling so the frame shows the new depth. */
const GOLD_SECONDS = 20;
/** The action scene: wait this long at most for the heron to swoop while the duckling hops. */
const ACTION_LIMIT_SECONDS = 150;

/** Whether a pad is threatened right now: the heron or the cat is about to land on it. */
function padThreat(state, id) {
  const heron = state.heron;
  if ((heron.state === 'fly' || heron.state === 'hover' || heron.state === 'swoop' || heron.state === 'stand') && heron.target === id) return true;
  const cat = state.cat;
  if ((cat.state === 'crouch' || cat.state === 'leap' || cat.state === 'land') && cat.target === id) return true;
  return false;
}

/** Every pad the duckling could hop to from where it stands, home included. */
function hopCandidates(world) {
  const state = world.state;
  const duck = state.duckling;
  const out = [];
  const candidates = [{ id: HOME_INDEX, x: 640, y: 662 }];
  for (let index = 0; index < state.pads.length; index += 1) {
    candidates.push({ id: index, x: state.pads[index].x, y: state.pads[index].y });
  }
  for (const cand of candidates) {
    if (cand.id === duck.pad) continue;
    const dist = Math.hypot(cand.x - duck.x, cand.y - duck.y);
    if (dist > HOP.range) continue;
    out.push(cand);
  }
  return out;
}

/** The good pilot: flee a threatened or sinking pad, else hop to the nearest safe crumb. */
function goodPilot(world) {
  const state = world.state;
  const duck = state.duckling;
  if (duck.hop !== null) return;
  const current = duck.pad === HOME_INDEX ? null : state.pads[duck.pad];
  const currentBad = current !== null && (current.state !== PAD_HEALTHY || padThreat(state, duck.pad));
  let best = null;
  let bestScore = -Infinity;
  for (const cand of hopCandidates(world)) {
    const pad = cand.id === HOME_INDEX ? null : state.pads[cand.id];
    let score = -Math.hypot(cand.x - duck.x, cand.y - duck.y) / 50;
    if (pad === null) score += 5;
    else if (pad.state === PAD_GONE || pad.state === PAD_SINKING) score -= 10000;
    else if (pad.turtle) score -= 10000;
    else if (pad.state === PAD_WOBBLE) score -= 500;
    else if (pad.hasStar) score += 250;
    else if (pad.hasGolden) score += 150;
    else if (pad.hasCrumb) score += 100;
    if (pad !== null && pad.hasShield) score += 60;
    if (padThreat(state, cand.id)) score -= 1000;
    if (score > bestScore) {
      bestScore = score;
      best = cand.id;
    }
  }
  if (best === null) return;
  if (currentBad || bestScore > 20) world.hopTo(best);
}

/** The bad pilot: chase the heron's target pad, and stand still on a pad that is about to sink. */
function badPilot(world) {
  const state = world.state;
  const duck = state.duckling;
  if (duck.hop !== null) return;
  const heron = state.heron;
  if ((heron.state === 'fly' || heron.state === 'hover' || heron.state === 'swoop') && heron.target >= 0) {
    if (duck.pad === heron.target) return;
    const target = state.pads[heron.target];
    const near = hopCandidates(world);
    let best = null;
    let bestDist = Infinity;
    for (const cand of near) {
      const dist = Math.hypot(cand.x - target.x, cand.y - target.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = cand.id;
      }
    }
    if (best !== null) world.hopTo(best);
    return;
  }
  const candidates = hopCandidates(world);
  if (candidates.length === 0) return;
  const pick = candidates[Math.floor(world.random() * candidates.length)];
  world.hopTo(pick.id);
}

/**
 * Stage showcase items on healthy pads near the duckling: a golden crumb, a star crumb
 * and a shield, so the frame shows the game's depth. Returns what was placed.
 */
function stageShowcase(world) {
  const state = world.state;
  const duck = state.duckling;
  let placedGold = false;
  let placedStar = false;
  let placedShield = false;
  for (let index = 0; index < state.pads.length; index += 1) {
    const pad = state.pads[index];
    if (pad.state !== PAD_HEALTHY || pad.hasCrumb || pad.hasGolden || pad.hasStar || pad.hasShield || pad.turtle) continue;
    const dist = Math.hypot(pad.x - duck.x, pad.y - duck.y);
    if (dist > 340) continue;
    if (!placedGold) {
      pad.hasGolden = true;
      placedGold = true;
    } else if (!placedStar) {
      pad.hasStar = true;
      placedStar = true;
    } else if (!placedShield) {
      pad.hasShield = true;
      placedShield = true;
    }
    if (placedGold && placedStar && placedShield) break;
  }
  return { placedGold, placedStar, placedShield };
}

/**
 * Set `world` to the named scene (start, play, gold, end or action; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end' && name !== 'gold' && name !== 'action') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'action') {
    // The most dramatic moment: the heron mid-swoop while the duckling is mid-hop,
    // after enough play that the HUD has a score and a combo. Break before the
    // pilot can reach 300 and turn the frame into a win panel.
    for (let index = 0; index < ACTION_LIMIT_SECONDS / STEP; index += 1) {
      goodPilot(world);
      const events = world.step(STEP, false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
      const state = world.state;
      if (state.score >= 290) break;
      if (state.elapsed > 10 && state.heron.state === 'swoop' && state.duckling.hop !== null) break;
    }
    stageShowcase(world);
    world.state.combo = Math.max(world.state.combo, 3);
    // Capture at once: the duckling is still mid-hop, the heron still diving.
    if (world.state.won) return { screen: SCREEN_WIN, best: world.state.score };
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'gold') {
    for (let index = 0; index < GOLD_SECONDS / STEP; index += 1) {
      goodPilot(world);
      const events = world.step(STEP, false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    // Stage the showcase: golden crumb, star crumb and shield on healthy pads near
    // the duckling, and a combo already running, so the HUD shows what the new rules pay.
    stageShowcase(world);
    world.state.combo = Math.max(world.state.combo, 3);
    // Let the pilot chase the star so Fever starts for real and the HUD shows it.
    // Break before the score can reach 300 and turn the frame into a win panel.
    for (let index = 0; index < 10 / STEP; index += 1) {
      goodPilot(world);
      const events = world.step(STEP, false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
      if (world.state.fever > 0 || world.state.score >= 290) break;
    }
    for (let index = 0; index < 2; index += 1) world.step(STEP, false);
    if (world.state.won) return { screen: SCREEN_WIN, best: world.state.score };
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const pilot = name === 'end' ? badPilot : goodPilot;
  for (let index = 0; index < limit / STEP; index += 1) {
    pilot(world);
    const events = world.step(STEP, false);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  if (world.state.won) return { screen: SCREEN_WIN, best: world.state.score };
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
