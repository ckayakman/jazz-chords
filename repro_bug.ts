
import { generateProgressionSequence } from './src/logic/progression-generator';
import { VoicingType } from './src/logic/voicing-generator';

const type: VoicingType = 'Drop3';
const badStringSet = [1, 3, 4, 5]; // The CORRECTED default behavior

console.log(`Testing ${type} with string set [${badStringSet}]...`);

// Try to generate a C Major II-V-I
const seq = generateProgressionSequence('MajorII_V_I', 'C', type, badStringSet);

console.log("Sequence Length:", seq.length);

if (seq.length === 0) {
    console.log("FAIL: Sequence is empty. Confirmed bug.");
    process.exit(1);
}

const firstChord = seq[0];
if (!firstChord) {
    console.log("FAIL: First chord is null (Sequence is empty of content).");
    process.exit(1);
}

console.log("SUCCESS: Sequence generated.");
