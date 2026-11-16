// Juice in a fixed pool: sparkles when a crumb is eaten, a splash when the duckling
// falls in, feathers when it is caught, and a ring when a shield breaks or is picked
// up. No allocation after creation; the seeded random keeps staged screenshots
// repeatable. Kinds: 0 spark, 1 drop (falls with gravity), 2 feather (drifts down),
// 3 ring (an expanding circle, drawn as a stroke).

export function createParticles(random) {
  const MAX = 160;
  const parts = [];
  for (let index = 0; index < MAX; index += 1) {
    parts.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#ffffff', kind: 0, grav: 0 });
  }
  let next = 0;

  function spawn(x, y, vx, vy, life, size, color, kind, grav) {
    const p = parts[next];
    next = (next + 1) % MAX;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.size = size;
    p.color = color;
    p.kind = kind;
    p.grav = grav;
  }

  /** A burst of sparks around (x, y): crumbs, golden crumbs and shield pickups. */
  function burst(x, y, color, count, speed) {
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const v = speed * (0.4 + random() * 0.8);
      spawn(x, y, Math.cos(angle) * v, Math.sin(angle) * v - 30, 0.45 + random() * 0.3, 2 + random() * 3, color, 0, 60);
    }
  }

  /** Droplets thrown up when the duckling splashes into the water. */
  function splash(x, y) {
    for (let index = 0; index < 18; index += 1) {
      const angle = -Math.PI / 2 + (random() - 0.5) * 2.2;
      const v = 90 + random() * 160;
      spawn(x, y, Math.cos(angle) * v, Math.sin(angle) * v, 0.5 + random() * 0.35, 2.5 + random() * 2.5, '#bfe8e0', 1, 420);
    }
    ring(x, y, 'rgba(191,232,224,0.8)');
  }

  /** Yellow feathers when the duckling is caught by the heron or the cat. */
  function feathers(x, y) {
    for (let index = 0; index < 12; index += 1) {
      const angle = random() * Math.PI * 2;
      const v = 40 + random() * 90;
      spawn(x, y, Math.cos(angle) * v, Math.sin(angle) * v - 40, 0.8 + random() * 0.5, 3 + random() * 3, '#ffd93b', 2, 90);
    }
  }

  /** An expanding ring: a shield breaking, or a shield picked up. */
  function ring(x, y, color) {
    spawn(x, y, 0, 0, 0.5, 6, color, 3, 0);
  }

  function update(dt) {
    for (const p of parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      if (p.kind === 2) p.vx += Math.sin(p.life * 9) * 12 * dt;
    }
  }

  function draw(context) {
    for (const p of parts) {
      if (p.life <= 0) continue;
      const a = Math.max(0, Math.min(1, p.life / p.max));
      if (p.kind === 3) {
        const r = p.size + (1 - a) * 46;
        context.strokeStyle = p.color;
        context.globalAlpha = a;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(p.x, p.y, r, 0, Math.PI * 2);
        context.stroke();
        context.globalAlpha = 1;
        continue;
      }
      context.globalAlpha = a;
      context.fillStyle = p.color;
      context.beginPath();
      if (p.kind === 2) {
        context.ellipse(p.x, p.y, p.size, p.size * 0.55, p.life * 4, 0, Math.PI * 2);
      } else {
        context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      }
      context.fill();
      context.globalAlpha = 1;
    }
  }

  return { burst, splash, feathers, ring, update, draw };
}
