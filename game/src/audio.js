// Synthesised sound, generated in code: no audio files are shipped. The engine
// is a low sawtooth hum whose pitch follows the throttle, plus filtered wind
// noise; rings chime, landings play a short fanfare and crashes thud. Nothing
// starts until the pilot's first input, so browsers never autoplay sound.

export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let started = false;

  function ensure() {
    if (started) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(context.destination);
      engineOsc.start();

      const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const windFilter = context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      windGain = context.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(context.destination);
      noise.start();
      started = true;
    } catch {
      context = null;
    }
  }

  function tone(frequency, at, duration, type, volume) {
    if (!context) return;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(at);
    osc.stop(at + duration + 0.05);
  }

  return {
    /** Call on the pilot's first key or click: browsers allow sound after a gesture. */
    unlock() {
      ensure();
      if (context && context.state === 'suspended') context.resume().catch(() => {});
    },
    /** Called every frame while flying: throttle 0..1, speed in m/s. */
    engine(throttle, speed, flying) {
      if (!context || !engineGain) return;
      const now = context.currentTime;
      engineOsc.frequency.setTargetAtTime(48 + throttle * 46 + speed * 0.12, now, 0.1);
      engineGain.gain.setTargetAtTime(flying ? 0.028 + throttle * 0.05 : 0, now, 0.15);
      windGain.gain.setTargetAtTime(flying ? Math.max(0, speed - 30) * 0.00045 : 0, now, 0.2);
    },
    chime(perfect) {
      if (!context) return;
      const now = context.currentTime;
      tone(880, now, 0.35, 'sine', 0.16);
      tone(1318.5, now + 0.07, 0.4, 'sine', 0.14);
      if (perfect) tone(1760, now + 0.14, 0.5, 'sine', 0.12);
    },
    fanfare() {
      if (!context) return;
      const now = context.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((frequency, index) => tone(frequency, now + index * 0.12, 0.5, 'triangle', 0.16));
    },
    thud() {
      if (!context) return;
      const now = context.currentTime;
      tone(70, now, 0.5, 'sine', 0.3);
      tone(45, now + 0.05, 0.6, 'sine', 0.25);
    },
    click() {
      if (!context) return;
      tone(660, context.currentTime, 0.08, 'square', 0.06);
    },
  };
}
