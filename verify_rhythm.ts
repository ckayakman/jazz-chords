
import { getAdaptiveTriggers, RhythmTrigger } from './src/logic/rhythm-patterns';

// Mock Voicing
interface Voicing {
    name: string;
}

// Charleston Pattern: 1 (Play), 2 (Play), 3 (Rest), 4 (Rest)
// Assuming 4-beat pattern for simplicity in this test context
// index 0 -> Play, 1 -> Play, 2 -> Rest, 3 -> Rest
// Wait, Charleston in code is:
// 0: Play
// 1: Play (offset 0.5) -- actually in code it is beat 1 play, beat 2 play offset 0.5?
/*
    'Charleston': [
        [{ offset: 0, duration: 1.2 }],       // Beat 1
        [{ offset: 0.5, duration: 0.4 }],     // Beat 2&
        [],                    // Beat 3 (rest)
        []                     // Beat 4 (rest)
    ],
*/
const charleston = [
    [{ offset: 0, duration: 1.2 }],
    [{ offset: 0.5, duration: 0.4 }],
    [],
    []
];

function test(name: string, condition: boolean) {
    if (condition) {
        console.log(`[PASS] ${name}`);
    } else {
        console.error(`[FAIL] ${name}`);
        process.exit(1);
    }
}

console.log('Running Adaptive Rhythm Verification...');

// Scenario 1: Beat 1 (Has Pattern) - Should return pattern triggers
const t1 = getAdaptiveTriggers(charleston, 0, { name: 'Cmaj7' }, null);
test('Beat 1 (Pattern Exists) returns pattern', t1.length === 1 && t1[0].offset === 0);

// Scenario 2: Beat 3 (No Pattern), Same Chord - Should rest
// Prev: Cmaj7, Curr: Cmaj7
const t2 = getAdaptiveTriggers(charleston, 2, { name: 'Cmaj7' }, { name: 'Cmaj7' });
test('Beat 3 (Rest), Same Chord returns Empty', t2.length === 0);

// Scenario 3: Beat 3 (No Pattern), New Chord - Should play
// Prev: Cmaj7, Curr: Dm7
const t3 = getAdaptiveTriggers(charleston, 2, { name: 'Dm7' }, { name: 'Cmaj7' });
test('Beat 3 (Rest), New Chord returns Fill Trigger', t3.length === 1 && t3[0].offset === 0 && t3[0].duration === 1.0);

// Scenario 4: Beat 3 (No Pattern), Null Current Chord - Should rest (or at least empty)
const t4 = getAdaptiveTriggers(charleston, 2, null, { name: 'Cmaj7' });
test('Beat 3 (Rest), No Chord returns Empty', t4.length === 0);

// Scenario 5: Beat 1 (Pattern Exists), New Chord - Should return pattern (Priority logic)
// Even if chord changes, if pattern says play, we play pattern triggers, not fill.
const t5 = getAdaptiveTriggers(charleston, 0, { name: 'Dm7' }, { name: 'Cmaj7' });
test('Beat 1 (Pattern Exists), New Chord returns Pattern', t5.length === 1 && t5[0].duration === 1.2);
// Note: Charleston beat 1 duration is 1.2, fill is 1.0. If it returns 1.2, it's the pattern.

console.log('All tests passed.');
