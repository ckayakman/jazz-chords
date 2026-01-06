import { FretPosition } from './voicing-generator';

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx!;
}

// Standard tuning frequencies
// E2, A2, D3, G3, B3, E4
const STRING_BASE_FREQUENCIES = [
    82.41,  // E2 (Low E) - String 0
    110.00, // A2         - String 1
    146.83, // D3         - String 2
    196.00, // G3         - String 3
    246.94, // B3         - String 4
    329.63  // E4 (High E)- String 5
];

function getFrequency(stringIdx: number, fret: number): number {
    const baseFreq = STRING_BASE_FREQUENCIES[stringIdx];
    // f = f0 * 2^(n/12)
    return baseFreq * Math.pow(2, fret / 12);
}




export function playChordAt(positions: FretPosition[], startTime: number, duration: number = 1.0) {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    // Sort positions by string index (low to high) to simulate a downstroke strum
    const sortedPositions = [...positions].sort((a, b) => a.string - b.string);

    sortedPositions.forEach((pos, index) => {
        const freq = getFrequency(pos.string, pos.fret);

        // Stagger start times for strum effect (e.g., 20ms delay per string)
        const noteStart = startTime + index * 0.02;

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);

        // Envelope Parameters
        const attackTime = 0.05;
        const releaseTime = 0.05;

        // Ensure duration is at least enough for attack
        const effectiveDuration = Math.max(duration, attackTime + 0.01);
        const endTime = noteStart + effectiveDuration;

        // Attack
        gainNode.gain.setValueAtTime(0, noteStart);
        gainNode.gain.linearRampToValueAtTime(0.3, noteStart + attackTime);

        // Decay/Sustain
        // Use linear ramp for safety against exponential ramp errors with zero/negative values or timing overlaps
        gainNode.gain.linearRampToValueAtTime(0.001, Math.max(endTime, noteStart + attackTime + 0.01));

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(noteStart);
        // Stop slightly after the fade out
        osc.stop(Math.max(endTime, noteStart + attackTime + 0.01) + releaseTime);
    });
}

export function playChord(positions: FretPosition[]) {
    const ctx = getAudioContext();
    // Play immediately (slightly in future to avoid clicks)
    playChordAt(positions, ctx.currentTime + 0.05);
}




export function playClickAt(time: number, isAccent: boolean) {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    // High pitch for accent (Beat 1), lower for others
    osc.frequency.setValueAtTime(isAccent ? 880 : 440, time);

    // Short percussive envelope
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.5, time + 0.005);
    gainNode.gain.linearRampToValueAtTime(0.001, time + 0.1);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.1);
}
