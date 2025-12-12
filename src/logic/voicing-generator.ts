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

export type VoicingType = 'Drop2' | 'Drop3' | 'Drop2_4' | 'Shell' | 'FreddieGreen';

export function generateVoicings(notes: Note[], type: VoicingType, stringSetOverride?: number[]): Voicing[] {
    // notes:
    // For Drop2/Drop3: [Root, 3rd, 5th, 7th] (4 notes)
    // For Shell/FreddieGreen: [Root, 3rd, 7th] (3 notes)

    if (type === 'Drop2' || type === 'Drop3' || type === 'Drop2_4') {
        if (notes.length !== 4) return [];
    } else {
        if (notes.length !== 3) return [];
    }

    // 1. Generate the 4 close voicings (inversions)
    // [1, 3, 5, 7], [3, 5, 7, 1], [5, 7, 1, 3], [7, 1, 3, 5]
    const inversions = [
        [notes[0], notes[1], notes[2], notes[3]],
        [notes[1], notes[2], notes[3], notes[0]],
        [notes[2], notes[3], notes[0], notes[1]],
        [notes[3], notes[0], notes[1], notes[2]],
    ];

    const voicings: Voicing[] = [];

    if (type === 'Shell' || type === 'FreddieGreen') {
        generateShellVoicings(notes, type, voicings);
        return voicings;
    }

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

    // Drop 2 & 4:
    // Drop the 2nd and 4th notes from the top (indices 1 & 3 of close position [0,1,2,3] -> wait, close is bottom up?)
    // Standard def:
    // Drop 2: 2nd from top of close voicing.
    // Drop 3: 3rd from top of close voicing.
    // Drop 2 & 4: 2nd and 4th from top of close voicing.
    // My inversions are defined as [lowest, ..., highest] in pitch for close voicings?
    // Let's verify: inversions[0] = [1, 3, 5, 7]. Top is 7 (index 3). 2nd from top is 5 (index 2). 4th from top is 1 (index 0).
    // So Drop 2&4 means taking indices 2 and 0 and dropping them an octave.
    // This leaves indices 1 and 3 in place.
    // Bass note will be index 0 or index 2 (whichever ends up lower, likely index 0 dropped).

    // Order for Drop 2&4:
    // Ideally we want Root in Bass first.
    // If we take inv[0] (1 3 5 7) -> Drop 5 and 1. Bass is 1. -> Root Position.
    // If we take inv[1] (3 5 7 1) -> Drop 7 and 3. Bass is 3. -> 1st Inv.
    // If we take inv[2] (5 7 1 3) -> Drop 1 and 5. Bass is 5. -> 2nd Inv.
    // If we take inv[3] (7 1 3 5) -> Drop 3 and 7. Bass is 7. -> 3rd Inv.
    // So the order [0, 1, 2, 3] maps to [Root, 1st, 2nd, 3rd] inversions naturally!

    const order = type === 'Drop2' ? [2, 3, 0, 1] : type === 'Drop3' ? [3, 0, 1, 2] : [0, 1, 2, 3];
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
            // Drop 2 & 4 are wider, allow up to 6?
            const limit = (type === 'Drop2_4') ? 6 : 4;

            if (maxFret - minFret <= limit) {
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
        } else if (type === 'Drop3') {
            targetNotes = [inv[1], inv[0], inv[2], inv[3]];
            stringSet = stringSetOverride || [0, 2, 3, 4];
        } else {
            // Drop 2 & 4
            // Original Close: [0, 1, 2, 3] (Low to High)
            // Drop 2 (index 2) and 4 (index 0).
            // Bottom up order: Index 0 (Dropped), Index 2 (Dropped), Index 1, Index 3.
            // Wait, dropping usually means lowering octave.
            // If we drop index 0 (Root in inv 0) it goes WAY down? No, it's already at bottom of close.
            // Let's re-read standard theory.
            // "Drop 2 and 4" comes from 5-part harmony block chords usually, but for guitar:
            // "Drop the second and fourth voices from the top of the chord down an octave."
            // Close: 1 3 5 7 (Root Pos). Top=7. 2nd=5. 3rd=3. 4th=1.
            // Drop 5 and 1.
            // New vertical order (low to high): 1 (dropped), 5 (dropped), 3, 7.
            // Intervals: 1, 5, 3, 7. (Open voicing).
            // Let's check string sets. E A D G B E.
            // 1(LowE), 5(A), 3(D), 7(G) -> Valid?
            // Or 1(A), 5(D), 3(G), 7(B) -> Valid.
            // So order of voices in `targetNotes` should be lowest string to highest string.
            // [inv[0], inv[2], inv[1], inv[3]]
            targetNotes = [inv[0], inv[2], inv[1], inv[3]];
            stringSet = stringSetOverride || [0, 1, 2, 3]; // Default low set
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

function generateShellVoicings(notes: Note[], type: 'Shell' | 'FreddieGreen', voicings: Voicing[]) {
    // notes: [Root, 3rd, 7th]
    // Shell/Freddie Green voicings are typically:
    // 1. Root (6th string), 7th (4th string), 3rd (3rd string)
    // 2. Root (6th string), 3rd (4th string), 7th (3rd string) -> Less common for strict shell, but possible
    // 3. Root (5th string), 3rd (4th string), 7th (3rd string)
    // 4. Root (5th string), 7th (4th string), 3rd (3rd string)

    // Freddie Green style is often strictly on bottom strings (6, 4, 3) or (6, 5, 4 - rare for chords)
    // We will define specific shapes.

    const root = notes[0];
    const third = notes[1];
    const seventh = notes[2];

    // Helper to generate a specific shape
    const tryShape = (name: string, targetNotes: [Note, Note, Note], stringSet: [number, number, number]) => {
        const possiblePositions: FretPosition[][] = [];
        targetNotes.forEach((n, idx) => {
            const s = stringSet[idx];
            const positions: FretPosition[] = [];
            for (let f = 1; f <= 16; f++) { // Shells usually lower on neck, but 16 is safe
                if (isSameNote(getNoteAtFret(s, f), n)) {
                    positions.push({ string: s, fret: f, note: n });
                }
            }
            possiblePositions.push(positions);
        });

        const combinations = cartesian(possiblePositions);
        combinations.forEach(combo => {
            const frets = combo.map(p => p.fret);
            const minFret = Math.min(...frets);
            const maxFret = Math.max(...frets);
            if (maxFret - minFret <= 4) { // Playable span
                voicings.push({ name, positions: combo });
            }
        });
    };

    // Strings: E(0), A(1), D(2), G(3), B(4), E(5)

    if (type === 'FreddieGreen') {
        // Freddie Green: Focus on Low E string roots primarily, sometimes A string.
        // Shape 1: Root (6), 7th (4), 3rd (3) -> R on E. (Indices: 0, 2, 3)
        tryShape("FG Style (R-7-3)", [root, seventh, third], [0, 2, 3]);

        // Shape 2: Root on A (5) -> 5, 4, 3 (Indices: 1, 2, 3)
        // Classic FG A-string shape
        tryShape("FG Style (R-7-3) A", [root, seventh, third], [1, 2, 3]);
        tryShape("FG Style (R-3-7) A", [root, third, seventh], [1, 2, 3]);

    } else {
        // Shell Voicings (General)
        // Set 1: Root on E (6) -> 6, 4, 3
        tryShape("Shell R6 (R-7-3)", [root, seventh, third], [0, 2, 3]);
        tryShape("Shell R6 (R-3-7)", [root, third, seventh], [0, 2, 3]);

        // Set 2: Root on A (5) -> 5, 4, 3 (Indices: 1, 2, 3)
        tryShape("Shell R5 (R-3-7)", [root, third, seventh], [1, 2, 3]);
        tryShape("Shell R5 (R-7-3)", [root, seventh, third], [1, 2, 3]);

        // Set 3: Root on A (5) -> 5, 3, 2 (Indices: 1, 3, 4)
        tryShape("Shell R5 (R-7-3) High", [root, seventh, third], [1, 3, 4]);
    }
}

function cartesian(arrays: FretPosition[][]): FretPosition[][] {
    return arrays.reduce<FretPosition[][]>((a, b) => {
        return a.flatMap(d => b.map(e => [...d, e]));
    }, [[]]);
}
