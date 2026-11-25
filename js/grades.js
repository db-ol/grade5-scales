(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.PianoGrade = factory;
})(typeof self !== 'undefined' ? self : this, function (grade) {
  'use strict';

  var seventh = grade === 7;
  var majors = seventh ? ['Db', 'E', 'G', 'Bb'] : ['C', 'Eb', 'F#', 'A'];
  var minors = seventh ? ['C#', 'E', 'G', 'Bb'] : majors;
  var sevenths = seventh ? ['Bb', 'E'] : ['Eb', 'C'];
  var legato = ['legato'];
  var both = ['legato', 'staccato'];
  var together = ['together'];
  var separate = ['rh', 'lh'];
  var major = { keys: majors, quality: 'major' };
  var harmonic = { keys: minors, quality: 'harmonic' };
  var tonal = [major, harmonic];
  var doubleThirds = [{ keys: [seventh ? 'G' : 'Eb'], quality: 'major' }];
  var choiceZh = '考官指定连奏或断奏，';
  var choiceEn = 'legato or staccato · ';

  function requirement(id, en, zh, octaves, hands, articulations, speed, rows, instruction, instructionZh) {
    return {
      id: id, en: en, enLong: en, eyebrow: en, zh: zh,
      range: octaves + ' oct.', octaves: octaves, hands: hands, articulations: articulations,
      speed: speed, rows: rows,
      requirement: (articulations === both ? choiceEn : articulations[0] + ' · ') + instruction,
      requirementZh: (articulations === both ? choiceZh : articulations[0] === 'legato' ? '连奏，' : '断奏，') + instructionZh
    };
  }

  var types = [
    requirement('scales', 'Scales', '同向音阶', 4, together, both, 'scale',
      [major, harmonic, { keys: minors, quality: 'melodic' }], 'hands together', '双手相隔八度同向进行'),
    seventh
      ? requirement('thirdsApart', 'Scales a third apart', '双手相隔三度音阶', 4, together, both, 'apart',
        tonal, 'hands a third apart', '左手从主音开始，右手高三度')
      : requirement('sixthsApart', 'Scales a sixth apart', '双手相隔六度音阶', 4, together, both, 'apart',
        tonal, 'hands a sixth apart', '右手从主音开始，左手低六度'),
    requirement('contrary', 'Scales in contrary motion', '反向音阶', 2, together, both, 'scale',
      tonal, 'both hands start on the tonic in unison', '两手从同一个主音开始反向进行'),
    requirement('legatoThirds', 'Legato scale in thirds', '三度双音连奏音阶', 2, separate, legato, 'legatoThirds',
      doubleThirds, 'hands separately', '单手同时弹两个音，起始低音为主音'),
    seventh
      ? requirement('staccatoThirds', 'Staccato scale in thirds', '三度双音断奏音阶', 2, separate, ['staccato'], 'staccatoDoubles',
        doubleThirds, 'hands separately', '单手同时弹两个音，起始低音为主音')
      : requirement('staccatoSixths', 'Staccato scale in sixths', '六度双音断奏音阶', 2, separate, ['staccato'], 'staccatoDoubles',
        [{ keys: ['C'], quality: 'major' }], 'hands separately', '单手同时弹两个音，起始高音为主音'),
    seventh
      ? requirement('chromatic', 'Chromatic scale in contrary motion', '反向半音阶', 2, together, both, 'scale',
        [{ keys: ['C#'], rhStart: 'E', quality: 'chromatic' }], 'start a minor third apart', '两手从相隔小三度的音开始反向进行')
      : requirement('chromaticSixths', 'Chromatic scale a major sixth apart', '双手相隔大六度半音阶', 4, together, both, 'apart',
        [{ keys: ['Eb'], rhStart: 'C', quality: 'chromatic' }], 'hands a major sixth apart', '双手相隔大六度同向进行')
  ];
  if (!seventh) {
    types.push(requirement('wholeTone', 'Whole tone scales', '全音音阶', 4, together, both, 'scale',
      [{ keys: ['Eb', 'C'], quality: 'wholeTone' }], 'hands together', '双手相隔八度同向进行'));
  }
  var arpeggios = requirement('arpeggios', 'Arpeggios', '琶音', 4, together, legato, 'arpeggio',
    [major, { keys: minors, quality: 'minor' }],
    seventh ? 'hands together in first inversion' : 'hands together in second inversion',
    seventh ? '双手弹第一转位，从三音开始' : '双手弹第二转位，从五音开始');
  arpeggios.inversion = seventh ? 1 : 2;
  types.push(arpeggios,
    requirement('dom7', 'Dominant sevenths', '属七和弦琶音', 4, together, legato, 'arpeggio',
      [{ keys: majors, quality: 'dom7' }], 'hands together, resolving to the tonic', '双手从属音开始，最后解决到主音'),
    requirement('dim7', 'Diminished sevenths', '减七和弦琶音', 4, together, legato, 'arpeggio',
      [{ keys: sevenths, quality: 'dim7' }], 'hands together', '双手相隔八度同向进行'));

  function speed(minim) { return { minim: minim, notesPerBeat: 4 }; }
  return {
    types: types,
    speed: {
      scale: speed(seventh ? 80 : 88), arpeggio: speed(seventh ? 56 : 66),
      apart: speed(60), legatoThirds: speed(seventh ? 46 : 52), staccatoDoubles: speed(54)
    }
  };
});
