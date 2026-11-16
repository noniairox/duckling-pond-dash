// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. Every
// creature is drawn on the canvas: the yellow duckling, the green lily pads, the grey heron and
// the orange cat. Animation time comes from the world's elapsed clock, so a staged screenshot
// always paints the same frame.
import { FIELD, FISH, FONT, HOME_PAD, LIVES, PALETTE } from './config.js';
import { PAD_GONE, PAD_HEALTHY, PAD_REGROW, PAD_SINKING, PAD_WOBBLE } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The panel's width; its height grows with its lines: room for the title, the lines and the prompt. */
const PANEL = { width: 640, top: 128, line: 32, bottom: 66 };
const BANK_BOTTOM = 96;

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

  function drawBackground(state) {
    const t = state.elapsed;
    const sky = context.createLinearGradient(0, 0, 0, BANK_BOTTOM + 40);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(1, PALETTE.sky);
    context.fillStyle = sky;
    context.fillRect(0, 0, FIELD.width, BANK_BOTTOM + 40);
    const water = context.createLinearGradient(0, BANK_BOTTOM, 0, FIELD.height);
    water.addColorStop(0, PALETTE.water);
    water.addColorStop(1, PALETTE.waterDeep);
    context.fillStyle = water;
    context.fillRect(0, BANK_BOTTOM, FIELD.width, FIELD.height - BANK_BOTTOM);

    // Soft clouds drifting over the bank.
    context.fillStyle = 'rgba(255,255,255,0.75)';
    for (let index = 0; index < 4; index += 1) {
      const cx = ((index * 340 + t * 8) % (FIELD.width + 240)) - 120;
      const cy = 26 + index * 14;
      ellipse(cx, cy, 52, 15, 'rgba(255,255,255,0.8)');
      ellipse(cx + 34, cy + 5, 36, 12, 'rgba(255,255,255,0.8)');
    }

    // The grassy bank.
    context.fillStyle = PALETTE.bank;
    context.fillRect(0, 0, FIELD.width, BANK_BOTTOM);
    context.fillStyle = PALETTE.bankDark;
    context.fillRect(0, BANK_BOTTOM - 10, FIELD.width, 10);
    // Reeds and little flowers along the bank.
    for (let index = 0; index < 14; index += 1) {
      const rx = 40 + index * 92 + wob(index, 0) * 20;
      const sway = Math.sin(t * 0.9 + index) * 3;
      context.strokeStyle = PALETTE.bankDark;
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

    // Fireflies over the water once the pond deepens (level 3): dusk is coming.
    if (state.level >= 3) {
      for (let index = 0; index < 12; index += 1) {
        const fx = 60 + ((index * 211) % 1160) + Math.sin(t * 0.6 + index * 2.4) * 18;
        const fy = 150 + ((index * 167) % 480) + Math.cos(t * 0.8 + index) * 12;
        const a = 0.25 + 0.55 * wob(index + 90, t * 1.3);
        context.fillStyle = `rgba(216,247,154,${a.toFixed(3)})`;
        context.beginPath();
        context.arc(fx, fy, 3.2, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawRipple(x, y, r, color, width) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.stroke();
  }

  function drawPad(pad, index, t) {
    if (pad.state === PAD_GONE) {
      const r = 14 + ((t * 22 + index * 17) % 44);
      drawRipple(pad.x, pad.y, r, 'rgba(191,232,224,0.5)', 2);
      drawRipple(pad.x, pad.y, r * 0.6, 'rgba(191,232,224,0.35)', 2);
      return;
    }
    let x = pad.x;
    let y = pad.y;
    let color = PALETTE.pad;
    if (pad.state === PAD_WOBBLE) {
      x += Math.sin(t * 16 + index) * 4;
      color = PALETTE.padWobble;
    } else if (pad.state === PAD_SINKING) {
      y += 12;
      color = PALETTE.padDark;
    } else if (pad.state === PAD_REGROW) {
      context.strokeStyle = PALETTE.pad;
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
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, pad.radius, 0.35, Math.PI * 2 - 0.35);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x, y, pad.radius - 4, 0.5, Math.PI * 2 - 0.5);
    context.stroke();
    context.strokeStyle = 'rgba(0,0,0,0.12)';
    context.lineWidth = 2;
    for (let vein = 0; vein < 3; vein += 1) {
      const a = 0.9 + vein * 1.1;
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

  function drawHomePad(t) {
    const x = HOME_PAD.x;
    const y = HOME_PAD.y;
    context.fillStyle = PALETTE.pad;
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
    }
    // Shadow on the water below.
    ellipse(groundX, groundY + 16, 26 - height * 0.18, 7, 'rgba(0,0,0,0.22)');
    const scale = 1 + height / 500;
    const x = duck.x;
    const y = duck.y;
    // Blink while invulnerable after a hit: hidden on every other tenth of a second.
    if (duck.invulnerable !== 0 && Math.floor(duck.invulnerable * 10) % 2 === 0) return;
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
    const flying = heron.state === 'fly' || heron.state === 'return';
    const flap = flying ? Math.sin(t * 14) * 0.5 : 0.25;
    const shadowY = heron.state === 'hover' ? heron.y + 78 : heron.y + 60;
    ellipse(heron.x, shadowY, 30, 6, 'rgba(0,0,0,0.18)');
    if (heron.state === 'hover') {
      drawRipple(heron.x, heron.y + 78, 34, 'rgba(217,79,61,0.65)', 3);
      text('!', heron.x, heron.y + 46, 30, PALETTE.danger, 'center', 'bold ');
    }
    context.save();
    context.translate(heron.x, heron.y);
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
    text(scoreLabel(state.score), 24, 18, 28, '#ffffff', 'left', 'bold ');
    text(levelLabel(state.level), FIELD.width / 2, 18, 28, '#ffffff', 'center', 'bold ');
    // The combo: crumbs in a row pay more, so the streak is worth showing.
    if (state.combo >= 2) {
      text(`Combo x${Math.min(state.combo, 3)}`, 24, 52, 24, PALETTE.goldBright, 'left', 'bold ');
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
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(14,42,36,0.45)';
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
    'Golden crumbs are worth 50. A shield bubble takes one hit.',
    'The heron swoops at your pad — hop away!',
    'From level 3, the cat leaps from the bank too.',
    'From level 4, some pads drift. A wobbling pad is about to sink.',
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
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawBackground(state);
    drawHomePad(state.elapsed);
    for (let index = 0; index < state.pads.length; index += 1) drawPad(state.pads[index], index, state.elapsed);
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
  return { draw, toField };
}
