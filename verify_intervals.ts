import { parseChord, getIntervalMap } from './src/logic/music-theory';

const testCases = [
    { chord: "Cmaj7", expected: { "C": "1", "E": "3", "G": "5", "B": "7" } },
    { chord: "C7", expected: { "C": "1", "E": "3", "G": "5", "Bb": "b7" } },
    { chord: "Cm7", expected: { "C": "1", "Eb": "b3", "G": "5", "Bb": "b7" } },
    { chord: "Cmaj7#4", expected: { "C": "1", "E": "3", "F#": "#4", "B": "7" } },
    { chord: "C7b9", expected: { "C": "1", "E": "3", "G": "5", "Bb": "b7", "Db": "b9" } }
];

let failed = false;

testCases.forEach(({ chord, expected }) => {
    const parsed = parseChord(chord);
    if (!parsed) {
        console.error(`Failed to parse ${chord}`);
        failed = true;
        return;
    }

    const map = getIntervalMap(parsed.root, parsed.intervals);

    // Check if map matches expected
    const mapStr = JSON.stringify(map);
    const expectedStr = JSON.stringify(expected);

    if (mapStr !== expectedStr) {
        console.error(`FAILED: ${chord}`);
        console.error(`  Expected: ${expectedStr}`);
        console.error(`  Actual:   ${mapStr}`);
        failed = true;
    } else {
        console.log(`PASSED: ${chord}`);
    }
});

if (failed) {
    process.exit(1);
} else {
    console.log("All tests passed!");
}
