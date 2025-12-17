
import { generateProgressionSequence } from './src/logic/progression-generator';
// Mock necessary parts if needed, but the generator is pure logic mostly.
// checking logic correctness

const seq = generateProgressionSequence('RhythmChanges', 'C', 'Drop2', [2, 3, 4, 5]);

console.log("Rhythm Changes Sequence Length:", seq.length);

// Check that we have chords in the first 32 slots
let filledCount = 0;
for (let i = 0; i < 32; i++) {
    if (seq[i]) filledCount++;
}

console.log(`Filled Slots in first 32: ${filledCount} (Expected 32)`);

if (filledCount !== 32) {
    console.error(`FAIL: Expected 32 filled slots, found ${filledCount}`);
    process.exit(1);
}

// Check first few chords
// Bar 1: Cmaj7 (2 beats), Am7 (2 beats)
// Bar 2: Dm7 (2 beats), G7 (2 beats)

const c1 = seq[0]; // Beat 1
const c2 = seq[2]; // Beat 3 (2 beats later)
const c3 = seq[4]; // Beat 1 of Meas 2 (4 beats from start)
const c4 = seq[6]; // Beat 3 of Meas 2

console.log("Chord 1:", c1?.name, "(Expected Cmaj7)");
console.log("Chord 2:", c2?.name, "(Expected Am7)");
console.log("Chord 3:", c3?.name, "(Expected Dm7)");
console.log("Chord 4:", c4?.name, "(Expected G7)");

if (!c1?.name.includes('C') || !c2?.name.includes('A') || !c3?.name.includes('D') || !c4?.name.includes('G')) {
    console.error("FAIL: Chord root mismatch");
    process.exit(1);
}

console.log("SUCCESS: Rhythm Changes logic valid");
