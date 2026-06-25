import generateLick from '../logic/lick-generator.ts';

function smallProgression(rootMidi: number) {
  return [
    { rootMidi, type: 'maj7', durationBeats: 4 },
    { rootMidi: rootMidi + 5, type: '7', durationBeats: 4 },
    { rootMidi: rootMidi + 7, type: 'm7', durationBeats: 4 },
    { rootMidi: rootMidi + 0, type: 'maj7', durationBeats: 4 },
  ];
}

const difficulties = [1, 2, 3];

difficulties.forEach(d => {
  console.log('\n--- Difficulty', d, '---');
  for (let i = 0; i < 3; i++) {
    const lick = generateLick(smallProgression(60 + i * 2), 60, d, { fretMin: 1, fretMax: 18 });
    console.log('Lick ID:', lick.id);
    console.log('Notes:');
    lick.notes.forEach(n => console.log(`  beat:${n.startBeat.toFixed(2)} dur:${n.durationBeats} pitch:${n.pitch} string:${n.string} fret:${n.fret}`));
    console.log('');
  }
});
