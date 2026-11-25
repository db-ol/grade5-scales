/*
 * Page logic: random cards, mock exam, the syllabus checklist and settings.
 * Progress lives in localStorage on this device only.
 */
(function () {
  'use strict';

  // The artifact build has no <html lang> of its own, and the page is Chinese either way.
  document.documentElement.lang = 'zh-CN';
  // iOS Safari only applies :active styles on tap when a touch listener exists.
  document.addEventListener('touchstart', function () {}, { passive: true });

  var Voice = window.ExamVoice;
  var Sound = window.PianoAudio;
  var KB = window.Keyboard;

  var PREFS_KEY = 'piano-scales-settings-v1';
  var GRADE_NAMES = { 5: '五级', 7: '七级', 8: '八级' };
  var DEFAULTS = {
    lang: 'en',
    voiceEn: '',
    voiceZh: '',
    rate: 0.95,
    phrasing: 'varied',
    autoSpeak: true,
    blind: false,
    showNotes: false,
    minorForm: 'harmonic',
    speed: 1,
    grade: 5,
    examExtra: 4,
    examOrder: 'syllabus',
    examBlind: true
  };
  var RATE_ZH = ['没弹好', '还可以', '很熟练'];

  function $(id) {
    return document.getElementById(id);
  }

  // ---------- Storage ----------

  function readStored(key) {
    try {
      return JSON.parse(window.localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  }

  function writeStored(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* Keep using in-memory settings and progress when storage is unavailable. */
    }
  }

  var legacy = readStored('g5-scales-v1') || {};
  var settings = Object.assign({}, DEFAULTS, readStored(PREFS_KEY) || legacy.settings);
  if (settings.examSize) settings.examExtra = settings.examSize - 6;
  if ([0, 4, 8].indexOf(settings.examExtra) === -1) settings.examExtra = 4;
  delete settings.examSize;
  delete settings.types;
  if ([5, 7, 8].indexOf(settings.grade) === -1) settings.grade = 5;

  var S = window.Syllabus.forGrade(settings.grade);
  var practiceByGrade = {};
  var practice = loadPractice();

  function loadPractice() {
    var grade = settings.grade;
    var data = readStored('piano-scales-practice-' + grade);
    if (!data && practiceByGrade[grade]) return practiceByGrade[grade];
    if (!data) data = grade === 5 ? legacy : {};
    var types = data.types || (data.settings && data.settings.types);
    types = Array.isArray(types) ? types.filter(function (id) { return S.TYPE_BY_ID[id]; }) : [];
    practiceByGrade[grade] = {
      types: types.length ? types : S.TYPES.map(function (t) { return t.id; }),
      stats: data.stats && typeof data.stats === 'object' ? data.stats : {},
      log: Array.isArray(data.log) ? data.log : [],
      recent: Array.isArray(data.recent) ? data.recent : []
    };
    return practiceByGrade[grade];
  }

  function savePractice() {
    writeStored('piano-scales-practice-' + settings.grade, practice);
  }

  function saveSettings() {
    writeStored(PREFS_KEY, settings);
  }

  function record(cardId, r) {
    var s = practice.stats[cardId] || { n: 0, hist: [] };
    s.r = r;
    s.n = (s.n || 0) + 1;
    s.t = Date.now();
    s.hist = (s.hist || []).concat([r]).slice(-6);
    practice.stats[cardId] = s;
    practice.log = practice.log.concat([[s.t, cardId, r]]).slice(-600);
  }

  // ---------- Small helpers ----------

  var toastTimer = null;

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove('show');
      // Clear the text once the fade has finished, so the pill never shows empty.
      toastTimer = setTimeout(function () { t.textContent = ''; }, 250);
    }, 2200);
  }

  // SVG elements have no hidden property, so toggle the attribute itself.
  function showEl(el, show) {
    if (show) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  }

  function setPressed(group, attr, value) {
    Array.prototype.forEach.call(group.querySelectorAll('button[' + attr + ']'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute(attr) === String(value)));
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function weight(card) {
    var s = practice.stats[card.id];
    if (!s) return 3;
    if (s.r === 0) return 5;
    if (s.r === 1) return 2.5;
    var streak = 0;
    for (var i = s.hist.length - 1; i >= 0 && s.hist[i] === 2; i--) streak++;
    return streak >= 3 ? 0.35 : 0.7;
  }

  function weightedPick(list) {
    var total = 0;
    list.forEach(function (c) { total += weight(c); });
    var x = Math.random() * total;
    for (var i = 0; i < list.length; i++) {
      x -= weight(list[i]);
      if (x <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  function stateOf(cardId) {
    var s = practice.stats[cardId];
    return s ? s.r : -1;
  }

  // ---------- Voice and sound ----------

  function speechText(card, seed) {
    return settings.lang === 'zh' ? S.speechZh(card) : S.speechEn(card, settings.phrasing, seed);
  }

  function say(card, seed) {
    if (!Voice.supported) {
      toast('这个浏览器不支持语音朗读，请换 Safari 或 Chrome。');
      return;
    }
    Sound.stop();
    var st = settings;
    Voice.speak(speechText(card, seed), {
      lang: st.lang,
      voiceURI: st.lang === 'zh' ? st.voiceZh : st.voiceEn,
      rate: st.rate
    });
  }

  var metroOwner = null;

  function stopAllSound() {
    Sound.stop();
    Sound.stopMetronome();
    Voice.cancel();
    metroOwner = null;
    syncMetroButton();
  }

  // ---------- Draw view ----------

  var cur = { card: null, seed: 0, revealed: true, notesShown: false, kb: null };

  function poolForDraw() {
    var pool = S.CARDS.filter(function (c) { return practice.types.indexOf(c.type) !== -1; });
    return pool.length ? pool : S.CARDS.slice();
  }

  function nextCard() {
    var pool = poolForDraw();
    // Skip the last few cards, but always leave a real choice so the weights matter.
    // With only two cards, allow a repeat but never the same card three times running.
    var avoid;
    if (pool.length <= 2) {
      var r = practice.recent;
      avoid = r.length >= 2 && r[r.length - 1] === r[r.length - 2] ? [r[r.length - 1]] : [];
    } else {
      avoid = practice.recent.slice(-Math.min(4, Math.floor(pool.length / 2)));
    }
    var cands = pool.filter(function (c) { return avoid.indexOf(c.id) === -1; });
    var card = weightedPick(cands.length ? cands : pool);
    practice.recent = practice.recent.concat([card.id]).slice(-8);
    savePractice();
    return card;
  }

  function showCard(card, speak) {
    stopAllSound();
    cur.card = card;
    cur.seed = Math.floor(Math.random() * 1000);
    cur.revealed = !settings.blind;
    cur.notesShown = !!settings.showNotes;
    renderCard();
    var inst = $('instrument');
    inst.classList.remove('dealt');
    void inst.offsetWidth;
    inst.classList.add('dealt');
    if (speak) say(card, cur.seed);
  }

  function fillFallboard(prefix, card, seed) {
    var type = S.TYPE_BY_ID[card.type];
    $(prefix + '-type').textContent = type.eyebrow + (card.hand === 'rh' ? ' · RH' : card.hand === 'lh' ? ' · LH' : '');
    var title = $(prefix + '-title');
    title.innerHTML = S.titleHtml(card);
    title.classList.toggle('long', title.textContent.length > 10);
    $(prefix + '-en').textContent = S.detailEn(card);
    $(prefix + '-zh').textContent = S.detailZh(card);
    var speech = $(prefix + '-speech');
    speech.textContent = '“' + speechText(card, seed) + '”';
    speech.lang = settings.lang === 'zh' ? 'zh-CN' : 'en';
  }

  function renderCard() {
    var card = cur.card;
    fillFallboard('card', card, cur.seed);
    $('veil').hidden = cur.revealed;

    renderHints();
    renderKeys();
    renderStats();
    syncMetroButton();
    setDemoButton(false);
  }

  // Reminder and minor form toggle sit outside the veil, so they wait until the card is shown.
  function renderHints() {
    var card = cur.card;
    var reminder = cur.revealed ? S.reminderZh(card) : '';
    $('card-reminder').textContent = reminder;
    $('card-reminder').hidden = !reminder;
    $('minor-form').hidden = !card.minorChoice || !cur.revealed;
    setPressed($('minor-form'), 'data-form', settings.minorForm);
  }

  function reveal() {
    if (cur.revealed) return;
    cur.revealed = true;
    $('veil').hidden = true;
    renderHints();
    renderKeys();
    syncMetroButton();
  }

  function renderKeys() {
    var card = cur.card;
    var spec = S.keyboardSpec(card, settings.minorForm);
    var keys = $('keys');
    // While the card is hidden, a neutral C to C keyboard keeps the key a secret.
    var shown = cur.revealed ? spec : { low: 60, high: 72, marks: [] };
    cur.kb = KB.render(keys, {
      low: shown.low,
      high: shown.high,
      marks: cur.notesShown && cur.revealed ? shown.marks : [],
      ariaLabel: cur.notesShown && cur.revealed ? '键盘上标出了这一项用到的音' : '键盘'
    });
    if (!cur.notesShown || !cur.revealed) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'reveal-notes';
      b.textContent = cur.revealed ? '点这里显示音符' : '看题和音符';
      b.addEventListener('click', function () {
        cur.notesShown = true;
        if (!cur.revealed) reveal();
        else renderKeys();
      });
      keys.appendChild(b);
    }
    renderNotesLine();
  }

  function fmt(names) {
    return names.map(function (n) { return S.noteHtml(n); }).join(' ');
  }

  function renderNotesLine() {
    var card = cur.card;
    var dl = $('notes-line');
    dl.hidden = !cur.notesShown || !cur.revealed;
    if (dl.hidden) return;
    var names = S.octaveNames(card, settings.minorForm);
    var rows = [];
    if (names.lower) {
      rows.push(['下方音', fmt(names.lower)], ['上方音', fmt(names.upper)]);
    } else if (names.lh) {
      rows.push(['左手', fmt(names.lh)], ['右手', fmt(names.rh)]);
    } else if (card.type === 'arpeggios' || card.type === 'dim7' || card.type === 'dom7') {
      rows.push(['和弦音', fmt(names.up)]);
      if (names.resolution) rows.push(['解决', fmt(names.resolution)]);
    } else {
      rows.push([names.down ? '上行' : '音阶', fmt(names.up)]);
      if (names.down) {
        rows.push(['下行', fmt(names.down)]);
        rows.push(['图例', '<span class="legend-dot"></span>实心圆：上行的音　<span class="legend-dot hollow"></span>空心圆：只在下行用到']);
      }
    }
    dl.innerHTML = rows.map(function (r) {
      var cls = r[0] === '图例' ? ' class="legend"' : '';
      return '<dt>' + r[0] + '</dt><dd' + cls + '>' + r[1] + '</dd>';
    }).join('');
  }

  function renderStats() {
    var all = S.CARDS.length;
    var good = 0;
    var weak = 0;
    S.CARDS.forEach(function (c) {
      var r = stateOf(c.id);
      if (r === 2) good++;
      if (r === 0) weak++;
    });
    var start = new Date();
    start.setHours(0, 0, 0, 0);
    var today = practice.log.filter(function (e) { return e[0] >= start.getTime(); }).length;
    $('stats').innerHTML =
      '<span>今天练了 <b>' + today + '</b> 题</span>' +
      '<span>很熟练 <b>' + good + '</b> / ' + all + '</span>' +
      (weak ? '<span>待加强 <b>' + weak + '</b></span>' : '');
  }

  function setDemoButton(playing) {
    var b = $('btn-demo');
    b.setAttribute('data-on', String(playing));
    showEl(b.querySelector('.i-play'), !playing);
    showEl(b.querySelector('.i-stop'), playing);
    b.querySelector('span').textContent = playing ? '停止' : '听示范';
  }

  function playDemo(card, kbHandle, onDone) {
    Voice.cancel();
    Sound.stopMetronome();
    metroOwner = null;
    syncMetroButton();
    var perf = S.performance(card, { minorForm: settings.minorForm, speed: settings.speed });
    var ok = Sound.play(perf.steps, {
      stepDur: perf.stepDur,
      staccato: perf.staccato,
      groupSize: perf.groupSize,
      onStep: function (i) {
        if (!kbHandle) return;
        var rh = [];
        var lh = [];
        perf.steps[i].forEach(function (n) { (n.hand === 'rh' ? rh : lh).push(((n.midi % 12) + 12) % 12); });
        kbHandle.light(rh, lh);
      },
      onEnd: function (stopped, reason) {
        if (kbHandle) kbHandle.clear();
        if (onDone) onDone();
        if (reason === 'nosound') toast('声音没有启动，请再点一次。');
      }
    });
    if (!ok) toast('这个浏览器不能播放示范声音。');
    return ok;
  }

  function toggleDemo() {
    if (Sound.isPlaying()) {
      Sound.stop();
      return;
    }
    Sound.unlock();
    // Hearing the demo gives the answer anyway, so show the card and its notes.
    cur.notesShown = true;
    if (!cur.revealed) reveal();
    else renderKeys();
    if (playDemo(cur.card, cur.kb, function () { setDemoButton(false); })) setDemoButton(true);
  }

  function syncMetroButton() {
    var b = $('btn-metro');
    if (!b || !cur.card) return;
    var on = metroOwner === 'draw' && Sound.metronomeOn();
    b.setAttribute('data-on', String(on));
    var minim = S.SPEED[S.TYPE_BY_ID[cur.card.type].speed].minim;
    var bpm = Math.round(minim * settings.speed);
    $('metro-label').textContent = on ? '停止' : '节拍器';
    // The tempo can give away the requirement in a listening exercise.
    $('metro-speed').innerHTML = cur.revealed ? MINIM_SVG + ' = ' + bpm : '';
  }

  var MINIM_SVG = '<svg class="minim" viewBox="0 0 10 20" aria-label="二分音符" role="img">' +
    '<ellipse cx="4.2" cy="16" rx="3.4" ry="2.4" transform="rotate(-22 4.2 16)" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
    '<path d="M7.3 15.2V1.5" stroke="currentColor" stroke-width="1.3"/></svg>';

  function toggleMetro() {
    if (metroOwner === 'draw' && Sound.metronomeOn()) {
      Sound.stopMetronome();
      metroOwner = null;
    } else {
      Sound.unlock();
      Sound.stop();
      Voice.cancel();
      var minim = S.SPEED[S.TYPE_BY_ID[cur.card.type].speed].minim;
      var started = Sound.metronome(minim * settings.speed, 1, function () {
        metroOwner = null;
        syncMetroButton();
        toast('声音没有启动，请再点一次。');
      });
      if (started) metroOwner = 'draw';
      else toast('这个浏览器不能播放声音。');
    }
    syncMetroButton();
  }

  function renderTypeChips() {
    var box = $('type-chips');
    var html = '<button class="chip" type="button" data-type="all">全部</button>';
    S.TYPES.forEach(function (t) {
      html += '<button class="chip" type="button" data-type="' + t.id + '">' + t.zh.replace(/（.*）/, '') + '</button>';
    });
    box.innerHTML = html;
    syncTypeChips();
  }

  function syncTypeChips() {
    var types = practice.types;
    var allOn = types.length === S.TYPES.length;
    Array.prototype.forEach.call($('type-chips').querySelectorAll('.chip'), function (b) {
      var id = b.getAttribute('data-type');
      b.setAttribute('aria-pressed', String(id === 'all' ? allOn : !allOn && types.indexOf(id) !== -1));
    });
  }

  function onTypeChip(id) {
    var types = practice.types;
    var allOn = types.length === S.TYPES.length;
    if (id === 'all') types = S.TYPES.map(function (t) { return t.id; });
    else if (allOn) types = [id];
    else if (types.indexOf(id) !== -1) types = types.filter(function (x) { return x !== id; });
    else types = types.concat([id]);
    if (!types.length) types = S.TYPES.map(function (t) { return t.id; });
    practice.types = types;
    savePractice();
    syncTypeChips();
    if (types.indexOf(cur.card.type) === -1) showCard(nextCard(), false);
  }

  // After rating while scrolled down, the new card would start out of sight under the header.
  function bringCardIntoView() {
    if (window.scrollY > 0 && $('instrument').getBoundingClientRect().top < 70) window.scrollTo(0, 0);
  }

  function bindDraw() {
    $('type-chips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (b) onTypeChip(b.getAttribute('data-type'));
    });
    $('btn-say').addEventListener('click', function () {
      Sound.unlock();
      say(cur.card, cur.seed);
    });
    $('btn-demo').addEventListener('click', toggleDemo);
    $('btn-metro').addEventListener('click', toggleMetro);
    $('veil').addEventListener('click', reveal);
    $('rate').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-rate]');
      if (!b) return;
      var r = +b.getAttribute('data-rate');
      record(cur.card.id, r);
      savePractice();
      toast('记下了：' + RATE_ZH[r]);
      showCard(nextCard(), settings.autoSpeak);
      bringCardIntoView();
    });
    $('btn-skip').addEventListener('click', function () {
      showCard(nextCard(), settings.autoSpeak);
      bringCardIntoView();
    });
    $('minor-form').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-form]');
      if (!b) return;
      settings.minorForm = b.getAttribute('data-form');
      saveSettings();
      Sound.stop();
      setPressed($('minor-form'), 'data-form', settings.minorForm);
      renderKeys();
    });
  }

  // ---------- Mock exam ----------

  var exam = { items: [], index: 0, ratings: [], saved: [], started: 0, timer: null, revealed: false };

  function startExam() {
    stopAllSound();
    Sound.unlock();
    var st = settings;
    exam.items = S.buildExam({ size: S.TYPES.length + st.examExtra, order: st.examOrder, weight: weight }).map(function (card) {
      return { card: card, seed: Math.floor(Math.random() * 1000) };
    });
    exam.index = 0;
    exam.ratings = exam.items.map(function () { return -1; });
    exam.started = Date.now();
    clearInterval(exam.timer);
    exam.timer = setInterval(tickClock, 1000);
    tickClock();
    $('exam-setup').hidden = true;
    $('exam-done').hidden = true;
    $('exam-run').hidden = false;
    $('exam-total').textContent = exam.items.length;
    KB.render($('exam-keys'), { low: 60, high: 76, marks: [], ariaLabel: '' });
    showExamItem(true);
  }

  function tickClock() {
    var s = Math.floor((Date.now() - exam.started) / 1000);
    $('exam-clock').textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function showExamItem(speak) {
    var item = exam.items[exam.index];
    exam.revealed = !settings.examBlind;
    fillFallboard('exam', item.card, item.seed);
    $('exam-veil').hidden = exam.revealed;
    $('exam-index').textContent = exam.index + 1;
    $('exam-bar').style.width = Math.round((exam.index / exam.items.length) * 100) + '%';
    $('exam-next-label').textContent = exam.index === exam.items.length - 1 ? '结束' : '下一项';
    if (speak) say(item.card, item.seed);
  }

  function nextExamItem() {
    if (exam.index < exam.items.length - 1) {
      exam.index++;
      showExamItem(true);
    } else {
      finishExam();
    }
  }

  function finishExam() {
    stopAllSound();
    clearInterval(exam.timer);
    $('exam-bar').style.width = '100%';
    $('exam-run').hidden = true;
    $('exam-done').hidden = false;
    var secs = Math.floor((Date.now() - exam.started) / 1000);
    $('exam-done-meta').textContent = '共 ' + exam.items.length + ' 项，用时 ' + Math.floor(secs / 60) + ' 分 ' + (secs % 60) + ' 秒。给每一项选一个评价，然后保存。可以点 ▶ 听示范对照。';
    var html = '';
    exam.items.forEach(function (item, i) {
      var c = item.card;
      var name = S.detailZh(c);
      html +=
        '<li class="summary-item" data-i="' + i + '">' +
        '<div class="summary-head">' +
        '<span class="item-name"><span lang="en">' + escapeHtml(S.TYPE_BY_ID[c.type].eyebrow) + ' · ' + S.titleHtml(c) + '</span>' +
        '<span class="item-sub">' + escapeHtml(S.detailZh(c)) + '</span></span>' +
        '<button class="mini-btn" type="button" data-play="' + i + '" data-on="false" aria-pressed="false" data-name="' + escapeHtml(name) + '" aria-label="听示范：' + escapeHtml(name) + '">' +
        '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>' +
        '<svg class="i-stop" viewBox="0 0 24 24" aria-hidden="true" hidden><rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor"/></svg></button>' +
        '</div>' +
        '<div class="seg" role="group" aria-label="自评：' + escapeHtml(name) + '">' +
        '<button type="button" data-rate="0" aria-pressed="false">没弹好</button>' +
        '<button type="button" data-rate="1" aria-pressed="false">还可以</button>' +
        '<button type="button" data-rate="2" aria-pressed="false">很熟练</button>' +
        '</div></li>';
    });
    $('exam-summary').innerHTML = html;
    exam.saved = exam.items.map(function () { return -1; });
    $('exam-save').disabled = false;
    $('exam-save').textContent = '保存自评';
  }

  function setSummaryPlaying(btn, on) {
    btn.setAttribute('data-on', String(on));
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', (on ? '停止示范：' : '听示范：') + btn.getAttribute('data-name'));
    showEl(btn.querySelector('.i-play'), !on);
    showEl(btn.querySelector('.i-stop'), on);
  }

  function quitExam() {
    stopAllSound();
    clearInterval(exam.timer);
    $('exam-run').hidden = true;
    $('exam-done').hidden = true;
    $('exam-setup').hidden = false;
  }

  function syncExamSetup() {
    var st = settings;
    setPressed($('exam-size'), 'data-extra', st.examExtra);
    setPressed($('exam-order'), 'data-order', st.examOrder);
    $('exam-blind').checked = !!st.examBlind;
  }

  function bindExam() {
    $('exam-size').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-extra]');
      if (!b) return;
      settings.examExtra = +b.getAttribute('data-extra');
      saveSettings();
      syncExamSetup();
    });
    $('exam-order').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-order]');
      if (!b) return;
      settings.examOrder = b.getAttribute('data-order');
      saveSettings();
      syncExamSetup();
    });
    $('exam-blind').addEventListener('change', function () {
      settings.examBlind = this.checked;
      saveSettings();
    });
    $('exam-start').addEventListener('click', startExam);
    $('exam-say').addEventListener('click', function () {
      Sound.unlock();
      var item = exam.items[exam.index];
      say(item.card, item.seed);
    });
    $('exam-veil').addEventListener('click', function () {
      exam.revealed = true;
      $('exam-veil').hidden = true;
    });
    $('exam-next').addEventListener('click', nextExamItem);
    $('exam-quit').addEventListener('click', quitExam);
    $('exam-summary').addEventListener('click', function (e) {
      var play = e.target.closest('button[data-play]');
      if (play) {
        var wasOn = play.getAttribute('data-on') === 'true';
        Sound.stop();
        if (!wasOn) {
          Sound.unlock();
          var item = exam.items[+play.getAttribute('data-play')];
          if (playDemo(item.card, null, function () { setSummaryPlaying(play, false); })) setSummaryPlaying(play, true);
        }
        return;
      }
      var b = e.target.closest('button[data-rate]');
      if (!b) return;
      var li = b.closest('li[data-i]');
      var i = +li.getAttribute('data-i');
      exam.ratings[i] = +b.getAttribute('data-rate');
      setPressed(li, 'data-rate', exam.ratings[i]);
      // A change after saving can be saved again.
      if ($('exam-save').disabled && exam.ratings[i] !== exam.saved[i]) {
        $('exam-save').disabled = false;
        $('exam-save').textContent = '保存修改';
      }
    });
    $('exam-save').addEventListener('click', function () {
      var n = 0;
      exam.items.forEach(function (item, i) {
        if (exam.ratings[i] >= 0 && exam.ratings[i] !== exam.saved[i]) {
          record(item.card.id, exam.ratings[i]);
          exam.saved[i] = exam.ratings[i];
          n++;
        }
      });
      if (!n) {
        var any = exam.ratings.some(function (r) { return r >= 0; });
        toast(any ? '没有新的修改' : '先给至少一项选一个评价');
        return;
      }
      savePractice();
      renderStats();
      renderScope();
      this.disabled = true;
      this.textContent = '已保存 ' + n + ' 项';
      toast('已保存 ' + n + ' 项自评');
    });
    $('exam-again').addEventListener('click', startExam);
  }

  // ---------- Scope view ----------

  function pillHtml(r) {
    var label = r === -1 ? '未练' : RATE_ZH[r];
    return '<span class="pill" data-state="' + r + '">' + label + '</span>';
  }

  function renderScope() {
    var all = S.CARDS.length;
    var good = S.CARDS.filter(function (c) { return stateOf(c.id) === 2; }).length;
    var tried = S.CARDS.filter(function (c) { return stateOf(c.id) !== -1; }).length;
    $('scope-summary').innerHTML =
      '<h2>' + GRADE_NAMES[settings.grade] + '音阶与琶音，共 ' + all + ' 项</h2>' +
      '<div class="progress" aria-hidden="true"><span style="width:' + Math.round((good / all) * 100) + '%"></span></div>' +
      '<p class="note">很熟练 ' + good + ' 项，练过 ' + tried + ' 项。点选题目即可练习。</p>' +
      '<p class="note">分手项目按左手和右手分别计数。' +
      (settings.grade === 5 ? '' : '考官可指定的小调形式和奏法也分别计数。') + '</p>';

    var html = '';
    S.TYPES.forEach(function (t) {
      var cards = S.CARDS.filter(function (c) { return c.type === t.id; });
      var good = cards.filter(function (c) { return stateOf(c.id) === 2; }).length;
      html += '<section class="panel">' +
        '<div class="cat-head"><h3><span lang="en">' + escapeHtml(t.enLong) + '</span><span class="zh">' + t.zh + '</span></h3>' +
        '<span class="count">' + good + ' / ' + cards.length + '</span></div>' +
        '<dl class="meta-grid">' +
        '<dt>音域</dt><dd>' + t.octaves + ' 个八度</dd>' +
        '<dt>要求</dt><dd><span lang="en">' + escapeHtml(t.requirement) + '</span><br>' + escapeHtml(t.requirementZh) + '</dd>' +
        '<dt>参考速度</dt><dd>二分音符 ＝ ' + S.SPEED[t.speed].minim + '</dd>' +
        '</dl><ul class="items">';
      cards.forEach(function (c) {
        var sub = S.detailZh(c);
        html += '<li class="item"><button class="item-open" type="button" data-card="' + c.id + '">' +
          '<span class="item-name"><span lang="en">' + S.titleHtml(c) + '</span><span class="item-sub">' + escapeHtml(sub) + '</span></span></button>' +
          pillHtml(stateOf(c.id)) + '</li>';
      });
      html += '</ul></section>';
    });
    $('scope-list').innerHTML = html;
  }

  function renderScopeStatic() {
    var grade = settings.grade;
    var page = { 5: 35, 7: 41, 8: 44 }[grade];
    var inversion = { 5: '原位', 7: '第一转位', 8: '第二转位' }[grade];
    var minorRule = grade === 5
      ? '同向音阶和断奏音阶的小调形式由考生自选。反向的升c小调须弹和声小调。'
      : '同向小调音阶要准备和声与旋律两种形式，由考官指定。反向音阶和双手相隔音程的小调音阶均用和声小调。';
    $('scope-rules').innerHTML =
      '<h2>考试规则</h2><ul>' +
      '<li>全部背谱，音符均匀，不用踏板。指法可以自选。</li>' +
      '<li>可以从任一合适的八度开始，按规定音域往返。双手通常相隔一个八度，另有起音或音程要求的题目以卡片为准。</li>' +
      '<li>' + minorRule + '</li>' +
      '<li>本级大小调琶音均用' + inversion + '。' +
      (grade === 5 ? '' : '属七和弦琶音在结尾解决到主音。') + '</li>' +
      '<li>考官通常每类至少问一项，同类先大调后小调。分手项目会指定左手或右手。' +
      (grade === 5 ? '' : '连奏和断奏都要求准备的项目，考官会指定奏法。') + '</li></ul>';
    $('scope-marking').innerHTML =
      '<h2>评分标准</h2>' +
      '<p class="note">音阶与琶音满分 21 分，占总分 150 分的 14%。总成绩 100 分及格，120 分良好，130 分优秀，单项不要求都及格。考官从音准、节奏、音色、乐句和整体表现几方面综合给分。</p>' +
      '<dl class="meta-grid">' +
      '<dt>优秀 19 到 21</dt><dd>音高非常准确，流畅有节奏，有音乐表现，从容自信</dd>' +
      '<dt>良好 17 到 18</dt><dd>音高大体准确，大致流畅，音色大致均匀，稳妥</dd>' +
      '<dt>及格 14 到 16</dt><dd>虽有错误但大体正确，基本保持连贯，音色大体可靠，比较谨慎</dd>' +
      '<dt>不及格 11 到 13</dt><dd>错音较多，不连贯或有项目没弹完，音色不稳，犹豫</dd>' +
      '</dl>' +
      '<p class="note">摘自大纲的分数分配和评分标准（第 57 和 60 页）。</p>';
    var speedNames = {
      scale: '音阶',
      arpeggio: '琶音与七和弦',
      apart: grade === 7 ? '双手相隔三度的音阶' : '双手相隔六度的音阶',
      legatoThirds: '单手双音三度连奏',
      staccatoDoubles: grade === 7 ? '单手双音三度断奏' : '单手双音六度断奏'
    };
    $('scope-speed').innerHTML =
      '<h2>速度参考</h2><dl class="meta-grid">' +
      Object.keys(S.SPEED).map(function (group) {
        return '<dt>' + speedNames[group] + '</dt><dd>二分音符 ＝ ' + S.SPEED[group].minim + '</dd>';
      }).join('') + '</dl>' +
      '<p class="note">每拍四个八分音符。示范和节拍器默认使用大纲参考速度，可以在设置里放慢。</p>';
    $('scope-source').innerHTML =
      '<h2>来源与说明</h2>' +
      '<p class="note">两版 ABRSM 钢琴现场考试大纲的' + GRADE_NAMES[grade] + '音阶与琶音要求相同，见印刷页第 ' + page + ' 页。演奏规则和参考速度见 2025 与 2026 年版第 13 至 14 页，或 2027 与 2028 年版第 12 至 14 页。</p>' +
      '<p class="note"><a href="https://www.abrsm.org/sites/default/files/2024-06/Piano%202025%20%26%202026%20Prac%20syllabus%2020240524_access.pdf#page=' + (page + 1) + '" target="_blank" rel="noopener">2025 与 2026 年官方大纲</a>　' +
      '<a href="https://www.abrsm.org/sites/default/files/2026-06/Piano%20Practical%20Grades%20Qualification%20Specification%202027%20%26%202028.pdf#page=' + (page + 1) + '" target="_blank" rel="noopener">2027 与 2028 年官方大纲</a></p>';
  }

  function bindScope() {
    $('scope-list').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-card]');
      if (!b) return;
      var card = S.CARD_BY_ID[b.getAttribute('data-card')];
      if (practice.types.indexOf(card.type) === -1) {
        practice.types = S.TYPES.map(function (t) { return t.id; });
        savePractice();
        syncTypeChips();
      }
      switchView('draw');
      showCard(card, settings.autoSpeak);
      window.scrollTo(0, 0);
    });
  }

  // ---------- Settings ----------

  function fillVoices() {
    var sel = $('set-voice');
    var st = settings;
    var want = st.lang === 'zh' ? 'zh' : 'en';
    var list = Voice.voices(want);
    var current = want === 'zh' ? st.voiceZh : st.voiceEn;
    var html = '<option value="">自动选择' + (want === 'en' ? '（优先英式英语）' : '') + '</option>';
    list.forEach(function (v) {
      html += '<option value="' + escapeHtml(v.voiceURI) + '">' + escapeHtml(v.name + ' (' + v.lang + ')') + '</option>';
    });
    sel.innerHTML = html;
    sel.value = list.some(function (v) { return v.voiceURI === current; }) ? current : '';
    $('voice-hint').textContent = !Voice.supported
      ? '这个浏览器不支持语音朗读。'
      : list.length
        ? (want === 'en' ? '考官说英文，默认优先英式英语声音。' : '中文提示适合刚开始熟悉题目时用。')
        : '没有找到' + (want === 'en' ? '英文' : '中文') + '声音，会用系统默认声音。';
  }

  function syncSettings() {
    var st = settings;
    setPressed($('set-lang'), 'data-lang', st.lang);
    setPressed($('set-phrasing'), 'data-phrasing', st.phrasing);
    setPressed($('set-speed'), 'data-speed', st.speed);
    $('set-rate').value = st.rate;
    $('rate-value').textContent = st.rate.toFixed(2) + '×';
    $('set-autospeak').checked = !!st.autoSpeak;
    $('set-blind').checked = !!st.blind;
    $('set-shownotes').checked = !!st.showNotes;
    fillVoices();
  }

  var resetArmed = null;

  function bindSettings() {
    var dlg = $('settings');
    $('open-settings').addEventListener('click', function () {
      syncSettings();
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    });
    $('close-settings').addEventListener('click', function () {
      if (typeof dlg.close === 'function') dlg.close();
      else dlg.removeAttribute('open');
    });
    // Close on a tap on the backdrop, but not when a drag that started inside ends there.
    var downOnBackdrop = false;
    dlg.addEventListener('pointerdown', function (e) { downOnBackdrop = e.target === dlg; });
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg && downOnBackdrop && typeof dlg.close === 'function') dlg.close();
      downOnBackdrop = false;
    });
    dlg.addEventListener('close', function () {
      clearTimeout(resetArmed);
      resetArmed = null;
      $('reset-progress').textContent = '清空本级练习记录';
      stopAllSound();
      renderCard();
    });

    $('set-lang').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-lang]');
      if (!b) return;
      settings.lang = b.getAttribute('data-lang');
      saveSettings();
      syncSettings();
    });
    $('set-voice').addEventListener('change', function () {
      if (settings.lang === 'zh') settings.voiceZh = this.value;
      else settings.voiceEn = this.value;
      saveSettings();
      if (cur.card) say(cur.card, cur.seed);
    });
    $('set-rate').addEventListener('input', function () {
      settings.rate = +this.value;
      $('rate-value').textContent = settings.rate.toFixed(2) + '×';
      saveSettings();
    });
    $('set-rate').addEventListener('change', function () {
      if (cur.card) say(cur.card, cur.seed);
    });
    $('set-phrasing').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-phrasing]');
      if (!b) return;
      settings.phrasing = b.getAttribute('data-phrasing');
      saveSettings();
      syncSettings();
    });
    $('set-speed').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-speed]');
      if (!b) return;
      settings.speed = +b.getAttribute('data-speed');
      saveSettings();
      Sound.stop();
      Sound.stopMetronome();
      metroOwner = null;
      syncSettings();
    });
    $('set-autospeak').addEventListener('change', function () {
      settings.autoSpeak = this.checked;
      saveSettings();
    });
    $('set-blind').addEventListener('change', function () {
      settings.blind = this.checked;
      saveSettings();
    });
    $('set-shownotes').addEventListener('change', function () {
      settings.showNotes = this.checked;
      saveSettings();
      if (this.checked) cur.notesShown = true;
    });
    $('reset-progress').addEventListener('click', function () {
      var b = this;
      if (!resetArmed) {
        b.textContent = '确定要清空吗？再点一次';
        resetArmed = setTimeout(function () {
          resetArmed = null;
          b.textContent = '清空本级练习记录';
        }, 4000);
        return;
      }
      clearTimeout(resetArmed);
      resetArmed = null;
      practice.stats = {};
      practice.log = [];
      practice.recent = [];
      savePractice();
      b.textContent = '清空本级练习记录';
      renderStats();
      renderScope();
      toast(GRADE_NAMES[settings.grade] + '练习记录已清空');
    });
    Voice.onVoicesChanged(function () {
      if (dlg.open) fillVoices();
    });
  }

  // ---------- Tabs ----------

  var VIEWS = ['draw', 'exam', 'scope'];

  function switchView(name) {
    if (VIEWS.indexOf(name) === -1) name = 'draw';
    stopAllSound();
    if (name !== 'draw') setDemoButton(false);
    VIEWS.forEach(function (v) {
      $('view-' + v).hidden = v !== name;
      $('tab-' + v).setAttribute('aria-selected', String(v === name));
      $('tab-' + v).tabIndex = v === name ? 0 : -1;
    });
    if (name === 'scope') renderScope();
    if (name === 'exam' && $('exam-run').hidden && $('exam-done').hidden) syncExamSetup();
  }

  function bindTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        switchView(t.getAttribute('data-view'));
        window.scrollTo(0, 0);
      });
      // Arrow keys move between tabs, as screen reader users expect from a tab list.
      t.addEventListener('keydown', function (e) {
        var j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (j === undefined) return;
        e.preventDefault();
        var next = tabs[(j + tabs.length) % tabs.length];
        next.focus();
        switchView(next.getAttribute('data-view'));
      });
    });
  }

  // ---------- Start ----------

  function registerServiceWorker() {
    // Only for the GitHub Pages copy, which links a manifest. The artifact preview has none.
    if (!('serviceWorker' in navigator) || !document.querySelector('link[rel="manifest"]')) return;
    if (!/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline mode is optional */ });
  }

  // Sound and speech stop when the phone locks or another app comes to the front, and the
  // buttons go back to play, so the first tap after returning plays instead of stopping.
  function bindLifecycle() {
    // The audio module stops a metronome by itself after an interruption, so the button follows.
    Sound.onReset(function () {
      if (!Sound.metronomeOn()) metroOwner = null;
      syncMetroButton();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') stopAllSound();
    });
    window.addEventListener('pagehide', stopAllSound);
  }

  function renderGrade() {
    $('grade-select').value = String(settings.grade);
    renderTypeChips();
    $('type-chips').scrollLeft = 0;
    $('exam-size').innerHTML = [0, 4, 8].map(function (extra) {
      return '<button type="button" data-extra="' + extra + '">' + (S.TYPES.length + extra) + ' 项</button>';
    }).join('');
    renderScopeStatic();
    renderScope();
    syncExamSetup();
    showCard(nextCard(), false);
  }

  function changeGrade() {
    var grade = Number(this.value);
    if (grade === settings.grade) return;
    var inExam = !$('exam-run').hidden;
    var unsaved = !$('exam-done').hidden && exam.ratings.some(function (r, i) { return r !== exam.saved[i]; });
    if ((inExam || unsaved) && !window.confirm(inExam ? '切换级别会结束本次模拟考试，确定切换吗？' : '本次考试还有未保存的自评，确定切换级别吗？')) {
      this.value = String(settings.grade);
      return;
    }
    quitExam();
    cur.card = null;
    settings.grade = grade;
    S = window.Syllabus.forGrade(grade);
    practice = loadPractice();
    saveSettings();
    renderGrade();
    window.scrollTo(0, 0);
  }

  function start() {
    $('grade-select').addEventListener('change', changeGrade);
    bindDraw();
    bindExam();
    bindScope();
    bindSettings();
    bindTabs();
    bindLifecycle();
    renderGrade();
    var hash = (location.hash || '').replace('#', '');
    switchView(VIEWS.indexOf(hash) !== -1 ? hash : 'draw');
    registerServiceWorker();
  }

  start();
})();
