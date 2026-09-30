const BPM = 112;
const STEP_SECONDS = 60 / BPM / 4;
const STEPS_PER_BAR = 16;
const LOOP_STEPS = STEPS_PER_BAR * 4;
const LOOKAHEAD_SECONDS = 0.12;
const SCHEDULER_INTERVAL_MS = 25;

const melody = [
  [79, null, 74, null, 76, null, 79, null, 74, null, 71, null, 74, null, 76, null],
  [81, null, 79, null, 76, null, 74, null, 71, null, 74, null, 76, null, 79, null],
  [74, null, 76, null, 79, null, 81, null, 83, null, 81, null, 79, null, 76, null],
  [79, null, 76, null, 74, null, 71, null, 74, null, 71, null, 69, null, 67, null],
];

const bassRoots = [43, 40, 48, 50]; // G · Em · C · D
const leadFrequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function createMusic(audioContext) {
  if (!audioContext) throw new TypeError("createMusic requires an AudioContext");

  const master = audioContext.createGain();
  const leadBus = audioContext.createGain();
  const bassBus = audioContext.createGain();
  const drumBus = audioContext.createGain();
  const noiseBuffer = makeNoiseBuffer(audioContext);
  const voices = new Set();

  master.gain.value = 0;
  leadBus.gain.value = 0.72;
  bassBus.gain.value = 0.56;
  drumBus.gain.value = 0.42;
  leadBus.connect(master);
  bassBus.connect(master);
  drumBus.connect(master);
  master.connect(audioContext.destination);

  let intensity = 1;
  let running = false;
  let destroyed = false;
  let timer = 0;
  let step = 0;
  let nextStepTime = 0;

  function remember(node) {
    voices.add(node);
    node.addEventListener("ended", () => voices.delete(node), { once: true });
    return node;
  }

  function tone({ midi, time, duration, type, volume, bus, endMidi = midi }) {
    const oscillator = remember(audioContext.createOscillator());
    const envelope = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(leadFrequency(midi), time);
    if (endMidi !== midi) {
      oscillator.frequency.exponentialRampToValueAtTime(leadFrequency(endMidi), time + duration);
    }
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(volume, time + Math.min(0.012, duration * 0.22));
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(envelope);
    envelope.connect(bus);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.015);
  }

  function noiseHit({ time, duration, volume, frequency, type = "highpass" }) {
    const source = remember(audioContext.createBufferSource());
    const filter = audioContext.createBiquadFilter();
    const envelope = audioContext.createGain();
    source.buffer = noiseBuffer;
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, time);
    envelope.gain.setValueAtTime(volume, time);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(drumBus);
    source.start(time);
    source.stop(time + duration + 0.01);
  }

  function kick(time, accent = 1) {
    tone({ midi: 47, endMidi: 31, time, duration: 0.16, type: "sine", volume: 0.12 * accent, bus: drumBus });
  }

  function snare(time, accent = 1) {
    noiseHit({ time, duration: 0.095, volume: 0.07 * accent, frequency: 1150 });
    tone({ midi: 50, endMidi: 43, time, duration: 0.085, type: "triangle", volume: 0.04 * accent, bus: drumBus });
  }

  function hat(time, accent = 1) {
    noiseHit({ time, duration: 0.035, volume: 0.018 * accent, frequency: 5200 });
  }

  function scheduleStep(index, time) {
    const bar = Math.floor(index / STEPS_PER_BAR) % 4;
    const beatStep = index % STEPS_PER_BAR;
    const note = melody[bar][beatStep];
    const level = intensity;

    if (note !== null) {
      tone({ midi: note, time, duration: 0.19, type: "square", volume: 0.055 + level * 0.002, bus: leadBus });
      if (level >= 4 && beatStep === 14 && bar === 2) {
        tone({ midi: note + 12, time, duration: 0.13, type: "square", volume: 0.022, bus: leadBus });
      }
    }

    if (beatStep === 0 || beatStep === 8) kick(time, beatStep === 0 ? 1 : 0.82);
    if (beatStep === 4 || beatStep === 12) snare(time, beatStep === 12 && bar === 3 ? 1.12 : 0.88);

    if (beatStep % 2 === 0) {
      if (level >= 2 || beatStep === 2 || beatStep === 10) hat(time, beatStep === 0 || beatStep === 8 ? 0.6 : 1);
    } else if (level >= 4 && (beatStep === 7 || beatStep === 15)) {
      hat(time, 0.55);
    }

    const root = bassRoots[bar];
    if (beatStep === 0 || beatStep === 8) {
      tone({ midi: root, time, duration: 0.24, type: "triangle", volume: 0.085, bus: bassBus });
    } else if (beatStep === 4 || beatStep === 12) {
      tone({ midi: root + 7, time, duration: 0.16, type: "triangle", volume: 0.055, bus: bassBus });
    }
  }

  function schedule() {
    const horizon = audioContext.currentTime + LOOKAHEAD_SECONDS;
    while (nextStepTime < horizon) {
      scheduleStep(step, nextStepTime);
      step = (step + 1) % LOOP_STEPS;
      nextStepTime += STEP_SECONDS;
    }
  }

  function start() {
    if (destroyed || running) return;
    running = true;
    step = 0;
    const now = audioContext.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.24, now + 0.08);
    nextStepTime = now + 0.04;
    schedule();
    timer = globalThis.setInterval(schedule, SCHEDULER_INTERVAL_MS);
  }

  function stop() {
    if (!running) return;
    running = false;
    globalThis.clearInterval(timer);
    timer = 0;
    const now = audioContext.currentTime;
    for (const voice of voices) {
      try { voice.stop(now + 0.015); } catch { /* already stopped */ }
    }
    voices.clear();
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.04);
  }

  function setIntensity(level) {
    const parsed = Number(level);
    intensity = Number.isFinite(parsed) ? Math.max(1, Math.min(5, Math.round(parsed))) : 1;
  }

  function destroy() {
    stop();
    if (destroyed) return;
    destroyed = true;
    leadBus.disconnect();
    bassBus.disconnect();
    drumBus.disconnect();
    master.disconnect();
  }

  return {
    start,
    stop,
    setIntensity,
    destroy,
    isPlaying: () => running && audioContext.state === "running",
  };
}

function makeNoiseBuffer(audioContext) {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * 0.25));
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}
