/*
 * Note spelling plus the note sequences of scales and arpeggios.
 * Pure functions with no DOM access, shared by the page and the Node tests.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Theory = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LETTERS = 'CDEFGAB';
  var NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];

  // Semitones above the tonic for each of the seven degrees.
  var MODES = {
    major: { up: [0, 2, 4, 5, 7, 9, 11], down: [0, 2, 4, 5, 7, 9, 11] },
    harmonic: { up: [0, 2, 3, 5, 7, 8, 11], down: [0, 2, 3, 5, 7, 8, 11] },
    // Melodic minor raises 6 and 7 going up and uses the natural minor coming down.
    melodic: { up: [0, 2, 3, 5, 7, 9, 11], down: [0, 2, 3, 5, 7, 8, 10] },
    natural: { up: [0, 2, 3, 5, 7, 8, 10], down: [0, 2, 3, 5, 7, 8, 10] }
  };

  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  // "F#" -> { letter: 3, acc: 1 }. Accepts #, ##, x, b, bb and the Unicode signs.
  function parseNote(name) {
    var m = /^([A-Ga-g])(##|#|x|bb|b|♯|♭|♮)?$/.exec(String(name).trim());
    if (!m) throw new Error('Cannot parse note name: ' + name);
    var accMap = { '': 0, '#': 1, '♯': 1, '##': 2, x: 2, b: -1, '♭': -1, bb: -2, '♮': 0 };
    return { letter: LETTERS.indexOf(m[1].toUpperCase()), acc: accMap[m[2] || ''] };
  }

  function pitchClass(note) {
    return mod(NATURAL_PC[note.letter] + note.acc, 12);
  }

  var ACC_ASCII = { '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': 'x' };
  var ACC_UNICODE = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
  var ACC_SPOKEN = { '-2': ' double flat', '-1': ' flat', '0': '', '1': ' sharp', '2': ' double sharp' };

  // style: 'ascii' (F#), 'unicode' (F♯) or 'spoken' (F sharp)
  function noteName(note, style) {
    var table = style === 'unicode' ? ACC_UNICODE : style === 'spoken' ? ACC_SPOKEN : ACC_ASCII;
    return LETTERS[note.letter] + table[String(note.acc)];
  }

  function formatName(name, style) {
    return noteName(parseNote(name), style);
  }

  // The note `semitones` above the tonic, written on the letter `steps` above the tonic letter.
  function spellAbove(tonic, steps, semitones) {
    var letter = mod(tonic.letter + steps, 7);
    var target = mod(pitchClass(tonic) + semitones, 12);
    var acc = mod(target - NATURAL_PC[letter] + 6, 12) - 6;
    if (acc < -2 || acc > 2) throw new Error('Spelling out of range');
    return { letter: letter, acc: acc };
  }

  // The seven spelled degrees of a scale, for the ascending or descending form.
  function degrees(tonicName, mode, direction) {
    var tonic = parseNote(tonicName);
    var steps = MODES[mode][direction === 'down' ? 'down' : 'up'];
    return steps.map(function (semi, i) {
      return spellAbove(tonic, i, semi);
    });
  }

  // Lowest MIDI number of this pitch class at or above `min`.
  function midiAtOrAbove(pc, min) {
    return min + mod(pc - min, 12);
  }

  function noteEvent(midi, note) {
    return { midi: midi, name: noteName(note, 'ascii'), pc: mod(midi, 12) };
  }

  /*
   * One hand's line for a scale. Starts on scale position `startDegree` (0 is the
   * tonic) above `tonicMidi`, runs up `octaves` octaves and back down to where it began.
   * With downFirst the line runs down first and then back up (left hand in contrary motion).
   */
  function scaleLine(opts) {
    var mode = MODES[opts.mode];
    var up = degrees(opts.tonic, opts.mode, 'up');
    var down = degrees(opts.tonic, opts.mode, 'down');
    var start = opts.startDegree || 0;
    var steps = 7 * opts.octaves;
    var dir = opts.downFirst ? -1 : 1;
    var out = [];

    function push(pos, goingUp) {
      var deg = mod(pos, 7);
      var oct = Math.floor(pos / 7);
      var semis = goingUp ? mode.up : mode.down;
      out.push(noteEvent(opts.tonicMidi + 12 * oct + semis[deg], (goingUp ? up : down)[deg]));
    }

    var k;
    for (k = 0; k <= steps; k++) push(start + dir * k, dir > 0);
    for (k = steps - 1; k >= 0; k--) push(start + dir * k, dir < 0);
    return out;
  }

  // Arpeggio of any chord. `letters` and `semis` give each chord note's distance from the
  // root in letter names and in semitones, e.g. a diminished seventh is [0, 2, 4, 6] and [0, 3, 6, 9].
  function chordLine(opts) {
    var root = parseNote(opts.root);
    var size = opts.semis.length;
    var spelled = opts.semis.map(function (semi, i) { return spellAbove(root, opts.letters[i], semi); });
    var count = size * opts.octaves;
    var out = [];

    function push(i) {
      var j = mod(i, size);
      var oct = Math.floor(i / size);
      out.push(noteEvent(opts.rootMidi + 12 * oct + opts.semis[j], spelled[j]));
    }

    var i;
    for (i = 0; i <= count; i++) push(i);
    for (i = count - 1; i >= 0; i--) push(i);
    return out;
  }

  // Root position major or minor triad through `octaves` octaves and back.
  function arpeggioLine(opts) {
    return chordLine({
      root: opts.tonic,
      rootMidi: opts.tonicMidi,
      octaves: opts.octaves,
      letters: [0, 2, 4],
      semis: opts.quality === 'minor' ? [0, 3, 7] : [0, 4, 7]
    });
  }

  function diminishedSeventhLine(opts) {
    return chordLine({
      root: opts.root,
      rootMidi: opts.rootMidi,
      octaves: opts.octaves,
      letters: [0, 2, 4, 6],
      semis: [0, 3, 6, 9]
    });
  }

  var SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  // Chromatic line from `startMidi`, written with sharps going up and flats coming down.
  // The first and last notes keep the starting note's own spelling.
  function chromaticLine(opts) {
    var dir = opts.downFirst ? -1 : 1;
    var steps = 12 * opts.octaves;
    var out = [];

    function push(k, goingUp) {
      var midi = opts.startMidi + dir * k;
      var name = k === 0 && opts.startName ? opts.startName : (goingUp ? SHARP_NAMES : FLAT_NAMES)[mod(midi, 12)];
      out.push(noteEvent(midi, parseNote(name)));
    }

    var k;
    for (k = 0; k <= steps; k++) push(k, dir > 0);
    for (k = steps - 1; k >= 0; k--) push(k, dir < 0);
    return out;
  }

  return {
    LETTERS: LETTERS,
    MODES: MODES,
    mod: mod,
    parseNote: parseNote,
    pitchClass: pitchClass,
    noteName: noteName,
    formatName: formatName,
    degrees: degrees,
    midiAtOrAbove: midiAtOrAbove,
    scaleLine: scaleLine,
    chordLine: chordLine,
    arpeggioLine: arpeggioLine,
    diminishedSeventhLine: diminishedSeventhLine,
    chromaticLine: chromaticLine
  };
});
