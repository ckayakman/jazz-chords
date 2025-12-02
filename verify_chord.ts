import { parseChord, getNotesFromIntervals } from './src/logic/music-theory.ts';

const chordName = "Cmaj7#4";
const parsed = parseChord(chordName);

if (!parsed) {
    console.error(`Failed to parse ${chordName}`);
    process.exit(1);
}

console.log(`Parsed ${chordName}:`, parsed);

const notes = getNotesFromIntervals(parsed.root, parsed.intervals);
console.log(`Notes for ${chordName}:`, notes);

const expectedNotes = ["C", "E", "F#", "B"];
const notesMatch = JSON.stringify(notes) === JSON.stringify(expectedNotes);

if (notesMatch) {
    console.log("Verification SUCCESS: Notes match expected output.");
} else {
    console.error("Verification FAILED: Notes do not match expected output.");
    console.error("Expected:", expectedNotes);
    console.error("Actual:", notes);
    process.exit(1);
}
