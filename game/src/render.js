// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. Every
// creature is drawn on the canvas: the yellow duckling, the green lily pads, the grey heron, the
// orange cat and the turtle that blocks a pad. The pond ages as the level rises — day, then a
// warm dusk, then night with a moon and fireflies — so a late game looks nothing like the
// opening. Animation time comes from the world's elapsed clock, so a staged screenshot always
// paints the same frame.
import { DRAGONFLY, DUCK_SCALE, FEVER, FIELD, FISH, FONT, HOME_PAD, LEVEL_NAMES, LIVES, PALETTE, PALETTE_DUSK, PALETTE_NIGHT } from './config.js';
import { PAD_GONE, PAD_HEALTHY, PAD_REGROW, PAD_SINKING, PAD_WOBBLE } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The panel's width; its height grows with its lines: room for the title, the lines and the prompt. */
const PANEL = { width: 660, top: 110, line: 28, bottom: 56 };
const BANK_BOTTOM = 96;

/** Blend two hex colours by t (0 = a, 1 = b). */
function lerpColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return `rgb(${r},${g},${bl})`;
}

/**
 * The pond's look for a level: day (1-2), warm dusk (3), night (4+). The blend is
 * two-stage so dusk really is orange before the night turns indigo.
 */
function themeFor(level) {
  const day = PALETTE;
  const dusk = PALETTE_DUSK;
  const night = PALETTE_NIGHT;
  const t = level <= 2 ? 0 : level === 3 ? 0.5 : 1;
  const from = t <= 0.5 ? day : dusk;
  const to = t <= 0.5 ? dusk : night;
  const k = t <= 0.5 ? t * 2 : (t - 0.5) * 2;
  return {
    sky: lerpColor(from.sky, to.sky, k),
    skyTop: lerpColor(from.skyTop, to.skyTop, k),
    bank: lerpColor(from.bank, to.bank, k),
    bankDark: lerpColor(from.bankDark, to.bankDark, k),
    water: lerpColor(from.water, to.water, k),
    waterDeep: lerpColor(from.waterDeep, to.waterDeep, k),
    pad: lerpColor(from.pad, to.pad, k),
    padDark: lerpColor(from.padDark, to.padDark, k),
    night: t,
  };
}

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

/** A deterministic 0..1 wobble for `seed` at time `t` (no Math.random in the renderer). */
function wob(seed, t) {
  return (Math.sin(seed * 12.9898 + t * 1.7) + 1) / 2;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const levelLabel = cachedLabel('Level ');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  /** Screen shake, set by shake() on a hit and decaying every frame. */
  let shake = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight ?? ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ?? ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function circle(x, y, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }

  function ellipse(x, y, rx, ry, color) {
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
  }

  function drawBackground(state, theme) {
    const t = state.elapsed;
    const sky = context.createLinearGradient(0, 0, 0, BANK_BOTTOM + 40);
    sky.addColorStop(0, theme.skyTop);
    sky.addColorStop(1, theme.sky);
    context.fillStyle = sky;
    context.fillRect(0, 0, FIELD.width, BANK_BOTTOM + 40);
    const water = context.createLinearGradient(0, BANK_BOTTOM, 0, FIELD.height);
    water.addColorStop(0, theme.water);
    water.addColorStop(1, theme.waterDeep);
    context.fillStyle = water;
    context.fillRect(0, BANK_BOTTOM, FIELD.width, FIELD.height - BANK_BOTTOM);

    // The grassy bank.
    context.fillStyle = theme.bank;
    context.fillRect(0, 0, FIELD.width, BANK_BOTTOM);
    context.fillStyle = theme.bankDark;
    context.fillRect(0, BANK_BOTTOM - 10, FIELD.width, 10);

    // The bank: day has drifting clouds, dusk a low sun, night a moon and stars.
    // (Drawn after the bank rect, or the bank would paint over them.)
    if (theme.night >= 1) {
      // Moon and stars over the night bank.
      circle(1120, 48, 26, '#f5eeda');
      circle(1112, 42, 22, theme.bank);
      for (let index = 0; index < 26; index += 1) {
        const sx = 30 + ((index * 173) % 1180);
        const sy = 10 + ((index * 97) % 70);
        const a = 0.35 + 0.5 * wob(index + 200, t);
        context.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
        context.beginPath();
        context.arc(sx, sy, 1.8, 0, Math.PI * 2);
        context.fill();
      }
    } else if (theme.night >= 0.5) {
      // A low orange sun setting over the dusk bank.
      circle(1120, 58, 30, '#ff9d5c');
      circle(1120, 58, 22, '#ffc27a');
    } else {
      // Soft clouds drifting over the bank.
      context.fillStyle = 'rgba(255,255,255,0.75)';
      for (let index = 0; index < 4; index += 1) {
        const cx = ((index * 340 + t * 8) % (FIELD.width + 240)) - 120;
        const cy = 26 + index * 14;
        ellipse(cx, cy, 52, 15, 'rgba(255,255,255,0.8)');
        ellipse(cx + 34, cy + 5, 36, 12, 'rgba(255,255,255,0.8)');
      }
    }
    // Reeds and little flowers along the bank.
    for (let index = 0; index < 14; index += 1) {
      const rx = 40 + index * 92 + wob(index, 0) * 20;
      const sway = Math.sin(t * 0.9 + index) * 3;
      context.strokeStyle = theme.bankDark;
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(rx, BANK_BOTTOM - 6);
      context.quadraticCurveTo(rx + sway, BANK_BOTTOM - 34, rx + sway * 2, BANK_BOTTOM - 52 - (index % 3) * 8);
      context.stroke();
      if (index % 4 === 1) circle(rx + sway * 2, BANK_BOTTOM - 56 - (index % 3) * 8, 5, PALETTE.flower);
    }

    // Water sparkles, fixed spots that shimmer with the clock.
    for (let index = 0; index < 26; index += 1) {
      const sx = 30 + ((index * 197) % 1220);
      const sy = 130 + ((index * 131) % 560);
      const a = 0.12 + 0.2 * wob(index + 40, t);
      context.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      context.beginPath();
      context.ellipse(sx, sy, 7, 2.4, 0, 0, Math.PI * 2);
      context.fill();
    }

    // Fireflies over the water once the pond deepens (level 3): dusk is coming,
    // and at night they are everywhere.
    if (state.level >= 3) {
      const count = state.level >= 4 ? 22 : 12;
      for (let index = 0; index < count; index += 1) {
        const fx = 60 + ((index * 211) % 1160) + Math.sin(t * 0.6 + index * 2.4) * 18;
        const fy = 150 + ((index * 167) % 480) + Math.cos(t * 0.8 + index) * 12;
        const a = 0.35 + 0.6 * wob(index + 90, t * 1.3);
        context.fillStyle = `rgba(216,247,154,${a.toFixed(3)})`;
        context.beginPath();
        context.arc(fx, fy, 3.6, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  /** Dragonflies flitting over the pond (visual only), from level 2. */
  function drawDragonflies(state) {
    if (state.level < 2) return;
    const t = state.elapsed;
    for (let index = 0; index < DRAGONFLY.count; index += 1) {
      const x = ((index * 431 + t * 46 * DRAGONFLY.speed * (index + 1)) % (FIELD.width + 120)) - 60;
      const y = 150 + ((index * 173) % 380) + Math.sin(t * 1.4 + index * 2.1) * 26;
      const dir = Math.sin(t * 0.9 + index * 3) >= 0 ? 1 : -1;
      context.save();
      context.translate(x, y);
      context.scale(dir, 1);
      // Wings, shimmering.
      context.fillStyle = 'rgba(159,216,255,0.75)';
      context.beginPath();
      context.ellipse(-2, -8, 12, 3.5, -0.5, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.ellipse(-2, 6, 12, 3.5, 0.5, 0, Math.PI * 2);
      context.fill();
      // Body.
      context.fillStyle = PALETTE.dragonfly;
      context.beginPath();
      context.ellipse(0, 0, 14, 2.5, 0, 0, Math.PI * 2);
      context.fill();
      circle(13, 0, 3, '#23402a');
      context.restore();
    }
  }

  function drawRipple(x, y, r, color, width) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.stroke();
  }

  function drawPad(pad, index, t, theme) {
    if (pad.state === PAD_GONE) {
      const r = 14 + ((t * 22 + index * 17) % 44);
      drawRipple(pad.x, pad.y, r, 'rgba(191,232,224,0.5)', 2);
      drawRipple(pad.x, pad.y, r * 0.6, 'rgba(191,232,224,0.35)', 2);
      return;
    }
    let x = pad.x;
    let y = pad.y;
    let color = theme.pad;
    if (pad.state === PAD_WOBBLE) {
      x += Math.sin(t * 16 + index) * 4;
      color = PALETTE.padWobble;
    } else if (pad.state === PAD_SINKING) {
      y += 12;
      color = theme.padDark;
    } else if (pad.state === PAD_REGROW) {
      context.strokeStyle = theme.pad;
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(x, y);
      context.quadraticCurveTo(x - 8, y - 14, x - 14, y - 20);
      context.moveTo(x, y);
      context.quadraticCurveTo(x + 8, y - 14, x + 14, y - 20);
      context.stroke();
      drawRipple(x, y, 12 + ((t * 18) % 20), 'rgba(191,232,224,0.45)', 2);
      return;
    }
    // The pad: a circle with a wedge notch, a lighter rim and vein lines.
    // Each pad's notch points its own way, and its size is its own.
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, pad.radius, pad.notch + 0.35, pad.notch + Math.PI * 2 - 0.35);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x, y, pad.radius - 4, pad.notch + 0.5, pad.notch + Math.PI * 2 - 0.5);
    context.stroke();
    context.strokeStyle = 'rgba(0,0,0,0.12)';
    context.lineWidth = 2;
    for (let vein = 0; vein < 3; vein += 1) {
      const a = pad.notch + 0.9 + vein * 1.1;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(a) * (pad.radius - 8), y + Math.sin(a) * (pad.radius - 8));
      context.stroke();
    }
    if (pad.flower) {
      for (let petal = 0; petal < 5; petal += 1) {
        const a = (petal / 5) * Math.PI * 2 + t * 0.05;
        ellipse(x + Math.cos(a) * 9, y - 12 + Math.sin(a) * 9, 7, 4, PALETTE.flower);
      }
      circle(x, y - 12, 5, '#ffd93b');
    }
    if (pad.hasCrumb) {
      const sparkle = 0.6 + 0.4 * Math.sin(t * 5 + index);
      circle(x - 10, y + 4, 5, PALETTE.crumb);
      circle(x + 2, y + 10, 4, PALETTE.crumbLight);
      circle(x + 11, y - 2, 4, PALETTE.crumb);
      context.fillStyle = `rgba(255,255,255,${sparkle.toFixed(2)})`;
      context.beginPath();
      context.moveTo(x + 2, y - 22);
      context.lineTo(x + 5, y - 14);
      context.lineTo(x + 13, y - 14);
      context.lineTo(x + 7, y - 9);
      context.lineTo(x + 9, y - 1);
      context.lineTo(x + 2, y - 6);
      context.lineTo(x - 5, y - 1);
      context.lineTo(x - 3, y - 9);
      context.lineTo(x - 9, y - 14);
      context.lineTo(x - 1, y - 14);
      context.closePath();
      context.fill();
    }
    if (pad.hasGolden) {
      // The golden crumb: bigger, brighter, worth 50, with a pulsing halo.
      const pulse = 0.5 + 0.3 * Math.sin(t * 6 + index);
      context.fillStyle = `rgba(255,217,77,${pulse.toFixed(2)})`;
      context.beginPath();
      context.arc(x, y, 20, 0, Math.PI * 2);
      context.fill();
      circle(x - 9, y + 5, 7, PALETTE.gold);
      circle(x + 4, y + 11, 6, PALETTE.goldBright);
      circle(x + 11, y - 3, 6, PALETTE.gold);
      circle(x, y - 2, 4, '#fff3c4');
      text('50', x, y - 26, 18, PALETTE.goldBright, 'center', 'bold ');
    }
    if (pad.hasStar) {
      // The star crumb: worth 100 and starts Fever (double points) — the brightest thing on the pond.
      const pulse = 0.55 + 0.35 * Math.sin(t * 7 + index);
      context.fillStyle = `rgba(255,243,196,${pulse.toFixed(2)})`;
      context.beginPath();
      context.arc(x, y, 26, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.goldBright;
      context.beginPath();
      for (let point = 0; point < 5; point += 1) {
        const a = -Math.PI / 2 + (point / 5) * Math.PI * 2;
        const a2 = a + Math.PI / 5;
        context.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13);
        context.lineTo(x + Math.cos(a2) * 5.5, y + Math.sin(a2) * 5.5);
      }
      context.closePath();
      context.fill();
      text('100', x, y - 30, 18, PALETTE.goldBright, 'center', 'bold ');
    }
    if (pad.hasShield) {
      // The shield bubble: a blue sphere with a bright glint, bobbing gently.
      const bob = Math.sin(t * 3 + index) * 3;
      context.fillStyle = 'rgba(127,212,255,0.45)';
      context.beginPath();
      context.arc(x, y - 14 + bob, 16, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.shield;
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(x, y - 14 + bob, 16, 0, Math.PI * 2);
      context.stroke();
      circle(x - 5, y - 19 + bob, 4, '#ffffff');
    }
    if (pad.state === PAD_WOBBLE) {
      text('!', x, y - pad.radius - 8, 26, PALETTE.danger, 'center', 'bold ');
    }
  }

  function drawHomePad(t, theme) {
    const x = HOME_PAD.x;
    const y = HOME_PAD.y;
    context.fillStyle = theme.pad;
    context.beginPath();
    context.arc(x, y, HOME_PAD.radius, 0.35, Math.PI * 2 - 0.35);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x, y, HOME_PAD.radius - 4, 0.5, Math.PI * 2 - 0.5);
    context.stroke();
    // The nest: a ring of twigs on the pad.
    context.strokeStyle = '#8a5a2b';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(x, y, 26, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = '#c98d4b';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x, y, 20, 0.4, Math.PI * 2 - 0.4);
    context.stroke();
    drawRipple(x, y, HOME_PAD.radius + 8 + ((t * 14) % 18), 'rgba(191,232,224,0.3)', 2);
  }

  /** The turtle that blocks a pad: a shell and a head, with a warning while it surfaces. */
  function drawTurtle(state) {
    const turtle = state.turtle;
    if (!turtle.active || turtle.pad < 0) return;
    const pad = state.pads[turtle.pad];
    const x = pad.x;
    const y = pad.y;
    const t = state.elapsed;
    if (turtle.warn) {
      text('!', x, y - pad.radius - 10, 30, PALETTE.danger, 'center', 'bold ');
      drawRipple(x, y, pad.radius + 6 + ((t * 20) % 16), 'rgba(217,79,61,0.7)', 3);
      return;
    }
    // Shell.
    ellipse(x, y - 4, 26, 18, PALETTE.turtle);
    ellipse(x, y - 8, 20, 12, PALETTE.turtleDark);
    context.strokeStyle = 'rgba(255,255,255,0.25)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y - 4, 18, Math.PI, Math.PI * 2);
    context.stroke();
    // Head, peeking out toward the duckling.
    const dir = state.duckling.x >= x ? 1 : -1;
    circle(x + dir * 26, y - 10, 8, PALETTE.turtle);
    circle(x + dir * 29, y - 12, 2, '#23402a');
  }

  function drawDuckling(state) {
    const duck = state.duckling;
    const t = state.elapsed;
    let groundX = duck.x;
    let groundY = duck.y;
    let height = 0;
    if (duck.hop !== null) {
      const hop = duck.hop;
      const k = Math.min(1, hop.t / hop.dur);
      groundX = hop.fromX + (hop.toX - hop.fromX) * k;
      groundY = hop.fromY + (hop.toY - hop.fromY) * k;
      height = Math.sin(k * Math.PI) * 55;
      // A trail of ripples along the hop arc, fading behind the duckling.
      for (let step = 1; step <= 3; step += 1) {
        const kk = k - step * 0.14;
        if (kk <= 0) continue;
        const tx = hop.fromX + (hop.toX - hop.fromX) * kk;
        const ty = hop.fromY + (hop.toY - hop.fromY) * kk - Math.sin(kk * Math.PI) * 55;
        drawRipple(tx, ty + 14, 8 + step * 3, `rgba(191,232,224,${(0.5 - step * 0.12).toFixed(2)})`, 2);
      }
    }
    // Shadow on the water below.
    ellipse(groundX, groundY + 16, 26 - height * 0.18, 7, 'rgba(0,0,0,0.22)');
    const scale = (1 + height / 500) * DUCK_SCALE;
    const x = duck.x;
    const y = duck.y;
    // Blink while invulnerable after a hit: hidden on every other tenth of a second.
    if (duck.invulnerable !== 0 && Math.floor(duck.invulnerable * 10) % 2 === 0) return;
    // Fever glow: a golden aura while points are doubled.
    if (state.fever > 0) {
      context.fillStyle = `rgba(255,217,77,${(0.22 + 0.1 * Math.sin(t * 8)).toFixed(2)})`;
      context.beginPath();
      context.arc(x, y, 44, 0, Math.PI * 2);
      context.fill();
    } else if (state.combo >= 3) {
      context.strokeStyle = 'rgba(255,217,77,0.55)';
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(x, y, 40 + Math.sin(t * 5) * 2, 0, Math.PI * 2);
      context.stroke();
    }
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    // Feet.
    ellipse(-9, 20, 8, 4, PALETTE.beak);
    ellipse(9, 20, 8, 4, PALETTE.beak);
    // Body.
    ellipse(0, 4, 24, 19, PALETTE.duck);
    // Wing.
    context.fillStyle = PALETTE.duckDark;
    context.beginPath();
    context.ellipse(-duck.facing * 12, 2, 11, 7, -0.4 * duck.facing, 0, Math.PI * 2);
    context.fill();
    // Head.
    circle(duck.facing * 8, -18, 15, PALETTE.duck);
    // Beak.
    context.fillStyle = PALETTE.beak;
    context.beginPath();
    context.moveTo(duck.facing * 20, -20);
    context.lineTo(duck.facing * 32, -15);
    context.lineTo(duck.facing * 20, -11);
    context.closePath();
    context.fill();
    // Eye.
    circle(duck.facing * 12, -22, 3.4, '#23402a');
    circle(duck.facing * 13, -23, 1.2, '#ffffff');
    // A tuft on top.
    context.strokeStyle = PALETTE.duckDark;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(duck.facing * 4, -31);
    context.quadraticCurveTo(duck.facing * 2, -38, duck.facing * 6, -39);
    context.stroke();
    context.restore();
    // The held shield: a blue ring around the duckling that absorbs the next hit.
    if (state.shield) {
      context.strokeStyle = PALETTE.shield;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x, y, 36 + Math.sin(t * 4) * 2, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = 'rgba(127,212,255,0.18)';
      context.beginPath();
      context.arc(x, y, 36 + Math.sin(t * 4) * 2, 0, Math.PI * 2);
      context.fill();
    }
    void t;
  }

  /** The leaping fish: an orange arc out of the water, with a splash ring on landing. */
  function drawFish(state) {
    const fish = state.fish;
    if (!fish.active) return;
    const k = Math.min(1, fish.t / FISH.leap);
    const y = fish.y - Math.sin(k * Math.PI) * 70;
    const x = fish.x + k * 40;
    if (k > 0.9) drawRipple(fish.x + 40, fish.y, 10 + (k - 0.9) * 120, 'rgba(191,232,224,0.6)', 2);
    context.save();
    context.translate(x, y);
    context.rotate(-0.5 + k * 1.0);
    ellipse(0, 0, 18, 8, PALETTE.fish);
    context.fillStyle = PALETTE.fish;
    context.beginPath();
    context.moveTo(-16, 0);
    context.lineTo(-26, -8);
    context.lineTo(-26, 8);
    context.closePath();
    context.fill();
    circle(8, -2, 2, '#23402a');
    context.restore();
  }

  function drawHeron(state) {
    const heron = state.heron;
    const t = state.elapsed;
    if (heron.state === 'perch') {
      // Perched on the bank, watching the pond.
      ellipse(heron.x, 92, 30, 6, 'rgba(0,0,0,0.18)');
      context.fillStyle = PALETTE.heron;
      context.beginPath();
      context.ellipse(heron.x, heron.y + 16, 13, 20, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.heron;
      context.lineWidth = 7;
      context.beginPath();
      context.moveTo(heron.x, heron.y + 2);
      context.quadraticCurveTo(heron.x + 14, heron.y - 8, heron.x + 22, heron.y - 2);
      context.stroke();
      circle(heron.x + 26, heron.y - 2, 8, PALETTE.heron);
      context.fillStyle = '#f2c94c';
      context.beginPath();
      context.moveTo(heron.x + 32, heron.y - 4);
      context.lineTo(heron.x + 48, heron.y - 1);
      context.lineTo(heron.x + 32, heron.y + 2);
      context.closePath();
      context.fill();
      circle(heron.x + 28, heron.y - 4, 2, '#23402a');
      return;
    }
    // Flying, hovering or swooping: wings out, long neck, legs trailing.
    // The swoop is the scary part, so the heron grows and streaks as it dives.
    const swooping = heron.state === 'swoop';
    const swoopScale = swooping ? 1.25 : 1;
    const flying = heron.state === 'fly' || heron.state === 'return';
    const flap = flying ? Math.sin(t * 14) * 0.5 : 0.25;
    const shadowY = heron.state === 'hover' ? heron.y + 78 : heron.y + 60;
    ellipse(heron.x, shadowY, 30, 6, 'rgba(0,0,0,0.18)');
    if (heron.state === 'hover') {
      drawRipple(heron.x, heron.y + 78, 34, 'rgba(217,79,61,0.65)', 3);
      drawRipple(heron.x, heron.y + 78, 22, 'rgba(217,79,61,0.4)', 2);
      text('!', heron.x, heron.y + 46, 30, PALETTE.danger, 'center', 'bold ');
    }
    if (swooping) {
      // Speed lines streaking behind the diving heron.
      context.strokeStyle = 'rgba(255,255,255,0.55)';
      context.lineWidth = 3;
      for (let line = 0; line < 3; line += 1) {
        const ly = heron.y - 24 + line * 20;
        context.beginPath();
        context.moveTo(heron.x - 52, ly);
        context.lineTo(heron.x - 84 - line * 8, ly - 6);
        context.stroke();
      }
    }
    context.save();
    context.translate(heron.x, heron.y);
    context.scale(swoopScale, swoopScale);
    // Wings.
    context.fillStyle = PALETTE.heronDark;
    context.beginPath();
    context.ellipse(-16, -6 - flap * 14, 26, 9, -0.5 - flap * 0.4, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(16, -6 - flap * 14, 26, 9, 0.5 + flap * 0.4, 0, Math.PI * 2);
    context.fill();
    // Body.
    context.fillStyle = PALETTE.heron;
    context.beginPath();
    context.ellipse(0, 0, 26, 13, 0, 0, Math.PI * 2);
    context.fill();
    // Neck and head, reaching forward and down when swooping.
    const dive = heron.state === 'swoop' || heron.state === 'stand' ? 1 : 0;
    context.strokeStyle = PALETTE.heron;
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(20, -4);
    context.quadraticCurveTo(34, -12 + dive * 14, 40, -2 + dive * 16);
    context.stroke();
    circle(42, -2 + dive * 16, 8, PALETTE.heron);
    context.fillStyle = '#f2c94c';
    context.beginPath();
    context.moveTo(48, -4 + dive * 16);
    context.lineTo(64, -1 + dive * 16);
    context.lineTo(48, 1 + dive * 16);
    context.closePath();
    context.fill();
    circle(44, -4 + dive * 16, 2, '#23402a');
    // Legs trailing behind when flying, planted when standing.
    context.strokeStyle = PALETTE.heronDark;
    context.lineWidth = 3;
    if (heron.state === 'stand') {
      context.beginPath();
      context.moveTo(-6, 10);
      context.lineTo(-8, 30);
      context.moveTo(6, 10);
      context.lineTo(8, 30);
      context.stroke();
    } else {
      context.beginPath();
      context.moveTo(-14, 8);
      context.lineTo(-22, 18);
      context.moveTo(-6, 10);
      context.lineTo(-12, 20);
      context.stroke();
    }
    context.restore();
  }

  function drawCat(state) {
    const cat = state.cat;
    if (cat.state === 'hidden') return;
    const t = state.elapsed;
    const leaping = cat.state === 'leap' || cat.state === 'return';
    context.save();
    context.translate(cat.x, cat.y);
    if (leaping) context.scale(1.25, 0.8);
    // Tail.
    context.strokeStyle = PALETTE.catDark;
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(-18, 2);
    context.quadraticCurveTo(-30, -14 + Math.sin(t * 6) * 4, -22, -24);
    context.stroke();
    // Body.
    ellipse(0, 0, 22, 14, PALETTE.cat);
    // Head.
    circle(18, -12, 12, PALETTE.cat);
    // Ears.
    context.fillStyle = PALETTE.cat;
    context.beginPath();
    context.moveTo(10, -20);
    context.lineTo(12, -30);
    context.lineTo(18, -22);
    context.closePath();
    context.moveTo(22, -22);
    context.lineTo(26, -30);
    context.lineTo(28, -20);
    context.closePath();
    context.fill();
    // Stripes.
    context.strokeStyle = PALETTE.catDark;
    context.lineWidth = 3;
    for (let stripe = 0; stripe < 3; stripe += 1) {
      context.beginPath();
      context.moveTo(-10 + stripe * 8, -10);
      context.lineTo(-8 + stripe * 8, 6);
      context.stroke();
    }
    // Eye and nose.
    circle(22, -14, 2.4, '#23402a');
    circle(30, -10, 2.4, '#d94f3d');
    // Whiskers.
    context.strokeStyle = 'rgba(255,255,255,0.8)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(28, -10);
    context.lineTo(40, -13);
    context.moveTo(28, -8);
    context.lineTo(40, -6);
    context.stroke();
    context.restore();
    if (cat.state === 'crouch') {
      text('!', cat.x, cat.y - 42, 30, PALETTE.danger, 'center', 'bold ');
    }
    void t;
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    // A soft dark shadow under the HUD text, so it reads over clouds, water and pads.
    context.shadowColor = 'rgba(0,0,0,0.4)';
    context.shadowBlur = 5;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 1;
    text(scoreLabel(state.score), 24, 18, 28, '#ffffff', 'left', 'bold ');
    text(`${levelLabel(state.level)} · ${LEVEL_NAMES[Math.min(state.level, 8)] ?? ''}`, FIELD.width / 2, 18, 28, '#ffffff', 'center', 'bold ');
    // The combo: crumbs in a row pay more, so the streak is worth showing.
    if (state.combo >= 2) {
      text(`Combo x${Math.min(state.combo, 3)}`, 24, 52, 24, PALETTE.goldBright, 'left', 'bold ');
    }
    // Fever: double points while the timer runs, with a bar that drains.
    if (state.fever > 0) {
      text('FEVER x2', 24, 84, 24, PALETTE.goldBright, 'left', 'bold ');
      context.fillStyle = 'rgba(255,255,255,0.3)';
      context.fillRect(24, 112, 120, 8);
      context.fillStyle = PALETTE.goldBright;
      context.fillRect(24, 112, 120 * Math.max(0, state.fever / FEVER.duration), 8);
    }
    if (state.shield) {
      text('Shield', FIELD.width / 2, 52, 24, PALETTE.shield, 'center', 'bold ');
    }
    const firstLife = FIELD.width - 24 - LIVES * 34;
    text('Lives', firstLife - 12, 18, 28, '#ffffff', 'right', 'bold ');
    for (let life = 0; life < LIVES; life += 1) {
      const lx = firstLife + life * 34 + 12;
      if (life < state.lives) {
        circle(lx, 32, 11, PALETTE.duck);
        circle(lx + 5, 29, 2, '#23402a');
        context.fillStyle = PALETTE.beak;
        context.beginPath();
        context.moveTo(lx + 10, 31);
        context.lineTo(lx + 17, 33);
        context.lineTo(lx + 10, 35);
        context.closePath();
        context.fill();
      } else {
        circle(lx, 32, 11, 'rgba(255,255,255,0.25)');
      }
    }
    // Clear the shadow so panel text (drawn after the HUD) stays crisp.
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    // A lighter veil than v2, so the living pond shows through behind the panel.
    context.fillStyle = 'rgba(14,42,36,0.28)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 4;
    context.strokeRect(x + 2, y + 2, PANEL.width - 4, height - 4);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 46, PALETTE.text, 'center', 'bold ');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 23, PALETTE.gold, 'center', 'bold ');
  }

  const TITLE_LINES = [
    'Hop the lily pads. Eat the breadcrumbs.',
    'Crumbs in a row build a combo — up to x3 points!',
    'Golden crumbs are worth 50. Star crumbs start FEVER!',
    'A shield bubble takes one hit. A turtle blocks a pad!',
    'The heron swoops at your pad — hop away!',
    'From level 3, the cat leaps too. From level 4, pads drift.',
    'Arrows / WASD or click a pad to hop. P pauses, M mutes.',
    '',
  ];
  const PAUSED_LINES = ['The heron will wait for you.'];
  const OVER_LINES = ['', ''];
  const WIN_LINES = ['You reached 300 points — Pond Champion!', '', ''];

  /** Paint one frame: the pond, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, particles) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Screen shake: a hit jolts the whole pond for a few frames.
    const shx = shake > 0.3 ? Math.sin(state.elapsed * 91) * shake : 0;
    const shy = shake > 0.3 ? Math.cos(state.elapsed * 77) * shake : 0;
    shake *= 0.86;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shx * view.scale, view.y + shy * view.scale);
    const theme = themeFor(state.level);
    drawBackground(state, theme);
    drawDragonflies(state);
    drawHomePad(state.elapsed, theme);
    for (let index = 0; index < state.pads.length; index += 1) drawPad(state.pads[index], index, state.elapsed, theme);
    drawTurtle(state);
    drawFish(state);
    drawHeron(state);
    drawCat(state);
    drawDuckling(state);
    if (particles) particles.draw(context);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[7] = bestLabel(best);
      drawPanel('Duckling Pond Dash', TITLE_LINES, 'Press Enter or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      drawPanel('Game over', OVER_LINES, 'Press R or click to play again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[1] = finalLabel(state.score);
      WIN_LINES[2] = bestLabel(best);
      drawPanel('Pond Champion!', WIN_LINES, 'Press R or click to play again');
    }
  }

  /** A client-space pointer position as playfield coordinates. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return { x: (x - view.x) / view.scale, y: (y - view.y) / view.scale };
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    toField,
    /** Jolt the pond (a hit just landed). */
    shake(amount) {
      shake = Math.max(shake, amount);
    },
  };
}
