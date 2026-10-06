/*
 * L'application : parcours des niveaux, lecteur de démo, voix, mode libre.
 */
(function () {
  'use strict';
  var CM = window.CubeModel;
  var LESSONS = window.CubeLessons.LESSONS;
  var NAMES = window.CubeLessons.MOVE_NAMES;

  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('cubemalin:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('cubemalin:' + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }
  };

  // ======================================================================
  // Icônes des gestes : une face 3×3 vue de devant, la rangée qui bouge en couleur, une flèche.
  // ======================================================================
  var SVGNS = 'http://www.w3.org/2000/svg';
  function moveIcon(token) {
    var p = CM.parseToken(token);
    var on = function (r, c) {
      switch (p.face) {
        case 'R': return c === 2;
        case 'L': return c === 0;
        case 'U': return r === 0;
        case 'D': return r === 2;
        case 'B': return r === 0;
        default: return true;
      }
    };
    var cells = '';
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 3; c++) {
        cells += '<rect class="cell' + (on(r, c) ? ' on' : '') + '" x="' + (6 + c * 12.4) + '" y="' + (6 + r * 12.4) + '" width="11" height="11" rx="2.6"/>';
      }
    }
    var ln = {
      R: [[36.5, 40], [36.5, 9]], L: [[11.5, 8], [11.5, 39]],
      U: [[40, 11.5], [9, 11.5]], D: [[8, 36.5], [39, 36.5]],
      B: [[40, 11.5], [9, 11.5]],
      y: [[40, 24], [9, 24]], x: [[24, 40], [24, 9]]
    }[p.face];
    var arrow = '';
    var tip, dir;
    if (ln) {
      var a = ln[0], b = ln[1];
      if (p.prime) { var t = a; a = b; b = t; }
      arrow = '<path class="arrow" d="M' + a[0] + ' ' + a[1] + 'L' + b[0] + ' ' + b[1] + '"/>';
      tip = b;
      dir = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
    } else {
      // F (ou z) : arc autour du centre, sens horloge (ou inverse).
      var R = 12.5, cx = 24, cy = 24;
      var s = -150 * Math.PI / 180, e = 120 * Math.PI / 180;
      var P = function (ang) { return [cx + R * Math.cos(ang), cy + R * Math.sin(ang)]; };
      var A = P(s), B = P(e);
      if (!p.prime) {
        arrow = '<path class="arrow" d="M' + A[0].toFixed(1) + ' ' + A[1].toFixed(1) + 'A' + R + ' ' + R + ' 0 1 1 ' + B[0].toFixed(1) + ' ' + B[1].toFixed(1) + '"/>';
        tip = B; dir = [-Math.sin(e), Math.cos(e)];
      } else {
        arrow = '<path class="arrow" d="M' + B[0].toFixed(1) + ' ' + B[1].toFixed(1) + 'A' + R + ' ' + R + ' 0 1 0 ' + A[0].toFixed(1) + ' ' + A[1].toFixed(1) + '"/>';
        tip = A; dir = [Math.sin(s), -Math.cos(s)];
      }
    }
    // Pointe de flèche.
    var L = Math.hypot(dir[0], dir[1]) || 1;
    var dx = dir[0] / L, dy = dir[1] / L;
    var hx = tip[0] + dx * 5, hy = tip[1] + dy * 5;
    var bx = tip[0] - dx * 3, by = tip[1] - dy * 3;
    var px = -dy * 6.5, py = dx * 6.5;
    var head = '<path class="head" d="M' + hx.toFixed(1) + ' ' + hy.toFixed(1) + 'L' + (bx + px).toFixed(1) + ' ' + (by + py).toFixed(1) + 'L' + (bx - px).toFixed(1) + ' ' + (by - py).toFixed(1) + 'Z"/>';
    var x2 = p.double ? '<circle class="x2bg" cx="40" cy="40" r="7.5"/><text class="x2" x="40" y="44.2" text-anchor="middle">2</text>' : '';
    return '<svg class="move-icon" viewBox="0 0 48 48" aria-hidden="true">' + cells + arrow + head + x2 + '</svg>';
  }

  function tileHTML(token, tag) {
    tag = tag || 'span';
    return '<' + tag + ' class="tile"' + (tag === 'button' ? ' type="button"' : '') + '>' + moveIcon(token) +
      '<span>' + NAMES[token] + '</span><small>' + token.replace("'", '’') + '</small></' + tag + '>';
  }

  // ======================================================================
  // Voix
  // ======================================================================
  var voice = {
    on: store.get('voice', true),
    ok: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
    pick: function () {
      if (!this.ok) return null;
      var vs = window.speechSynthesis.getVoices().filter(function (v) { return /^fr/i.test(v.lang); });
      var pref = vs.filter(function (v) { return /google|amélie|amelie|audrey|marie|denise|hortense|julie/i.test(v.name); });
      return pref[0] || vs[0] || null;
    },
    stop: function () { if (this.ok) try { window.speechSynthesis.cancel(); } catch (e) { /* rien */ } },
    say: function (text, force) {
      var self = this;
      if (!this.ok || (!this.on && !force) || !text) return Promise.resolve();
      return new Promise(function (resolve) {
        var done = false;
        var finish = function () { if (!done) { done = true; resolve(); } };
        try {
          window.speechSynthesis.cancel();
          var u = new SpeechSynthesisUtterance(text.replace(/…/g, '.'));
          u.lang = 'fr-FR';
          u.rate = 0.95;
          u.pitch = 1.08;
          var v = self.pick();
          if (v) u.voice = v;
          u.onend = finish;
          u.onerror = finish;
          window.speechSynthesis.speak(u);
          // Filet de sécurité si le navigateur n'envoie jamais « fin ».
          setTimeout(finish, Math.min(16000, 1200 + text.length * 75));
        } catch (e) { finish(); }
      });
    }
  };
  if (voice.ok) window.speechSynthesis.onvoiceschanged = function () { };

  // ======================================================================
  // État
  // ======================================================================
  var view = new window.CubeView($('stage'));
  var state = {
    mode: 'learn',
    li: Math.min(store.get('level', 0), LESSONS.length - 1),
    ci: 0,
    flat: [],          // [{token, seg}]
    start: null,       // modèle de départ de la démo
    idx: 0,            // prochain geste à jouer
    playing: false,
    runId: 0,          // change à chaque pause / nouveau départ
    caseRun: 0,        // change quand le cube de la démo est remplacé
    spokenSeg: -1,
    done: store.get('done', {}),
    speed: store.get('speed', 1)
  };

  function lesson() { return LESSONS[state.li]; }
  function currentCase() { return lesson().cases[state.ci]; }

  // ======================================================================
  // Chemin des niveaux
  // ======================================================================
  var STAR = '<svg class="level-star" viewBox="0 0 24 24" aria-label="réussi"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2 6.4 20.2l1.1-6.3L2.9 9.5l6.3-.9z" fill="currentColor" stroke="#1b2140" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  function renderLevels() {
    $('levels').innerHTML = LESSONS.map(function (l, i) {
      return '<li><button class="level" data-i="' + i + '" data-group="' + l.group + '"' + (i === state.li ? ' aria-current="step"' : '') + '>' +
        '<span class="level-dot">' + (i + 1) + (state.done[l.id] ? STAR : '') + '</span>' +
        '<span class="level-text"><span class="level-name">' + l.title + '</span><span class="level-sub">' + l.subtitle + '</span></span>' +
        '</button></li>';
    }).join('');
  }
  $('levels').addEventListener('click', function (e) {
    var b = e.target.closest('.level');
    if (b) selectLesson(+b.dataset.i, 0);
  });

  // ======================================================================
  // Leçon
  // ======================================================================
  function selectLesson(li, ci) {
    state.li = li;
    store.set('level', li);
    var l = lesson();
    $('lesson-badge').textContent = li + 1;
    $('lesson-badge').dataset.group = l.group;
    $('lesson-eyebrow').textContent = 'Niveau ' + (li + 1) + ' sur ' + LESSONS.length;
    $('lesson-title').textContent = l.title;
    $('lesson-subtitle').textContent = l.subtitle;
    $('tip-text').textContent = l.tip;
    $('cases-label').textContent = l.group === 'intro' ? 'Choisis une démo' : 'Choisis ce que tu vois sur ton cube';
    $('btn-prev').hidden = li === 0;
    $('btn-done-label').textContent = li === LESSONS.length - 1 ? 'J’ai fini le cube !' : 'J’ai réussi ! Niveau suivant';

    if (l.recipe) {
      $('recipe-card').hidden = false;
      $('recipe-name').textContent = l.recipe.name;
      $('recipe-moves').innerHTML = CM.tokens(l.recipe.alg).map(function (t) { return tileHTML(t); }).join('');
    } else {
      $('recipe-card').hidden = true;
    }
    renderLevels();
    var cur = document.querySelector('.level[aria-current="step"]');
    if (cur && cur.scrollIntoView && window.matchMedia('(max-width: 1180px)').matches) {
      cur.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
    selectCase(ci || 0);
  }

  function selectCase(ci) {
    stop();
    state.ci = ci;
    var l = lesson();
    var cs = currentCase();
    $('cases').innerHTML = l.cases.map(function (c, i) {
      return '<button class="case" role="tab" data-i="' + i + '" aria-selected="' + (i === ci) + '">' + c.name + '</button>';
    }).join('');

    state.flat = [];
    cs.segments.forEach(function (s, si) {
      CM.tokens(s.alg).forEach(function (t) { state.flat.push({ token: t, seg: si }); });
    });
    var alg = state.flat.map(function (m) { return m.token; });
    state.start = new CM.Cube().apply(cs.base || l.base || '').apply(CM.invert(alg));
    state.idx = 0;
    state.spokenSeg = -1;
    state.caseRun++;

    renderDemo();
    view.setViewMode(l.view);
    view.setFocus(cs.focus || []);
    view.setModel(state.start.clone());
    setBubble(l.goal);
    $('demo-count').textContent = '· ' + alg.length + (alg.length > 1 ? ' gestes' : ' geste');
    hideMovePill();
    $('bravo').hidden = true;
  }

  $('cases').addEventListener('click', function (e) {
    var b = e.target.closest('.case');
    if (b) selectCase(+b.dataset.i);
  });

  function renderDemo() {
    var cs = currentCase();
    // Les morceaux qui se suivent avec le même nom (« Pétale 1 », « Coin 2 »…) vont sur la même ligne,
    // sauf les répétitions d'une même recette, qui restent une par ligne pour bien les compter.
    var groups = [];
    cs.segments.forEach(function (s, si) {
      var last = groups[groups.length - 1];
      var prev = si > 0 ? cs.segments[si - 1] : null;
      if (last && s.label && prev && prev.label === s.label && prev.alg !== s.alg) last.segs.push(si);
      else groups.push({ label: s.label && (!prev || prev.label !== s.label) ? s.label : '', segs: [si] });
    });
    var k = 0;
    $('demo').innerHTML = groups.map(function (g) {
      var tiles = g.segs.map(function (si) {
        return CM.tokens(cs.segments[si].alg).map(function () {
          var t = state.flat[k];
          var html = tileHTML(t.token, 'button').replace('class="tile"', 'class="tile" data-k="' + k + '" title="Aller à ce geste"');
          k++;
          return html;
        }).join('');
      }).join('');
      return '<li class="demo-seg">' + (g.label ? '<span class="demo-seg-label">' + g.label + '</span>' : '') +
        '<div class="demo-tiles">' + tiles + '</div></li>';
    }).join('');
    paintDemo();
  }

  function paintDemo() {
    var tiles = $('demo').querySelectorAll('.tile');
    var curK = state.playing || view.isAnimating() ? state.idx : -1;
    Array.prototype.forEach.call(tiles, function (el) {
      var k = +el.dataset.k;
      el.dataset.state = k < state.idx ? 'done' : (k === curK ? 'current' : 'todo');
    });
  }

  function setBubble(text) { $('bubble-text').textContent = text; }

  // ======================================================================
  // Lecteur de démo
  // ======================================================================
  function showMovePill(token) {
    $('move-pill-icon').innerHTML = moveIcon(token);
    $('move-pill-name').textContent = NAMES[token];
    $('move-pill-code').textContent = 'Geste ' + token.replace("'", '’');
    var pill = $('move-pill');
    pill.hidden = true;
    void pill.offsetWidth; // relance l'animation d'apparition
    pill.hidden = false;
  }
  function hideMovePill() { $('move-pill').hidden = true; }

  function setPlaying(p) {
    state.playing = p;
    $('btn-play').dataset.playing = String(p);
    $('btn-play-label').textContent = p ? 'Pause' : (state.idx > 0 && state.idx < state.flat.length ? 'Continuer' : 'Regarder');
  }

  function stop() {
    state.runId++;
    setPlaying(false);
    voice.stop();
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /** Joue un geste de la démo (avec la phrase du morceau si on y entre). */
  function playOne(runId) {
    var m = state.flat[state.idx];
    var cs = currentCase();
    var seg = cs.segments[m.seg];
    var talk = Promise.resolve();
    if (state.spokenSeg !== m.seg) {
      state.spokenSeg = m.seg;
      setBubble(seg.say);
      talk = voice.say(seg.say);
    }
    $('bravo').hidden = true;
    paintDemoCurrent();
    showMovePill(m.token);
    var caseRun = state.caseRun;
    return view.animateMove(m.token).then(function () {
      if (caseRun !== state.caseRun) return false;   // le cube a été remplacé entre-temps
      state.idx++;
      paintDemo();
      if (runId !== state.runId) return false;      // pause demandée pendant le geste
      var next = state.flat[state.idx];
      var segEnds = !next || next.seg !== m.seg;
      // À la fin d'un morceau, on attend que la phrase soit finie.
      return (segEnds ? talk.then(function () { return wait(350 * state.speed); }) : wait(90 * state.speed)).then(function () {
        return runId === state.runId;
      });
    });
  }

  function paintDemoCurrent() {
    var tiles = $('demo').querySelectorAll('.tile');
    Array.prototype.forEach.call(tiles, function (el) {
      var k = +el.dataset.k;
      el.dataset.state = k < state.idx ? 'done' : (k === state.idx ? 'current' : 'todo');
    });
    // Sur grand écran le panneau défile tout seul : on garde le geste en cours visible.
    // (Sur téléphone on ne bouge pas la page, l'enfant regarde le cube.)
    var cur = $('demo').querySelector('.tile[data-state="current"]');
    if (cur && getComputedStyle($('lesson')).overflowY === 'auto') cur.scrollIntoView({ block: 'nearest' });
  }

  function finishDemo() {
    setPlaying(false);
    hideMovePill();
    paintDemo();
    $('btn-play-label').textContent = 'Revoir';
    if (state.li === LESSONS.length - 1) { view.celebrate(); confetti(90); }
    $('bravo').hidden = false;
    setTimeout(function () { $('bravo').hidden = true; }, 1800);
  }

  function restartModel() {
    state.caseRun++;
    view.setModel(state.start.clone());
    state.idx = 0;
    state.spokenSeg = -1;
  }

  function play() {
    if (state.playing) { stop(); paintDemo(); hideMovePill(); return; }
    if (state.idx >= state.flat.length) restartModel();
    var runId = ++state.runId;
    setPlaying(true);
    var loop = function () {
      if (runId !== state.runId) return;
      if (state.idx >= state.flat.length) { finishDemo(); return; }
      playOne(runId).then(function (go) { if (go) loop(); });
    };
    loop();
  }

  function stepOnce() {
    if (view.isAnimating()) return;
    stop();
    if (state.idx >= state.flat.length) restartModel();
    var runId = state.runId;
    playOne(runId).then(function () {
      hideMovePill();
      if (state.idx >= state.flat.length) finishDemo();
      else setPlaying(false);
    });
  }

  /** Va directement au geste k (les gestes avant sont faits d'un coup), puis le joue. */
  function goTo(k) {
    stop();
    var m = state.start.clone();
    for (var i = 0; i < k; i++) m.move(state.flat[i].token);
    state.caseRun++;
    view.setModel(m);
    state.idx = k;
    state.spokenSeg = -1;
    stepOnce();
  }

  $('demo').addEventListener('click', function (e) {
    var t = e.target.closest('.tile');
    if (t) goTo(+t.dataset.k);
  });
  $('btn-play').addEventListener('click', play);
  $('btn-step').addEventListener('click', stepOnce);
  $('btn-restart').addEventListener('click', function () { selectCase(state.ci); });
  $('btn-listen').addEventListener('click', function () { voice.say($('bubble-text').textContent, true); });
  $('recenter').addEventListener('click', function () { view.resetView(); });

  $('btn-prev').addEventListener('click', function () { if (state.li > 0) selectLesson(state.li - 1, 0); });
  $('btn-done').addEventListener('click', function () {
    var l = lesson();
    state.done[l.id] = true;
    store.set('done', state.done);
    if (state.li === LESSONS.length - 1) {
      renderLevels();
      confetti();
      view.celebrate();
      setBubble('Incroyable ! Tu sais résoudre le Rubik’s Cube. Mélange-le et recommence pour aller de plus en plus vite !');
      voice.say($('bubble-text').textContent);
    } else {
      confetti(60);
      selectLesson(state.li + 1, 0);
    }
  });

  // Vitesse
  function setSpeed(k) {
    state.speed = k;
    store.set('speed', k);
    view.setSpeed(k);
    Array.prototype.forEach.call(document.querySelectorAll('.speed-btn'), function (b) {
      b.setAttribute('aria-checked', String(+b.dataset.speed === k));
    });
  }
  document.querySelector('.speed').addEventListener('click', function (e) {
    var b = e.target.closest('.speed-btn');
    if (b) setSpeed(+b.dataset.speed);
  });

  // Voix
  function paintVoice() {
    var b = $('voice-toggle');
    b.hidden = !voice.ok;
    $('btn-listen').hidden = !voice.ok;
    b.setAttribute('aria-pressed', String(voice.on));
    $('voice-label').textContent = voice.on ? 'Voix' : 'Muet';
  }
  $('voice-toggle').addEventListener('click', function () {
    voice.on = !voice.on;
    store.set('voice', voice.on);
    if (!voice.on) voice.stop();
    paintVoice();
  });

  // ======================================================================
  // Mode libre
  // ======================================================================
  var PAD = ['R', "R'", 'L', "L'", 'U', "U'", 'D', "D'", 'F', "F'", 'y', "y'"];
  // history : tous les gestes faits (mélange compris), pour Annuler et Rembobiner.
  // kidMoves : seulement ceux de l'enfant, pour le compteur.
  var play$ = { history: [], kidMoves: 0, busy: false, scrambled: false, queue: [] };

  function renderPad() {
    $('pad').innerHTML = PAD.map(function (t) {
      return '<button class="pad-btn" data-t="' + t + '">' + moveIcon(t) + '<span><strong>' + NAMES[t] + '</strong><small>' + t.replace("'", '’') + '</small></span></button>';
    }).join('');
  }

  function playStatus(html) { $('play-status').innerHTML = html; }

  function runQueue() {
    if (play$.busy) return;
    var job = play$.queue.shift();
    if (!job) return;
    play$.busy = true;
    if (!job.fast) showMovePill(job.token);
    view.animateMove(job.token, { arrow: !job.fast, fast: job.fast }).then(function () {
      play$.busy = false;
      if (job.after) job.after();
      if (!play$.queue.length) {
        hideMovePill();
        afterPlayMove();
      }
      runQueue();
    });
  }

  function doMove(token, opts) {
    opts = opts || {};
    if (!opts.silent) play$.history.push(token);
    play$.queue.push({ token: token, fast: !!opts.fast, after: opts.after });
    runQueue();
  }

  function afterPlayMove() {
    if (state.mode !== 'play') return;
    var solved = view.model.isSolved();
    if (solved && play$.scrambled && !play$.queue.length) {
      play$.scrambled = false;
      play$.history = [];
      play$.kidMoves = 0;
      playStatus('<strong>Bravo !</strong> Le cube est résolu. Tu es un vrai champion !');
      confetti();
      view.celebrate();
      voice.say('Bravo ! Le cube est résolu !');
    } else if (solved) {
      playStatus('Le cube est tout neuf. Mélange-le, puis essaie de le refaire !');
    } else {
      playStatus('Tes gestes : <strong>' + play$.kidMoves + '</strong>' + (play$.scrambled ? '. Utilise les recettes des niveaux pour le résoudre.' : ''));
    }
  }

  $('pad').addEventListener('click', function (e) {
    var b = e.target.closest('.pad-btn');
    if (b) kidMove(b.dataset.t);
  });
  function kidMove(t) { play$.kidMoves++; doMove(t); }

  // L'historique contient déjà les gestes en attente : Annuler et Rembobiner
  // peuvent donc s'ajouter à la file même pendant une animation.
  $('btn-scramble').addEventListener('click', function () {
    if (play$.queue.length || play$.busy) return;
    var sc = CM.scramble(20);
    play$.scrambled = true;
    play$.kidMoves = 0;
    playStatus('Je mélange…');
    sc.forEach(function (t) { doMove(t, { fast: true }); });
  });
  $('btn-undo').addEventListener('click', function () {
    if (!play$.history.length) return;
    var t = play$.history.pop();
    if (play$.kidMoves > 0) play$.kidMoves--;
    doMove(CM.invertToken(t), { silent: true });
  });
  $('btn-rewind').addEventListener('click', function () {
    if (!play$.history.length) return;
    var back = CM.invert(play$.history);
    play$.history = [];
    play$.kidMoves = 0;
    play$.scrambled = false;
    playStatus('Le cube refait tout à l’envers…');
    back.forEach(function (t) { doMove(t, { silent: true, fast: back.length > 12 }); });
  });
  $('btn-new').addEventListener('click', function () {
    play$.queue = [];
    view.cancel();
    play$.busy = false;
    play$.history = [];
    play$.kidMoves = 0;
    play$.scrambled = false;
    view.setModel(new CM.Cube());
    hideMovePill();
    afterPlayMove();
  });

  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (state.mode === 'play') {
      var k = e.key.toUpperCase();
      if ('RLUDFY'.indexOf(k) !== -1 && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var t = (k === 'Y' ? 'y' : k) + (e.shiftKey ? "'" : '');
        kidMove(t);
        e.preventDefault();
      }
    } else if (e.key === ' ' && !(e.target.closest && e.target.closest('button'))) {
      play();
      e.preventDefault();
    }
  });

  // ======================================================================
  // Modes
  // ======================================================================
  var learnSnapshot = null;
  var playModel = new CM.Cube();
  function setMode(mode) {
    if (mode === state.mode) return;
    if (mode === 'play') {
      stop();
      hideMovePill();
      view.setViewMode('all');
      view.setFocus([]);
      view.setModel(playModel);
    } else {
      play$.queue = [];
      view.cancel();
      play$.busy = false;
      playModel = view.model;
      selectCase(state.ci);
    }
    state.mode = mode;
    $('layout').dataset.mode = mode;
    Array.prototype.forEach.call(document.querySelectorAll('.mode'), function (b) {
      b.setAttribute('aria-selected', String(b.dataset.mode === mode));
    });
    if (mode === 'play') afterPlayMove();
  }
  document.querySelector('.modes').addEventListener('click', function (e) {
    var b = e.target.closest('.mode');
    if (b) setMode(b.dataset.mode);
  });
  $('brand').addEventListener('click', function (e) { e.preventDefault(); setMode('learn'); selectLesson(0, 0); });

  // Le message « glisse ton doigt » disparaît après la première manipulation.
  $('stage').addEventListener('pointerdown', function () { $('stage-hint').hidden = true; }, { once: true });

  // ======================================================================
  // Confettis aux couleurs du cube
  // ======================================================================
  function confetti(count) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = $('confetti');
    var ctx = c.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cols = ['#ffd21a', '#00a650', '#1f5fe0', '#e3233a', '#ff7417', '#f6f6ef'];
    var parts = [];
    for (var i = 0; i < (count || 160); i++) {
      parts.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.3,
        y: innerHeight * 0.45,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 16 - 6,
        s: 7 + Math.random() * 8,
        r: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.4,
        c: cols[i % cols.length]
      });
    }
    var t0 = performance.now();
    (function frame(now) {
      var t = now - t0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach(function (p) {
        p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.strokeStyle = '#1b2140';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
        ctx.strokeRect(-p.s / 2, -p.s / 2, p.s, p.s);
        ctx.restore();
      });
      if (t < 3200) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(t0);
  }

  // ======================================================================
  // Démarrage
  // ======================================================================
  window.cubeMalin = { view: view, state: state }; // pratique pour déboguer dans la console

  renderPad();
  paintVoice();
  setSpeed(state.speed);
  selectLesson(state.li, 0);
})();
