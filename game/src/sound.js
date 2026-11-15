// Optional sound, synthesized with WebAudio: no files, no network. Everything is guarded,
// so a browser without audio (or one that has not had a gesture yet) simply stays silent.

export function createSound() {
  let context = null;
  let muted = false;

  function ensure() {
    if (muted) return null;
    if (context === null) {
      try {
        const AudioContext = window.AudioContext ?? window.webkitAudioContext;
        if (AudioContext === undefined) return null;
        context = new AudioContext();
      } catch {
        return null;
      }
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function tone(freq, dur, type, vol, delay) {
    const ctx = ensure();
    if (ctx === null) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const start = ctx.currentTime + (delay ?? 0);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(vol, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    } catch {
      // A sound that cannot play is skipped, never fatal.
    }
  }

  function noise(dur, vol) {
    const ctx = ensure();
    if (ctx === null) return;
    try {
      const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      source.connect(gain).connect(ctx.destination);
      source.start();
    } catch {
      // A sound that cannot play is skipped, never fatal.
    }
  }

  return {
    toggleMute() {
      muted = !muted;
      return muted;
    },
    hop() {
      tone(520, 0.09, 'sine', 0.12);
      tone(760, 0.09, 'sine', 0.09, 0.07);
    },
    crumb() {
      tone(880, 0.06, 'triangle', 0.12);
      tone(1318, 0.09, 'triangle', 0.1, 0.05);
    },
    splash() {
      noise(0.28, 0.16);
    },
    caught() {
      tone(220, 0.2, 'sawtooth', 0.12);
      tone(155, 0.28, 'sawtooth', 0.12, 0.1);
    },
    level() {
      tone(660, 0.08, 'triangle', 0.12);
      tone(880, 0.08, 'triangle', 0.12, 0.08);
      tone(990, 0.14, 'triangle', 0.12, 0.16);
    },
    win() {
      tone(523, 0.12, 'triangle', 0.13);
      tone(659, 0.12, 'triangle', 0.13, 0.12);
      tone(784, 0.12, 'triangle', 0.13, 0.24);
      tone(1047, 0.24, 'triangle', 0.14, 0.36);
    },
  };
}
