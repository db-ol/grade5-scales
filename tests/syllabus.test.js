const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/theory.js');
const S = require('../js/syllabus.js');

// The Grade 5 table as printed on page 35 of the ABRSM Piano Practical Grades
// syllabus (2025 & 2026, and again in 2027 & 2028), typed in separately from syllabus.js.
const OFFICIAL = {
  scales: { majors: ['A', 'E', 'B', 'F#', 'Db'], minors: ['F#', 'C#', 'G#', 'Eb', 'Bb'], hands: ['together'] },
  staccato: { majors: ['Ab'], minors: ['F'], hands: ['rh', 'lh'] },
  contrary: { majors: ['Db'], harmonic: ['C#'], hands: ['together'] },
  chromatic: { starts: ['F#'], hands: ['together'] },
  arpeggios: { majors: ['A', 'E', 'B', 'F#', 'Ab', 'Db'], minors: ['F#', 'C#', 'G#', 'Eb', 'F', 'Bb'], hands: ['together'] },
  dim7: { starts: ['B'], hands: ['rh', 'lh'] }
};

test('the deck matches the official Grade 5 table exactly', () => {
  const expected = [];
  for (const [type, o] of Object.entries(OFFICIAL)) {
    for (const hand of o.hands) {
      (o.majors || []).forEach(k => expected.push(`${type}:${k}:major:${hand}`));
      (o.minors || []).forEach(k => expected.push(`${type}:${k}:minor:${hand}`));
      (o.harmonic || []).forEach(k => expected.push(`${type}:${k}:harmonic:${hand}`));
      if (type === 'chromatic') expected.push(`chromatic:F#:chromatic:${hand}`);
      if (type === 'dim7') expected.push(`dim7:B:dim7:${hand}`);
    }
  }
  assert.deepEqual(S.CARDS.map(c => c.id).sort(), expected.sort());
  assert.equal(S.CARDS.length, 31);
});

test('six requirement types in syllabus order, all two octaves', () => {
  assert.deepEqual(S.TYPES.map(t => t.id), ['scales', 'staccato', 'contrary', 'chromatic', 'arpeggios', 'dim7']);
  S.TYPES.forEach(t => assert.equal(t.range, '2 oct.'));
});

test('minor form is the candidate’s choice only for similar motion and staccato minors', () => {
  const choice = S.CARDS.filter(c => c.minorChoice).map(c => c.id).sort();
  assert.deepEqual(choice, [
    'scales:Bb:minor:together', 'scales:C#:minor:together', 'scales:Eb:minor:together',
    'scales:F#:minor:together', 'scales:G#:minor:together',
    'staccato:F:minor:lh', 'staccato:F:minor:rh'
  ].sort());
});

test('guide speeds: scales minim 60, arpeggios minim 44, four notes a beat', () => {
  const scale = S.performance(S.CARD_BY_ID['scales:A:major:together']);
  assert.equal(scale.stepDur, 0.25);
  const arp = S.performance(S.CARD_BY_ID['arpeggios:A:major:together']);
  assert.ok(Math.abs(arp.stepDur - 60 / 44 / 4) < 1e-9);
  const dim = S.performance(S.CARD_BY_ID['dim7:B:dim7:rh']);
  assert.equal(dim.stepDur, arp.stepDur);
  const slow = S.performance(S.CARD_BY_ID['scales:A:major:together'], { speed: 0.5 });
  assert.equal(slow.stepDur, 0.5);
});

const isUp = (line, n) => line.slice(1, n + 1).every((x, i) => x.midi > line[i].midi);

test('every card produces a correct two octave demo', () => {
  for (const card of S.CARDS) {
    for (const form of ['harmonic', 'melodic']) {
      const p = S.performance(card, { minorForm: form });
      const { rh, lh } = p.lines;
      const len = { scales: 29, staccato: 29, contrary: 29, chromatic: 49, arpeggios: 13, dim7: 17 }[card.type];
      assert.equal(rh.length, len, card.id);
      assert.equal(lh.length, len, card.id);
      assert.equal(p.steps.length, len, card.id);
      const half = (len - 1) / 2;
      // ascend exactly two octaves and come back to the starting note
      assert.equal(rh[half].midi - rh[0].midi, 24, card.id);
      assert.equal(rh[len - 1].midi, rh[0].midi, card.id);
      assert.ok(isUp(rh, half), card.id);
      if (card.type === 'contrary') {
        assert.equal(lh[0].midi, rh[0].midi, `${card.id} unison start`);
        assert.equal(lh[half].midi, lh[0].midi - 24, card.id);
      } else if (card.type === 'chromatic') {
        assert.equal(rh[0].midi - lh[0].midi, 4, 'major third apart');
        assert.equal(T.mod(lh[0].midi, 12), 6, 'LH starts on F#');
        assert.equal(T.mod(rh[0].midi, 12), 10, 'RH starts on A#');
        assert.equal(lh[half].midi, lh[0].midi - 24);
      } else {
        rh.forEach((n, i) => assert.equal(n.midi - lh[i].midi, 12, `${card.id} hands an octave apart`));
      }
      if (card.hand === 'together') assert.ok(p.steps.every(s => s.length === 2), card.id);
      else assert.ok(p.steps.every(s => s.length === 1 && s[0].hand === card.hand), card.id);
      assert.equal(p.staccato, card.type === 'staccato', card.id);
    }
  }
});

test('demo notes are spelled in the right key', () => {
  const names = (id, form) => S.lines(S.CARD_BY_ID[id], form).rh.slice(0, 8).map(n => n.name).join(' ');
  assert.equal(names('scales:Db:major:together'), 'Db Eb F Gb Ab Bb C Db');
  assert.equal(names('scales:G#:minor:together', 'harmonic'), 'G# A# B C# D# E Fx G#');
  assert.equal(names('scales:G#:minor:together', 'melodic'), 'G# A# B C# D# E# Fx G#');
  assert.equal(names('scales:Eb:minor:together', 'melodic'), 'Eb F Gb Ab Bb C D Eb');
  assert.equal(names('staccato:F:minor:rh', 'harmonic'), 'F G Ab Bb C Db E F');
  assert.equal(names('contrary:C#:harmonic:together', 'melodic'), 'C# D# E F# G# A B# C#');
  const arp = S.lines(S.CARD_BY_ID['arpeggios:Eb:minor:together']).rh.slice(0, 4).map(n => n.name).join(' ');
  assert.equal(arp, 'Eb Gb Bb Eb');
  const dim = S.lines(S.CARD_BY_ID['dim7:B:dim7:lh']).lh.slice(0, 5).map(n => n.name).join(' ');
  assert.equal(dim, 'B D F Ab B');
});

test('melodic minor comes down with the natural minor', () => {
  const rh = S.lines(S.CARD_BY_ID['scales:F#:minor:together'], 'melodic').rh;
  assert.deepEqual(rh.slice(21).map(n => n.name), ['F#', 'E', 'D', 'C#', 'B', 'A', 'G#', 'F#']);
});

test('spoken requests never open with a bare key letter', () => {
  for (const card of S.CARDS) {
    for (let seed = 0; seed < 6; seed++) {
      const s = S.speechEn(card, 'varied', seed);
      assert.ok(!/^[A-G]\b/.test(s), s);
      assert.ok(!/[#♯♭]/.test(s), `no symbols in speech: ${s}`);
      assert.ok(!/\b[A-G]b\b/.test(s), `no ascii flats in speech: ${s}`);
    }
  }
  assert.equal(S.speechEn(S.CARD_BY_ID['scales:F#:major:together'], 'plain'), 'Scale of F sharp major, hands together.');
  assert.equal(S.speechEn(S.CARD_BY_ID['staccato:Ab:major:lh'], 'plain'), 'Staccato scale of A flat major, left hand.');
  assert.equal(S.speechEn(S.CARD_BY_ID['contrary:C#:harmonic:together'], 'plain'), 'Contrary-motion scale of C sharp harmonic minor.');
});

test('Chinese names follow the usual convention (minor keys in lower case)', () => {
  assert.equal(S.keyZh(S.CARD_BY_ID['scales:F#:major:together']), '升F大调');
  assert.equal(S.keyZh(S.CARD_BY_ID['scales:Bb:minor:together']), '降b小调');
  assert.equal(S.keyZh(S.CARD_BY_ID['contrary:C#:harmonic:together']), '升c和声小调');
  assert.equal(S.speechZh(S.CARD_BY_ID['staccato:F:minor:rh']), 'f小调断奏音阶，右手。');
});

test('keyboard marks show the scale notes from tonic to tonic', () => {
  const spec = S.keyboardSpec(S.CARD_BY_ID['scales:F#:minor:together'], 'melodic');
  const labels = spec.marks.map(m => m.label + ':' + m.kind);
  assert.ok(labels.includes('E♯:up'));
  assert.ok(labels.includes('D:down-only'));
  assert.ok(labels.includes('E:down-only'));
  assert.equal(spec.marks.filter(m => m.kind === 'tonic').length, 2);
  const dim = S.keyboardSpec(S.CARD_BY_ID['dim7:B:dim7:rh']);
  assert.deepEqual(dim.marks.map(m => m.label), ['B', 'D', 'F', 'A♭', 'B']);
});

// Small seeded generator so the property test is repeatable.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('mock exams follow the examiner rules from the syllabus', () => {
  const typeIndex = Object.fromEntries(S.TYPES.map((t, i) => [t.id, i]));
  for (const size of [6, 10, 14]) {
    for (const order of ['syllabus', 'shuffle']) {
      for (let seed = 1; seed <= 400; seed++) {
        const rand = mulberry32(seed * 7919 + size);
        const weight = c => 1 + (c.tonic.length % 3);
        const exam = S.buildExam({ size, order, weight, random: rand });
        const where = `size ${size} ${order} seed ${seed}`;
        assert.equal(exam.length, size, where);
        // at least one of each type, and each type's requests kept together
        const types = exam.map(c => c.type);
        for (const t of S.TYPES) assert.ok(types.includes(t.id), `${where}: missing ${t.id}`);
        const blocks = types.filter((t, i) => i === 0 || types[i - 1] !== t);
        assert.equal(blocks.length, S.TYPES.length, `${where}: types interleaved`);
        if (order === 'syllabus') {
          assert.deepEqual(blocks, S.TYPES.map(t => t.id), where);
        }
        // majors before minors within a type
        for (const t of S.TYPES) {
          const q = exam.filter(c => c.type === t.id).map(c => (c.quality === 'major' ? 0 : 1));
          assert.deepEqual(q, [...q].sort((a, b) => a - b), `${where}: ${t.id} majors first`);
        }
        // the same key is never asked twice within a type
        const keys = exam.map(c => `${c.type}:${c.tonic}:${c.quality}`);
        assert.equal(new Set(keys).size, keys.length, `${where}: repeated key`);
        // both hands heard when there are two or more hands separately requests
        const sep = exam.filter(c => c.hand !== 'together');
        if (sep.length >= 2) assert.ok(new Set(sep.map(c => c.hand)).size === 2, `${where}: hands not balanced`);
        // a major and a minor where scales or arpeggios get two or more requests
        for (const id of ['scales', 'arpeggios']) {
          const list = exam.filter(c => c.type === id);
          if (list.length >= 2) {
            assert.ok(list.some(c => c.quality === 'major') && list.some(c => c.quality === 'minor'), `${where}: ${id} lacks major or minor`);
          }
        }
      }
    }
  }
});

test('every spoken wording names its requirement type, so no request is ambiguous', () => {
  const word = { scales: /\bscale\b/i, staccato: /\bstaccato\b/i, contrary: /\bcontrary/i, chromatic: /\bchromatic\b/i, arpeggios: /\barpeggio\b/i, dim7: /\bdiminished seventh\b/i };
  for (const card of S.CARDS) {
    for (let seed = 0; seed < 12; seed++) {
      const text = S.speechEn(card, 'varied', seed);
      assert.match(text, word[card.type], text);
      if (card.type === 'scales') assert.doesNotMatch(text, /arpeggio|staccato|contrary/i, text);
      if (card.hand !== 'together') assert.match(text, card.hand === 'rh' ? /right hand/ : /left hand/, text);
      // Grade 5 candidate-choice minors: the examiner does not name the form
      if (card.minorChoice) assert.doesNotMatch(text, /harmonic|melodic/, text);
      assert.doesNotMatch(text, /octave/, text);
    }
  }
  assert.match(S.speechEn(S.CARD_BY_ID['contrary:C#:harmonic:together'], 'varied', 1), /harmonic minor/);
});

test('double sharps and flats are written as double signs, never a single sharp', () => {
  assert.equal(S.noteHtml('Fx'), 'F<span class="acc">\uD834\uDD2A</span>');
  assert.equal(S.noteHtml('Bbb'), 'B<span class="acc">\uD834\uDD2B</span>');
  assert.equal(S.noteHtml('F#'), 'F<span class="acc">\u266F</span>');
  const names = S.octaveNames(S.CARD_BY_ID['scales:G#:minor:together'], 'harmonic').up;
  assert.deepEqual(names, ['G#', 'A#', 'B', 'C#', 'D#', 'E', 'Fx', 'G#']);
  assert.ok(names.map(S.noteHtml).join(' ').includes('\uD834\uDD2A'));
});

test('on-screen requirement text follows the writing rules (no semicolons)', () => {
  for (const t of S.TYPES) {
    assert.doesNotMatch(t.requirement, /;/, t.requirement);
    assert.doesNotMatch(t.requirementZh, /[;；,:]/, t.requirementZh);
  }
  for (const card of S.CARDS) {
    for (const text of [S.detailZh(card), S.reminderZh(card), S.speechZh(card)]) {
      assert.doesNotMatch(text, /[;,:]/, `ASCII punctuation in Chinese text: ${text}`);
    }
  }
});
