/*
 * Examiner voice through the browser's built in speech synthesis.
 * Prefers a British English voice, since ABRSM examiners give instructions in English.
 */
(function (root) {
  'use strict';

  var synth = root.speechSynthesis || null;
  var all = [];
  var listeners = [];

  // Novelty voices on Apple devices that would sound silly as an examiner.
  var NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|rocko|shelley|eddy|flo|reed|sandy|deranged|hysterical/i;

  function lang(v) {
    return String(v.lang || '').replace('_', '-').toLowerCase();
  }

  function refresh() {
    if (!synth) return;
    all = synth.getVoices() || [];
    listeners.forEach(function (fn) { fn(); });
  }

  if (synth) {
    refresh();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', refresh);
    else synth.onvoiceschanged = refresh;
  }

  function score(v, want) {
    var l = lang(v);
    var s = 0;
    if (want === 'en') {
      if (l === 'en-gb') s += 100;
      else if (l.indexOf('en') === 0) s += 60;
      else return -1;
    } else {
      if (l === 'zh-cn' || l === 'zh-hans-cn') s += 100;
      else if (l.indexOf('zh') === 0 || l.indexOf('cmn') === 0) s += 60;
      else return -1;
    }
    // Voices on the device come first, so the prompts keep working offline.
    if (v.localService) s += 15;
    if (/premium|enhanced|natural|neural/i.test(v.name)) s += 8;
    if (/daniel|serena|kate|arthur|martha|oliver|sonia|ryan|libby|google uk english|tingting|ting-ting|xiaoxiao|yunxi|huihui/i.test(v.name)) s += 4;
    if (NOVELTY.test(v.name)) s -= 90;
    return s;
  }

  function voices(want) {
    return all
      .map(function (v) { return { v: v, s: score(v, want) }; })
      .filter(function (x) { return x.s >= 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .map(function (x) { return x.v; });
  }

  function pick(want, uri) {
    var list = voices(want);
    if (uri) {
      for (var i = 0; i < list.length; i++) if (list[i].voiceURI === uri) return list[i];
    }
    return list[0] || null;
  }

  var token = 0;
  var lastCancel = 0;
  var ANDROID = /Android/i.test((root.navigator && root.navigator.userAgent) || '');

  /*
   * Speaks `text`. opts.lang is 'en' or 'zh', opts.voiceURI picks a voice, opts.rate sets speed.
   * Resolves true when finished, false when it could not speak or was interrupted.
   */
  function speak(text, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      if (!synth || typeof root.SpeechSynthesisUtterance !== 'function') return resolve(false);
      var mine = ++token;
      var busy = synth.speaking || synth.pending;
      if (busy) {
        synth.cancel();
        lastCancel = Date.now();
      }
      var u = new root.SpeechSynthesisUtterance(text);
      var want = opts.lang === 'zh' ? 'zh' : 'en';
      var v = pick(want, opts.voiceURI);
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else {
        u.lang = want === 'zh' ? 'zh-CN' : 'en-GB';
      }
      u.rate = opts.rate || 0.95;
      u.pitch = 1;
      var finished = false;
      var safety = null;
      function done(ok) {
        if (finished) return;
        finished = true;
        clearTimeout(safety);
        resolve(ok && mine === token);
      }
      u.onend = function () { done(true); };
      u.onerror = function () { done(false); };
      function go() {
        if (mine !== token) return done(false);
        synth.speak(u);
        // Some desktop Chrome builds start paused after cancel().
        if (synth.paused) synth.resume();
      }
      // Chrome on Android can drop an utterance queued straight after cancel(), so wait a moment
      // there. Everywhere else speak at once, inside the tap, which iOS needs for the first one.
      if (ANDROID && Date.now() - lastCancel < 150) setTimeout(go, 120);
      else go();
      // Give up if the browser never reports the end, so callers are never left waiting.
      safety = setTimeout(function () { done(false); }, 4000 + text.length * 120);
    });
  }

  function cancel() {
    token++;
    if (synth) {
      synth.cancel();
      lastCancel = Date.now();
    }
  }

  root.ExamVoice = {
    supported: !!synth,
    speak: speak,
    cancel: cancel,
    voices: voices,
    pick: pick,
    onVoicesChanged: function (fn) { listeners.push(fn); }
  };
})(typeof self !== 'undefined' ? self : this);
