const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/syllabus.js');

const requirements = {
  7: {
    majors: 'Db E G Bb', minors: 'C# E G Bb',
    apart: 'thirdsApart', thirds: 'G', staccato: 'staccatoThirds', staccatoKey: 'G',
    chromatic: 'chromatic', start: ['C#', 'E'], diminished: 'Bb E',
    scaleSpeed: 80, arpeggioSpeed: 56, thirdsSpeed: 46
  },
  8: {
    majors: 'C Eb F# A', minors: 'C Eb F# A',
    apart: 'sixthsApart', thirds: 'Eb', staccato: 'staccatoSixths', staccatoKey: 'C',
    chromatic: 'chromaticSixths', start: ['Eb', 'C'], diminished: 'Eb C',
    scaleSpeed: 88, arpeggioSpeed: 66, thirdsSpeed: 52
  }
};

function expectedCards(grade, spec) {
  const cards = [];
  const both = ['legato', 'staccato'];
  function add(type, keys, quality, octaves, articulations = ['legato'], hands = ['together']) {
    for (const tonic of keys.split(' ')) {
      for (const articulation of articulations) {
        for (const hand of hands) cards.push([type, tonic, quality, hand, octaves, articulation].join(' '));
      }
    }
  }
  for (const [type, octaves] of [['scales', 4], [spec.apart, 4], ['contrary', 2]]) {
    add(type, spec.majors, 'major', octaves, both);
    add(type, spec.minors, 'harmonic', octaves, both);
  }
  add('scales', spec.minors, 'melodic', 4, both);
  add('legatoThirds', spec.thirds, 'major', 2, ['legato'], ['rh', 'lh']);
  add(spec.staccato, spec.staccatoKey, 'major', 2, ['staccato'], ['rh', 'lh']);
  add(spec.chromatic, spec.start[0], 'chromatic', grade === 7 ? 2 : 4, both);
  if (grade === 8) add('wholeTone', 'Eb C', 'wholeTone', 4, both);
  add('arpeggios', spec.majors, 'major', 4);
  add('arpeggios', spec.minors, 'minor', 4);
  add('dom7', spec.majors, 'dom7', 4);
  add('dim7', spec.diminished, 'dim7', 4);
  return cards.sort();
}

for (const grade of [7, 8]) {
  const spec = requirements[grade];
  test(`Grade ${grade} covers each prescribed key, form, hand, articulation and range`, () => {
    const deck = S.forGrade(grade);
    const actual = deck.CARDS.map(c => [c.type, c.tonic, c.quality, c.hand, c.octaves, c.articulation].join(' '));
    assert.deepEqual(actual.sort(), expectedCards(grade, spec));
    for (const c of deck.CARDS) {
      assert.equal(deck.CARD_BY_ID[c.id], c);
      assert.equal(c.grade, grade);
      assert.ok(!c.minorChoice);
      if (c.type === spec.chromatic) assert.equal(c.rhStart, spec.start[1]);
      if (c.type === 'arpeggios') assert.equal(c.inversion, grade === 7 ? 1 : 2);
      const prompt = deck.speechEn(c, 'plain');
      if (c.quality === 'harmonic' || c.quality === 'melodic') assert.ok(prompt.includes(c.quality), prompt);
      if (c.hand !== 'together') assert.ok(prompt.includes(c.hand === 'rh' ? 'right hand' : 'left hand'), prompt);
      if (['scales', spec.apart, 'contrary', spec.chromatic, 'wholeTone'].includes(c.type)) {
        assert.ok(prompt.includes(c.articulation), prompt);
      }
    }
  });

  test(`Grade ${grade} demos use the prescribed tempo, articulation, octaves and hand motion`, () => {
    const deck = S.forGrade(grade);
    const speed = {
      scales: spec.scaleSpeed, contrary: spec.scaleSpeed, wholeTone: spec.scaleSpeed,
      [spec.apart]: 60, [spec.chromatic]: grade === 7 ? spec.scaleSpeed : 60,
      legatoThirds: spec.thirdsSpeed, [spec.staccato]: 54,
      arpeggios: spec.arpeggioSpeed, dom7: spec.arpeggioSpeed, dim7: spec.arpeggioSpeed
    };
    for (const c of deck.CARDS) {
      const p = deck.performance(c);
      assert.equal(p.minim, speed[c.type], c.id);
      assert.equal(p.groupSize, 4, c.id);
      assert.equal(p.stepDur, 60 / p.minim / 4, c.id);
      assert.equal(p.staccato, c.articulation === 'staccato', c.id);
      const notesPerOctave = { arpeggios: 3, dom7: 4, dim7: 4, wholeTone: 6, [spec.chromatic]: 12 }[c.type] || 7;
      const apex = c.octaves * notesPerOctave;
      assert.equal(p.steps.length, 2 * apex + 1, c.id);
      const hands = c.hand === 'together' ? ['lh', 'rh'] : [c.hand, c.hand];
      for (const slot of p.steps) {
        assert.deepEqual(slot.map(n => n.hand).sort(), hands, c.id);
        assert.ok(slot.every(n => n.midi >= 21 && n.midi <= 108), c.id);
      }
      const midis = i => p.steps[i].map(n => n.midi).sort((a, b) => a - b);
      const first = midis(0);
      const top = midis(apex);
      const last = midis(2 * apex);
      const contrary = c.type === 'contrary' || c.type === 'chromatic';
      assert.equal(top[1] - first[1], 12 * c.octaves, c.id);
      assert.equal(top[0] - first[0], (contrary ? -12 : 12) * c.octaves, c.id);
      assert.deepEqual(last, first.map(n => c.type === 'dom7' ? n + 5 : n), c.id);
      if (c.type === 'contrary') assert.equal(first[0], first[1], c.id);
      if (c.type === 'chromatic') assert.equal(first[1] - first[0], 3, c.id);
      if (c.type === 'chromaticSixths' || c.type === 'wholeTone') {
        const interval = c.type === 'wholeTone' ? 12 : 9;
        const step = c.type === 'wholeTone' ? 2 : 1;
        for (let i = 0; i < p.steps.length; i++) {
          const pair = midis(i);
          assert.equal(pair[1] - pair[0], interval, c.id);
          assert.equal(pair[0] - first[0], Math.min(i, 2 * apex - i) * step, c.id);
        }
      }
    }
  });

  test(`Grade ${grade} mock exams cover the selected grade in distinct blocks`, () => {
    const deck = S.forGrade(grade);
    const types = deck.TYPES.map(t => t.id);
    let seed = 37;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const extra of [0, 4, 8]) {
      const size = types.length + extra;
      for (const order of ['syllabus', 'shuffle']) {
        for (let i = 0; i < 40; i++) {
          const exam = deck.buildExam({ size, order, random });
          assert.equal(exam.length, size);
          assert.ok(exam.every(c => deck.CARD_BY_ID[c.id] === c));
          assert.equal(new Set(exam.map(c => c.id)).size, size);
          const blocks = exam.map(c => c.type).filter((t, j) => j === 0 || t !== exam[j - 1].type);
          if (order === 'syllabus') assert.deepEqual(blocks, types);
          else assert.deepEqual([...blocks].sort(), [...types].sort());
          for (const type of types) {
            const majorFirst = exam.filter(c => c.type === type).map(c => Number(c.quality !== 'major'));
            assert.deepEqual(majorFirst, [...majorFirst].sort());
          }
          assert.ok(exam.some(c => c.hand === 'rh') && exam.some(c => c.hand === 'lh'));
          const chosen = exam.filter(c => deck.TYPE_BY_ID[c.type].articulations.length > 1);
          const legato = chosen.filter(c => c.articulation === 'legato').length;
          assert.ok(Math.abs(legato - (chosen.length - legato)) <= 1);
        }
      }
    }
  });
}

function example(grade, type, tonic, quality) {
  const deck = S.forGrade(grade);
  const card = deck.CARDS.find(c => c.type === type && c.tonic === tonic && c.quality === quality);
  assert.ok(card, [grade, type, tonic, quality].join(' '));
  return { played: deck.performance(card), names: deck.octaveNames(card), marks: deck.keyboardSpec(card).marks };
}

test('scales in parallel intervals use the prescribed starting degree in both voices', () => {
  const thirds = example(7, 'thirdsApart', 'Db', 'major');
  assert.deepEqual(thirds.names.lh, ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C', 'Db']);
  assert.deepEqual(thirds.names.rh, ['F', 'Gb', 'Ab', 'Bb', 'C', 'Db', 'Eb', 'F']);
  const sixths = example(8, 'sixthsApart', 'C', 'harmonic');
  assert.deepEqual(sixths.names.lh, ['Eb', 'F', 'G', 'Ab', 'B', 'C', 'D', 'Eb']);
  assert.deepEqual(sixths.names.rh, ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'B', 'C']);
  const doubleThirds = example(8, 'legatoThirds', 'Eb', 'major');
  assert.deepEqual(doubleThirds.names.lower, ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D', 'Eb']);
  assert.deepEqual(doubleThirds.names.upper, ['G', 'Ab', 'Bb', 'C', 'D', 'Eb', 'F', 'G']);
  const doubleSixths = example(8, 'staccatoSixths', 'C', 'major');
  assert.deepEqual(doubleSixths.names.lower, ['E', 'F', 'G', 'A', 'B', 'C', 'D', 'E']);
  assert.deepEqual(doubleSixths.names.upper, ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']);
  for (const [exercise, interval] of [[thirds, 4], [sixths, 9], [doubleThirds, 4], [doubleSixths, 8]]) {
    const [a, b] = exercise.played.steps[0];
    assert.equal(Math.abs(a.midi - b.midi), interval);
  }
});

test('inverted arpeggios and dominant sevenths have the correct endpoints and spellings', () => {
  const first = example(7, 'arpeggios', 'C#', 'minor');
  const second = example(8, 'arpeggios', 'Eb', 'major');
  assert.deepEqual(first.names.up, ['E', 'G#', 'C#', 'E']);
  assert.deepEqual(second.names.up, ['Bb', 'Eb', 'G', 'Bb']);
  const dominant = example(8, 'dom7', 'F#', 'dom7');
  assert.deepEqual(dominant.names.up, ['C#', 'E#', 'G#', 'B', 'C#']);
  assert.deepEqual(dominant.names.resolution, ['E#', 'F#']);
  assert.ok(dominant.marks.some(m => m.label === 'F♯'));
  assert.deepEqual(dominant.played.lines.rh.slice(-5).map(n => n.name), ['C#', 'B', 'G#', 'E#', 'F#']);
  assert.deepEqual(example(7, 'dim7', 'Bb', 'dim7').names.up, ['Bb', 'Db', 'Fb', 'Abb', 'Bb']);
});

test('melodic minor keeps its assigned ascending and descending forms', () => {
  const { names, played } = example(8, 'scales', 'Eb', 'melodic');
  assert.deepEqual(names.up, ['Eb', 'F', 'Gb', 'Ab', 'Bb', 'C', 'D', 'Eb']);
  assert.deepEqual(names.down, ['Eb', 'Db', 'Cb', 'Bb', 'Ab', 'Gb', 'F', 'Eb']);
  assert.deepEqual(played.lines.rh.slice(-8).map(n => n.name), names.down);
});

test('chromatic examples identify the starting pitches and direction for each hand', () => {
  for (const [grade, type, tonic, rhStart, lhSecond, rhSecond, labels] of [
    [7, 'chromatic', 'C#', 'E', 'C', 'F', ['C♯', 'E']],
    [8, 'chromaticSixths', 'Eb', 'C', 'E', 'C#', ['E♭', 'C']]
  ]) {
    const { names, marks } = example(grade, type, tonic, 'chromatic');
    assert.deepEqual(names.lh.slice(0, 2), [tonic, lhSecond]);
    assert.deepEqual(names.rh.slice(0, 2), [rhStart, rhSecond]);
    assert.deepEqual(marks.map(m => m.label), labels);
  }
});
