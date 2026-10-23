/*
 * A small Web Audio piano voice and a scheduler for the demo playback.
 * No samples are downloaded, so it also works offline.
 */
(function (root) {
  'use strict';

  var ctx = null;
  var master = null;
  var wave = null;
  // Set when the page was hidden or the audio was interrupted. iOS can bring a context back stuck
  // or silent, so the next tap builds a new one. 'slow' means it did not start in time but may yet.
  var stale = false;
  // Wall clock and context clock at the last tap, to spot a context that says 'running' but has stopped.
  var lastWall = 0;
  var lastCt = 0;
  var lastRunning = false;
  // Runs when sound stops without a tap (interruption or rebuild), so the page can reset its buttons.
  var resetHandlers = [];

  function noop() {}

  function settle(p) {
    if (p && p.catch) p.catch(noop);
  }

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
      watch(ctx);
    }
    // 'suspended' before the first tap, and WebKit's 'interrupted' after a phone call or Siri.
    if (ctx.state !== 'running' && ctx.state !== 'closed') settle(ctx.resume());
    return ctx;
  }

  // After the screen locks or Safari goes to the background, iOS can leave the context stuck in
  // 'interrupted', with a resume() that never settles, or 'running' with a clock that no longer moves.
  function broken() {
    // A context that only started late is fine. Anything else still gets checked below.
    if (stale === 'slow' && ctx.state === 'running') stale = false;
    if (stale || ctx.state === 'interrupted' || ctx.state === 'closed') return true;
    if (ctx.state !== 'running' || !lastRunning) return false;
    var wall = Date.now() - lastWall;
    return wall > 400 && (ctx.currentTime - lastCt) * 1000 < wall * 0.5;
  }

  // Drops the old context so context() builds a new one. Only call from a tap, where iOS lets it start.
  function rebuild() {
    halt();
    var old = ctx;
    ctx = master = wave = null;
    try { settle(old.close()); } catch (e) { /* already closed */ }
  }

  // Call from a tap handler. iOS only starts audio inside a user gesture.
  function unlock() {
    if (ctx && broken()) rebuild();
    var c = context();
    if (!c) return false;
    var buf = c.createBuffer(1, 1, 22050);
    var src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    stale = false;
    mark(c);
    return true;
  }

  function mark(c) {
    lastWall = Date.now();
    lastCt = c.currentTime;
    lastRunning = c.state === 'running';
  }

  // Stops the demo and metronome without a tap and tells the page.
  function halt() {
    var had = !!(current || metro);
    stop();
    stopMetronome();
    if (had) resetHandlers.forEach(function (fn) { fn(); });
  }

  // Siri, an alarm or a call banner can interrupt the audio while the page stays visible.
  // Our own suspend() on hide gives 'suspended', not 'interrupted', so this skips that case.
  function watch(c) {
    if (!c.addEventListener) return;
    c.addEventListener('statechange', function () {
      if (c !== ctx || c.state !== 'interrupted') return;
      stale = true;
      halt();
    });
  }

  // Runs ok() once the context's clock is running, or fail() if it does not start in time.
  // Notes scheduled on a stopped clock would never sound while the screen still showed them playing.
  function whenRunning(c, ok, fail) {
    if (c.state === 'running') return ok();
    var done = false;
    var timer = null;
    function finish(good) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (c.removeEventListener) c.removeEventListener('statechange', check);
      if (good) {
        // The clock check in broken() needs a starting point from a running context.
        if (c === ctx) mark(c);
        ok();
      } else fail();
    }
    function check() {
      if (c.state === 'running') finish(true);
    }
    if (c.addEventListener) c.addEventListener('statechange', check);
    try {
      var p = c.resume();
      if (p && p.then) p.then(check, noop);
    } catch (e) { /* closed */ }
    timer = setTimeout(function () {
      // The next tap starts over with a new context, unless this one has started by then.
      if (c === ctx && !stale) stale = 'slow';
      finish(false);
    }, 2000);
  }

  // Everything stops when the page is hidden, so nothing plays late on return and the first tap plays.
  function onHide() {
    halt();
    if (!ctx) return;
    stale = true;
    if (ctx.state !== 'closed') {
      try { settle(ctx.suspend()); } catch (e) { /* not supported */ }
    }
  }

  if (root.document && root.addEventListener) {
    root.document.addEventListener('visibilitychange', function () {
      if (root.document.visibilityState === 'hidden') onHide();
    });
    root.addEventListener('pagehide', onHide);
    root.addEventListener('pageshow', function (e) {
      if (e.persisted && ctx) stale = true;
    });
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
   * opts.onStep(i) runs in time with the sound, opts.onEnd(stopped, reason) when it finishes.
   * reason is 'nosound' when the audio could not start.
   */
  function play(steps, opts) {
    stop();
    var c = context();
    if (!c) return false;
    var mine = { out: bus(), oscs: [], timers: [], onEnd: opts.onEnd };
    current = mine;
    whenRunning(c, function () {
      if (current !== mine) return;
      schedule(c, mine, steps, opts);
    }, function () {
      if (current !== mine) return;
      current = null;
      try { mine.out.disconnect(); } catch (e) { /* already gone */ }
      if (opts.onEnd) opts.onEnd(true, 'nosound');
    });
    return true;
  }

  function schedule(c, mine, steps, opts) {
    var stepDur = opts.stepDur;
    var t0 = c.currentTime + 0.08;
    var out = mine.out;
    var oscs = mine.oscs;
    var timers = mine.timers;
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
    timers.push(setTimeout(function () {
      if (current !== mine) return;
      current = null;
      try { out.disconnect(); } catch (e) { /* already gone */ }
      if (opts.onEnd) opts.onEnd(false);
    }, (end - c.currentTime) * 1000 + 300));
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
  // onFail runs if the audio could not start.
  var metro = null;

  function metronome(bpm, beatsPerBar, onFail) {
    stopMetronome();
    var c = context();
    if (!c) return false;
    var period = 60 / bpm;
    var m = { timer: null, out: bus(), oscs: [] };
    metro = m;
    whenRunning(c, function () {
      if (metro !== m) return;
      var next = c.currentTime + 0.1;
      var beat = 0;
      (function tick() {
        if (metro !== m) return;
        while (next < c.currentTime + 0.25) {
          m.oscs.push(click(m.out, next, beat % (beatsPerBar || 4) === 0));
          next += period;
          beat++;
        }
        m.oscs = m.oscs.slice(-8);
        m.timer = setTimeout(tick, 60);
      })();
    }, function () {
      if (metro !== m) return;
      metro = null;
      try { m.out.disconnect(); } catch (e) { /* already gone */ }
      if (onFail) onFail();
    });
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
    metronomeOn: function () { return !!metro; },
    onReset: function (fn) { resetHandlers.push(fn); }
  };
})(typeof self !== 'undefined' ? self : this);
