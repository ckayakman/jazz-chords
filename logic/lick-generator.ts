// Bebop phrase library approach to lick generation.
// Rather than choosing notes step-by-step from a scale pool, this module stores
// pre-composed melodic cells in authentic bebop vocabulary (arpeggios, bebop scale
// runs, enclosures, chromatic approach cells) and transposes them to any key at runtime.

export type NoteEvent = {
  pitch: number;       // MIDI note number
  startBeat: number;
  durationBeats: number;
  string?: number;     // 0..4 for top 5 strings (A,D,G,B,E)
  fret?: number;
};

export type Lick = {
  id: string;
  key?: number;
  progressionId?: string;
  difficulty: number;
  notes: NoteEvent[];
  metadata?: any;
};

// ── Phrase template ───────────────────────────────────────────────────────────

type PhraseTemplate = {
  id: string;
  chordContext: 'major' | 'minor' | 'dom' | 'halfdim' | 'any';
  minDifficulty: number;   // 1 = easy, 2 = medium, 3 = hard
  durationBeats: number;   // always 2 or 4
  // Intervals are semitones above the chord root.
  // 12 = one octave up (the default center register for single-note guitar lines).
  notes: { interval: number; beats: number }[];
};

// ── Bebop vocabulary encoded as interval patterns ──────────────────────────────
//
// Bebop building blocks represented here:
//   Arpeggios        — chord tones R-3-5-7 (the skeleton of any bebop line)
//   Bebop scale runs — 8 eighth notes filling 4 beats; a chromatic passing tone
//                      is added to the scale so chord tones land on downbeats
//   Enclosures       — surround a chord tone from a half-step (or scale step)
//                      above and a half-step below, then resolve into the target
//   Chromatic cells  — b9 approach, tritone approach, 3rd→root chromatic descent
//
const PHRASE_LIBRARY: PhraseTemplate[] = [

  // ── DOMINANT 7 ─────────────────────────────────────────────────────────────
  // The V chord is the heart of bebop; most of the characteristic vocabulary lives here.

  // difficulty 1 — arpeggios (quarter notes)
  { id: 'dom-up-4',    chordContext: 'dom', minDifficulty: 1, durationBeats: 4,
    notes: [{interval:12,beats:1},{interval:16,beats:1},{interval:19,beats:1},{interval:22,beats:1}] },
  { id: 'dom-dn-4',    chordContext: 'dom', minDifficulty: 1, durationBeats: 4,
    notes: [{interval:22,beats:1},{interval:19,beats:1},{interval:16,beats:1},{interval:12,beats:1}] },
  { id: 'dom-up-2',    chordContext: 'dom', minDifficulty: 1, durationBeats: 2,
    notes: [{interval:12,beats:.5},{interval:14,beats:.5},{interval:16,beats:.5},{interval:19,beats:.5}] },
  { id: 'dom-dn-2',    chordContext: 'dom', minDifficulty: 1, durationBeats: 2,
    notes: [{interval:22,beats:.5},{interval:19,beats:.5},{interval:16,beats:.5},{interval:12,beats:.5}] },

  // difficulty 2 — bebop dominant scale: adds the natural 7 as a passing tone to
  // mixolydian, giving 8 notes per octave so chord tones land on downbeats
  { id: 'dom-bop-up',  chordContext: 'dom', minDifficulty: 2, durationBeats: 4,
    // R-2-3-4-5-6-b7-nat7
    notes: [{interval:12,beats:.5},{interval:14,beats:.5},{interval:16,beats:.5},{interval:17,beats:.5},
            {interval:19,beats:.5},{interval:21,beats:.5},{interval:22,beats:.5},{interval:23,beats:.5}] },
  { id: 'dom-bop-dn',  chordContext: 'dom', minDifficulty: 2, durationBeats: 4,
    // nat7-b7-6-5-4-3-2-R
    notes: [{interval:23,beats:.5},{interval:22,beats:.5},{interval:21,beats:.5},{interval:19,beats:.5},
            {interval:17,beats:.5},{interval:16,beats:.5},{interval:14,beats:.5},{interval:12,beats:.5}] },
  // enclosure of the 3rd: approach from P4 above and b3 below, land on 3rd, descend
  { id: 'dom-encl-3',  chordContext: 'dom', minDifficulty: 2, durationBeats: 4,
    notes: [{interval:17,beats:.5},{interval:15,beats:.5},{interval:16,beats:.5},{interval:19,beats:.5},
            {interval:22,beats:.5},{interval:19,beats:.5},{interval:16,beats:.5},{interval:12,beats:.5}] },
  // enclosure of the root: approach from b9 above and maj7 below, resolve to root
  { id: 'dom-encl-r',  chordContext: 'dom', minDifficulty: 2, durationBeats: 2,
    notes: [{interval:13,beats:.5},{interval:11,beats:.5},{interval:12,beats:.5},{interval:16,beats:.5}] },
  // 3rd up to b7 with stepwise motion (typical guide-tone line landing point)
  { id: 'dom-3-b7',    chordContext: 'dom', minDifficulty: 2, durationBeats: 2,
    notes: [{interval:16,beats:.5},{interval:17,beats:.5},{interval:19,beats:.5},{interval:22,beats:.5}] },
  // classic bebop "parker cell": ascend R-3-5-maj7, then descend b7-5
  { id: 'dom-parker',  chordContext: 'dom', minDifficulty: 2, durationBeats: 4,
    notes: [{interval:12,beats:.5},{interval:16,beats:.5},{interval:19,beats:.5},{interval:23,beats:.5},
            {interval:24,beats:.5},{interval:23,beats:.5},{interval:22,beats:.5},{interval:19,beats:.5}] },

  // difficulty 3 — chromatic cells
  // chromatic descent from the 3rd through b9 down to b7 below root
  { id: 'dom-chrom3',  chordContext: 'dom', minDifficulty: 3, durationBeats: 4,
    notes: [{interval:16,beats:.5},{interval:15,beats:.5},{interval:14,beats:.5},{interval:13,beats:.5},
            {interval:12,beats:.5},{interval:11,beats:.5},{interval:10,beats:.5},{interval:9,beats:.5}] },
  // dim7 arpeggio from the b9 (outlines b9-3-5-b7 of the dominant)
  { id: 'dom-dim7',    chordContext: 'dom', minDifficulty: 3, durationBeats: 4,
    notes: [{interval:13,beats:.5},{interval:16,beats:.5},{interval:19,beats:.5},{interval:22,beats:.5},
            {interval:21,beats:.5},{interval:19,beats:.5},{interval:16,beats:.5},{interval:13,beats:.5}] },
  // tritone approach: chromatic run from #4 (tritone sub color) down through root
  { id: 'dom-trit',    chordContext: 'dom', minDifficulty: 3, durationBeats: 4,
    notes: [{interval:18,beats:.5},{interval:17,beats:.5},{interval:16,beats:.5},{interval:15,beats:.5},
            {interval:14,beats:.5},{interval:13,beats:.5},{interval:12,beats:.5},{interval:11,beats:.5}] },

  // ── MINOR 7 ────────────────────────────────────────────────────────────────
  // The ii chord in a major key; Dorian mode is the natural home.

  // difficulty 1 — arpeggios
  { id: 'min-up-4',    chordContext: 'minor', minDifficulty: 1, durationBeats: 4,
    notes: [{interval:12,beats:1},{interval:15,beats:1},{interval:19,beats:1},{interval:22,beats:1}] },
  { id: 'min-dn-4',    chordContext: 'minor', minDifficulty: 1, durationBeats: 4,
    notes: [{interval:22,beats:1},{interval:19,beats:1},{interval:15,beats:1},{interval:12,beats:1}] },
  { id: 'min-up-2',    chordContext: 'minor', minDifficulty: 1, durationBeats: 2,
    notes: [{interval:12,beats:.5},{interval:14,beats:.5},{interval:15,beats:.5},{interval:19,beats:.5}] },
  { id: 'min-dn-2',    chordContext: 'minor', minDifficulty: 1, durationBeats: 2,
    notes: [{interval:22,beats:.5},{interval:19,beats:.5},{interval:15,beats:.5},{interval:12,beats:.5}] },
  // step down from b7 toward 5th — a natural guide-tone descent
  { id: 'min-step-2',  chordContext: 'minor', minDifficulty: 1, durationBeats: 2,
    notes: [{interval:22,beats:.5},{interval:21,beats:.5},{interval:19,beats:.5},{interval:17,beats:.5}] },

  // difficulty 2 — Dorian scale runs
  { id: 'min-dor-up',  chordContext: 'minor', minDifficulty: 2, durationBeats: 4,
    // R-2-b3-4-5-6-b7-R (Dorian: the natural 6 is the characteristic note)
    notes: [{interval:12,beats:.5},{interval:14,beats:.5},{interval:15,beats:.5},{interval:17,beats:.5},
            {interval:19,beats:.5},{interval:21,beats:.5},{interval:22,beats:.5},{interval:24,beats:.5}] },
  { id: 'min-dor-dn',  chordContext: 'minor', minDifficulty: 2, durationBeats: 4,
    notes: [{interval:24,beats:.5},{interval:22,beats:.5},{interval:21,beats:.5},{interval:19,beats:.5},
            {interval:17,beats:.5},{interval:15,beats:.5},{interval:14,beats:.5},{interval:12,beats:.5}] },
  // enclosure of the minor 3rd: M3 above, M2 below, land on b3, continue up
  { id: 'min-encl-3',  chordContext: 'minor', minDifficulty: 2, durationBeats: 4,
    notes: [{interval:16,beats:.5},{interval:14,beats:.5},{interval:15,beats:.5},{interval:19,beats:.5},
            {interval:22,beats:.5},{interval:19,beats:.5},{interval:15,beats:.5},{interval:12,beats:.5}] },
  // characteristic Dorian cell: b3-4-5-6 (the natural 6 gives Dorian its bright color)
  { id: 'min-dor-c',   chordContext: 'minor', minDifficulty: 2, durationBeats: 2,
    notes: [{interval:15,beats:.5},{interval:17,beats:.5},{interval:19,beats:.5},{interval:21,beats:.5}] },

  // difficulty 3 — chromatic
  { id: 'min-chrom',   chordContext: 'minor', minDifficulty: 3, durationBeats: 4,
    // chromatic descent from b7 to b3
    notes: [{interval:22,beats:.5},{interval:21,beats:.5},{interval:20,beats:.5},{interval:19,beats:.5},
            {interval:18,beats:.5},{interval:17,beats:.5},{interval:16,beats:.5},{interval:15,beats:.5}] },
  // enclosure into root, then ascend through arpeggio
  { id: 'min-encl-r',  chordContext: 'minor', minDifficulty: 3, durationBeats: 4,
    notes: [{interval:13,beats:.5},{interval:11,beats:.5},{interval:12,beats:.5},{interval:15,beats:.5},
            {interval:19,beats:.5},{interval:22,beats:.5},{interval:21,beats:.5},{interval:19,beats:.5}] },

  // ── MAJOR 7 ────────────────────────────────────────────────────────────────
  // The I chord; bebop major scale adds a chromatic b6/#5 between 5 and 6.

  // difficulty 1 — arpeggios
  { id: 'maj-up-4',    chordContext: 'major', minDifficulty: 1, durationBeats: 4,
    notes: [{interval:12,beats:1},{interval:16,beats:1},{interval:19,beats:1},{interval:23,beats:1}] },
  { id: 'maj-dn-4',    chordContext: 'major', minDifficulty: 1, durationBeats: 4,
    notes: [{interval:23,beats:1},{interval:19,beats:1},{interval:16,beats:1},{interval:12,beats:1}] },
  { id: 'maj-up-2',    chordContext: 'major', minDifficulty: 1, durationBeats: 2,
    notes: [{interval:12,beats:.5},{interval:14,beats:.5},{interval:16,beats:.5},{interval:19,beats:.5}] },
  { id: 'maj-dn-2',    chordContext: 'major', minDifficulty: 1, durationBeats: 2,
    notes: [{interval:23,beats:.5},{interval:19,beats:.5},{interval:16,beats:.5},{interval:12,beats:.5}] },

  // difficulty 2 — major bebop scale: adds chromatic #5 between 5 and 6
  { id: 'maj-bop-up',  chordContext: 'major', minDifficulty: 2, durationBeats: 4,
    // R-2-3-4-5-#5-6-7
    notes: [{interval:12,beats:.5},{interval:14,beats:.5},{interval:16,beats:.5},{interval:17,beats:.5},
            {interval:19,beats:.5},{interval:20,beats:.5},{interval:21,beats:.5},{interval:23,beats:.5}] },
  { id: 'maj-bop-dn',  chordContext: 'major', minDifficulty: 2, durationBeats: 4,
    // 7-6-#5-5-4-3-2-R
    notes: [{interval:23,beats:.5},{interval:21,beats:.5},{interval:20,beats:.5},{interval:19,beats:.5},
            {interval:17,beats:.5},{interval:16,beats:.5},{interval:14,beats:.5},{interval:12,beats:.5}] },
  // enclosure of the major 3rd: P4 above, b3 below, land on 3rd, continue up
  { id: 'maj-encl-3',  chordContext: 'major', minDifficulty: 2, durationBeats: 4,
    notes: [{interval:17,beats:.5},{interval:15,beats:.5},{interval:16,beats:.5},{interval:19,beats:.5},
            {interval:21,beats:.5},{interval:23,beats:.5},{interval:21,beats:.5},{interval:19,beats:.5}] },
  // 3-4-5-7 leap — lands on the maj7, characteristic of the Imaj7 sound
  { id: 'maj-leap-2',  chordContext: 'major', minDifficulty: 2, durationBeats: 2,
    notes: [{interval:16,beats:.5},{interval:17,beats:.5},{interval:19,beats:.5},{interval:23,beats:.5}] },

  // difficulty 3 — chromatic
  // chromatic descent from the 7 to the 3
  { id: 'maj-chrom',   chordContext: 'major', minDifficulty: 3, durationBeats: 4,
    notes: [{interval:23,beats:.5},{interval:22,beats:.5},{interval:21,beats:.5},{interval:20,beats:.5},
            {interval:19,beats:.5},{interval:18,beats:.5},{interval:17,beats:.5},{interval:16,beats:.5}] },
  // enclosure into root, then arpeggio
  { id: 'maj-encl-r',  chordContext: 'major', minDifficulty: 3, durationBeats: 4,
    notes: [{interval:13,beats:.5},{interval:11,beats:.5},{interval:12,beats:.5},{interval:16,beats:.5},
            {interval:19,beats:.5},{interval:23,beats:.5},{interval:21,beats:.5},{interval:19,beats:.5}] },

  // ── HALF-DIMINISHED ────────────────────────────────────────────────────────
  // The ii chord in a minor key; Locrian mode.

  // difficulty 1 — arpeggios
  { id: 'hd-up-4',     chordContext: 'halfdim', minDifficulty: 1, durationBeats: 4,
    notes: [{interval:12,beats:1},{interval:15,beats:1},{interval:18,beats:1},{interval:22,beats:1}] },
  { id: 'hd-dn-4',     chordContext: 'halfdim', minDifficulty: 1, durationBeats: 4,
    notes: [{interval:22,beats:1},{interval:18,beats:1},{interval:15,beats:1},{interval:12,beats:1}] },
  { id: 'hd-up-2',     chordContext: 'halfdim', minDifficulty: 1, durationBeats: 2,
    notes: [{interval:12,beats:.5},{interval:15,beats:.5},{interval:18,beats:.5},{interval:22,beats:.5}] },
  { id: 'hd-dn-2',     chordContext: 'halfdim', minDifficulty: 1, durationBeats: 2,
    notes: [{interval:22,beats:.5},{interval:18,beats:.5},{interval:15,beats:.5},{interval:12,beats:.5}] },

  // difficulty 2 — Locrian scale (R-b2-b3-4-b5-b6-b7)
  { id: 'hd-loc-up',   chordContext: 'halfdim', minDifficulty: 2, durationBeats: 4,
    notes: [{interval:12,beats:.5},{interval:13,beats:.5},{interval:15,beats:.5},{interval:17,beats:.5},
            {interval:18,beats:.5},{interval:20,beats:.5},{interval:22,beats:.5},{interval:24,beats:.5}] },
  { id: 'hd-loc-dn',   chordContext: 'halfdim', minDifficulty: 2, durationBeats: 4,
    notes: [{interval:24,beats:.5},{interval:22,beats:.5},{interval:20,beats:.5},{interval:18,beats:.5},
            {interval:17,beats:.5},{interval:15,beats:.5},{interval:13,beats:.5},{interval:12,beats:.5}] },

  // difficulty 3 — chromatic half-dim cell: b9-b3-b5-b7 arpeggio shape
  { id: 'hd-chrom',    chordContext: 'halfdim', minDifficulty: 3, durationBeats: 4,
    notes: [{interval:13,beats:.5},{interval:15,beats:.5},{interval:18,beats:.5},{interval:22,beats:.5},
            {interval:20,beats:.5},{interval:18,beats:.5},{interval:15,beats:.5},{interval:13,beats:.5}] },
];

// ── Chord type detection ──────────────────────────────────────────────────────

function getChordContext(type?: string): 'major' | 'minor' | 'dom' | 'halfdim' {
  if (!type) return 'major';
  if (/m7b5|ø|dim/i.test(type)) return 'halfdim';
  if (/maj|M7|Δ/.test(type)) return 'major';           // case-sensitive: "M7" ≠ "m7"
  if (/m(?!a)|min/i.test(type)) return 'minor';
  if (/[79]|11|13|dom|alt/i.test(type)) return 'dom';
  return 'major';
}

// ── Phrase selection ──────────────────────────────────────────────────────────

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function selectPhrase(
  context: 'major' | 'minor' | 'dom' | 'halfdim',
  durationBeats: number,
  difficulty: number,
  usedIds: Set<string>
): PhraseTemplate | null {
  const pool = PHRASE_LIBRARY.filter(
    p => (p.chordContext === context || p.chordContext === 'any') &&
         p.minDifficulty <= difficulty &&
         p.durationBeats === durationBeats
  );
  if (pool.length === 0) return null;
  // Prefer phrases not yet used this lick for variety; fall back to full pool if exhausted
  const fresh = pool.filter(p => !usedIds.has(p.id));
  return randChoice(fresh.length > 0 ? fresh : pool);
}

// ── Pitch resolution ──────────────────────────────────────────────────────────

// Translate a phrase's interval list into absolute MIDI pitches.
// The octave is chosen to keep the first note in a comfortable guitar register (MIDI 55-79)
// and secondarily to minimize the melodic jump from the previous phrase's ending pitch.
function applyPhrase(
  phrase: PhraseTemplate,
  rootMidi: number,
  prevEndPitch: number | null,
  startBeat: number
): NoteEvent[] {
  if (phrase.notes.length === 0) return [];

  const rawFirst = rootMidi + phrase.notes[0].interval;
  let octaveOffset = 0;

  // Primary: bring first note into guitar single-note register
  while (rawFirst + octaveOffset < 55) octaveOffset += 12;
  while (rawFirst + octaveOffset > 79) octaveOffset -= 12;

  // Secondary: nudge one octave toward the previous pitch for smooth voice-leading
  if (prevEndPitch !== null) {
    const curr = rawFirst + octaveOffset;
    const up   = curr + 12;
    const down = curr - 12;
    if (up <= 84 && Math.abs(up - prevEndPitch) < Math.abs(curr - prevEndPitch)) {
      octaveOffset += 12;
    } else if (down >= 48 && Math.abs(down - prevEndPitch) < Math.abs(curr - prevEndPitch)) {
      octaveOffset -= 12;
    }
  }

  let beat = startBeat;
  return phrase.notes.map(n => {
    const event: NoteEvent = {
      pitch: Math.max(40, Math.min(88, rootMidi + n.interval + octaveOffset)),
      startBeat: beat,
      durationBeats: n.beats,
    };
    beat += n.beats;
    return event;
  });
}

// ── Per-chord note building ───────────────────────────────────────────────────

// Fills the chord's full duration by stitching together phrases.
// For odd/short durations it chains a 4-beat phrase + 2-beat phrase as needed,
// and falls back to a single held chord tone for any remainder.
function buildChordNotes(
  chord: { rootMidi: number; type?: string; durationBeats?: number },
  startBeat: number,
  difficulty: number,
  prevEndPitch: number | null,
  usedIds: Set<string>
): NoteEvent[] {
  const totalDur = chord.durationBeats ?? 4;
  const context  = getChordContext(chord.type);
  const notes: NoteEvent[] = [];
  let remaining = totalDur;
  let beatPos   = startBeat;
  let prevPitch = prevEndPitch;

  while (remaining > 0) {
    const targetDur = remaining >= 4 ? 4 : remaining >= 2 ? 2 : 1;
    const phrase    = selectPhrase(context, targetDur, difficulty, usedIds);

    if (phrase) {
      usedIds.add(phrase.id);
      const phraseNotes = applyPhrase(phrase, chord.rootMidi, prevPitch, beatPos);
      notes.push(...phraseNotes);
      prevPitch  = phraseNotes[phraseNotes.length - 1]?.pitch ?? prevPitch;
      beatPos   += phrase.durationBeats;
      remaining -= phrase.durationBeats;
    } else {
      // Fallback: hold the chord's 3rd for whatever beats remain
      const interval = (context === 'minor' || context === 'halfdim') ? 15 : 16;
      let pitch = chord.rootMidi + interval;
      if (prevPitch !== null) {
        while (pitch < prevPitch - 6) pitch += 12;
        while (pitch > prevPitch + 6) pitch -= 12;
      }
      notes.push({
        pitch: Math.max(40, Math.min(88, pitch)),
        startBeat: beatPos,
        durationBeats: remaining,
      });
      break;
    }
  }

  return notes;
}

// ── Guitar position mapping (unchanged from original) ─────────────────────────

const OPEN_STRING_MIDI = [45, 50, 55, 59, 64]; // A2, D3, G3, B3, E4
const DEFAULT_FRET_MIN = 1;
const DEFAULT_FRET_MAX = 20;

function mapPitchToTop5(pitch: number, fretMin = DEFAULT_FRET_MIN, fretMax = DEFAULT_FRET_MAX) {
  for (const octaveShift of [0, -12, 12]) {
    const p = pitch + octaveShift;
    for (let s = 0; s < OPEN_STRING_MIDI.length; s++) {
      const fret = p - OPEN_STRING_MIDI[s];
      if (fret >= fretMin && fret <= fretMax) return { string: s, fret };
    }
  }
  const targetOpen = OPEN_STRING_MIDI[4];
  let fret = pitch - targetOpen;
  while (fret < fretMin) fret += 12;
  fret = Math.max(fretMin, Math.min(fretMax, fret));
  return { string: 4, fret };
}

function candidateMappingsForPitch(pitch: number, fretMin = DEFAULT_FRET_MIN, fretMax = DEFAULT_FRET_MAX) {
  const candidates: { string: number; fret: number; pitch: number }[] = [];
  for (const shift of [0, -12, 12]) {
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

function assignStringMapping(
  notes: NoteEvent[],
  fretMin = DEFAULT_FRET_MIN,
  fretMax = DEFAULT_FRET_MAX,
  difficulty = 1
) {
  if (notes.length === 0) return;

  const allCandidates = notes.map(n => candidateMappingsForPitch(n.pitch, fretMin, fretMax));

  for (let i = 0; i < notes.length; i++) {
    if (allCandidates[i].length === 0) {
      const extra: { string: number; fret: number; pitch: number }[] = [];
      for (const shift of [24, -24]) {
        const p = notes[i].pitch + shift;
        for (let s = 0; s < OPEN_STRING_MIDI.length; s++) {
          const fret = p - OPEN_STRING_MIDI[s];
          if (Number.isFinite(fret) && fret >= fretMin && fret <= fretMax) {
            extra.push({ string: s, fret, pitch: p });
          }
        }
      }
      if (extra.length > 0) allCandidates[i] = extra;
    }
  }

  let prev: { string: number; fret: number } | null = null;

  for (let i = 0; i < notes.length; i++) {
    const cands = allCandidates[i];
    if (!cands || cands.length === 0) {
      const fall = mapPitchToTop5(notes[i].pitch, fretMin, fretMax);
      notes[i].string = fall.string;
      notes[i].fret   = fall.fret;
      prev = { string: fall.string, fret: fall.fret };
      continue;
    }

    let best      = cands[0];
    let bestScore = Infinity;

    for (const cand of cands) {
      let score = cand.fret * 0.05;
      if (prev) {
        const fretJump   = Math.abs(cand.fret   - prev.fret);
        const stringJump = Math.abs(cand.string - prev.string);
        score += fretJump   * 0.8;
        score += stringJump * 1.0;
        if (fretJump   > 7) score += 8;
        if (stringJump > 2) score += 6;
      } else {
        if (cand.fret > (fretMax - fretMin) * 0.6 + fretMin) score += 1.5;
      }

      const windowBeats = difficulty === 1 ? 1.0 : difficulty === 2 ? 0.75 : 0.5;
      const windowFrets: number[] = [];
      for (let k = i - 1; k >= 0; k--) {
        if (notes[k].startBeat < notes[i].startBeat - windowBeats) break;
        if (notes[k].fret != null) windowFrets.push(notes[k].fret!);
      }
      if (windowFrets.length > 0) {
        const fmin  = Math.min(...windowFrets, cand.fret);
        const fmax  = Math.max(...windowFrets, cand.fret);
        const span  = fmax - fmin;
        const allowed = difficulty === 1 ? 4 : difficulty === 2 ? 5 : 7;
        if (span > allowed) score += (span - allowed) * 6 + 12;
      }

      if (score < bestScore) { bestScore = score; best = cand; }
    }

    notes[i].string = best.string;
    notes[i].fret   = best.fret;
    prev = { string: best.string, fret: best.fret };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateLick(
  progression: Array<{ rootMidi: number; type?: string; durationBeats?: number }>,
  keyMidi?: number,
  difficulty = 1,
  options?: { fretMin?: number; fretMax?: number }
): Lick {
  const fretMin = options?.fretMin ?? DEFAULT_FRET_MIN;
  const fretMax = options?.fretMax ?? DEFAULT_FRET_MAX;
  const notes: NoteEvent[]  = [];
  const usedIds             = new Set<string>();
  let currentBeat           = 0;
  let prevEndPitch: number | null = null;

  for (const chord of progression) {
    const chordNotes = buildChordNotes(chord, currentBeat, difficulty, prevEndPitch, usedIds);
    notes.push(...chordNotes);
    prevEndPitch  = chordNotes[chordNotes.length - 1]?.pitch ?? prevEndPitch;
    currentBeat  += chord.durationBeats ?? 4;
  }

  assignStringMapping(notes, fretMin, fretMax, difficulty);

  const id = `lick_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  return { id, key: keyMidi, progressionId: undefined, difficulty, notes, metadata: { generatedAt: Date.now() } };
}

export default generateLick;
