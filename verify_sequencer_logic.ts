// Simulate the state logic in App.tsx

interface Voicing { name: string }

let sequence: (Voicing | null)[] = Array(16).fill(null);
let activeSlot: number | null = 0;

function handleChordClick(voicing: Voicing) {
    if (activeSlot !== null) {
        // Add to sequence
        const newSeq = [...sequence];
        newSeq[activeSlot] = voicing;
        sequence = newSeq;

        // Advance slot
        activeSlot = (activeSlot !== null && activeSlot < 15) ? activeSlot + 1 : null;
    }
}

function handleClearSlot(index: number) {
    const newSeq = [...sequence];
    newSeq[index] = null;
    sequence = newSeq;
}

// Test Scenario
console.log("Initial State:", activeSlot);

// 1. Add 3 chords
handleChordClick({ name: "Cmaj7" });
console.log("After 1st chord:", activeSlot, sequence[0]?.name);

handleChordClick({ name: "Dm7" });
console.log("After 2nd chord:", activeSlot, sequence[1]?.name);

handleChordClick({ name: "G7" });
console.log("After 3rd chord:", activeSlot, sequence[2]?.name);

// 2. Verify slots
if (sequence[0]?.name === "Cmaj7" && sequence[1]?.name === "Dm7" && sequence[2]?.name === "G7") {
    console.log("PASS: Chords added correctly");
} else {
    console.error("FAIL: Chords not added correctly");
    process.exit(1);
}

if (activeSlot === 3) {
    console.log("PASS: Active slot advanced correctly");
} else {
    console.error("FAIL: Active slot did not advance correctly");
    process.exit(1);
}

// 3. Clear slot 1
handleClearSlot(1);
if (sequence[1] === null) {
    console.log("PASS: Slot 1 cleared");
} else {
    console.error("FAIL: Slot 1 not cleared");
    process.exit(1);
}

// 4. Fill slot 15 (last one)
activeSlot = 15;
handleChordClick({ name: "End" });
if (activeSlot === null) {
    console.log("PASS: Active slot became null after last slot");
} else {
    console.error("FAIL: Active slot did not become null");
    process.exit(1);
}

console.log("All logic tests passed!");
