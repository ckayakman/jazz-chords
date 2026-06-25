import { FretPosition } from './voicing-generator';

let audioCtx: AudioContext | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let chordGainNode: GainNode | null = null;
let lickGainNode: GainNode | null = null;

export function getAudioContext(): AudioContext {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx!;
}

function getMasterCompressor(): DynamicsCompressorNode {
    if (masterCompressor) return masterCompressor;
    const ctx = getAudioContext();
    masterCompressor = ctx.createDynamicsCompressor();
    masterCompressor.threshold.value = -20;
    masterCompressor.knee.value = 8;
    masterCompressor.ratio.value = 5;
    masterCompressor.attack.value = 0.003;
    masterCompressor.release.value = 0.15;
    masterCompressor.connect(ctx.destination);
    return masterCompressor;
}

function getMixGains(): { chordGain: GainNode; lickGain: GainNode } {
    const ctx = getAudioContext();
    if (!chordGainNode) {
        chordGainNode = ctx.createGain();
        chordGainNode.gain.value = 1.0;
        chordGainNode.connect(getMasterCompressor());
    }
    if (!lickGainNode) {
        lickGainNode = ctx.createGain();
        lickGainNode.gain.value = 1.0;
        lickGainNode.connect(getMasterCompressor());
    }
    return { chordGain: chordGainNode, lickGain: lickGainNode };
}

// Very gentle tanh saturation for amp warmth
function createWaveShaper(ctx: AudioContext): WaveShaperNode {
    const shaper = ctx.createWaveShaper();
    const n = 512;
    const curve = new Float32Array(n);
    const drive = 1.3;
    const norm = 1.0 / Math.tanh(drive);
    for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = Math.tanh(x * drive) * norm;
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    return shaper;
}

// Standard tuning: E2, A2, D3, G3, B3, E4
const STRING_BASE_FREQUENCIES = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];

function getFrequency(stringIdx: number, fret: number): number {
    return STRING_BASE_FREQUENCIES[stringIdx] * Math.pow(2, fret / 12);
}

export function playChordAt(positions: FretPosition[], startTime: number, duration: number = 1.0) {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const sortedPositions = [...positions].sort((a, b) => a.string - b.string);

    sortedPositions.forEach((pos, index) => {
        const freq = getFrequency(pos.string, pos.fret);
        const noteStart = startTime + index * 0.018;

        // Additive synthesis: fundamental + harmonics that decay away faster.
        // Real plucked strings behave this way — high harmonics vanish first,
        // leaving a warm fundamental. This is what separates "guitar" from "vibes".
        const oscFund = ctx.createOscillator();
        oscFund.type = 'sine';
        oscFund.frequency.setValueAtTime(freq, noteStart);

        const oscH2 = ctx.createOscillator();
        oscH2.type = 'sine';
        oscH2.frequency.setValueAtTime(freq * 2, noteStart);

        const oscH3 = ctx.createOscillator();
        oscH3.type = 'sine';
        oscH3.frequency.setValueAtTime(freq * 3, noteStart);

        const fundGain = ctx.createGain();
        fundGain.gain.value = 0.70;

        // 2nd harmonic fades out in ~300ms (τ=100ms, 3τ≈300ms)
        const h2Gain = ctx.createGain();
        h2Gain.gain.setValueAtTime(0.22, noteStart);
        h2Gain.gain.setTargetAtTime(0.001, noteStart + 0.015, 0.10);

        // 3rd harmonic fades out faster, ~150ms (τ=50ms)
        const h3Gain = ctx.createGain();
        h3Gain.gain.setValueAtTime(0.08, noteStart);
        h3Gain.gain.setTargetAtTime(0.001, noteStart + 0.015, 0.05);

        // Light waveshaper — just enough to round off peaks like a real amp
        const shaper = createWaveShaper(ctx);

        // Low-pass filter: open enough to let the 2nd/3rd harmonics through initially,
        // but still rolls off the harshness above ~2kHz
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, noteStart);
        filter.Q.value = 0.6;

        // Overall amplitude envelope
        const envGain = ctx.createGain();
        const attackTime = 0.012;
        const peakLevel = 0.38;
        const sustainLevel = peakLevel * 0.45;
        const effectiveDuration = Math.max(duration, attackTime + 0.1);
        const endTime = noteStart + effectiveDuration;
        const decayStartTime = noteStart + attackTime;
        const releaseStartTime = Math.max(decayStartTime + 0.05, endTime - 0.12);

        envGain.gain.setValueAtTime(0, noteStart);
        envGain.gain.linearRampToValueAtTime(peakLevel, decayStartTime);
        envGain.gain.setTargetAtTime(sustainLevel, decayStartTime, 0.10);
        envGain.gain.setTargetAtTime(0.001, releaseStartTime, 0.06);

        // Signal chain
        oscFund.connect(fundGain);
        oscH2.connect(h2Gain);
        oscH3.connect(h3Gain);
        fundGain.connect(shaper);
        h2Gain.connect(shaper);
        h3Gain.connect(shaper);
        shaper.connect(filter);
        filter.connect(envGain);
        const { chordGain } = getMixGains();
        envGain.connect(chordGain);

        const stopTime = releaseStartTime + 0.4;
        oscFund.start(noteStart);
        oscH2.start(noteStart);
        oscH3.start(noteStart);
        oscFund.stop(stopTime);
        oscH2.stop(stopTime);
        oscH3.stop(stopTime);
    });
}

export function playChord(positions: FretPosition[]) {
    const ctx = getAudioContext();
    playChordAt(positions, ctx.currentTime + 0.05);
}

export function playClickAt(time: number, isAccent: boolean) {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isAccent ? 880 : 440, time);

    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.5, time + 0.005);
    gainNode.gain.linearRampToValueAtTime(0.001, time + 0.1);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.1);
}

export function playMidiNoteAt(midi: number, time: number, duration: number = 1.0) {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const freq = 440 * Math.pow(2, (midi - 69) / 12);

    const oscFund = ctx.createOscillator();
    oscFund.type = 'sine';
    oscFund.frequency.setValueAtTime(freq, time);

    const oscH2 = ctx.createOscillator();
    oscH2.type = 'sine';
    oscH2.frequency.setValueAtTime(freq * 2, time);

    const fundGain = ctx.createGain();
    fundGain.gain.value = 0.7;

    const h2Gain = ctx.createGain();
    h2Gain.gain.setValueAtTime(0.18, time);
    h2Gain.gain.setTargetAtTime(0.001, time + 0.015, 0.10);

    const shaper = createWaveShaper(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, time);
    filter.Q.value = 0.6;

    const envGain = ctx.createGain();
    const attackTime = 0.008;
    const peakLevel = 0.32;
    const sustainLevel = peakLevel * 0.45;
    const effectiveDuration = Math.max(duration, attackTime + 0.08);
    const decayStartTime = time + attackTime;
    const releaseStartTime = Math.max(decayStartTime + 0.04, time + effectiveDuration - 0.08);

    envGain.gain.setValueAtTime(0, time);
    envGain.gain.linearRampToValueAtTime(peakLevel, decayStartTime);
    envGain.gain.setTargetAtTime(sustainLevel, decayStartTime, 0.08);
    envGain.gain.setTargetAtTime(0.001, releaseStartTime, 0.05);

    const { lickGain } = getMixGains();
    oscFund.connect(fundGain);
    oscH2.connect(h2Gain);
    fundGain.connect(shaper);
    h2Gain.connect(shaper);
    shaper.connect(filter);
    filter.connect(envGain);
    envGain.connect(lickGain);

    const stopTime = releaseStartTime + 0.24;
    oscFund.start(time);
    oscH2.start(time);
    oscFund.stop(stopTime);
    oscH2.stop(stopTime);
}

export function getChordGain() {
    return getMixGains().chordGain;
}

export function getLickGain() {
    return getMixGains().lickGain;
}
