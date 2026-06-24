import { useCallback } from "react";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();

  if (ctx.state === "suspended") {
    void ctx.resume();
  }

  return ctx;
}

function getVolume(): number {
  const value = localStorage.getItem("bgmVolume");
  if (!value) return 0;

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;

  return Math.max(0, Math.min(1, parsed)) * 0.5;
}

function clampSample(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

const useSFX = () => {
  const playBlip = useCallback(() => {
    const vol = getVolume();
    if (vol <= 0) return;

    const c = getCtx();
    const t = c.currentTime;

    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(180, t);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain).connect(c.destination);

    osc.onended = () => {
      gain.disconnect();
      osc.disconnect();
    };
    osc.start(t);
    osc.stop(t + 0.04);
  }, []);

  const playGlitch = useCallback(() => {
    const vol = getVolume();
    if (vol <= 0) return;

    const c = getCtx();
    const t = c.currentTime;

    const duration = 0.19 + Math.random() * 0.07;
    const sampleRate = c.sampleRate;
    const length = Math.floor(sampleRate * duration);

    const master = c.createGain();
    const compressor = c.createDynamicsCompressor();

    compressor.threshold.value = -14;
    compressor.knee.value = 6;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.05;

    master
      .connect(compressor)
      .connect(c.destination);

    const peak = Math.max(0.0001, vol * 0.7);

    master.gain.setValueAtTime(0.0001, t);
    master.gain.linearRampToValueAtTime(peak, t + 0.002);

    let envelopeTime = t + 0.012;

    while (envelopeTime < t + duration - 0.012) {
      const roll = Math.random();

      let level: number;

      if (roll < 0.22) {
        level = 0.0001;
      } else if (roll < 0.42) {
        level = peak * (0.08 + Math.random() * 0.18);
      } else {
        level = peak * (0.55 + Math.random() * 0.45);
      }

      master.gain.setValueAtTime(level, envelopeTime);
      envelopeTime += 0.004 + Math.random() * 0.012;
    }

    master.gain.setValueAtTime(peak * 0.5, t + duration - 0.008);
    master.gain.linearRampToValueAtTime(0.0001, t + duration);

    const noiseBuffer = c.createBuffer(1, length, sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);

    let heldNoise = 0;
    let heldSamplesLeft = 0;
    let gate = 1;
    let gateSamplesLeft = 0;

    for (let i = 0; i < length; i++) {
      if (heldSamplesLeft <= 0) {
        heldSamplesLeft = 1 + Math.floor(Math.random() * 7);

        const raw = Math.random() * 2 - 1;
        const levels = 12 + Math.floor(Math.random() * 28);

        heldNoise = Math.round(raw * levels) / levels;
      }

      if (gateSamplesLeft <= 0) {
        gateSamplesLeft = Math.max(
          1,
          Math.floor(
            sampleRate * (0.001 + Math.random() * 0.005),
          ),
        );

        const roll = Math.random();

        if (roll < 0.18) {
          gate = 0;
        } else if (roll < 0.38) {
          gate = 0.1 + Math.random() * 0.25;
        } else {
          gate = 0.55 + Math.random() * 0.45;
        }
      }

      heldSamplesLeft--;
      gateSamplesLeft--;

      const whiteNoise = Math.random() * 2 - 1;

      const crackle =
        Math.random() < 0.0012
          ? (Math.random() < 0.5 ? -1 : 1) *
            (0.8 + Math.random() * 1.2)
          : 0;

      const sample =
        whiteNoise * 0.48 +
        heldNoise * 0.38 +
        crackle;

      noiseData[i] = clampSample(sample * gate);
    }

    const noiseSource = c.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseHighpass = c.createBiquadFilter();
    noiseHighpass.type = "highpass";
    noiseHighpass.frequency.setValueAtTime(380, t);
    noiseHighpass.Q.value = 0.65;

    const noiseLowpass = c.createBiquadFilter();
    noiseLowpass.type = "lowpass";
    noiseLowpass.frequency.setValueAtTime(7600, t);
    noiseLowpass.Q.value = 0.5;

    const noisePresence = c.createBiquadFilter();
    noisePresence.type = "peaking";
    noisePresence.frequency.setValueAtTime(2200, t);
    noisePresence.Q.value = 0.8;
    noisePresence.gain.value = 3;

    const noiseGain = c.createGain();
    noiseGain.gain.value = 0.72;

    noiseSource
      .connect(noiseHighpass)
      .connect(noisePresence)
      .connect(noiseLowpass)
      .connect(noiseGain)
      .connect(master);

    const toneOsc = c.createOscillator();
    const toneGain = c.createGain();
    const toneFilter = c.createBiquadFilter();

    toneOsc.type = "square";

    toneFilter.type = "bandpass";
    toneFilter.frequency.setValueAtTime(1700, t);
    toneFilter.Q.value = 0.75;

    toneGain.gain.setValueAtTime(0.0001, t);

    const toneFrequencies = [
      620,
      780,
      960,
      1180,
      1440,
      1760,
      2120,
      2480,
    ];

    let toneTime = t;

    while (toneTime < t + duration) {
      const frequency =
        toneFrequencies[
          Math.floor(Math.random() * toneFrequencies.length)
        ];

      const enabled = Math.random() > 0.32;

      toneOsc.frequency.setValueAtTime(frequency, toneTime);
      toneGain.gain.setValueAtTime(
        enabled
          ? vol * (0.035 + Math.random() * 0.055)
          : 0.0001,
        toneTime,
      );

      toneTime += 0.005 + Math.random() * 0.013;
    }

    toneGain.gain.setValueAtTime(0.0001, t + duration);

    toneOsc
      .connect(toneFilter)
      .connect(toneGain)
      .connect(master);

    const buzzOsc = c.createOscillator();
    const buzzGain = c.createGain();
    const buzzFilter = c.createBiquadFilter();

    buzzOsc.type = "square";
    buzzOsc.frequency.setValueAtTime(
      165 + Math.random() * 55,
      t,
    );

    buzzFilter.type = "bandpass";
    buzzFilter.frequency.setValueAtTime(420, t);
    buzzFilter.Q.value = 0.55;

    buzzGain.gain.setValueAtTime(0.0001, t);
    buzzGain.gain.linearRampToValueAtTime(vol * 0.08, t + 0.003);

    let buzzTime = t + 0.012;

    while (buzzTime < t + duration - 0.01) {
      buzzGain.gain.setValueAtTime(
        Math.random() < 0.28
          ? 0.0001
          : vol * (0.035 + Math.random() * 0.06),
        buzzTime,
      );

      buzzOsc.frequency.setValueAtTime(
        150 + Math.random() * 90,
        buzzTime,
      );

      buzzTime += 0.008 + Math.random() * 0.018;
    }

    buzzGain.gain.setValueAtTime(0.0001, t + duration);

    buzzOsc
      .connect(buzzFilter)
      .connect(buzzGain)
      .connect(master);

    const clickBuffer = c.createBuffer(
      1,
      Math.floor(sampleRate * 0.012),
      sampleRate,
    );

    const clickData = clickBuffer.getChannelData(0);

    for (let i = 0; i < clickData.length; i++) {
      const decay = 1 - i / clickData.length;
      clickData[i] =
        (Math.random() * 2 - 1) *
        decay *
        decay;
    }

    const startClick = c.createBufferSource();
    const startClickGain = c.createGain();

    startClick.buffer = clickBuffer;
    startClickGain.gain.value = vol * 0.22;

    startClick
      .connect(startClickGain)
      .connect(master);

    const endClick = c.createBufferSource();
    const endClickGain = c.createGain();

    endClick.buffer = clickBuffer;
    endClickGain.gain.value = vol * 0.16;

    endClick
      .connect(endClickGain)
      .connect(master);

    const allNodes = [
      noiseSource, noiseHighpass, noisePresence, noiseLowpass, noiseGain,
      toneOsc, toneFilter, toneGain,
      buzzOsc, buzzFilter, buzzGain,
      startClick, startClickGain,
      endClick, endClickGain,
      master, compressor,
    ];
    endClick.onended = () => {
      for (const node of allNodes) node.disconnect();
    };

    noiseSource.start(t);
    toneOsc.start(t);
    buzzOsc.start(t);
    startClick.start(t);
    endClick.start(t + duration - 0.01);

    noiseSource.stop(t + duration);
    toneOsc.stop(t + duration);
    buzzOsc.stop(t + duration);
    startClick.stop(t + 0.012);
    endClick.stop(t + duration + 0.01);
  }, []);

  return {
    playBlip,
    playGlitch,
  };
};

export default useSFX;