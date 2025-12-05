export type Note = string; // e.g., "C", "F#", "Bb"
export type Interval = string; // e.g., "1P", "3m", "5d"

export interface ChordComponents {
    root: Note;
    quality: string;
    intervals: Interval[];
}

const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function getNoteIndex(note: Note): number {
    const n = note.replace(/[0-9]/g, ''); // remove octave if present
    let idx = NOTES_SHARP.indexOf(n);
    if (idx === -1) idx = NOTES_FLAT.indexOf(n);
    return idx;
}

// Helper to determine if we should use sharps or flats based on root and quality
function useFlats(root: Note, quality: string): boolean {
    // 1. If root has flat, use flats.
    if (root.includes('b')) return true;
    // 2. If root has sharp, use sharps.
    if (root.includes('#')) return false;

    // 3. Natural roots
    // F major/minor usually has flats (Bb).
    if (root === 'F') return true;

    // C: C7 has Bb (flat). Cmin has Eb, Bb. Cmaj7 is natural.
    if (root === 'C') {
        if (quality.includes('Minor') || quality.includes('Dominant') || quality.includes('Diminished')) return true;
        return false; // Cmaj7
    }

    // D: Dmin has Bb. D7 has F# (sharp). Dmaj7 has F#, C#.
    if (root === 'D') {
        if (quality.includes('Minor') || quality.includes('Diminished')) return true; // Dm (1b), Ddim
        return false; // Dmaj, D7
    }

    // G: Gmin has Bb, Eb. G7 (1#). Gmaj (1#).
    if (root === 'G') {
        if (quality.includes('Minor') || quality.includes('Diminished')) return true;
        return false;
    }

    // A: Amin (natural). A7 (3#). Amaj (3#).
    // E: Emin (1#). E7 (4#). Emaj (4#).
    // B: Bmin (2#). B7 (5#). Bmaj (5#).

    // General heuristic for natural roots:
    // Major/Dom keys: C(0), G(1#), D(2#), A(3#), E(4#), B(5#), F(1b).
    // Minor keys: Am(0), Em(1#), Bm(2#), F#m(3#), C#m(4#), Dm(1b), Gm(2b), Cm(3b), Fm(4b).

    if (quality.includes('Minor') || quality.includes('Diminished')) {
        // Minor/Dim context
        if (['D', 'G', 'C', 'F'].includes(root)) return true; // Dm, Gm, Cm, Fm use flats
        return false; // Am, Em, Bm use sharps (or natural)
    } else {
        // Major/Dom context
        if (root === 'F') return true; // F major has Bb
        if (root === 'C' && quality.includes('Dominant')) return true; // C7 has Bb
        return false; // G, D, A, E, B use sharps
    }
}

export function transpose(root: Note, semitones: number, preferFlats: boolean): Note {
    let idx = getNoteIndex(root);
    if (idx === -1) return root;
    let newIdx = (idx + semitones) % 12;
    if (newIdx < 0) newIdx += 12;

    return preferFlats ? NOTES_FLAT[newIdx] : NOTES_SHARP[newIdx];
}

export function parseChord(name: string): ChordComponents | null {
    const match = name.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return null;

    const root = match[1];
    const rest = match[2];

    let intervals: Interval[] = ["1P"];
    let quality = "Unknown";

    // Basic qualities
    if (rest === "" || rest === "maj" || rest === "M") {
        quality = "Major";
        intervals = ["1P", "3M", "5P"];
    } else if (rest === "m" || rest === "min" || rest === "-") {
        quality = "Minor";
        intervals = ["1P", "3m", "5P"];
    } else if (rest === "7" || rest === "dom7") {
        quality = "Dominant 7";
        intervals = ["1P", "3M", "5P", "7m"];
    } else if (rest === "maj7" || rest === "M7" || rest === "Maj7") {
        quality = "Major 7";
        intervals = ["1P", "3M", "5P", "7M"];
    } else if (rest === "maj7#4" || rest === "M7#4" || rest === "maj7(#4)" || rest === "M7(#4)") {
        quality = "Major 7 #4";
        intervals = ["1P", "3M", "4A", "7M"];
    } else if (rest === "m7" || rest === "min7" || rest === "-7") {
        quality = "Minor 7";
        intervals = ["1P", "3m", "5P", "7m"];
    } else if (rest === "m7b5" || rest === "m7(b5)" || rest === "min7(b5)" || rest === "min7(5b)" || rest === "ø" || rest === "ø7") {
        quality = "Half Diminished";
        intervals = ["1P", "3m", "5d", "7m"];
    } else if (rest === "dim" || rest === "dim7" || rest === "o" || rest === "o7") {
        quality = "Diminished 7";
        intervals = ["1P", "3m", "5d", "6M"]; // 6M is enharmonically bb7
    } else if (rest === "6" || rest === "maj6" || rest === "M6") {
        quality = "Major 6";
        intervals = ["1P", "3M", "5P", "6M"];
    } else if (rest === "m6" || rest === "min6" || rest === "-6") {
        quality = "Minor 6";
        intervals = ["1P", "3m", "5P", "6M"];
    } else if (rest === "maj9" || rest === "M9" || rest === "Maj9") {
        quality = "Major 9";
        intervals = ["1P", "3M", "5P", "7M", "9M"];
    } else if (rest === "9" || rest === "dom9") {
        quality = "Dominant 9";
        intervals = ["1P", "3M", "5P", "7m", "9M"];
    } else if (rest === "7b9" || rest === "7(b9)" || rest === "dom7(b9)") {
        quality = "Dominant 7(b9)";
        intervals = ["1P", "3M", "5P", "7m", "9m"];
    } else if (rest === "m7b9" || rest === "min7(b9)" || rest === "-7(b9)") {
        quality = "Minor 7(b9)";
        intervals = ["1P", "3m", "5P", "7m", "9m"];
    } else if (rest === "m9" || rest === "min9" || rest === "-9") {
        quality = "Minor 9";
        intervals = ["1P", "3m", "5P", "7m", "9M"];
    } else if (rest === "mmaj7" || rest === "minmaj7" || rest === "-maj7") {
        quality = "Minor Major 7";
        intervals = ["1P", "3m", "5P", "7M"];
    } else if (rest === "maj7#5" || rest === "maj7(#5)" || rest === "M7#5" || rest === "M7(#5)") {
        quality = "Augmented Major 7";
        intervals = ["1P", "3M", "5A", "7M"];
    } else if (rest === "dom7#5" || rest === "dom7(#5)" || rest === "7#5" || rest === "7(#5)") {
        quality = "Augmented Dominant 7";
        intervals = ["1P", "3M", "5A", "7m"];
    } else if (rest === "dom7#11" || rest === "7#11" || rest === "dom7(#11)" || rest === "7(#11)") {
        quality = "Dominant 7 #11";
        intervals = ["1P", "3M", "5P", "7m", "11A"];
    } else if (rest === "dom7sus4" || rest === "7sus4") {
        quality = "Dominant 7 sus4";
        intervals = ["1P", "4P", "5P", "7m"];
    } else if (rest === "alt" || rest === "7alt" || rest === "dom7alt") {
        quality = "Altered Dominant";
        // Base intervals for identification, but App.tsx will expand this into multiple variations
        intervals = ["1P", "3M", "7m"];
    } else {
        return null;
    }

    return { root, quality, intervals };
}

export function getNotesFromIntervals(root: Note, intervals: Interval[]): Note[] {
    const rootIdx = getNoteIndex(root);
    if (rootIdx === -1) return [];

    // Determine spelling preference based on root and implied quality from intervals
    // We can pass the quality string if we had it, or re-derive.
    // Let's assume the parser passed us the quality or we infer it.
    // Actually, let's just use the root and a simple check.
    // If intervals contains '3m', it's minor-ish.
    const isMinor = intervals.includes('3m');
    const isDom = intervals.includes('7m') && (intervals.includes('3M') || intervals.includes('4P')); // 4P for sus4
    const isDim = intervals.includes('5d');

    let quality = "Major";
    if (isMinor) quality = "Minor";
    if (isDom) quality = "Dominant";
    if (isDim) quality = "Diminished"; // Overrides minor for spelling check purposes

    const preferFlats = useFlats(root, quality);

    return intervals.map(interval => {
        let semitones = 0;
        switch (interval) {
            case "1P": semitones = 0; break;
            case "3m": semitones = 3; break;
            case "3M": semitones = 4; break;
            case "4P": semitones = 5; break;
            case "4A": semitones = 6; break;
            case "5d": semitones = 6; break;
            case "5P": semitones = 7; break;
            case "5A": semitones = 8; break;
            case "6M": semitones = 9; break; // bb7 or 6
            case "7m": semitones = 10; break;
            case "7M": semitones = 11; break;
            case "9m": semitones = 13; break;
            case "9M": semitones = 14; break;
            case "9A": semitones = 15; break; // #9
            case "11A": semitones = 18; break; // Same pitch class as #4 (6 semitones)
        }

        // Force sharps for Augmented intervals (e.g. #5, #11) unless root dictates otherwise?
        // Actually, just locally prefer sharps for 'A' intervals if the global preference was flats,
        // to avoid "Ab" for #5 in C7.
        let localPreferFlats = preferFlats;
        if (interval.endsWith('A')) localPreferFlats = false;

        return transpose(root, semitones, localPreferFlats);
    });
}

export function formatInterval(interval: Interval): string {
    // Map internal interval codes to user-friendly labels
    const map: Record<string, string> = {
        "1P": "1",
        "3m": "b3",
        "3M": "3",
        "4P": "4",
        "4A": "#4",
        "5d": "b5",
        "5P": "5",
        "5A": "#5",
        "6M": "6",
        "7m": "b7",
        "7M": "7",
        "9m": "b9",
        "9M": "9",
        "9A": "#9",
        "11P": "11",
        "11A": "#11",
        "13M": "13"
    };
    return map[interval] || interval;
}

export function getIntervalMap(root: Note, intervals: Interval[]): Record<string, string> {
    const notes = getNotesFromIntervals(root, intervals);
    const map: Record<string, string> = {};

    notes.forEach((note, index) => {
        if (intervals[index]) {
            map[note] = formatInterval(intervals[index]);
        }
    });

    return map;
}
