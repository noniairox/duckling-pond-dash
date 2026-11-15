// Keyboard and pointer input. Hop keys (arrows / WASD) are queued one-shot, so one press is
// one hop; start/restart and pause are queued as bit flags and taken once by the loop, so a
// press between two frames is never lost and never counted twice. Pointer presses carry their
// position, so the loop can hop to the pad that was clicked.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const HOPS = {
  ArrowUp: { dx: 0, dy: -1 },
  KeyW: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  KeyS: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  KeyA: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  KeyD: { dx: 1, dy: 0 },
};
const CONFIRM = new Set(['Space', 'Enter', 'KeyR']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let actions = 0;
  const hops = [];
  const clicks = [];

  window.addEventListener('keydown', (event) => {
    const hop = HOPS[event.code];
    if (hop !== undefined) {
      if (!event.repeat) hops.push(hop);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  target.addEventListener('pointerdown', (event) => {
    clicks.push({ x: event.clientX, y: event.clientY });
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The next queued hop direction, or null. */
    takeHop() {
      return hops.length === 0 ? null : hops.shift();
    },
    /** The pointer presses since the last call, in client coordinates. */
    takeClicks() {
      if (clicks.length === 0) return clicks;
      const taken = clicks.slice();
      clicks.length = 0;
      return taken;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Drop every queued hop and click (a fresh game starts with a clean slate). */
    clear() {
      hops.length = 0;
      clicks.length = 0;
    },
  };
}
