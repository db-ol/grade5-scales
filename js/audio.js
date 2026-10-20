/*
 * A small Web Audio piano voice and a scheduler for the demo playback.
 * No samples are downloaded, so it also works offline.
 */
(function (root) {
  'use strict';

  var ctx = null;
  var master = null;
  var wave = null;

  function context() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try {
        // Lets iPhone play the demo even when the ring switch is on silent (Safari 17+).
        if (root.navigator && root.navigator.audioSession) root.navigator.audioSession.type = 'playback';
      } catch (e) { /* not supported */ }
      ctx = new AC();
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(comp);
      comp.connect(ctx.destination);
      // Harmonics that fall away quickly give a soft, piano like tone.
      var n = 16;
      var real = new Float32Array(n);
      var imag = new Float32Array(n);
      var amps = [0, 1, 0.42, 0.24, 0.16, 0.09, 0.06, 0.04, 0.025, 0.018, 0.012, 0.008, 0.005, 0.003, 0.002, 0.001];
      for (var i = 1; i < n; i++) imag[i] = amps[i];
      wave = ctx.createPeriodicWave(real, imag);
    }
    // 'suspended' before the first tap, and WebKit's 'interrupted' after a phone call or Siri.
    if (ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume();
    return ctx;
  }

  // Call from a tap handler. iOS only starts audio inside a user gesture.
  function unlock() {
    var c = context();
    if (!c) return false;
    var buf = c.createBuffer(1, 1, 22050);
    var src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    return true;
  }

  function freq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // A gain stage of its own for one playback, so stopping can fade everything at once.
  function bus() {
    var g = ctx.createGain();
    g.gain.value = 1;
    g.connect(master);
    return g;
  }

  // Schedules one note into `out` and returns its oscillators so playback can be cut short.
  function note(out, midi, when, dur, opts) {
    var c = ctx;
    var f = freq(midi);
    var vel = (opts && opts.velocity) || 0.8;
    var staccato = opts && opts.staccato;
    // Higher notes are quieter and die away faster, like real strings.
    var level = vel * (0.32 - Math.min(0.14, Math.max(0, midi - 60) * 0.003));
    var decay = Math.max(0.35, 2.4 - (midi - 36) * 0.03);

    var g = c.createGain();
    var lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.4;
    var bright = Math.min(16000, f * 9);
    lp.frequency.setValueAtTime(bright, when);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 2.2, 400), when + 0.6);

    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(level, when + 0.006);
    g.gain.setTargetAtTime(level * 0.08, when + 0.01, decay / 3);
    var release = staccato ? 0.035 : 0.12;
    var off = when + dur;
    // setTargetAtTime starts from wherever the decay has got to, so the release is smooth.
    g.gain.setTargetAtTime(0.0001, off, release / 3);

    var o1 = c.createOscillator();
    o1.setPeriodicWave(wave);
    o1.frequency.value = f;
    var o2 = c.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2.001;
    var g2 = c.createGain();
    g2.gain.value = 0.18;

    o1.connect(lp);
    o2.connect(g2);
    g2.connect(lp);
    lp.connect(g);
    g.connect(out);

    var stopAt = off + release * 4 + 0.05;
    o1.start(when);
    o2.start(when);
    o1.stop(stopAt);
    o2.stop(stopAt);
    return [o1, o2];
  }

  // Fades a playback's bus out and stops its oscillators. Notes that have not started yet
  // get a stop time before their start time, so they never sound.
  function silence(out, oscs) {
    var now = ctx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(out.gain.value, now);
    out.gain.linearRampToValueAtTime(0, now + 0.04);
    oscs.forEach(function (o) {
      try { o.stop(now + 0.05); } catch (e) { /* already stopped */ }
    });
    setTimeout(function () {
      try { out.disconnect(); } catch (e) { /* already gone */ }
    }, 200);
  }

  var current = null;

  function stop() {
    if (!current) return;
    var p = current;
    current = null;
    p.timers.forEach(clearTimeout);
    silence(p.out, p.oscs);
    if (p.onEnd) p.onEnd(true);
  }

  /*
   * steps: array of time slots, each an array of { midi, hand } sounding together.
   * opts.stepDur is the length of one slot in seconds. The last slot is held longer.
   * opts.groupSize puts a light accent at the start of each group.
   * opts.onStep(i) runs in time with the sound, opts.onEnd(stopped) when it finishes.
   */
  function play(steps, opts) {
    stop();
    var c = context();
    if (!c) return false;
    var stepDur = opts.stepDur;
    var t0 = c.currentTime + 0.08;
    var out = bus();
    var oscs = [];
    var timers = [];
    var group = opts.groupSize || 4;

    steps.forEach(function (slot, i) {
      var when = t0 + i * stepDur;
      var last = i === steps.length - 1;
      var len = last ? Math.max(stepDur * 3, 0.9) : opts.staccato ? stepDur * 0.42 : stepDur * 1.04;
      var vel = i % group === 0 ? 0.86 : 0.76;
      slot.forEach(function (n) {
        oscs.push.apply(oscs, note(out, n.midi, when, len, { velocity: vel, staccato: opts.staccato && !last }));
      });
      if (opts.onStep) {
        timers.push(setTimeout(function () { opts.onStep(i); }, Math.max(0, (when - c.currentTime) * 1000)));
      }
    });

    var end = t0 + (steps.length - 1) * stepDur + Math.max(stepDur * 3, 0.9);
    var mine = { out: out, oscs: oscs, timers: timers, onEnd: opts.onEnd };
    current = mine;
    timers.push(setTimeout(function () {
      if (current !== mine) return;
      current = null;
      try { out.disconnect(); } catch (e) { /* already gone */ }
      if (opts.onEnd) opts.onEnd(false);
    }, (end - c.currentTime) * 1000 + 300));
    return true;
  }

  function click(out, when, accent) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = accent ? 1760 : 1320;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(accent ? 0.18 : 0.1, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    o.connect(g);
    g.connect(out);
    o.start(when);
    o.stop(when + 0.06);
    return o;
  }

  // A metronome that ticks until stopped. beatsPerBar sets which beats are accented.
  var metro = null;

  function metronome(bpm, beatsPerBar) {
    stopMetronome();
    var c = context();
    if (!c) return false;
    var period = 60 / bpm;
    var next = c.currentTime + 0.1;
    var beat = 0;
    var m = { timer: null, out: bus(), oscs: [] };
    metro = m;
    (function schedule() {
      if (metro !== m) return;
      while (next < c.currentTime + 0.25) {
        m.oscs.push(click(m.out, next, beat % (beatsPerBar || 4) === 0));
        next += period;
        beat++;
      }
      m.oscs = m.oscs.slice(-8);
      m.timer = setTimeout(schedule, 60);
    })();
    return true;
  }

  function stopMetronome() {
    if (!metro) return;
    var m = metro;
    metro = null;
    clearTimeout(m.timer);
    // Clicks already queued inside the look-ahead are silenced too.
    silence(m.out, m.oscs);
  }

  function isPlaying() {
    return !!current;
  }

  root.PianoAudio = {
    unlock: unlock,
    play: play,
    stop: stop,
    isPlaying: isPlaying,
    metronome: metronome,
    stopMetronome: stopMetronome,
    metronomeOn: function () { return !!metro; }
  };
})(typeof self !== 'undefined' ? self : this);
