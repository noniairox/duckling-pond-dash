// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, paused, game over and win.
//
// ?seed=N fixes the pond's pattern. ?shot=start|play|gold|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { BEST_KEY, LIVES, STEP, WIN_SCORE } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BREAK, EVENT_CRUMB, EVENT_FEVER, EVENT_GOLD, EVENT_HIT, EVENT_LEVEL, EVENT_OVER, EVENT_SHIELD, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createSound } from './sound.js';
import { createParticles } from './particles.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const particles = createParticles(world.random);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__shot = { screen: scene.screen, best: scene.best, score: world.state.score, lives: world.state.lives, level: world.state.level };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, particles);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const sound = createSound();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    input.clear();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${LIVES} lives. Collect breadcrumbs, dodge the heron.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function winGame() {
    screen = SCREEN_WIN;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`You win! Pond Champion. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = sound.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function handleHops() {
    if (screen !== SCREEN_PLAY) return;
    let hop = input.takeHop();
    while (hop !== null) {
      if (world.hopDir(hop.dx, hop.dy)) sound.hop();
      hop = input.takeHop();
    }
    for (const click of input.takeClicks()) {
      const field = renderer.toField(click.x, click.y);
      if (world.hopToPoint(field.x, field.y)) sound.hop();
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, true);
      particles.update(STEP);
      return;
    }
    const turtleWasActive = world.state.turtle.active;
    const events = world.step(STEP, false);
    particles.update(STEP);
    // The turtle just surfaced on a pad: a low plop.
    if (!turtleWasActive && world.state.turtle.active) sound.turtle();
    const duck = world.state.duckling;
    // A floating "+points" popup where the gain happened.
    const gain = world.state.lastGain;
    if (gain !== null) {
      particles.popup(gain.x, gain.y, gain.label ?? `+${gain.points}`, gain.label ? '#ffd94d' : '#ffffff');
    }
    if (events & EVENT_CRUMB) {
      sound.crumb(world.state.combo);
      particles.burst(duck.x, duck.y - 10, '#ffd93b', 10, 120);
    }
    if (events & EVENT_GOLD) {
      sound.gold();
      particles.burst(duck.x, duck.y - 10, '#ffd94d', 18, 170);
      announce(`Golden crumb! +50. Combo x${Math.min(world.state.combo, 3)}.`);
    }
    if (events & EVENT_FEVER) {
      sound.star();
      particles.burst(duck.x, duck.y - 10, '#ffd94d', 26, 220);
      particles.ring(duck.x, duck.y, 'rgba(255,217,77,0.9)');
      announce('Star crumb! FEVER — double points for 8 seconds!');
    }
    if (events & EVENT_SHIELD) {
      sound.shield();
      particles.ring(duck.x, duck.y, 'rgba(127,212,255,0.9)');
      announce('Shield up — it takes the next hit.');
    }
    if (events & EVENT_BREAK) {
      sound.breakShield();
      particles.ring(duck.x, duck.y, 'rgba(127,212,255,0.9)');
      announce('Shield broke — it saved a life!');
    }
    if (events & EVENT_LEVEL) {
      sound.level();
      announce(`Level ${world.state.level}.`);
    }
    if (events & EVENT_HIT) {
      renderer.shake(7);
      if (world.state.lives === 0) {
        sound.caught();
        particles.feathers(duck.x, duck.y);
      } else {
        sound.splash();
        particles.splash(duck.x, duck.y);
        particles.feathers(duck.x, duck.y - 10);
      }
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_WIN) {
      sound.win();
      winGame();
    } else if (events & EVENT_OVER) {
      sound.caught();
      endGame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    handleHops();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, particles);
  }

  // Leaving the tab pauses a running game rather than letting the heron swoop unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce(`Duckling Pond Dash. Press Enter or click to start. Reach ${WIN_SCORE} points to win.`);
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
