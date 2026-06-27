// First-pass guitar lick generator
// Exports generateLick(progression, key, difficulty, options)
// Assumptions: `progression` is an array of chords with fields { rootMidi: number, type?: string, durationBeats?: number }

export type NoteEvent = {
  pitch: number; // MIDI note number
  startBeat: number;
  durationBeats: number;
  string?: number; // 0..4 for top 5 strings (A,D,G,B,E)
  fret?: number;
};

export type Lick = {
  id: string;
  key?: number; // MIDI of key tonic
  progressionId?: string;
  difficulty: number;
  notes: NoteEvent[];
  metadata?: any;
};

const OPEN_STRING_MIDI = [45, 50, 55, 59, 64]; // A2, D3, G3, B3, E4 (top 5 strings)
const DEFAULT_FRET_MIN = 1; // avoid open strings
const DEFAULT_FRET_MAX = 20;

function randChoice<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isMinorChord(type?: string) {
  if (!type) return false;
  return /m(?!a)/.test(type) || /min/.test(type);
}

function chordThird(rootMidi: number, type?: string) {
  return rootMidi + (isMinorChord(type) ? 3 : 4);
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function mapPitchToTop5(pitch: number, fretMin = DEFAULT_FRET_MIN, fretMax = DEFAULT_FRET_MAX) {
  // Return the first direct candidate mapping found for single-note mapping.
  for (let octaveShift of [0, -12, 12]) {
    const p = pitch + octaveShift;
    for (let s = 0; s < OPEN_STRING_MIDI.length; s++) {
      const fret = p - OPEN_STRING_MIDI[s];
      if (fret >= fretMin && fret <= fretMax) {
        return { string: s, fret };
      }
    }
  }
  // fallback: project into top E string with octave transposition
  const targetOpen = OPEN_STRING_MIDI[4];
  let fret = pitch - targetOpen;
  // try moving up octaves until in range
  while (fret < fretMin) {
    fret += 12;
  }
  fret = clamp(fret, fretMin, fretMax);
  return { string: 4, fret };
}

function candidateMappingsForPitch(pitch: number, fretMin = DEFAULT_FRET_MIN, fretMax = DEFAULT_FRET_MAX) {
  const candidates: { string: number; fret: number; pitch: number }[] = [];
  const octaveShifts = [0, -12, 12];
  for (const shift of octaveShifts) {
    const p = pitch + shift;
    for (let s = 0; s < OPEN_STRING_MIDI.length; s++) {
      const fret = p - OPEN_STRING_MIDI[s];
      if (Number.isFinite(fret) && fret >= fretMin && fret <= fretMax) {
        candidates.push({ string: s, fret, pitch: p });
      }
    }
  }
  return candidates;
}

function assignStringMapping(notes: NoteEvent[], fretMin = DEFAULT_FRET_MIN, fretMax = DEFAULT_FRET_MAX, difficulty = 1) {
  // Sequence-aware assignment: choose candidate mapping for each note minimizing string jumps
  if (notes.length === 0) return;

  // Build candidates per note
  const allCandidates = notes.map(n => candidateMappingsForPitch(n.pitch, fretMin, fretMax));

  // If any note has no candidate, try expanding search by octave +/-24
  for (let i = 0; i < notes.length; i++) {
    if (allCandidates[i].length === 0) {
      const extra: any[] = [];
      for (const shift of [24, -24]) {
        const p = notes[i].pitch + shift;
        for (let s = 0; s < OPEN_STRING_MIDI.length; s++) {
          const fret = p - OPEN_STRING_MIDI[s];
          if (Number.isFinite(fret) && fret >= fretMin && fret <= fretMax) extra.push({ string: s, fret, pitch: p });
        }
      }
      if (extra.length > 0) allCandidates[i] = extra;
    }
  }

  // Choose mapping greedily with cost function
  let prev = null as { string: number; fret: number } | null;
  for (let i = 0; i < notes.length; i++) {
    const cands = allCandidates[i];
    if (!cands || cands.length === 0) {
      // As a last resort, map to top E string by clamping
      const fall = mapPitchToTop5(notes[i].pitch, fretMin, fretMax);
      notes[i].string = fall.string;
      notes[i].fret = fall.fret;
      prev = { string: notes[i].string!, fret: notes[i].fret! };
      continue;
    }

    // Evaluate cost for each candidate
    let best = cands[0];
    let bestScore = Infinity;
    for (const cand of cands) {
      let score = 0;
      // prefer lower fret positions mildly
      score += cand.fret * 0.05;
      if (prev) {
        const fretJump = Math.abs(cand.fret - prev.fret);
        const stringJump = Math.abs(cand.string - prev.string);
        score += fretJump * 0.8; // penalize large fret jumps
        score += stringJump * 1.0; // penalize string changes
        // heavy penalty for extreme jumps
        if (fretJump > 7) score += 8;
        if (stringJump > 2) score += 6;
      } else {
        // prefer middle of neck for first note
        if (cand.fret > (fretMax - fretMin) * 0.6 + fretMin) score += 1.5;
      }

      // Sliding-window hand-shape penalty: notes within this many beats should be playable in one hand shape
      const windowBeats = difficulty === 1 ? 1.0 : difficulty === 2 ? 0.75 : 0.5;
      const windowFrets: number[] = [];
      for (let k = i - 1; k >= 0; k--) {
        const prevNote = notes[k];
        if (prevNote.startBeat < notes[i].startBeat - windowBeats) break;
        if (prevNote.fret != null) windowFrets.push(prevNote.fret);
      }
      // include this candidate fret in span calculation
      if (windowFrets.length > 0) {
        const fmin = Math.min(...windowFrets, cand.fret);
        const fmax = Math.max(...windowFrets, cand.fret);
        const span = fmax - fmin;
        // comfortable span thresholds depend on difficulty
        const allowed = difficulty === 1 ? 4 : difficulty === 2 ? 5 : 7;
        if (span > allowed) {
          score += (span - allowed) * 6 + 12; // steep penalty for impossible stretches
        }
      }

      if (score < bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    notes[i].string = best.string;
    notes[i].fret = best.fret;
    prev = { string: best.string, fret: best.fret };
  }
}

function buildEasyRhythm(totalBeats: number) {
  const patterns: Record<number, number[][]> = {
    4: [
      [1, 1, 1, 1],
      [1, 1, 0.5, 0.5],
      [1, 0.5, 1, 0.5],
      [0.5, 1, 0.5, 1],
      [1, 1, 1],
      [1, 0.5, 0.5, 1],
      [0.5, 0.5, 1, 1],
    ],
    2: [[1, 1], [1, 0.5], [0.5, 1], [0.5, 0.5]],
    1: [[1], [0.5, 0.5]],
  };
  const available = patterns[totalBeats] || [[totalBeats]];
  return randChoice(available);
}

function buildRhythm(totalBeats: number, difficulty: number) {
  if (difficulty <= 1) {
    return buildEasyRhythm(totalBeats);
  }

  // Durations allowed: quarter(1), eighth(0.5), sixteenth(0.25), triplet(1/3)
  // No 32nd notes.
  // Difficulty affects available subdivisions and their weights.
  const choices: number[] = [];
  const weights: number[] = [];

  if (difficulty === 2) {
    // Medium: allow sixteenth, mostly quarters/eighths
    choices.push(1, 0.5, 0.25);
    weights.push(0.45, 0.45, 0.1);
  } else {
    // Hard: allow triplets and sixteenths with higher density
    choices.push(1, 0.5, 0.25, 1 / 3);
    weights.push(0.25, 0.35, 0.25, 0.15);
  }

  function chooseWeighted<T>(items: T[], w: number[]) {
    const sum = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < items.length; i++) {
      if (r < w[i]) return items[i];
      r -= w[i];
    }
    return items[items.length - 1];
  }

  const out: number[] = [];
  let remaining = totalBeats;
  let attempts = 0;
  while (remaining > 1e-6 && attempts < 200) {
    const c = chooseWeighted(choices, weights);
    if (c > remaining + 1e-6) {
      const smaller = choices.filter((x) => x <= remaining + 1e-6);
      if (smaller.length === 0) break;
      out.push(smaller[0]);
      remaining -= out[out.length - 1];
    } else {
      out.push(c);
      remaining -= c;
    }
    attempts++;
  }
  if (remaining > 1e-6) out.push(remaining);

  const allFast = out.every((d) => Math.abs(d - 0.25) < 1e-6 || Math.abs(d - 1 / 3) < 1e-6);
  if (allFast) {
    out[0] = 1;
  }

  return out;
}

function buildModalScalePitches(root: number, type?: string, octaves = 2) {
  let degrees: number[];
  if (/m7b5|dim7|m7b5|m7b5/i.test(type || '')) {
    degrees = [0, 2, 3, 5, 6, 8, 10];
  } else if (isMinorChord(type)) {
    degrees = [0, 2, 3, 5, 7, 9, 10]; // Dorian-like
  } else if (/7/.test(type || '') || /dom/.test(type || '')) {
    degrees = [0, 2, 4, 5, 7, 9, 10]; // Mixolydian-like
  } else {
    degrees = [0, 2, 4, 5, 7, 9, 11]; // major / Ionian
  }

  const pitches: number[] = [];
  const startRoot = root - 12;
  for (let octave = 0; octave <= octaves; octave++) {
    const shift = octave * 12;
    for (const degree of degrees) {
      pitches.push(startRoot + shift + degree);
    }
  }
  return pitches.filter((p) => p >= 0 && p < 128);
}

function chordSeventh(rootMidi: number, type?: string) {
  if (!type) return rootMidi + 10;
  return /maj7|M7|Δ/.test(type) ? rootMidi + 11 : rootMidi + 10;
}

function buildChordPitches(root: number, type?: string, octaves = 2) {
  const third = chordThird(root, type);
  const fifth = root + 7;
  const seventh = chordSeventh(root, type);
  const pitches: number[] = [];
  const startRoot = root - 12;
  for (let octave = 0; octave <= octaves; octave++) {
    const shift = octave * 12;
    pitches.push(startRoot + shift, third + shift, fifth + shift, seventh + shift);
  }
  return pitches.filter((p) => p >= 0 && p < 128);
}

function nearestPitchIndex(target: number, pool: number[]) {
  let bestIndex = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < pool.length; i++) {
    const diff = Math.abs(pool[i] - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function nextPoolStep(prevPitch: number, direction: number, pool: number[]) {
  if (pool.length === 0) return prevPitch;
  const sorted = [...pool].sort((a, b) => a - b);
  const index = nearestPitchIndex(prevPitch, sorted);
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= sorted.length) {
    return sorted[index];
  }
  return sorted[nextIndex];
}

function chooseStartPitch(
  root: number,
  phraseType: string,
  scalePitches: number[],
  chordPitches: number[],
  forcedPitch?: number
) {
  if (forcedPitch != null) {
    return clamp(forcedPitch, 0, 127);
  }

  const baseTarget = root + 12;
  if (phraseType === 'arpeggio') {
    return chordPitches.length > 0 ? chordPitches[nearestPitchIndex(baseTarget, chordPitches)] : baseTarget;
  }
  return scalePitches.length > 0 ? scalePitches[nearestPitchIndex(baseTarget, scalePitches)] : baseTarget;
}

function chooseEndingPitch(root: number, type: string | undefined, nextChord?: { rootMidi: number; type?: string }) {
  if (nextChord) {
    return chordSeventh(root, type);
  }
  return chordThird(root, type);
}

function chooseNextLickPitch(
  prevPitch: number,
  phraseType: string,
  direction: number,
  currentBeat: number,
  difficulty: number,
  allowOutside: boolean,
  scalePitches: number[],
  chordPitches: number[]
) {
  const candidates: number[] = [];
  const stepScale = nextPoolStep(prevPitch, direction, scalePitches);
  const stepChord = nextPoolStep(prevPitch, direction, chordPitches);
  const chromatic = clamp(prevPitch + direction, 0, 127);
  const isOffBeat = Math.abs(currentBeat % 1) > 1e-6;

  if (phraseType === 'scalar') {
    candidates.push(stepScale);
    if (difficulty >= 2) candidates.push(stepChord);
  } else if (phraseType === 'arpeggio') {
    candidates.push(stepChord);
    if (difficulty >= 2) candidates.push(stepScale);
  } else if (phraseType === 'pivot') {
    if (Math.random() < 0.5) {
      candidates.push(stepChord);
      candidates.push(stepScale);
    } else {
      candidates.push(stepScale);
      candidates.push(stepChord);
    }
    if (difficulty >= 3 && isOffBeat && allowOutside) candidates.push(chromatic);
  } else {
    candidates.push(stepScale);
    candidates.push(stepChord);
    if (difficulty >= 2 && isOffBeat && allowOutside) {
      candidates.push(chromatic);
    }
  }

  if (allowOutside && difficulty >= 3 && isOffBeat && Math.random() < 0.15) {
    candidates.push(prevPitch + direction * 2);
  }

  const filtered = candidates
    .map((pitch) => clamp(pitch, 0, 127))
    .filter((pitch, index, self) => self.indexOf(pitch) === index);

  if (filtered.length === 0) return prevPitch;

  return randChoice(filtered);
}

function choosePhraseType(difficulty: number) {
  if (difficulty <= 1) return randChoice(['scalar', 'arpeggio']);
  if (difficulty === 2) return randChoice(['scalar', 'arpeggio', 'pivot']);
  return randChoice(['scalar', 'arpeggio', 'pivot', 'chromatic']);
}

function pickDirectionChangeIndices(slotCount: number, maxChanges: number) {
  if (maxChanges <= 0 || slotCount <= 1) return [];
  const available = Array.from({ length: slotCount - 1 }, (_, i) => i + 1);
  const chosen: number[] = [];
  while (chosen.length < maxChanges && available.length > 0) {
    const index = Math.floor(Math.random() * available.length);
    chosen.push(available.splice(index, 1)[0]);
  }
  return chosen.sort((a, b) => a - b);
}

function generateChordLickNotes(
  chord: { rootMidi: number; type?: string; durationBeats?: number },
  startBeat: number,
  difficulty: number,
  options?: { forcedStartPitch?: number; nextChord?: { rootMidi: number; type?: string } }
) {
  const root = chord.rootMidi;
  const dur = chord.durationBeats ?? 4;
  const rhythm = buildRhythm(dur, difficulty);
  const allowOutside = /7/.test(chord.type || '') || /dom/.test(chord.type || '');
  const phraseType = choosePhraseType(difficulty);
  const scalePitches = buildModalScalePitches(root, chord.type, 3);
  const chordPitches = buildChordPitches(root, chord.type, 3);
  const startingPitch = chooseStartPitch(
    root,
    phraseType,
    scalePitches,
    chordPitches,
    options?.forcedStartPitch
  );
  const targetRestPitch = chooseEndingPitch(root, chord.type, options?.nextChord);
  const direction = randChoice([1, -1]);
  const maxChanges = difficulty === 1 ? 0 : difficulty === 2 ? 1 : 2;
  const directionChangeIndices = pickDirectionChangeIndices(rhythm.length, maxChanges);

  const notes: NoteEvent[] = [];
  let currentDirection = direction;
  let prevPitch = startingPitch;
  let position = 0;

  for (let i = 0; i < rhythm.length; i++) {
    if (directionChangeIndices.includes(i)) {
      currentDirection *= -1;
    }

    const durationBeats = rhythm[i];
    const isLast = i === rhythm.length - 1;
    const pitch = isLast
      ? targetRestPitch
      : chooseNextLickPitch(prevPitch, phraseType, currentDirection, startBeat + position, difficulty, allowOutside, scalePitches, chordPitches);

    notes.push({ pitch, startBeat: startBeat + position, durationBeats });
    prevPitch = pitch;
    position += durationBeats;
  }

  return notes;
}

export function generateLick(
  progression: Array<{ rootMidi: number; type?: string; durationBeats?: number }>,
  keyMidi?: number,
  difficulty = 1,
  options?: { fretMin?: number; fretMax?: number }
): Lick {
  const startFret = options?.fretMin ?? DEFAULT_FRET_MIN;
  const endFret = options?.fretMax ?? DEFAULT_FRET_MAX;
  const notes: NoteEvent[] = [];
  let currentBeat = 0;

  progression.forEach((chord, index) => {
    const nextChord = progression[index + 1];
    const forcedStartPitch = difficulty === 1 ? chordThird(chord.rootMidi, chord.type) : undefined;
    const chordNotes = generateChordLickNotes(chord, currentBeat, difficulty, {
      forcedStartPitch,
      nextChord,
    });
    notes.push(...chordNotes);
    currentBeat += chord.durationBeats ?? 4;
  });

  // Assign playability-aware string/fret mapping for the whole sequence (difficulty-aware)
  assignStringMapping(notes, startFret, endFret, difficulty);

  const id = `lick_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  return { id, key: keyMidi, progressionId: undefined, difficulty, notes, metadata: { generatedAt: Date.now() } };
}

export default generateLick;
