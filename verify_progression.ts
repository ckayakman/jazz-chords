import { generateProgressionSequence } from './src/logic/progression-generator.ts';

function runVerification() {
    console.log("Starting progression generation verification...");

    const key = 'C';
    const voicingType = 'Drop2';
    const stringSet = [2, 3, 4, 5]; // Top set

    // 1. Verify Long Major ii-V-I
    const longMajorSeq = generateProgressionSequence('LongMajorII_V_I', key, voicingType, stringSet);
    if (!longMajorSeq) {
        console.error("FAIL: Long Major ii-V-I generated null sequence");
        process.exit(1);
    }
    // Expected chords: Dm7 (4 beats), G7 (4 beats), Cmaj7 (8 beats)
    const dm7Count = longMajorSeq.filter(s => s && s.name === 'Dm7').length;
    const g7Count = longMajorSeq.filter(s => s && s.name === 'G7').length;
    const cmaj7Count = longMajorSeq.filter(s => s && s.name === 'Cmaj7').length;

    console.log(`Long Major ii-V-I beats: Dm7=${dm7Count}, G7=${g7Count}, Cmaj7=${cmaj7Count}`);
    if (dm7Count !== 4 || g7Count !== 4 || cmaj7Count !== 8) {
        console.error("FAIL: Long Major ii-V-I beat counts do not match expected (4, 4, 8)");
        process.exit(1);
    }

    // 2. Verify Short Major ii-V-I
    const shortMajorSeq = generateProgressionSequence('ShortMajorII_V_I', key, voicingType, stringSet);
    if (!shortMajorSeq) {
        console.error("FAIL: Short Major ii-V-I generated null sequence");
        process.exit(1);
    }
    // Expected chords: Dm7 (2 beats), G7 (2 beats), Cmaj7 (4 beats)
    const shortDm7Count = shortMajorSeq.filter(s => s && s.name === 'Dm7').length;
    const shortG7Count = shortMajorSeq.filter(s => s && s.name === 'G7').length;
    const shortCmaj7Count = shortMajorSeq.filter(s => s && s.name === 'Cmaj7').length;

    console.log(`Short Major ii-V-I beats: Dm7=${shortDm7Count}, G7=${shortG7Count}, Cmaj7=${shortCmaj7Count}`);
    if (shortDm7Count !== 2 || shortG7Count !== 2 || shortCmaj7Count !== 4) {
        console.error("FAIL: Short Major ii-V-I beat counts do not match expected (2, 2, 4)");
        process.exit(1);
    }

    // 3. Verify Long Minor ii-V-i
    const longMinorSeq = generateProgressionSequence('LongMinorII_V_I', key, voicingType, stringSet);
    // Expected chords: Dm7b5 (4 beats), G7alt (4 beats), Cm7 (8 beats)
    const dm7b5Count = longMinorSeq.filter(s => s && s.name === 'Dm7b5').length;
    const g7altCount = longMinorSeq.filter(s => s && s.name === 'G7alt').length;
    const cm7Count = longMinorSeq.filter(s => s && s.name === 'Cm7').length;

    console.log(`Long Minor ii-V-i beats: Dm7b5=${dm7b5Count}, G7alt=${g7altCount}, Cm7=${cm7Count}`);
    if (dm7b5Count !== 4 || g7altCount !== 4 || cm7Count !== 8) {
        console.error("FAIL: Long Minor ii-V-i beat counts do not match expected (4, 4, 8)");
        process.exit(1);
    }

    // 4. Verify Short Minor ii-V-i
    const shortMinorSeq = generateProgressionSequence('ShortMinorII_V_I', key, voicingType, stringSet);
    // Expected chords: Dm7b5 (2 beats), G7alt (2 beats), Cm7 (4 beats)
    const shortDm7b5Count = shortMinorSeq.filter(s => s && s.name === 'Dm7b5').length;
    const shortG7altCount = shortMinorSeq.filter(s => s && s.name === 'G7alt').length;
    const shortCm7Count = shortMinorSeq.filter(s => s && s.name === 'Cm7').length;

    console.log(`Short Minor ii-V-i beats: Dm7b5=${shortDm7b5Count}, G7alt=${shortG7altCount}, Cm7=${shortCm7Count}`);
    if (shortDm7b5Count !== 2 || shortG7altCount !== 2 || shortCm7Count !== 4) {
        console.error("FAIL: Short Minor ii-V-i beat counts do not match expected (2, 2, 4)");
        process.exit(1);
    }

    console.log("Verification SUCCESS: All progression generation tests passed!");
}

runVerification();
