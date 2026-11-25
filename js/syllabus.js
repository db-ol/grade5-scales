(function (root, factory) {
  var T = root.Theory || (typeof require === 'function' ? require('./theory.js') : null);
  var pianoGrade = root.PianoGrade || (typeof require === 'function' ? require('./grades.js') : null);
  var decks = {};
  function forGrade(grade) {
    grade = Number(grade);
    if ([5, 7, 8].indexOf(grade) < 0) throw new RangeError('Unknown piano grade');
    if (!decks[grade]) {
      decks[grade] = factory(T, grade, grade === 5 ? null : pianoGrade(grade));
      decks[grade].forGrade = forGrade;
    }
    return decks[grade];
  }
  var api = forGrade(5);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Syllabus = api;
})(typeof self !== 'undefined' ? self : this, function (T, grade, syllabus) {
  'use strict';

  var SPEED = syllabus ? syllabus.speed : {
    scale: { minim: 60, notesPerBeat: 4 },
    arpeggio: { minim: 44, notesPerBeat: 4 }
  };

  var TYPES = syllabus ? syllabus.types : [
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
  TYPES.forEach(function (t) {
    if (grade === 5) {
      t.octaves = 2;
      t.articulations = [t.id === 'staccato' ? 'staccato' : 'legato'];
    }
    TYPE_BY_ID[t.id] = t;
  });

  var HAND_EN = { together: 'hands together', rh: 'right hand', lh: 'left hand' };
  var HAND_ZH = { together: '双手', rh: '右手', lh: '左手' };

  function buildCards() {
    var cards = [];
    TYPES.forEach(function (type) {
      type.rows.forEach(function (row) {
        row.keys.forEach(function (key) {
          type.hands.forEach(function (hand) {
            type.articulations.forEach(function (articulation) {
              var id = [type.id, key, row.quality, hand].join(':');
              cards.push({
                id: grade === 5 ? id : [grade, id, articulation].join(':'),
                grade: grade,
                type: type.id,
                tonic: key,
                quality: row.quality,
                hand: hand,
                octaves: type.octaves,
                articulation: articulation,
                inversion: type.inversion || 0,
                minorChoice: !!row.minorChoice,
                rhStart: row.rhStart || null
              });
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

  var QUALITY_EN = { major: 'major', minor: 'minor', harmonic: 'harmonic minor', melodic: 'melodic minor' };
  var ART_ZH = { legato: '连奏', staccato: '断奏' };
  var INV_EN = ['', 'first inversion', 'second inversion'];
  var INV_ZH = ['', '第一转位', '第二转位'];

  function keyEn(card, style) {
    var tonic = style === 'spoken' ? T.formatName(card.tonic, 'spoken') : T.formatName(card.tonic, 'unicode');
    return QUALITY_EN[card.quality] ? tonic + ' ' + QUALITY_EN[card.quality] : tonic;
  }

  function keyZh(card) {
    if (card.quality === 'major') return noteZh(card.tonic) + '大调';
    if (card.quality === 'harmonic') return noteZh(card.tonic, true) + '和声小调';
    if (card.quality === 'melodic') return noteZh(card.tonic, true) + '旋律小调';
    if (card.quality === 'minor') return noteZh(card.tonic, true) + '小调';
    return noteZh(card.tonic);
  }

  // Large title on the card, as HTML with styled accidentals.
  function titleHtml(card) {
    if (card.rhStart) return noteHtml(card.tonic) + ' &amp; ' + noteHtml(card.rhStart);
    if (card.type === 'dim7' || card.type === 'wholeTone') return 'starting on ' + noteHtml(card.tonic);
    if (card.type === 'dom7') return 'in ' + noteHtml(card.tonic);
    return noteHtml(card.tonic) + ' ' + QUALITY_EN[card.quality];
  }

  // Plain text title for lists and summaries.
  function titleText(card) {
    var title = keyEn(card);
    if (card.rhStart) title += ' (LH) & ' + T.formatName(card.rhStart, 'unicode') + ' (RH)';
    if (card.type === 'dim7' || card.type === 'wholeTone') title = 'starting on ' + title;
    if (card.type === 'dom7') title = 'in ' + title;
    if (TYPE_BY_ID[card.type].articulations.length > 1) title += ' · ' + card.articulation;
    return title;
  }

  function detailEn(card) {
    var how = {
      contrary: 'hands start on the tonic in unison',
      chromatic: grade === 5 ? 'hands start a major third apart' : 'hands start a minor third apart',
      chromaticSixths: 'hands a major sixth apart', thirdsApart: 'hands a third apart',
      sixthsApart: 'hands a sixth apart'
    };
    var parts = [how[card.type] || HAND_EN[card.hand], card.octaves + ' octaves', card.articulation];
    if (card.inversion) parts.push(INV_EN[card.inversion]);
    if (card.type === 'dom7') parts.push('resolve to the tonic');
    return parts.join(' · ');
  }

  function exerciseZh(card) {
    var key = keyZh(card);
    switch (card.type) {
      case 'scales': return key + '音阶';
      case 'staccato': return key + '断奏音阶';
      case 'thirdsApart': return key + '双手相隔三度音阶';
      case 'sixthsApart': return key + '双手相隔六度音阶';
      case 'contrary': return key + '反向音阶';
      case 'legatoThirds': return key + '三度双音连奏音阶';
      case 'staccatoThirds': return key + '三度双音断奏音阶';
      case 'staccatoSixths': return key + '六度双音断奏音阶';
      case 'chromatic': return '反向半音阶';
      case 'chromaticSixths': return '双手相隔大六度半音阶';
      case 'wholeTone': return '从' + key + '开始的全音音阶';
      case 'arpeggios': return key + INV_ZH[card.inversion] + '琶音';
      case 'dom7': return key + '调属七和弦琶音，解决到主音';
      case 'dim7': return '从' + key + '开始的减七和弦琶音';
    }
  }

  function handsZh(card) {
    if (card.rhStart) return '左手从' + noteZh(card.tonic) + '、右手从' + noteZh(card.rhStart) + '开始';
    if (card.type === 'contrary') return '双手从同一个主音开始';
    return HAND_ZH[card.hand];
  }

  function detailZh(card) {
    return [exerciseZh(card), handsZh(card), card.octaves === 4 ? '四个八度' : '两个八度',
      ART_ZH[card.articulation]].join('，');
  }

  function reminderZh(card) {
    if (card.minorChoice) return '和声小调或旋律小调由你自选，考官不会指定。';
    if (card.type === 'contrary' && card.quality === 'harmonic') return '这一项指定为和声小调。';
    if (card.type === 'chromatic') return '右手上行、左手下行，两个八度后再一起回到起点。';
    if (card.type === 'thirdsApart' || card.type === 'legatoThirds' || card.type === 'staccatoThirds') return '起始三度的低音是主音。';
    if (card.type === 'sixthsApart' || card.type === 'staccatoSixths') return '起始六度的高音是主音。';
    if (card.inversion === 1) return '从和弦的三音开始。';
    if (card.inversion === 2) return '从和弦的五音开始。';
    if (card.type === 'dim7' && grade === 5) return 'B、D、F、降A，原位上行两个八度再下行。';
    return '';
  }

  function requestEn(card) {
    var key = keyEn(card, 'spoken');
    var hand = HAND_EN[card.hand];
    switch (card.type) {
      case 'scales': return 'scale of ' + key + ', hands together';
      case 'staccato': return 'staccato scale of ' + key + ', ' + hand;
      case 'thirdsApart': return 'scale of ' + key + ', hands a third apart';
      case 'sixthsApart': return 'scale of ' + key + ', hands a sixth apart';
      case 'contrary': return grade === 5 ? 'contrary-motion scale of ' + key : 'scale of ' + key + ' in contrary motion';
      case 'legatoThirds': return 'legato scale of ' + key + ' in thirds, ' + hand;
      case 'staccatoThirds': return 'staccato scale of ' + key + ' in thirds, ' + hand;
      case 'staccatoSixths': return 'staccato scale of ' + key + ' in sixths, ' + hand;
      case 'chromatic':
      case 'chromaticSixths':
        var motion = card.type === 'chromatic' ? 'in contrary motion' : 'a major sixth apart';
        return 'chromatic scale ' + motion + ', starting on ' + key + ' in the left hand and ' +
          T.formatName(card.rhStart, 'spoken') + ' in the right hand';
      case 'wholeTone': return 'whole tone scale starting on ' + key + ', hands together';
      case 'arpeggios': return 'arpeggio of ' + key + (card.inversion ? ' in ' + INV_EN[card.inversion] : '') + ', hands together';
      case 'dom7': return 'dominant seventh in the key of ' + key + ', resolving to the tonic, hands together';
      case 'dim7': return 'diminished seventh, starting on ' + key + ', ' + hand;
    }
  }

  function speechEn(card, style, seed) {
    var request = requestEn(card);
    if (TYPE_BY_ID[card.type].articulations.length > 1) request += ', ' + card.articulation;
    switch (style === 'varied' ? Math.abs(seed || 0) % 4 : 0) {
      case 1: return 'Could I have the ' + request + ', please?';
      case 2: return 'Now the ' + request + '.';
      case 3: return 'Let’s hear the ' + request + '.';
      default: return request.charAt(0).toUpperCase() + request.slice(1) + '.';
    }
  }

  function speechZh(card) {
    var request = exerciseZh(card);
    if (card.type !== 'contrary') request += '，' + handsZh(card);
    if (TYPE_BY_ID[card.type].articulations.length > 1) request += '，' + ART_ZH[card.articulation];
    return request + '。';
  }

  // ---------- Notes for the demo ----------

  // Mode used for the demo of a minor key. `minorForm` is the player's choice for
  // "candidate's choice" keys and is ignored where the syllabus fixes the form.
  function modeFor(card, minorForm) {
    if (card.quality === 'minor') return minorForm === 'melodic' ? 'melodic' : 'harmonic';
    return card.quality;
  }

  function lines(card, minorForm, octaves) {
    var t = card.type;
    var oct = octaves || card.octaves;
    var pc = T.pitchClass(T.parseNote(card.tonic));
    // Leave room for four octaves and a chord inversion on an 88 key piano.
    var rhTonic = T.midiAtOrAbove(pc, card.octaves === 4 ? 42 : 55);
    var lhTonic = rhTonic - 12;

    function scale(midi, degree, downFirst) {
      return T.scaleLine({ tonic: card.tonic, mode: modeFor(card, minorForm),
        tonicMidi: midi, startDegree: degree, downFirst: downFirst, octaves: oct });
    }

    if (t === 'chromatic' || t === 'chromaticSixths') {
      var lhStart = T.midiAtOrAbove(pc, t === 'chromatic' ? 53 : 36);
      var rhStart = T.midiAtOrAbove(T.pitchClass(T.parseNote(card.rhStart)), lhStart);
      var upperLine = { startMidi: rhStart, startName: card.rhStart, octaves: oct };
      if (t === 'chromaticSixths') return T.chromaticSixths(upperLine);
      return {
        rh: T.chromaticLine(upperLine),
        lh: T.chromaticLine({ startMidi: lhStart, startName: card.tonic, octaves: oct, downFirst: true })
      };
    }
    if (t === 'contrary') return { rh: scale(rhTonic), lh: scale(rhTonic, 0, true) };
    if (t === 'thirdsApart') return { rh: scale(rhTonic, 2), lh: scale(rhTonic) };
    if (t === 'sixthsApart') return { rh: scale(rhTonic), lh: scale(rhTonic, -5) };
    if (t === 'legatoThirds' || t === 'staccatoThirds' || t === 'staccatoSixths') {
      var lower = t === 'staccatoSixths' ? -5 : 0;
      var upper = t === 'staccatoSixths' ? 0 : 2;
      return {
        rh: scale(rhTonic, lower), rhUpper: scale(rhTonic, upper),
        lh: scale(lhTonic, lower), lhUpper: scale(lhTonic, upper)
      };
    }

    function parallel(midi) {
      var opts = { tonic: card.tonic, tonicMidi: midi, octaves: oct };
      switch (t) {
        case 'arpeggios':
          opts.quality = card.quality;
          opts.inversion = card.inversion;
          return T.arpeggioLine(opts);
        case 'dom7': return T.dominantSeventhLine(opts);
        case 'dim7': return T.diminishedSeventhLine({ root: card.tonic, rootMidi: midi, octaves: oct });
        case 'wholeTone': return T.wholeToneLine(opts);
        default: return scale(midi);
      }
    }
    return { rh: parallel(rhTonic), lh: parallel(lhTonic) };
  }

  function performance(card, opts) {
    opts = opts || {};
    var parts = lines(card, opts.minorForm);
    var speed = SPEED[TYPE_BY_ID[card.type].speed];
    var hands = card.hand === 'together' ? ['rh', 'lh'] : [card.hand];
    var steps = parts.rh.map(function (_, i) {
      var notes = [];
      hands.forEach(function (hand) {
        notes.push({ midi: parts[hand][i].midi, hand: hand });
        var upper = parts[hand + 'Upper'];
        if (upper) notes.push({ midi: upper[i].midi, hand: hand });
      });
      return notes;
    });
    return {
      steps: steps,
      lines: parts,
      stepDur: 60 / speed.minim / speed.notesPerBeat / (opts.speed || 1),
      staccato: card.articulation === 'staccato',
      groupSize: speed.notesPerBeat,
      minim: speed.minim
    };
  }

  function octaveNames(card, minorForm) {
    var parts = lines(card, minorForm, 1);
    var turn = (parts.rh.length - 1) / 2;
    function name(note) { return note.name; }
    function outward(part) { return part.slice(0, turn + 1).map(name); }
    var names = { up: outward(parts.rh), down: null };
    if (parts.rhUpper) {
      names.lower = names.up;
      names.upper = outward(parts.rhUpper);
    } else if (card.rhStart || card.type === 'thirdsApart' || card.type === 'sixthsApart') {
      names.rh = names.up;
      names.lh = outward(parts.lh);
    } else if (card.type === 'dom7') {
      names.resolution = parts.rh.slice(-2).map(name);
    } else if (modeFor(card, minorForm) === 'melodic' && card.type !== 'arpeggios') {
      names.down = parts.rh.slice(turn).map(name);
    }
    return names;
  }

  function keyboardSpec(card, minorForm) {
    function pc(name) { return T.pitchClass(T.parseNote(name)); }
    var names = octaveNames(card, minorForm);
    var ascending = names.lower || names.lh || names.up;
    var first = ascending[0];
    var low = 60 + pc(first);
    var marks = [];

    function mark(name, kind, octaveEnd) {
      var midi = low + (octaveEnd ? 12 : T.mod(pc(name) - pc(first), 12));
      if (marks.some(function (item) { return item.midi === midi; })) return;
      marks.push({ midi: midi, label: T.formatName(name, 'unicode'), kind: kind });
    }

    if (card.rhStart) {
      mark(card.tonic, 'tonic');
      mark(card.rhStart, 'tonic');
    } else {
      var otherStart = names.upper ? names.upper[0] : names.rh ? names.rh[0] : null;
      ascending.forEach(function (name, i) {
        mark(name, name === first || name === otherStart ? 'tonic' : 'up', i === ascending.length - 1);
      });
      if (names.down) names.down.forEach(function (name) { mark(name, 'down-only'); });
      if (names.resolution) mark(card.tonic, 'tonic');
    }
    return { low: low, high: low + 12, marks: marks };
  }

  // ---------- Mock exam ----------

  var EXTRA_WEIGHT = { scales: 4, arpeggios: 4, staccato: 1.2 };

  /*
   * Picks the cards for a mock exam the way the syllabus says examiners ask: at least one of
   * each type, majors before minors within a type, a balance of hands, and both a major and a
   * minor wherever a type gets two or more requests. The same key is never asked twice in one
   * type. opts: size, order ('syllabus' or 'shuffle'), weight(card) to favour keys that need
   * work, random() for tests.
   */
  function buildExam(opts) {
    opts = opts || {};
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
      var quality = c.quality === 'melodic' ? 'harmonic' : c.quality;
      return c.type + ':' + c.tonic + ':' + quality;
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
      var pool = CARDS.filter(free);
      if (!pool.length) break;
      take(pickWeighted(pool, function (c) { return (EXTRA_WEIGHT[c.type] || 1) * weight(c); }));
      extra--;
    }

    TYPES.forEach(function (t) {
      var id = t.id;
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
        .sort(function (a, b) { return Number(b.quality === 'major') - Number(a.quality === 'major'); })
        .forEach(function (c) { out.push(c); });
    });
    function balance(field, first, second, eligible) {
      var choices = out.filter(eligible);
      var count = choices.filter(function (c) { return c[field] === first; }).length;
      var difference = count * 2 - choices.length;
      var over = difference > 0 ? first : second;
      var options = choices.filter(function (c) { return c[field] === over; });
      var otherField = field === 'hand' ? 'articulation' : 'hand';
      for (var i = Math.floor(Math.abs(difference) / 2); i > 0; i--) {
        var from = options.splice(Math.floor(rand() * options.length), 1)[0];
        out[out.indexOf(from)] = byType[from.type].find(function (c) {
          return c.tonic === from.tonic && c.quality === from.quality &&
            c[field] !== from[field] && c[otherField] === from[otherField];
        });
      }
    }
    balance('hand', 'rh', 'lh', function (c) { return c.hand !== 'together'; });
    balance('articulation', 'legato', 'staccato', function (c) { return TYPE_BY_ID[c.type].articulations.length > 1; });
    return out;
  }

  return {
    grade: grade,
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
