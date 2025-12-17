import { Note, transpose, parseChord, getNotesFromIntervals, getIntervalMap } from './music-theory';
import { generateVoicings, Voicing, VoicingType } from './voicing-generator';

export type ProgressionType = 'MajorII_V_I' | 'MinorII_V_I' | 'MajorBlues' | 'MinorBlues' | 'RhythmChanges' | 'MajorI_vi_ii_V' | 'Major_iii_vi_ii_V' | 'MinorTurnaround' | 'RhythmChangesBridge';

export const PROGRESSION_LABELS: Record<ProgressionType, string> = {
    'MajorII_V_I': 'Major ii-V-I',
    'MinorII_V_I': 'Minor ii-V-i',
    'MajorBlues': 'Major Blues (12-Bar)',
    'MinorBlues': 'Minor Blues (12-Bar)',
    'RhythmChanges': 'Rhythm Changes (A Section)',
    'MajorI_vi_ii_V': 'Major I-vi-ii-V',
    'Major_iii_vi_ii_V': 'Major iii-vi-ii-V',
    'MinorTurnaround': 'Minor Turnaround (i-bVI-ii-V)',
    'RhythmChangesBridge': 'Rhythm Changes Bridge'
};

export const AVAILABLE_KEYS: Note[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];



// Simple map of progressions relative to a Major Key Root
// Note: For Minor keys, we will treat the input key as the minor root, but we need to handle the relative intervals carefully.
// Actually, let's keep it simple: We transpose the root and append the suffix.
const PROGRESSIONS: Record<ProgressionType, { degrees: number[], suffixes: string[], measures: number[] }> = {
    'MajorII_V_I': {
        degrees: [2, 7, 0, 0], // Semitones from root: II(2), V(7), I(0)
        suffixes: ['m7', '7', 'maj7', 'maj7'],
        measures: [1, 1, 1, 1] // 4 measures
    },
    'MinorII_V_I': {
        degrees: [2, 7, 0, 0], // II(2), V(7), I(0) - but minor
        suffixes: ['m7b5', '7alt', 'm7', 'm7'],
        measures: [1, 1, 1, 1]
    },
    'MajorI_vi_ii_V': {
        degrees: [0, 9, 2, 7], // Root, vi(9), ii(2), V(7)
        suffixes: ['maj7', 'm7', 'm7', '7'],
        measures: [1, 1, 1, 1]
    },
    'Major_iii_vi_ii_V': {
        degrees: [4, 9, 2, 7], // iii(4), vi(9), ii(2), V(7)
        suffixes: ['m7', 'm7', 'm7', '7'],
        measures: [1, 1, 1, 1]
    },
    'MinorTurnaround': {
        degrees: [0, 8, 2, 7], // i(0), bVI(8), ii(2), V(7)
        suffixes: ['m7', 'maj7', 'm7b5', '7alt'],
        measures: [1, 1, 1, 1]
    },
    'RhythmChangesBridge': {
        degrees: [4, 9, 2, 7], // III(4), VI(9), II(2), V(7) - Dominant 7ths for Bridge
        suffixes: ['7', '7', '7', '7'],
        measures: [1, 1, 1, 1]
    },
    'MajorBlues': {
        // Standard Jazz Blues in Bb: Bb7, Eb7, Bb7, Fm7 Bb7, Eb7, Edim, Bb7, G7, Cm7, F7, Bb7 G7, Cm7 F7
        // Let's do a simplified but "jazzy" version.
        // 1: I7
        // 2: IV7
        // 3: I7
        // 4: I7 (implied V/IV) -> let's stick to I7
        // 5: IV7
        // 6: #IVdim (6 semitones)
        // 7: I7
        // 8: VI7 (9 semitones, dom)
        // 9: ii7 (2 semitones)
        // 10: V7 (7 semitones)
        // 11: I7
        // 12: V7
        degrees: [0, 5, 0, 0, 5, 6, 0, 9, 2, 7, 0, 7],
        suffixes: ['7', '7', '7', '7', '7', 'dim7', '7', '7', 'm7', '7', '7', '7'],
        measures: Array(12).fill(1)
    },
    'MinorBlues': {
        // 1: Im7
        // 2: ivm7 (5 semitones)
        // 3: Im7
        // 4: Im7
        // 5: ivm7
        // 6: ivm7
        // 7: Im7
        // 8: Im7
        // 9: ii7b5 (2 semitones)
        // 10: V7alt (7 semitones)
        // 11: Im7
        // 12: V7alt
        degrees: [0, 5, 0, 0, 5, 5, 0, 0, 2, 7, 0, 7],
        suffixes: ['m7', 'm7', 'm7', 'm7', 'm7', 'm7', 'm7', 'm7', 'm7b5', '7alt', 'm7', '7alt'],
        measures: Array(12).fill(1)
    },
    'RhythmChanges': {
        // A Section (8 bars)
        // | I VI | ii V | I VI | ii V |
        // | I I7 | IV #IVdim | I V | I |
        // Let's do a standard version:
        // 1: I, VI, ii, V (2 beats each -> simplified to 1 chord per bar for now? No, sequencer supports beats.)
        // Our sequencer is 1 slot per beat. 1 measure = 4 slots.
        // Let's defined chords per measure.
        // If we want 2 chords per measure, we need to handle that.
        // Current structure: degrees/suffixes lists are 1-to-1.
        // Let's just output the list of chords.
        // Measure 1: I maj7, VI 7 (A7 in C? usually A7 or Am7. Let's do A7 for VI7)
        // Actually, let's keep it simple for V1. 1 chord per measure is easier, but Rhythm Changes needs 2.
        // Let's assume the user can edit. Let's provide a "simplified" Rhythm Changes or expand our logic.
        // Implementation decision: Expand logic to return detailed sequence.

        // Wait, "degrees" is just semitones from root.
        // Let's just list the chords in order of *beats*? No, that's too much data.
        // Let's stick to 1 chord per *measure* for the simple UI, EXCEPT Rhythm Changes is too fast for that.
        // Let's skip Rhythm Changes for this iteration to ensure high quality on the others, 
        // OR implement it as: Imaj7 | A7 | Dm7 | G7 | ... which is half-time but playable.
        // Better: Imaj7 (Meas 1), Dm7 (Meas 2), G7 (Meas 3)... no that's wrong.
        // Let's DO implement 2 chords per bar support if needed.

        // For this V1, let's stick to 1 chord per bar for the Blues/II-V-I.
        // I will comment out Rhythm Changes for now to avoid complexity spike.
        degrees: [
            0, 9, 2, 7, // Bar 1-2: I vi ii V
            0, 9, 2, 7, // Bar 3-4: I vi ii V
            0, 0, 5, 6, // Bar 5-6: I I7 IV #IVdim
            0, 7, 0, 7  // Bar 7-8: I V I V
        ],
        suffixes: [
            'maj7', 'm7', 'm7', '7',
            'maj7', 'm7', 'm7', '7',
            'maj7', '7', 'maj7', 'dim7',
            'maj7', '7', 'maj7', '7'
        ],
        measures: Array(16).fill(0.5) // 0.5 measures * 4 beats/measure = 2 beats each
    }
};

interface GeneratedChord {
    name: string;
    root: string;
    durationBeats: number;
}

function getChordsForProgression(type: ProgressionType, keyRoot: Note): GeneratedChord[] {
    // Exclude RhythmChanges for now


    const prog = PROGRESSIONS[type];
    const chords: GeneratedChord[] = [];

    prog.degrees.forEach((semitones, i) => {
        // Use flat preference generally, unless key is sharp-heavy. 
        // Simple heuristic: keyRoot has # -> prefer sharps.
        const preferFlats = !keyRoot.includes('#');

        let root = transpose(keyRoot, semitones, preferFlats);

        // Fix for "Dim7" on #IV in Major Blues
        // In Bb: #IV is E dim. IV is Eb.
        // semitones for IV is 5. #IV is 6.
        // transpose('Bb', 6) -> E (natural). Correct.

        const suffix = prog.suffixes[i];

        chords.push({
            name: `${root}${suffix}`,
            root: root,
            durationBeats: prog.measures[i] * 4
        });
    });

    return chords;
}


// Voice Leading Helper
function getAverageFret(v: Voicing): number {
    if (v.positions.length === 0) return 0;
    const sum = v.positions.reduce((acc, p) => acc + p.fret, 0);
    return sum / v.positions.length;
}

function getDistance(v1: Voicing, v2: Voicing): number {
    // Sum of absolute fret distances for each voice?
    // Voices might not be in same order. Sort by string to align voices.
    // Drop 2 has 4 voices. Shell has 3.
    // Ideally we align by pitch (low to high).

    // Sort positions by string (high string index = high pitch? No. String 0 is Low E. String 5 is High E.)
    // So sorting by string index is roughly sorting by pitch.
    const p1 = [...v1.positions].sort((a, b) => a.string - b.string);
    const p2 = [...v2.positions].sort((a, b) => a.string - b.string);

    // If different note count, penalty
    if (p1.length !== p2.length) return 100;

    let dist = 0;
    for (let i = 0; i < p1.length; i++) {
        dist += Math.abs(p1[i].fret - p2[i].fret);
    }
    return dist;
}

export function generateProgressionSequence(
    type: ProgressionType,
    keyRoot: Note,
    voicingType: VoicingType,
    stringSet: number[]
): (Voicing & { intervalMap?: Record<string, string> } | null)[] {

    const chData = getChordsForProgression(type, keyRoot);
    if (chData.length === 0) return [];



    // 1. Generate all candidates for each chord
    const allCandidates: Voicing[][] = chData.map(ch => {
        const parsed = parseChord(ch.name);
        if (!parsed) return []; // Should not happen with our presets

        // Handle "Alt" special case logic (from App.tsx) ideally refactored, 
        // but for now let's rely on standard generator handling basic types.
        // App.tsx handles 'Altered Dominant' by manual expansion. 
        // voicing-generator's generateVoicings handles standard notes.
        // We need to feed specific notes for Alt.

        let notes: Note[] = [];
        let candidates: Voicing[] = [];

        if (parsed.quality === 'Altered Dominant') {
            // Hardcode a nice Alt voicing: 1, 3, b7, b9
            // Changed from #9 to b9 to fit standard Drop 3 spans better and be more "inside"
            const altIntervals = ['1P', '3M', '7m', '9m'];
            notes = getNotesFromIntervals(parsed.root, altIntervals);
        } else {
            notes = getNotesFromIntervals(parsed.root, parsed.intervals);
        }

        // Filter notes for voicing type requirements
        // Drop 2/3/2+4 need 4 notes.
        // Shell/FG need 3 notes.

        if (voicingType === 'Shell' || voicingType === 'FreddieGreen') {
            // Need R, 3, 7
            if (parsed.quality === 'Altered Dominant') {
                // Manual Alt keys: [1, 3, 7, 9]. We want [1, 3, 7].
                // Indices: 0, 1, 2.
                if (notes.length >= 3) {
                    notes = [notes[0], notes[1], notes[2]];
                }
            } else {
                // Standard 7ths: [1, 3, 5, 7]. We want [1, 3, 7].
                // Indices: 0, 1, 3.
                // m7b5: [1, b3, b5, b7]. Indices: 0, 1, 3.
                if (notes.length >= 4) {
                    notes = [notes[0], notes[1], notes[3]];
                }
            }
        } else {
            // Drop voicings need 4 notes.
            if (notes.length === 5) {
                // Omit 5th (index 2) for 9th chords
                notes = [notes[0], notes[1], notes[3], notes[4]];
            }
        }

        candidates = generateVoicings(notes, voicingType, stringSet);

        // Attach the interval map for the UI
        const iMap = getIntervalMap(parsed.root, parsed.intervals);
        return candidates.map(v => ({ ...v, intervalMap: iMap }));
    });

    // 2. Voice Leading Selection
    let selectedVoicings: (Voicing | null)[] = [];

    // Choose first chord: Closest to Fret 5 (average fret)
    const firstCandidates = allCandidates[0];
    if (firstCandidates && firstCandidates.length > 0) {
        // Sort by distance from fret 5
        firstCandidates.sort((a, b) => Math.abs(getAverageFret(a) - 5) - Math.abs(getAverageFret(b) - 5));
        selectedVoicings.push(firstCandidates[0]);
    } else {
        selectedVoicings.push(null); // Failed to generate first chord
    }

    // Choose subsequent chords
    for (let i = 1; i < chData.length; i++) {
        const prev = selectedVoicings[i - 1];
        const currentCandidates = allCandidates[i];

        if (currentCandidates && currentCandidates.length > 0) {
            if (prev) {
                // Sort by valid distance to prev
                currentCandidates.sort((a, b) => getDistance(prev, a) - getDistance(prev, b));
                selectedVoicings.push(currentCandidates[0]);
            } else {
                // No previous chord to guide leading, pick "center" (Fret 5)
                currentCandidates.sort((a, b) => Math.abs(getAverageFret(a) - 5) - Math.abs(getAverageFret(b) - 5));
                selectedVoicings.push(currentCandidates[0]);
            }
        } else {
            console.warn("No voicing found for", chData[i].name);
            selectedVoicings.push(null);
        }
    }

    // 3. Build Sequence Array (160 slots)
    // Map selected voicings to the measure durations
    let slotIndex = 0;

    // Ensure we account for the 160 slot limit
    const MAX_SLOTS = 160;

    const finalSeq = Array(MAX_SLOTS).fill(null);

    selectedVoicings.forEach((v, index) => {
        const duration = chData[index].durationBeats;
        // Fill duration
        for (let b = 0; b < duration; b++) {
            if (slotIndex < MAX_SLOTS) {
                if (v) {
                    // Clone voicing to avoid reference issues
                    finalSeq[slotIndex] = { ...v, name: chData[index].name };
                }
                slotIndex++;
            }
        }
    });

    return finalSeq;
}
