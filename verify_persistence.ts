
import { validateSequence } from './src/logic/persistence-utils.ts';

const validVoicing = {
    name: "Cmaj7",
    positions: [{ string: 1, fret: 3, note: "C" }]
};

const validSequence = [
    validVoicing,
    null,
    validVoicing,
    null
];

const invalidSequence1 = "not an array";
const invalidSequence2 = [{ name: "Bad", positions: "not array" }];
const invalidSequence3 = [{ name: 123, positions: [] }]; // name not string

console.log("Testing validateSequence...");

const t1 = validateSequence(validSequence);
console.log(`Test 1 (Valid): ${t1 ? "PASS" : "FAIL"}`);

const t2 = validateSequence(invalidSequence1);
console.log(`Test 2 (Not array): ${!t2 ? "PASS" : "FAIL"}`);

const t3 = validateSequence(invalidSequence2);
console.log(`Test 3 (Bad structure): ${!t3 ? "PASS" : "FAIL"}`);

const t4 = validateSequence(invalidSequence3);
console.log(`Test 4 (Bad type): ${!t4 ? "PASS" : "FAIL"}`);

if (t1 && !t2 && !t3 && !t4) {
    console.log("ALL TESTS PASSED");
} else {
    console.log("SOME TESTS FAILED");
    process.exit(1);
}
