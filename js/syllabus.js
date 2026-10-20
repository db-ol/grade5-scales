/*
 * ABRSM Piano Grade 5 scales and arpeggios, transcribed from the Piano Practical Grades
 * syllabus (2025 & 2026, page 35). The 2027 & 2028 syllabus prints the same Grade 5 table.
 * Also builds the quiz cards, what the examiner says, and the notes for the demo.
 */
(function (root, factory) {
  var T = root.Theory || (typeof require === 'function' ? require('./theory.js') : null);
  var api = factory(T);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Syllabus = api;
})(typeof self !== 'undefined' ? self : this, function (T) {
  'use strict';

  // Guide speeds from the syllabus speed table, Grade 5 column.
  // "All speeds relate to the rhythmic grouping" of four quavers, so four notes per minim beat.
  var SPEED = {
    scale: { minim: 60, notesPerBeat: 4 },
    arpeggio: { minim: 44, notesPerBeat: 4 }
  };

  var TYPES = [
    {
      id: 'scales',
      en: 'Scales',
      enLong: 'Scales (similar motion)',
      zh: '音阶（同向）',
      eyebrow: 'Scale',
      range: '2 oct.',
      requirement: 'legato · hands together',
      requirementZh: '连奏，双手同向，相隔一个八度',
      speed: 'scale',
      rows: [
        { label: 'A, E, B, F♯, D♭ majors', keys: ['A', 'E', 'B', 'F#', 'Db'], quality: 'major' },
        { label: 'F♯, C♯, G♯, E♭, B♭ minors (harmonic or melodic, at candidate’s choice)', keys: ['F#', 'C#', 'G#', 'Eb', 'Bb'], quality: 'minor', minorChoice: true }
      ],
      hands: ['together']
    },
    {
      id: 'staccato',
      en: 'Staccato scales',
      enLong: 'Staccato scales',
      zh: '断奏音阶',
      eyebrow: 'Staccato scale',
      range: '2 oct.',
      requirement: 'staccato · hands separately',
      requirementZh: '断奏，分手（考官指定左手或右手）',
      speed: 'scale',
      rows: [
        { label: 'A♭ major', keys: ['Ab'], quality: 'major' },
        { label: 'F minor (harmonic or melodic, at candidate’s choice)', keys: ['F'], quality: 'minor', minorChoice: true }
      ],
      hands: ['rh', 'lh']
    },
    {
      id: 'contrary',
      en: 'Contrary-motion scales',
      enLong: 'Contrary-motion scales',
      zh: '反向音阶',
      eyebrow: 'Contrary-motion scale',
      range: '2 oct.',
      requirement: 'legato · hands starting on the tonic (unison)',
      requirementZh: '连奏，双手从主音同音开始反向进行',
      speed: 'scale',
      rows: [
        { label: 'D♭ major', keys: ['Db'], quality: 'major' },
        { label: 'C♯ harmonic minor', keys: ['C#'], quality: 'harmonic' }
      ],
      hands: ['together']
    },
    {
      id: 'chromatic',
      en: 'Chromatic contrary-motion scale',
      enLong: 'Chromatic contrary-motion scale',
      zh: '反向半音阶',
      eyebrow: 'Chromatic · contrary',
      range: '2 oct.',
      requirement: 'legato · hands starting a major third apart',
      requirementZh: '连奏，双手相隔大三度开始反向进行',
      speed: 'scale',
      rows: [
        { label: 'starting on F♯ (LH) and A♯ (RH)', keys: ['F#'], quality: 'chromatic', rhStart: 'A#' }
      ],
      hands: ['together']
    },
    {
      id: 'arpeggios',
      en: 'Arpeggios',
      enLong: 'Arpeggios',
      zh: '琶音',
      eyebrow: 'Arpeggio',
      range: '2 oct.',
      requirement: 'legato · hands together',
      requirementZh: '连奏，双手同向，相隔一个八度，原位',
      speed: 'arpeggio',
      rows: [
        { label: 'A, E, B, F♯, A♭, D♭ majors', keys: ['A', 'E', 'B', 'F#', 'Ab', 'Db'], quality: 'major' },
        { label: 'F♯, C♯, G♯, E♭, F, B♭ minors', keys: ['F#', 'C#', 'G#', 'Eb', 'F', 'Bb'], quality: 'minor' }
      ],
      hands: ['together']
    },
    {
      id: 'dim7',
      en: 'Diminished seventh',
      enLong: 'Diminished seventh',
      zh: '减七和弦琶音',
      eyebrow: 'Diminished 7th',
      range: '2 oct.',
      requirement: 'legato · hands separately',
      requirementZh: '连奏，分手（考官指定左手或右手）',
      speed: 'arpeggio',
      rows: [
        { label: 'starting on B', keys: ['B'], quality: 'dim7' }
      ],
      hands: ['rh', 'lh']
    }
  ];

  var TYPE_BY_ID = {};
  TYPES.forEach(function (t) { TYPE_BY_ID[t.id] = t; });

  var HAND_EN = { together: 'hands together', rh: 'right hand', lh: 'left hand' };
  var HAND_ZH = { together: '双手', rh: '右手', lh: '左手' };

  function buildCards() {
    var cards = [];
    TYPES.forEach(function (type) {
      type.rows.forEach(function (row) {
        row.keys.forEach(function (key) {
          type.hands.forEach(function (hand) {
            cards.push({
              id: [type.id, key, row.quality, hand].join(':'),
              type: type.id,
              tonic: key,
              quality: row.quality,
              hand: hand,
              minorChoice: !!row.minorChoice,
              rhStart: row.rhStart || null
            });
          });
        });
      });
    });
    return cards;
  }

  var CARDS = buildCards();
  var CARD_BY_ID = {};
  CARDS.forEach(function (c) { CARD_BY_ID[c.id] = c; });

  // ---------- Names ----------

  var ACC_HTML = { '-2': '\uD834\uDD2B', '-1': '\u266D', '1': '\u266F', '2': '\uD834\uDD2A' };

  function noteHtml(name) {
    var n = T.parseNote(name);
    var letter = T.LETTERS[n.letter];
    if (n.acc === 0) return letter;
    return letter + '<span class="acc">' + ACC_HTML[String(n.acc)] + '</span>';
  }

  function noteZh(name, lower) {
    var n = T.parseNote(name);
    var letter = T.LETTERS[n.letter];
    if (lower) letter = letter.toLowerCase();
    return ({ '-2': '重降', '-1': '降', '0': '', '1': '升', '2': '重升' })[String(n.acc)] + letter;
  }

  var QUALITY_EN = { major: 'major', minor: 'minor', harmonic: 'harmonic minor' };

  function keyEn(card, style) {
    var tonic = style === 'spoken' ? T.formatName(card.tonic, 'spoken') : T.formatName(card.tonic, 'unicode');
    return tonic + ' ' + QUALITY_EN[card.quality];
  }

  function keyZh(card) {
    if (card.quality === 'major') return noteZh(card.tonic) + '大调';
    if (card.quality === 'harmonic') return noteZh(card.tonic, true) + '和声小调';
    return noteZh(card.tonic, true) + '小调';
  }

  // Large title on the card, as HTML with styled accidentals.
  function titleHtml(card) {
    if (card.type === 'chromatic') return noteHtml(card.tonic) + ' &amp; ' + noteHtml(card.rhStart);
    if (card.type === 'dim7') return 'starting on ' + noteHtml(card.tonic);
    return noteHtml(card.tonic) + ' ' + QUALITY_EN[card.quality];
  }

  // Plain text title for lists and summaries.
  function titleText(card) {
    if (card.type === 'chromatic') return 'F♯ (LH) & A♯ (RH)';
    if (card.type === 'dim7') return 'starting on ' + T.formatName(card.tonic, 'unicode');
    return keyEn(card);
  }

  function detailEn(card) {
    var parts = [];
    if (card.type === 'contrary') parts.push('hands start on the tonic (unison)');
    else if (card.type === 'chromatic') parts.push('hands a major third apart');
    else parts.push(HAND_EN[card.hand]);
    parts.push('2 octaves');
    parts.push(card.type === 'staccato' ? 'staccato' : 'legato');
    return parts.join(' · ');
  }

  function detailZh(card) {
    var t = card.type;
    var what;
    if (t === 'scales') what = keyZh(card) + '音阶';
    else if (t === 'staccato') what = keyZh(card) + '断奏音阶';
    else if (t === 'contrary') what = keyZh(card) + '反向音阶';
    else if (t === 'chromatic') what = '反向半音阶';
    else if (t === 'arpeggios') what = keyZh(card) + '琶音';
    else what = '从B开始的减七和弦琶音';
    var how;
    if (t === 'contrary') how = '双手从主音同音开始';
    else if (t === 'chromatic') how = '左手升F、右手升A（相隔大三度）';
    else if (card.hand === 'together') how = '双手';
    else how = HAND_ZH[card.hand];
    return [what, how, '两个八度', t === 'staccato' ? '断奏' : '连奏'].join(' · ');
  }

  // Extra reminder shown under the card, or an empty string.
  function reminderZh(card) {
    if (card.minorChoice) return '和声小调或旋律小调由你自选，考官不会指定。';
    if (card.type === 'contrary' && card.quality === 'harmonic') return '这一项指定为和声小调。';
    if (card.type === 'chromatic') return '右手上行、左手下行，两个八度后再一起回到起点。';
    if (card.type === 'dim7') return 'B、D、F、A♭，原位上行两个八度再下行。';
    return '';
  }

  // ---------- What the examiner says ----------

  function pick(list, seed) {
    return list[Math.abs(seed || 0) % list.length];
  }

  /*
   * English request in the style of an examiner. style 'plain' always uses the first wording,
   * 'varied' picks among natural alternatives using `seed`. Every wording keeps the key name
   * in the middle of the sentence so speech engines read "A" as a letter, not an article.
   */
  function speechEn(card, style, seed) {
    var key = keyEn(card, 'spoken');
    var hand = HAND_EN[card.hand];
    var s = style === 'varied' ? seed : 0;
    switch (card.type) {
      case 'scales':
        return pick([
          'Scale of ' + key + ', hands together.',
          'Could I have the scale of ' + key + ', hands together, please?',
          'Now the scale of ' + key + ', hands together.',
          'Let’s have the scale of ' + key + ', hands together, please.'
        ], s);
      case 'staccato':
        return pick([
          'Staccato scale of ' + key + ', ' + hand + '.',
          'Could I have the staccato scale of ' + key + ', ' + hand + ', please?',
          'Now the staccato scale of ' + key + ', ' + hand + '.'
        ], s);
      case 'contrary':
        return pick([
          'Contrary-motion scale of ' + key + '.',
          'Could I have the contrary-motion scale of ' + key + ', please?',
          'Now the scale of ' + key + ', in contrary motion.'
        ], s);
      case 'chromatic':
        return pick([
          'Chromatic contrary-motion scale, starting on F sharp and A sharp.',
          'Could I have the chromatic scale in contrary motion, starting on F sharp and A sharp, please?',
          'Now the chromatic contrary-motion scale, starting on F sharp and A sharp.'
        ], s);
      case 'arpeggios':
        return pick([
          'Arpeggio of ' + key + ', hands together.',
          'Could I have the arpeggio of ' + key + ', hands together, please?',
          'Now the arpeggio of ' + key + ', hands together.',
          'Let’s hear the arpeggio of ' + key + ', hands together.'
        ], s);
      default:
        return pick([
          'Diminished seventh, starting on B, ' + hand + '.',
          'Could I have the diminished seventh starting on B, ' + hand + ', please?',
          'Now the diminished seventh, starting on B, ' + hand + '.'
        ], s);
    }
  }

  function speechZh(card) {
    var t = card.type;
    if (t === 'scales') return keyZh(card) + '音阶，双手。';
    if (t === 'staccato') return keyZh(card) + '断奏音阶，' + HAND_ZH[card.hand] + '。';
    if (t === 'contrary') return keyZh(card) + '反向音阶。';
    if (t === 'chromatic') return '反向半音阶，左手从升F、右手从升A开始。';
    if (t === 'arpeggios') return keyZh(card) + '琶音，双手。';
    return '从B开始的减七和弦琶音，' + HAND_ZH[card.hand] + '。';
  }

  // ---------- Notes for the demo ----------

  // Mode used for the demo of a minor key. `minorForm` is the player's choice for
  // "candidate's choice" keys and is ignored where the syllabus fixes the form.
  function modeFor(card, minorForm) {
    if (card.quality === 'major') return 'major';
    if (card.quality === 'harmonic') return 'harmonic';
    return minorForm === 'melodic' ? 'melodic' : 'harmonic';
  }

  var RH_FLOOR = 55; // right hand starts between G3 and F#4, left hand an octave lower

  function lines(card, minorForm) {
    var pc = T.pitchClass(T.parseNote(card.tonic));
    var rhTonic = T.midiAtOrAbove(pc, RH_FLOOR);
    var lhTonic = rhTonic - 12;
    var oct = 2;
    var t = card.type;
    if (t === 'scales' || t === 'staccato') {
      var mode = modeFor(card, minorForm);
      return {
        rh: T.scaleLine({ tonic: card.tonic, mode: mode, octaves: oct, tonicMidi: rhTonic }),
        lh: T.scaleLine({ tonic: card.tonic, mode: mode, octaves: oct, tonicMidi: lhTonic })
      };
    }
    if (t === 'contrary') {
      var m = modeFor(card, minorForm);
      return {
        rh: T.scaleLine({ tonic: card.tonic, mode: m, octaves: oct, tonicMidi: rhTonic }),
        lh: T.scaleLine({ tonic: card.tonic, mode: m, octaves: oct, tonicMidi: rhTonic, downFirst: true })
      };
    }
    if (t === 'chromatic') {
      // LH on the F sharp below middle C, RH on the A sharp a major third above it.
      return {
        rh: T.chromaticLine({ startMidi: 58, startName: card.rhStart, octaves: oct }),
        lh: T.chromaticLine({ startMidi: 54, startName: card.tonic, octaves: oct, downFirst: true })
      };
    }
    if (t === 'arpeggios') {
      return {
        rh: T.arpeggioLine({ tonic: card.tonic, quality: card.quality, octaves: oct, tonicMidi: rhTonic }),
        lh: T.arpeggioLine({ tonic: card.tonic, quality: card.quality, octaves: oct, tonicMidi: lhTonic })
      };
    }
    return {
      rh: T.diminishedSeventhLine({ root: card.tonic, rootMidi: rhTonic, octaves: oct }),
      lh: T.diminishedSeventhLine({ root: card.tonic, rootMidi: lhTonic, octaves: oct })
    };
  }

  /*
   * Everything the player needs: time slots of notes that sound together, the length of
   * one note at the guide speed times `speed`, articulation and where accents fall.
   */
  function performance(card, opts) {
    opts = opts || {};
    var l = lines(card, opts.minorForm);
    var type = TYPE_BY_ID[card.type];
    var sp = SPEED[type.speed];
    var stepDur = 60 / sp.minim / sp.notesPerBeat / (opts.speed || 1);
    var steps;
    if (card.hand === 'rh') steps = l.rh.map(function (n) { return [{ midi: n.midi, hand: 'rh' }]; });
    else if (card.hand === 'lh') steps = l.lh.map(function (n) { return [{ midi: n.midi, hand: 'lh' }]; });
    else steps = l.rh.map(function (n, i) { return [{ midi: n.midi, hand: 'rh' }, { midi: l.lh[i].midi, hand: 'lh' }]; });
    // Light accent on every fourth note: one minim beat of four quavers, as in the speed guide.
    var group = sp.notesPerBeat;
    return {
      steps: steps,
      lines: l,
      stepDur: stepDur,
      staccato: card.type === 'staccato',
      groupSize: group,
      minim: sp.minim
    };
  }

  // Spelled notes for one octave going up (and down where it differs), for display.
  function octaveNames(card, minorForm) {
    var t = card.type;
    var up;
    var down = null;
    if (t === 'scales' || t === 'staccato' || t === 'contrary') {
      var mode = modeFor(card, minorForm);
      var u = T.degrees(card.tonic, mode, 'up').map(function (n) { return T.noteName(n, 'ascii'); });
      var d = T.degrees(card.tonic, mode, 'down').map(function (n) { return T.noteName(n, 'ascii'); });
      up = u.concat([u[0]]);
      if (d.join() !== u.join()) down = [u[0]].concat(d.slice(1).reverse(), [u[0]]);
    } else if (t === 'arpeggios') {
      up = T.arpeggioLine({ tonic: card.tonic, quality: card.quality, octaves: 1, tonicMidi: 60 }).slice(0, 4).map(function (n) { return n.name; });
    } else if (t === 'dim7') {
      up = T.diminishedSeventhLine({ root: card.tonic, rootMidi: 59, octaves: 1 }).slice(0, 5).map(function (n) { return n.name; });
    } else {
      up = null;
    }
    return { up: up, down: down };
  }

  // Keys to mark on the one octave keyboard.
  function keyboardSpec(card, minorForm) {
    var pc = T.pitchClass(T.parseNote(card.tonic));
    var low = 60 + pc;
    var marks = [];
    function mark(name, offset, kind) {
      marks.push({ midi: low + offset, label: T.formatName(name, 'unicode'), kind: kind });
    }
    if (card.type === 'chromatic') {
      // One octave from F sharp, with both starting notes (F sharp and A sharp) marked.
      low = 66;
      return {
        low: low,
        high: low + 12,
        marks: [
          { midi: low, label: 'F♯', kind: 'tonic' },
          { midi: low + 4, label: 'A♯', kind: 'tonic' }
        ]
      };
    }
    var names = octaveNames(card, minorForm);
    var mode = card.type === 'arpeggios' || card.type === 'dim7' ? null : modeFor(card, minorForm);
    if (mode) {
      var semUp = T.MODES[mode].up;
      var semDown = T.MODES[mode].down;
      var spelledUp = T.degrees(card.tonic, mode, 'up');
      var spelledDown = T.degrees(card.tonic, mode, 'down');
      semUp.forEach(function (s, i) {
        mark(T.noteName(spelledUp[i], 'ascii'), s, i === 0 ? 'tonic' : 'up');
      });
      semDown.forEach(function (s, i) {
        if (semUp.indexOf(s) === -1) mark(T.noteName(spelledDown[i], 'ascii'), s, 'down-only');
      });
      mark(card.tonic, 12, 'tonic');
    } else {
      var semis = card.type === 'dim7' ? [0, 3, 6, 9] : card.quality === 'minor' ? [0, 3, 7] : [0, 4, 7];
      names.up.slice(0, semis.length).forEach(function (name, i) {
        mark(name, semis[i], i === 0 ? 'tonic' : 'up');
      });
      mark(card.tonic, 12, 'tonic');
    }
    return { low: low, high: low + 12, marks: marks };
  }

  // ---------- Mock exam ----------

  var QUALITY_ORDER = { major: 0, minor: 1, harmonic: 1, chromatic: 0, dim7: 0 };
  var EXTRA_WEIGHT = { scales: 4, arpeggios: 4, staccato: 1.2, contrary: 1, chromatic: 0, dim7: 0 };

  /*
   * Picks the cards for a mock exam the way the syllabus says examiners ask: at least one of
   * each type, majors before minors within a type, a balance of hands, and both a major and a
   * minor wherever a type gets two or more requests. The same key is never asked twice in one
   * type. opts: size, order ('syllabus' or 'shuffle'), weight(card) to favour keys that need
   * work, random() for tests.
   */
  function buildExam(opts) {
    var size = opts.size || 10;
    var rand = opts.random || Math.random;
    var weight = opts.weight || function () { return 1; };
    var byType = {};
    TYPES.forEach(function (t) { byType[t.id] = []; });
    CARDS.forEach(function (c) { byType[c.type].push(c); });

    function pickWeighted(list, w) {
      var total = 0;
      list.forEach(function (c) { total += w(c); });
      var x = rand() * total;
      for (var i = 0; i < list.length; i++) {
        x -= w(list[i]);
        if (x <= 0) return list[i];
      }
      return list[list.length - 1];
    }

    var chosen = {};
    var used = {};
    function keyOf(c) {
      return c.type + ':' + c.tonic + ':' + c.quality;
    }
    function take(card) {
      chosen[card.type] = (chosen[card.type] || []).concat([card]);
      used[keyOf(card)] = true;
    }
    function free(c) {
      return !used[keyOf(c)];
    }

    TYPES.forEach(function (t) { take(pickWeighted(byType[t.id], weight)); });

    var extra = Math.max(0, size - TYPES.length);
    while (extra > 0) {
      var pool = CARDS.filter(function (c) { return free(c) && EXTRA_WEIGHT[c.type] > 0; });
      if (!pool.length) break;
      take(pickWeighted(pool, function (c) { return EXTRA_WEIGHT[c.type] * weight(c); }));
      extra--;
    }

    ['scales', 'arpeggios'].forEach(function (id) {
      var list = chosen[id] || [];
      if (list.length < 2) return;
      var hasMajor = list.some(function (c) { return c.quality === 'major'; });
      var hasMinor = list.some(function (c) { return c.quality !== 'major'; });
      if (hasMajor && hasMinor) return;
      var options = byType[id].filter(function (c) { return free(c) && (c.quality === 'major') !== hasMajor; });
      if (!options.length) return;
      var swapOut = list[list.length - 1];
      take(pickWeighted(options, weight));
      chosen[id] = chosen[id].filter(function (c) { return c !== swapOut; });
    });

    var separate = [];
    TYPES.forEach(function (t) {
      (chosen[t.id] || []).forEach(function (c) { if (c.hand !== 'together') separate.push(c); });
    });
    if (separate.length >= 2 && separate.every(function (c) { return c.hand === separate[0].hand; })) {
      var flip = separate[separate.length - 1];
      var twin = CARD_BY_ID[[flip.type, flip.tonic, flip.quality, flip.hand === 'rh' ? 'lh' : 'rh'].join(':')];
      chosen[flip.type] = chosen[flip.type].map(function (c) { return c === flip ? twin : c; });
    }

    var typeOrder = TYPES.map(function (t) { return t.id; });
    if (opts.order === 'shuffle') {
      for (var j = typeOrder.length - 1; j > 0; j--) {
        var k = Math.floor(rand() * (j + 1));
        var tmp = typeOrder[j];
        typeOrder[j] = typeOrder[k];
        typeOrder[k] = tmp;
      }
    }
    var out = [];
    typeOrder.forEach(function (id) {
      (chosen[id] || [])
        .slice()
        .sort(function (a, b) { return QUALITY_ORDER[a.quality] - QUALITY_ORDER[b.quality]; })
        .forEach(function (c) { out.push(c); });
    });
    return out;
  }

  return {
    TYPES: TYPES,
    TYPE_BY_ID: TYPE_BY_ID,
    CARDS: CARDS,
    CARD_BY_ID: CARD_BY_ID,
    SPEED: SPEED,
    HAND_ZH: HAND_ZH,
    noteHtml: noteHtml,
    noteZh: noteZh,
    keyEn: keyEn,
    keyZh: keyZh,
    titleHtml: titleHtml,
    titleText: titleText,
    detailEn: detailEn,
    detailZh: detailZh,
    reminderZh: reminderZh,
    speechEn: speechEn,
    speechZh: speechZh,
    modeFor: modeFor,
    lines: lines,
    performance: performance,
    octaveNames: octaveNames,
    keyboardSpec: keyboardSpec,
    buildExam: buildExam
  };
});
