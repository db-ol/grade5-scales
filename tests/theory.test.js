// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/theory.js');

// Written out by hand from the circle of fifths, independent of the code under test.
const MAJOR = {
  C: 'C D E F G A B', G: 'G A B C D E F#', D: 'D E F# G A B C#', A: 'A B C# D E F# G#',
  E: 'E F# G# A B C# D#', B: 'B C# D# E F# G# A#', 'F#': 'F# G# A# B C# D# E#',
  'C#': 'C# D# E# F# G# A# B#', F: 'F G A Bb C D E', Bb: 'Bb C D Eb F G A',
  Eb: 'Eb F G Ab Bb C D', Ab: 'Ab Bb C Db Eb F G', Db: 'Db Eb F Gb Ab Bb C',
  Gb: 'Gb Ab Bb Cb Db Eb F', Cb: 'Cb Db Eb Fb Gb Ab Bb'
};
const HARMONIC = {
  A: 'A B C D E F G#', E: 'E F# G A B C D#', B: 'B C# D E F# G A#', 'F#': 'F# G# A B C# D E#',
  'C#': 'C# D# E F# G# A B#', 'G#': 'G# A# B C# D# E Fx', 'D#': 'D# E# F# G# A# B Cx',
  'A#': 'A# B# C# D# E# F# Gx', D: 'D E F G A Bb C#', G: 'G A Bb C D Eb F#',
  C: 'C D Eb F G Ab B', F: 'F G Ab Bb C Db E', Bb: 'Bb C Db Eb F Gb A',
  Eb: 'Eb F Gb Ab Bb Cb D', Ab: 'Ab Bb Cb Db Eb Fb G'
};
const MELODIC_UP = {
  A: 'A B C D E F# G#', E: 'E F# G A B C# D#', B: 'B C# D E F# G# A#', 'F#': 'F# G# A B C# D# E#',
  'C#': 'C# D# E F# G# A# B#', 'G#': 'G# A# B C# D# E# Fx', 'D#': 'D# E# F# G# A# B# Cx',
  D: 'D E F G A B C#', G: 'G A Bb C D E F#', C: 'C D Eb F G A B', F: 'F G Ab Bb C D E',
  Bb: 'Bb C Db Eb F G A', Eb: 'Eb F Gb Ab Bb C D'
};
const NATURAL = {
  A: 'A B C D E F G', E: 'E F# G A B C D', B: 'B C# D E F# G A', 'F#': 'F# G# A B C# D E',
  'C#': 'C# D# E F# G# A B', 'G#': 'G# A# B C# D# E F#', 'D#': 'D# E# F# G# A# B C#',
  D: 'D E F G A Bb C', G: 'G A Bb C D Eb F', C: 'C D Eb F G Ab Bb', F: 'F G Ab Bb C Db Eb',
  Bb: 'Bb C Db Eb F Gb Ab', Eb: 'Eb F Gb Ab Bb Cb Db'
};

const spell = (tonic, mode, dir) => T.degrees(tonic, mode, dir).map(n => T.noteName(n, 'ascii')).join(' ');

test('major scales are spelled correctly in all 15 keys', () => {
  for (const [k, v] of Object.entries(MAJOR)) assert.equal(spell(k, 'major', 'up'), v, k);
});

test('harmonic minor scales are spelled correctly', () => {
  for (const [k, v] of Object.entries(HARMONIC)) {
    assert.equal(spell(k, 'harmonic', 'up'), v, k);
    assert.equal(spell(k, 'harmonic', 'down'), v, k);
  }
});

test('melodic minor raises 6 and 7 going up and uses natural minor coming down', () => {
  for (const [k, v] of Object.entries(MELODIC_UP)) assert.equal(spell(k, 'melodic', 'up'), v, k);
  for (const [k, v] of Object.entries(NATURAL)) assert.equal(spell(k, 'melodic', 'down'), v, k);
});

test('parseNote and formatName round trip', () => {
  assert.equal(T.formatName('F#', 'unicode'), 'F♯');
  assert.equal(T.formatName('Bb', 'spoken'), 'B flat');
  assert.equal(T.formatName('C#', 'spoken'), 'C sharp');
  assert.equal(T.pitchClass(T.parseNote('E#')), 5);
  assert.equal(T.pitchClass(T.parseNote('Cb')), 11);
  assert.equal(T.pitchClass(T.parseNote('Fx')), 7);
});

function steps(line) {
  return line.slice(1).map((n, i) => n.midi - line[i].midi);
}

test('four octave scale goes up and comes back down', () => {
  const tonicMidi = 54; // F#3
  const line = T.scaleLine({ tonic: 'F#', mode: 'major', octaves: 4, tonicMidi });
  assert.equal(line.length, 4 * 14 + 1);
  assert.equal(line[0].midi, tonicMidi);
  assert.equal(line[28].midi, tonicMidi + 48);
  assert.equal(line[line.length - 1].midi, tonicMidi);
  // whole and half steps only, rising then falling, symmetric for a major scale
  const s = steps(line);
  assert.ok(s.slice(0, 28).every(x => x === 1 || x === 2));
  assert.ok(s.slice(28).every(x => x === -1 || x === -2));
  assert.deepEqual(line.slice(0, 8).map(n => n.name), ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#', 'F#']);
});

test('melodic minor line uses the descending form on the way down', () => {
  const line = T.scaleLine({ tonic: 'A', mode: 'melodic', octaves: 1, tonicMidi: 57 });
  assert.deepEqual(line.map(n => n.name), ['A', 'B', 'C', 'D', 'E', 'F#', 'G#', 'A', 'G', 'F', 'E', 'D', 'C', 'B', 'A']);
  assert.deepEqual(line.map(n => n.midi), [57, 59, 60, 62, 64, 66, 68, 69, 67, 65, 64, 62, 60, 59, 57]);
});

test('contrary motion left hand mirrors the right hand', () => {
  const rh = T.scaleLine({ tonic: 'E', mode: 'major', octaves: 2, tonicMidi: 64 });
  const lh = T.scaleLine({ tonic: 'E', mode: 'major', octaves: 2, tonicMidi: 64, downFirst: true });
  assert.equal(rh.length, lh.length);
  assert.equal(lh[0].midi, 64);
  assert.equal(lh[14].midi, 64 - 24);
  assert.equal(lh[lh.length - 1].midi, 64);
  assert.deepEqual(lh.slice(0, 8).map(n => n.name), ['E', 'D#', 'C#', 'B', 'A', 'G#', 'F#', 'E']);
});

test('contrary motion melodic minor: each hand uses the form for its own direction', () => {
  const lh = T.scaleLine({ tonic: 'A', mode: 'melodic', octaves: 1, tonicMidi: 57, downFirst: true });
  assert.deepEqual(lh.map(n => n.name), ['A', 'G', 'F', 'E', 'D', 'C', 'B', 'A', 'B', 'C', 'D', 'E', 'F#', 'G#', 'A']);
});

test('scale starting on another degree keeps the key (a third apart)', () => {
  const rh = T.scaleLine({ tonic: 'C', mode: 'major', octaves: 1, tonicMidi: 60, startDegree: 2 });
  assert.deepEqual(rh.map(n => n.name), ['E', 'F', 'G', 'A', 'B', 'C', 'D', 'E', 'D', 'C', 'B', 'A', 'G', 'F', 'E']);
  assert.equal(rh[0].midi, 64);
  assert.equal(rh[7].midi, 76);
});

test('arpeggios: major and minor triads over the requested octaves', () => {
  const maj = T.arpeggioLine({ tonic: 'Db', quality: 'major', octaves: 2, tonicMidi: 61 });
  assert.equal(maj.length, 13);
  assert.deepEqual(maj.slice(0, 7).map(n => n.name), ['Db', 'F', 'Ab', 'Db', 'F', 'Ab', 'Db']);
  assert.deepEqual(maj.slice(0, 7).map(n => n.midi), [61, 65, 68, 73, 77, 80, 85]);
  const min = T.arpeggioLine({ tonic: 'G#', quality: 'minor', octaves: 4, tonicMidi: 44 });
  assert.equal(min.length, 25);
  assert.deepEqual(min.slice(0, 4).map(n => n.name), ['G#', 'B', 'D#', 'G#']);
  assert.equal(min[12].midi, 44 + 48);
  assert.equal(min[24].midi, 44);
});

test('chromatic line covers every semitone up and down', () => {
  const line = T.chromaticLine({ startMidi: 56, startName: 'Ab', octaves: 2 });
  assert.equal(line.length, 49);
  assert.equal(line[0].name, 'Ab');
  assert.equal(line[24].midi, 80);
  assert.ok(steps(line).slice(0, 24).every(x => x === 1));
  assert.ok(steps(line).slice(24).every(x => x === -1));
  const lh = T.chromaticLine({ startMidi: 62, startName: 'D', octaves: 1, downFirst: true });
  assert.equal(lh[12].midi, 50);
  assert.equal(lh[24].midi, 62);
});

test('diminished seventh on B is spelled B D F Ab', () => {
  const line = T.diminishedSeventhLine({ root: 'B', rootMidi: 59, octaves: 2 });
  assert.equal(line.length, 17);
  assert.deepEqual(line.slice(0, 9).map(n => n.name), ['B', 'D', 'F', 'Ab', 'B', 'D', 'F', 'Ab', 'B']);
  assert.deepEqual(line.slice(0, 9).map(n => n.midi), [59, 62, 65, 68, 71, 74, 77, 80, 83]);
  assert.equal(line[16].midi, 59);
});

test('midiAtOrAbove picks the first matching pitch at or above the floor', () => {
  assert.equal(T.midiAtOrAbove(6, 48), 54);
  assert.equal(T.midiAtOrAbove(0, 48), 48);
  assert.equal(T.midiAtOrAbove(11, 48), 59);
});
