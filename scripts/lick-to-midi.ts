import fs from 'fs';
import generateLick from '../logic/lick-generator.ts';

function writeVarLen(value: number) {
  const bytes: number[] = [];
  let buffer = value & 0x7f;
  while ((value >>= 7) > 0) {
    bytes.unshift(0x80 | buffer);
    buffer = value & 0x7f;
  }
  bytes.unshift(buffer);
  return Buffer.from(bytes);
}

function numberToBytesBE(value: number, bytes: number) {
  const b = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i++) {
    b[bytes - 1 - i] = value & 0xff;
    value >>= 8;
  }
  return b;
}

function buildMidi(lick: any, bpm = 90) {
  const ppq = 480; // ticks per quarter
  const microsecondsPerQuarter = Math.round(60000000 / bpm);

  const events: Buffer[] = [];

  // tempo meta event at time 0
  events.push(Buffer.from([0x00, 0xff, 0x51, 0x03]));
  events.push(numberToBytesBE(microsecondsPerQuarter, 3));

  // track name meta (optional)
  const name = `Lick ${lick.id}`;
  events.push(Buffer.from([0x00, 0xff, 0x03, name.length]));
  events.push(Buffer.from(name));

  // Note events
  // Gather note on/off events with absolute tick times
  const noteEvents: { tick: number; type: 'on' | 'off'; note: number; vel: number }[] = [];
  lick.notes.forEach((n: any) => {
    const startTick = Math.round(n.startBeat * ppq);
    const durTicks = Math.round(n.durationBeats * ppq);
    noteEvents.push({ tick: startTick, type: 'on', note: n.pitch, vel: 96 });
    noteEvents.push({ tick: startTick + durTicks, type: 'off', note: n.pitch, vel: 64 });
  });

  noteEvents.sort((a, b) => a.tick - b.tick || (a.type === 'off' ? -1 : 1));

  let lastTick = 0;
  noteEvents.forEach(ev => {
    const delta = ev.tick - lastTick;
    events.push(writeVarLen(delta));
    if (ev.type === 'on') {
      events.push(Buffer.from([0x90, ev.note & 0x7f, ev.vel & 0x7f]));
    } else {
      events.push(Buffer.from([0x80, ev.note & 0x7f, ev.vel & 0x7f]));
    }
    lastTick = ev.tick;
  });

  // End of track
  events.push(Buffer.from([0x00, 0xff, 0x2f, 0x00]));

  const trackData = Buffer.concat(events);

  const header = Buffer.concat([
    Buffer.from('MThd'),
    numberToBytesBE(6, 4),
    numberToBytesBE(0, 2), // format 0
    numberToBytesBE(1, 2), // one track
    numberToBytesBE(ppq, 2),
  ]);

  const trackChunk = Buffer.concat([
    Buffer.from('MTrk'),
    numberToBytesBE(trackData.length, 4),
    trackData,
  ]);

  return Buffer.concat([header, trackChunk]);
}

function smallProgression(rootMidi: number) {
  return [
    { rootMidi, type: 'maj7', durationBeats: 4 },
    { rootMidi: rootMidi + 5, type: '7', durationBeats: 4 },
    { rootMidi: rootMidi + 7, type: 'm7', durationBeats: 4 },
    { rootMidi: rootMidi + 0, type: 'maj7', durationBeats: 4 },
  ];
}

const difficulties = [1, 2, 3];

for (const d of difficulties) {
  for (let i = 0; i < 3; i++) {
    const prog = smallProgression(60 + i * 2);
    const lick = generateLick(prog, 60, d, { fretMin: 1, fretMax: 18 });
    const midi = buildMidi(lick, 90);
    const filename = `generated_lick_d${d}_${i}.mid`;
    fs.writeFileSync(filename, midi);
    console.log('Wrote', filename);
  }
}

console.log('Done.');
