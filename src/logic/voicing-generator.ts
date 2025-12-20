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

    // 1. Generate inversions
    // We want to cover both the strict input order (stacked thirds usually)
    // AND the pitch-class sorted order (true Close Position blocks), 
    // which handles cases like 7#11 where the #11 is a #4 within the octave.

    const getInversions = (baseNotes: Note[]) => {
        const result: Note[][] = [];
        const rotations = [
            [baseNotes[0], baseNotes[1], baseNotes[2], baseNotes[3]],
            [baseNotes[1], baseNotes[2], baseNotes[3], baseNotes[0]],
            [baseNotes[2], baseNotes[3], baseNotes[0], baseNotes[1]],
            [baseNotes[3], baseNotes[0], baseNotes[1], baseNotes[2]],
        ];
        rotations.forEach(r => result.push(r));
        return result;
    }

    const inputInversions = getInversions(notes);

    // Generate sorted inversions for "Compressed" close forms
    const sortedNotes = [...notes].sort((a, b) => getNoteIndex(a) - getNoteIndex(b));
    const sortedInversions = getInversions(sortedNotes);

    // Combine and deduplicate
    // Simple stringify check for dedup
    const seen = new Set<string>();
    const allInversions: Note[][] = [];

    [...inputInversions, ...sortedInversions].forEach(inv => {
        const key = inv.join(',');
        if (!seen.has(key)) {
            seen.add(key);
            allInversions.push(inv);
        }
    });

    const voicings: Voicing[] = [];

    if (type === 'Shell' || type === 'FreddieGreen') {
        generateShellVoicings(notes, type, voicings);
        return voicings;
    }

    // Standard Drop Voicing Generation
    // We iterate through ALL generated inversions to find Drop voicings.
    // However, the "Order" logic (Root Pos, 1st Inv etc) is based on *specific* inversions of the standard tertian stack.
    // If we throw 8 inversions at it, the naming ("Root Position") might get messy or incorrect if we just use index.
    // Strategy:
    // 1. Generate "Standard" Drop voicings using strictly the `inputInversions` (assuming input is R-3-5-7 or similar standard stack).
    //    This preserves the standard naming mapping [Root, 1st, 2nd, 3rd].
    // 2. Generate "Supplementary" Drop voicings using `sortedInversions`. 
    //    Name them generic "Drop X var" or try to infer bass? 
    //    Actually, "Close Root Pos" etc refers to the Close parent.
    //    Let's just iterate `allInversions` but try to allow the loop to assign names if possible, or just use generic naming for the extras.

    // To keep it clean and fix the user's specific issue:
    // The user wants G7#11 (Drop 2) to exist.
    // That comes from the Sorted set.
    // If we just process the Sorted Set as the primary source for Drop 2/3/etc, we get the standard "Block Chord" theory voicings.
    // IS input `notes` always in Stacked Thirds order from App.tsx? Yes, `getNotesFromIntervals` does that.
    // BUT for chords like 7#11, strict stacked thirds (R 3 5 7 11) spans > 1 octave if 11 is on top.
    // Sorted set brings it back into one octave.
    // MOST Jazz theory teaches Drop voicings derived from the one-octave Close block.
    // So `sortedInversions` is actually BETTER as the primary source than `inputInversions`.
    // Let's use `sortedInversions` as the primary list for the standard [Root, 1st, 2nd, 3rd] naming if the input was indeed a known chord type.

    // However, `getNotesFromIntervals` returns sorted by interval size.
    // Cmaj7 -> C E G B. Sorted -> C E G B. Match.
    // C7#11 (no 5) -> C E Bb F#. Sorted -> C E F# Bb.
    // Input inversions: [C E Bb F#] ...
    // Sorted inversions: [C E F# Bb] ...
    // Drop 2 from Input[0] (C E Bb F#) -> Drop Bb -> Bb C E F#. (Bass Bb).
    // Drop 2 from Sorted[0] (C E F# Bb) -> Drop F# -> F# C E Bb. (Bass F#).

    // The user's requested G7#11 voicing was `G C# F B` (Bass G).
    // From Sorted: `C# F G B` -> Drop G -> G C# F B. (This is Drop 2 of the 1st inversion of sorted set).
    // So yes, we need standard Drop logic on the Sorted Set.

    // Let's combine them but prioritize Sorted for the Naming alignment? 
    // Actually, let's just run both sets and name them.
    // We can label them "Drop X (Var)" if they come from the extra set.

    // Actually, to avoid duplicates in the generic loops, let's just use `allInversions`.
    // But for naming:
    // We will just label them "Drop X" (we lose the "Root Pos" label specificity if we don't know which voice is root).
    // Current code: `names[i]`.
    // Let's rely on standard logic:
    // Check which note is in the bass? No, too complex.
    // Let's just generate them. The user sees the Chord Name, and we append "Drop X".
    // Current code appends names like "Root Position".

    // Compromise:
    // Run the standard loop on `inputInversions` (First 4) with the standard names.
    // Run a loop on `sortedInversions` (if different) with "Alt" names?
    // OR, just replace usages.
    // Given the user specifically asked for "Close" forms and found them missing...
    // I will simplify:
    // Use `sortedInversions` to generate the bulk of standard jazz voicings.
    // Use `inputInversions` as well to catch wide stacks.

    const order = type === 'Drop2' ? [2, 3, 0, 1] : type === 'Drop3' ? [3, 0, 1, 2] : [0, 1, 2, 3];
    const standardNames = ["Root Position", "1st Inversion", "2nd Inversion", "3rd Inversion"];
    // Note: The `order` array was mapping Close Inversions -> Drop Inversions such that Drop Bass matches Close Bass.
    // This mapping holds true for Sorted Sets (standard block chords).
    // So using `sortedInversions` with `order` and `standardNames` is the THEORETICALLY CORRECT way for Drop Voicings.

    // So I will primarily use Sorted Inversions for the main names.
    const primaryInversions = sortedInversions;

    const tryVoicing = (targetNotes: Note[], name: string, stringSet: number[]) => {
        const possiblePositions: FretPosition[][] = [];
        for (let k = 0; k < 4; k++) {
            const s = stringSet[k];
            const target = targetNotes[k];
            const positions: FretPosition[] = [];
            // Search frets 1 to 18 (No open strings allowed for portability)
            for (let f = 1; f <= 18; f++) {
                if (isSameNote(getNoteAtFret(s, f), target)) {
                    positions.push({ string: s, fret: f, note: target });
                }
            }
            possiblePositions.push(positions);
        }

        const combinations = cartesian(possiblePositions);
        const validCombinations: FretPosition[][] = [];

        combinations.forEach(combo => {
            const frets = combo.map(p => p.fret);
            // Since we excluded 0, we can just take max - min
            const minFret = Math.min(...frets);
            const maxFret = Math.max(...frets);
            const span = maxFret - minFret;

            // Span limits:
            // Drop 2 & 4: Limit "6 frets tall" means max-min=5
            // All others: Limit "5 frets tall" means max-min=4
            // User feedback: "diagram cannot cross more than 5 frets" (Inclusive count likely)
            const limit = (type === 'Drop2_4') ? 5 : 4;

            if (span <= limit) {
                validCombinations.push(combo);
            }
        });

        // Filter duplicates (same shape, octave shifted)
        // Since we are iterating a specific set of notes on a specific set of strings,
        // any multiple valid combinations are almost certainly octave displacements.
        // We sort by lowest fret and keep the first one.
        validCombinations.sort((a, b) => {
            const minA = Math.min(...a.map(p => p.fret));
            const minB = Math.min(...b.map(p => p.fret));
            return minA - minB;
        });

        // Take only the lowest one
        if (validCombinations.length > 0) {
            const bestCombo = validCombinations[0];

            // Check if already exists (global dedup still needed for Cross-Algorithm duplicates)
            const signature = bestCombo.map(p => `${p.string}-${p.fret}`).join('|');
            if (!voicings.some(v => v.positions.map(p => `${p.string}-${p.fret}`).join('|') === signature)) {
                voicings.push({
                    name: name,
                    positions: bestCombo
                });
            }
        }
    };

    // GENERATE DROP VOICINGS from Sorted Sets (Primary)
    order.forEach((invIndex, i) => {
        const inv = primaryInversions[invIndex];
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
            // From Close (Low to High): 0, 1, 2, 3.
            // Drop 2nd (Index 2) and 4th (Index 0).
            // Result (Low to High): 0, 2, 1, 3.
            targetNotes = [inv[0], inv[2], inv[1], inv[3]];
            stringSet = stringSetOverride || [0, 1, 2, 3];
        }
        tryVoicing(targetNotes, standardNames[i], stringSet);
    });

    // GENERATE DROP VOICINGS from Input Sets (if different) - Catch-all for wide intervals
    // We won't name them "Root Position" etc because we don't know the bass logic relative to sorted.
    // Just "Drop X Var".
    inputInversions.forEach((inv) => {
        // Skip if this inversion is effectively the same as one in sorted (permutation check)
        // Actually, just generate and rely on dedup in `tryVoicing`.

        let targetNotes: Note[] = [];
        let stringSet: number[] = [];

        if (type === 'Drop2') {
            targetNotes = [inv[2], inv[0], inv[1], inv[3]];
            stringSet = stringSetOverride || [2, 3, 4, 5];
        } else if (type === 'Drop3') {
            targetNotes = [inv[1], inv[0], inv[2], inv[3]];
            stringSet = stringSetOverride || [0, 2, 3, 4];
        } else {
            targetNotes = [inv[0], inv[2], inv[1], inv[3]];
            stringSet = stringSetOverride || [0, 1, 2, 3];
        }
        tryVoicing(targetNotes, `${type} Var`, stringSet);
    });


    // GENERATE CLOSE VOICINGS (Explicit "Close" forms on the string set)
    // Run for ALL types now (Drop2, Drop3, Drop2_4) to cover user request.
    const closeNames = ["Close Root Pos", "Close 1st Inv", "Close 2nd Inv", "Close 3rd Inv"];

    // Use Sorted Inversions for Close forms (this is the standard definition)
    primaryInversions.forEach((inv, i) => {
        const stringSet = stringSetOverride || (type === 'Drop2' ? [2, 3, 4, 5] : type === 'Drop3' ? [0, 2, 3, 4] : [0, 1, 2, 3]);
        // Note: For Close voicings on Split sets (Drop 3), the span might be large, but we try anyway.
        tryVoicing(inv, closeNames[i], stringSet);
    });

    // Also try Input Inversions for Close forms (wide close?)
    inputInversions.forEach((inv) => {
        const stringSet = stringSetOverride || (type === 'Drop2' ? [2, 3, 4, 5] : type === 'Drop3' ? [0, 2, 3, 4] : [0, 1, 2, 3]);
        tryVoicing(inv, "Close Var", stringSet);
    });

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
        const validCombinations: FretPosition[][] = [];

        combinations.forEach(combo => {
            const frets = combo.map(p => p.fret);
            const minFret = Math.min(...frets);
            const maxFret = Math.max(...frets);
            if (maxFret - minFret <= 4) { // Playable span
                validCombinations.push(combo);
            }
        });

        // Filter duplicates (keep lowest)
        validCombinations.sort((a, b) => {
            const minA = Math.min(...a.map(p => p.fret));
            const minB = Math.min(...b.map(p => p.fret));
            return minA - minB;
        });

        if (validCombinations.length > 0) {
            const bestCombo = validCombinations[0];
            // Check if already exists
            const signature = bestCombo.map(p => `${p.string}-${p.fret}`).join('|');
            if (!voicings.some(v => v.positions.map(p => `${p.string}-${p.fret}`).join('|') === signature)) {
                voicings.push({ name, positions: bestCombo });
            }
        }
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
