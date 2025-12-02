import { FretPosition } from './voicing-generator';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
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

export function playChord(positions: FretPosition[]) {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const now = ctx.currentTime;
    const duration = 3.0; // 3 seconds

    // Sort positions by string index (low to high) to simulate a downstroke strum
    const sortedPositions = [...positions].sort((a, b) => a.string - b.string);

    sortedPositions.forEach((pos, index) => {
        const freq = getFrequency(pos.string, pos.fret);

        // Stagger start times for strum effect (e.g., 30ms delay per string)
        const startTime = now + index * 0.03;

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'triangle'; // Triangle wave sounds a bit more like a guitar than sine
        osc.frequency.setValueAtTime(freq, startTime);

        // Envelope
        // Attack
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05); // Fast attack
        // Decay/Sustain
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
    });
}
