import { Note, getNoteIndex } from './music-theory';

// Drop 2 uses strings: 3, 2, 1, 0 (D, G, B, E) -> Indices 2, 3, 4, 5.
// Drop 3 uses strings: 5, 3, 2, 1 (E, D, G, B) -> Indices 0, 2, 3, 4.

export interface FretPosition {
    string: number; // 0-5 (Low E to High E)
    fret: number;   // 0-22
    note: Note;
}

export interface Voicing {
    name: string;
    positions: FretPosition[];
}


// Standard Tuning: E A D G B E
const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function getNoteAtFret(stringIdx: number, fret: number): Note {
    // Tuning offsets from C (arbitrary base)
    // Let's just use the getNoteIndex and add semitones.
    // E A D G B E
    // E=4, A=9, D=2, G=7, B=11, E=4 (indices in C-major scale starting C=0)
    const openStringIndices = [4, 9, 2, 7, 11, 4];
    const base = openStringIndices[stringIdx];
    const noteIdx = (base + fret) % 12;
    // Return sharp or flat? Let's default to sharp for lookup, but we should match input preference.
    return NOTES_SHARP[noteIdx];
}

function isSameNote(n1: Note, n2: Note): boolean {
    return getNoteIndex(n1) === getNoteIndex(n2);
}

export function generateVoicings(notes: Note[], type: 'Drop2' | 'Drop3', stringSetOverride?: number[]): Voicing[] {
    // notes: [Root, 3rd, 5th, 7th] (assumed 4 notes)
    if (notes.length !== 4) return [];

    // 1. Generate the 4 close voicings (inversions)
    // [1, 3, 5, 7], [3, 5, 7, 1], [5, 7, 1, 3], [7, 1, 3, 5]
    const inversions = [
        [notes[0], notes[1], notes[2], notes[3]],
        [notes[1], notes[2], notes[3], notes[0]],
        [notes[2], notes[3], notes[0], notes[1]],
        [notes[3], notes[0], notes[1], notes[2]],
    ];

    const voicings: Voicing[] = [];

    // Define processing order to ensure "Root Position" (Root in bass) comes first.
    // Drop 2:
    // - Close Inv 2 (Root at index 2) -> Drop 2 -> Root in Bass (Root Pos)
    // - Close Inv 3 -> Drop 2 -> 3rd in Bass (1st Inv)
    // - Close Inv 0 -> Drop 2 -> 5th in Bass (2nd Inv)
    // - Close Inv 1 -> Drop 2 -> 7th in Bass (3rd Inv)
    // Order: [2, 3, 0, 1]

    // Drop 3:
    // - Close Inv 3 (Root at index 1) -> Drop 3 -> Root in Bass (Root Pos)
    // - Close Inv 0 -> Drop 3 -> 3rd in Bass (1st Inv)
    // - Close Inv 1 -> Drop 3 -> 5th in Bass (2nd Inv)
    // - Close Inv 2 -> Drop 3 -> 7th in Bass (3rd Inv)
    // Order: [3, 0, 1, 2]

    const order = type === 'Drop2' ? [2, 3, 0, 1] : [3, 0, 1, 2];
    const names = ["Root Position", "1st Inversion", "2nd Inversion", "3rd Inversion"];

    // Helper to generate and check voicings
    const tryVoicing = (targetNotes: Note[], name: string, stringSet: number[]) => {
        const possiblePositions: FretPosition[][] = [];
        for (let k = 0; k < 4; k++) {
            const s = stringSet[k];
            const target = targetNotes[k];
            const positions: FretPosition[] = [];
            // Search frets 1 to 17
            for (let f = 1; f <= 17; f++) {
                if (isSameNote(getNoteAtFret(s, f), target)) {
                    positions.push({ string: s, fret: f, note: target });
                }
            }
            possiblePositions.push(positions);
        }

        const combinations = cartesian(possiblePositions);
        combinations.forEach(combo => {
            const frets = combo.map(p => p.fret);
            const minFret = Math.min(...frets);
            const maxFret = Math.max(...frets);

            // Span check: usually 4 or 5 frets.
            if (maxFret - minFret <= 4) {
                voicings.push({
                    name: name,
                    positions: combo
                });
            }
        });
    };

    order.forEach((invIndex, i) => {
        const inv = inversions[invIndex];
        let targetNotes: Note[] = [];
        let stringSet: number[] = [];

        if (type === 'Drop2') {
            targetNotes = [inv[2], inv[0], inv[1], inv[3]];
            stringSet = stringSetOverride || [2, 3, 4, 5];
        } else {
            targetNotes = [inv[1], inv[0], inv[2], inv[3]];
            stringSet = stringSetOverride || [0, 2, 3, 4];
        }

        tryVoicing(targetNotes, names[i], stringSet);
    });

    // For Drop 2, also attempt "Close" voicings as they are often playable and desirable
    // especially for Omit 5 chords (e.g. C, E, B, D).
    if (type === 'Drop2') {
        const closeNames = ["Close Root Pos", "Close 1st Inv", "Close 2nd Inv", "Close 3rd Inv"];
        inversions.forEach((inv, i) => {
            const stringSet = stringSetOverride || [2, 3, 4, 5];
            tryVoicing(inv, closeNames[i], stringSet);
        });
    }

    return voicings;
}

function cartesian(arrays: FretPosition[][]): FretPosition[][] {
    return arrays.reduce<FretPosition[][]>((a, b) => {
        return a.flatMap(d => b.map(e => [...d, e]));
    }, [[]]);
}
