/*
 * Draws a short keyboard (tonic up to the tonic an octave higher) as SVG,
 * marks the notes of the scale or arpeggio, and lights keys during playback.
 */
(function (root) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
  var W = 40;
  var H = 104;
  var BW = 25;
  var BH = 64;

  function isWhite(pc) {
    return WHITE_PCS.indexOf(((pc % 12) + 12) % 12) !== -1;
  }

  var count = 0;

  function el(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /*
   * spec.low and spec.high are the MIDI range that matters. The drawing widens it to whole
   * white keys, but only keys inside the range light up during playback.
   * spec.marks: [{ midi, label, kind }] where kind is 'tonic', 'up', 'down-only' or 'plain'.
   */
  function render(container, spec) {
    var low = spec.low;
    var high = spec.high;
    while (!isWhite(low)) low--;
    while (!isWhite(high)) high++;

    var whites = [];
    var blacks = [];
    for (var m = low; m <= high; m++) (isWhite(m) ? whites : blacks).push(m);
    var x = {};
    whites.forEach(function (midi, i) { x[midi] = i * W; });
    blacks.forEach(function (midi) { x[midi] = x[midi - 1] + W - BW / 2; });

    var width = whites.length * W;
    var svg = el('svg', {
      viewBox: '-1 0 ' + (width + 2) + ' ' + (H + 2),
      role: 'img',
      'aria-label': spec.ariaLabel || 'keyboard'
    });
    // Each keyboard gets its own gradient id, so a hidden copy elsewhere on the page never hides it.
    var gid = 'both-hands-' + (++count);
    var defs = el('defs', {});
    var grad = el('linearGradient', { id: gid, x1: '0', x2: '1', y1: '0', y2: '0' });
    // Presentation attributes cannot read CSS variables, so the colours go in style.
    grad.appendChild(el('stop', { offset: '50%', style: 'stop-color: var(--gold)' }));
    grad.appendChild(el('stop', { offset: '50%', style: 'stop-color: var(--lh)' }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    var keyEls = {};
    whites.forEach(function (midi) {
      var r = el('rect', { x: x[midi], y: 0, width: W, height: H, rx: 4, class: 'k-white', 'data-midi': midi });
      svg.appendChild(r);
      keyEls[midi] = r;
    });
    blacks.forEach(function (midi) {
      var r = el('rect', { x: x[midi], y: 0, width: BW, height: BH, rx: 3, class: 'k-black', 'data-midi': midi });
      svg.appendChild(r);
      keyEls[midi] = r;
    });

    (spec.marks || []).forEach(function (mk) {
      if (x[mk.midi] === undefined) return;
      var white = isWhite(mk.midi);
      var cx = x[mk.midi] + (white ? W : BW) / 2;
      var cy = white ? H - 20 : BH - 15;
      var r = white ? 14.5 : 11.5;
      var cls = 'k-dot' + (mk.kind === 'tonic' ? ' tonic' : mk.kind === 'down-only' ? ' down-only' : '');
      svg.appendChild(el('circle', { cx: cx, cy: cy, r: r, class: cls }));
      if (mk.label) {
        var t = el('text', { x: cx, y: cy + 0.5, class: 'k-label' + (white ? '' : ' on-black') + (mk.kind === 'tonic' ? ' tonic' : mk.kind === 'down-only' ? ' down-only' : '') });
        t.textContent = mk.label;
        svg.appendChild(t);
      }
    });

    container.textContent = '';
    container.appendChild(svg);
    return {
      // Lights the keys in range with the given pitch classes (right hand gold, left hand blue).
      light: function (rhPcs, lhPcs) {
        Object.keys(keyEls).forEach(function (k) {
          var midi = +k;
          var pc = ((midi % 12) + 12) % 12;
          var node = keyEls[k];
          var inRange = midi >= spec.low && midi <= spec.high;
          var rh = inRange && rhPcs.indexOf(pc) !== -1;
          var lh = inRange && lhPcs.indexOf(pc) !== -1;
          node.classList.toggle('on-rh', rh);
          node.classList.toggle('on-lh', lh);
          node.style.fill = rh && lh ? 'url(#' + gid + ')' : '';
        });
      },
      clear: function () {
        Object.keys(keyEls).forEach(function (k) {
          keyEls[k].classList.remove('on-rh', 'on-lh');
          keyEls[k].style.fill = '';
        });
      }
    };
  }

  root.Keyboard = { render: render, isWhite: isWhite };
})(typeof self !== 'undefined' ? self : this);
