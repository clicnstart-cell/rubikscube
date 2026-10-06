/*
 * L'application : parcours des niveaux, lecteur de démo, voix, mode libre.
 */
(function () {
  'use strict';
  var CM = window.CubeModel;
  var LESSONS = window.CubeLessons.LESSONS;
  var NAMES = window.CubeLessons.MOVE_NAMES;
  var MESSAGES = window.CubeLessons.MESSAGES;
  var MOVE_SAY = window.CubeLessons.MOVE_SAY;
  var COLOR_NAMES = window.CubeLessons.COLOR_NAMES;

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
  // Sur téléphone, la synthèse vocale a plusieurs pièges :
  //  - iPhone : la toute première phrase doit partir directement d'un toucher (on « débloque » la voix
  //    au premier contact avec la page) ;
  //  - Chrome Android : un speak() juste après cancel() est parfois ignoré, la synthèse peut rester
  //    « en pause », et une phrase oubliée par le navigateur ne se termine jamais ;
  //  - les voix arrivent en retard (getVoices() est vide au début).
  // Si malgré tout rien ne sort, on affiche une aide dans la bulle.
  var speechOk = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  var hasRecorded = !!(window.CUBE_VOICE && window.CUBE_VOICE.keys.length) && typeof Audio !== 'undefined';

  /** Un très court silence (WAV), pour « débloquer » le lecteur audio au premier toucher. */
  function silentWav() {
    var n = 400, buf = new ArrayBuffer(44 + n), d = new DataView(buf);
    var w = function (o, s) { for (var i = 0; i < s.length; i++) d.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); d.setUint32(4, 36 + n, true); w(8, 'WAVEfmt ');
    d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
    d.setUint32(24, 8000, true); d.setUint32(28, 8000, true); d.setUint16(32, 1, true); d.setUint16(34, 8, true);
    w(36, 'data'); d.setUint32(40, n, true);
    for (var i = 0; i < n; i++) d.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  // La voix enregistrée (HeyGen, « voix calme ») est jouée en priorité ;
  // la synthèse vocale du navigateur sert de secours pour une phrase non enregistrée.
  var voice = {
    on: store.get('voice', true),
    speechOk: speechOk,
    ok: speechOk || hasRecorded,
    audio: hasRecorded ? new Audio() : null,
    audioDone: null,
    voices: [],
    unlocked: false,
    current: null,      // garde la phrase en vie (sinon Chrome peut l'oublier en route)
    heard: false,       // une phrase a déjà vraiment démarré
    load: function () {
      if (!this.speechOk) return;
      try { this.voices = window.speechSynthesis.getVoices() || []; } catch (e) { this.voices = []; }
    },
    pick: function () {
      if (!this.voices.length) this.load();
      var fr = this.voices.filter(function (v) { return /^fr([-_]|$)/i.test(v.lang); });
      var byName = function (list) {
        return list.filter(function (v) { return /amélie|amelie|audrey|marie|denise|hortense|julie|google/i.test(v.name); })[0] || list[0];
      };
      // Les voix de l'appareil marchent hors ligne et sans délai : on les préfère.
      var local = fr.filter(function (v) { return v.localService; });
      return byName(local) || byName(fr) || null;
    },
    unlock: function () {
      // Pas pendant une phrase : on la couperait.
      if (this.audio && !this.audioUnlocked && !this.audioDone) {
        var self = this;
        var a = this.audio;
        try {
          a.src = this.silent || (this.silent = silentWav());
          var p = a.play();
          if (p && p.then) p.then(function () { self.audioUnlocked = true; }, function () { /* on réessaiera */ });
        } catch (e) { /* rien */ }
      }
      if (!this.speechOk || this.unlocked) return;
      this.unlocked = true;
      try {
        var u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        u.lang = 'fr-FR';
        window.speechSynthesis.speak(u);
      } catch (e) { /* rien */ }
    },
    stop: function () {
      if (this.audioDone) this.audioDone();
      if (!this.speechOk) return;
      try {
        var s = window.speechSynthesis;
        if (s.speaking || s.pending) s.cancel();
      } catch (e) { /* rien */ }
    },
    /** Adresse du fichier enregistré pour cette phrase, ou null. */
    recorded: function (text) {
      var rec = window.CUBE_VOICE;
      if (!rec || !text) return null;
      var k = window.CubeLessons.voiceKey(text);
      return rec.keys.indexOf(k) !== -1 ? rec.dir + k + '.mp3' : null;
    },
    /** Range sur l'appareil les prochaines phrases pour qu'elles partent sans attendre. */
    prefetch: function (texts) {
      var self = this;
      if (!this.on || !window.fetch) return;
      texts.slice(0, 6).forEach(function (t) {
        var url = self.recorded(t);
        if (url) getVoiceFile(url).catch(function () { /* hors ligne : tant pis */ });
      });
    },
    say: function (text, force) {
      if ((!this.on && !force) || !text) return Promise.resolve();
      var url = this.recorded(text);
      if (url) return this.playFile(url, text);
      return this.sayTTS(text);
    },
    /** Joue une phrase enregistrée (vraie voix), avec la synthèse vocale en secours. */
    playFile: function (url, text) {
      var self = this;
      this.stop();
      var a = this.audio;
      return new Promise(function (resolve) {
        var done = false;
        var timer = null;
        var blobUrl = null;
        var finish = function () {
          if (done) return;
          done = true;
          clearTimeout(timer);
          a.onended = a.onerror = a.onplaying = a.onloadedmetadata = null;
          if (self.audioDone === finish) self.audioDone = null;
          try { a.pause(); } catch (e) { /* rien */ }
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          resolve();
        };
        self.audioDone = finish;
        a.onplaying = function () { self.heard = true; self.audioUnlocked = true; voiceHelp(false); };
        a.onended = finish;
        a.onerror = function () { finish(); };
        a.onloadedmetadata = function () {
          clearTimeout(timer);
          timer = setTimeout(finish, (a.duration || 10) * 1000 + 2500);
        };
        timer = setTimeout(finish, 20000);
        var start = function (src) {
          if (done) return;
          a.src = src;
          var p;
          try { p = a.play(); } catch (e) { p = Promise.reject(e); }
          if (p && p.catch) {
            p.catch(function () {
              // Lecture refusée (navigateur strict) : on tente la synthèse vocale.
              if (done) return;
              done = true;
              clearTimeout(timer);
              self.audioDone = null;
              self.sayTTS(text).then(resolve);
            });
          }
        };
        // Le fichier est lu depuis l'appareil quand il y est (marche sans internet,
        // et évite les soucis de lecture en streaming de Safari) ; sinon on le lit en ligne.
        getVoiceFile(url)
          .then(function (res) { return res.blob(); })
          .then(function (b) {
            if (done) return;
            blobUrl = URL.createObjectURL(b);
            start(blobUrl);
          })
          .catch(function () { start(url); });
      });
    },
    sayTTS: function (text) {
      var self = this;
      if (!this.speechOk) { voiceHelp(true); return Promise.resolve(); }
      this.unlocked = true;
      return new Promise(function (resolve) {
        var done = false;
        var finish = function () { if (!done) { done = true; resolve(); } };
        var s = window.speechSynthesis;
        var u = new SpeechSynthesisUtterance(text.replace(/…/g, '.'));
        u.lang = 'fr-FR';
        u.rate = 0.95;
        u.pitch = 1.08;
        var v = self.pick();
        if (v) { u.voice = v; u.lang = v.lang; }
        var started = false;
        u.onstart = function () { started = true; self.heard = true; voiceHelp(false); };
        u.onend = finish;
        u.onerror = function (e) {
          if (e && e.error && e.error !== 'interrupted' && e.error !== 'canceled') voiceHelp(true);
          finish();
        };
        self.current = u;
        var go = function () {
          try {
            s.resume();     // Chrome Android peut rester bloqué en pause
            s.speak(u);
          } catch (e) { voiceHelp(true); finish(); }
        };
        var busy = false;
        try { busy = s.speaking || s.pending; } catch (e) { /* rien */ }
        if (busy) { s.cancel(); setTimeout(go, 120); } else go();
        // Rien n'a démarré au bout de 3 s : le son est sûrement bloqué sur cet appareil.
        setTimeout(function () { if (!started && !done && !self.heard) voiceHelp(true); }, 3000);
        // Filet de sécurité si le navigateur n'envoie jamais « fin ».
        setTimeout(finish, Math.min(16000, 1500 + text.length * 75));
      });
    }
  };
  if (voice.speechOk) {
    voice.load();
    try { window.speechSynthesis.addEventListener('voiceschanged', function () { voice.load(); }); } catch (e) { /* rien */ }
  }
  if (voice.ok) {
    // Débloque le son au premier vrai geste (obligatoire sur iPhone). Seuls « fin du toucher »,
    // « clic » et « touche » comptent pour le navigateur, pas le simple appui du doigt.
    var unlockOnGesture = function () {
      voice.unlock();
      if (voice.unlocked && (!voice.audio || voice.audioUnlocked)) {
        ['touchend', 'click', 'keydown'].forEach(function (ev) { document.removeEventListener(ev, unlockOnGesture, true); });
      }
    };
    ['touchend', 'click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, unlockOnGesture, true); });
  }

  function voiceHelp(show) {
    var el = $('voice-help');
    if (el) el.hidden = !show || !voice.on;
  }

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
    voice.prefetch([l.goal].concat(cs.segments.map(function (s) { return s.say; })));
    view.setViewMode(l.view);
    view.setFocus(cs.focus || []);
    view.setModel(state.start.clone());
    view.resetView();
    paintHold();
    paintStep();
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
  function showMovePill(token, count) {
    $('move-pill-icon').innerHTML = moveIcon(token);
    $('move-pill-name').textContent = MOVE_SAY[token] || NAMES[token];
    $('move-pill-code').textContent = (count ? count + ' · ' : '') + 'code ' + token.replace("'", '’');
    var pill = $('move-pill');
    pill.dataset.idle = 'false';
    pill.classList.remove('pop');
    void pill.offsetWidth; // relance l'animation d'apparition
    pill.classList.add('pop');
  }
  /** Quand aucun geste ne tourne : le bandeau dit quoi faire ensuite. */
  function hideMovePill() {
    var n = state.flat.length;
    $('move-pill').dataset.idle = 'true';
    $('move-pill-icon').innerHTML = '<svg class="mascot" viewBox="0 0 64 64" aria-hidden="true"><use href="#mascot"/></svg>';
    $('move-pill-name').textContent = state.idx === 0
      ? 'Appuie sur « Premier geste » pour commencer.'
      : state.idx >= n ? 'Bravo, c’est fini ! « Revoir » pour recommencer.' : 'Appuie sur « Geste suivant ».';
    $('move-pill-code').textContent = '';
  }

  function setPlaying(p) {
    state.playing = p;
    $('btn-play').dataset.playing = String(p);
    $('btn-play-label').textContent = p ? 'Pause' : 'Tout regarder';
    paintStep();
  }

  /** Le gros bouton : « Premier geste », « Geste suivant » ou « Revoir », avec le compteur. */
  function paintStep() {
    var n = state.flat.length;
    $('btn-step-label').textContent = state.idx === 0 ? 'Premier geste' : (state.idx >= n ? 'Revoir' : 'Geste suivant');
    $('step-count').textContent = state.idx < n ? (state.idx + 1) + ' sur ' + n : '';
  }

  /** Le rappel « tiens ton cube » : couleur du centre de devant et du dessus. */
  function paintHold() {
    var f = view.model.centerColor('F');
    var u = view.model.centerColor('U');
    $('hold-front').textContent = COLOR_NAMES[f];
    $('hold-top').textContent = COLOR_NAMES[u];
    $('hold-front-dot').style.setProperty('--dot', 'var(--c-' + f + ')');
    $('hold-top-dot').style.setProperty('--dot', 'var(--c-' + u + ')');
  }

  function stop() {
    state.runId++;
    setPlaying(false);
    voice.stop();
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /** Joue un geste de la démo (avec la phrase du morceau si on y entre). */
  function playOne(runId, stepMode) {
    var m = state.flat[state.idx];
    var cs = currentCase();
    var seg = cs.segments[m.seg];
    var talk = Promise.resolve();
    if (state.spokenSeg !== m.seg) {
      state.spokenSeg = m.seg;
      setBubble(seg.say);
      talk = voice.say(seg.say);
    } else if (stepMode) {
      // Pas à pas : chaque geste est dit en entier (« Tourne la colonne de droite vers le haut »).
      talk = voice.say(MOVE_SAY[m.token]);
    }
    $('bravo').hidden = true;
    paintDemoCurrent();
    showMovePill(m.token, 'Geste ' + (state.idx + 1) + ' sur ' + state.flat.length);
    var caseRun = state.caseRun;
    return view.animateMove(m.token).then(function () {
      if (caseRun !== state.caseRun) return false;   // le cube a été remplacé entre-temps
      state.idx++;
      paintDemo();
      paintHold();
      paintStep();
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
    if (state.li === LESSONS.length - 1) { view.celebrate(); confetti(90); }
    $('bravo').hidden = false;
    setTimeout(function () { $('bravo').hidden = true; }, 1800);
  }

  function restartModel() {
    state.caseRun++;
    view.setModel(state.start.clone());
    state.idx = 0;
    state.spokenSeg = -1;
    paintHold();
    paintStep();
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
    // Le bandeau du geste reste affiché : l'enfant le refait sur son cube, puis appuie à nouveau.
    playOne(runId, true).then(function () {
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
    paintHold();
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
      setBubble(MESSAGES.fin);
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
    if (!voice.ok) {
      // Certains navigateurs intégrés (Facebook, Instagram…) n'ont pas de synthèse vocale.
      $('voice-help-text').textContent = 'Ce navigateur ne sait pas lire à voix haute. Ouvre la page dans Chrome (Android) ou Safari (iPhone).';
      $('voice-help').hidden = false;
    } else if (!voice.on) {
      voiceHelp(false);
    }
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
    paintHold();
    var solved = view.model.isSolved();
    if (solved && play$.scrambled && !play$.queue.length) {
      play$.scrambled = false;
      play$.history = [];
      play$.kidMoves = 0;
      playStatus('<strong>Bravo !</strong> Le cube est résolu. Tu es un vrai champion !');
      confetti();
      view.celebrate();
      voice.say(MESSAGES.bravoLibre);
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
      stepOnce();
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
    paintHold();
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
  // ======================================================================
  // Hors ligne : service worker, téléchargement des voix, installation
  // ======================================================================
  var VOIX_CACHE = 'cube-malin-voix';   // même nom que dans sw.js
  var ONLINE_URL = 'https://clicnstart-cell.github.io/rubikscube/';

  function cacheOk() {
    try { return 'caches' in window && location.protocol !== 'file:'; } catch (e) { return false; }
  }

  /** La phrase enregistrée, depuis l'appareil si elle y est (sinon téléchargée et rangée). */
  function getVoiceFile(url) {
    if (!cacheOk()) return Promise.reject(new Error('pas de cache'));
    return caches.open(VOIX_CACHE).then(function (c) {
      return c.match(url).then(function (hit) {
        if (hit) return hit;
        return fetch(url).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return c.put(url, res.clone()).then(function () { return res; }, function () { return res; });
        });
      });
    });
  }

  var offline = {
    isFile: location.protocol === 'file:',
    swSupported: 'serviceWorker' in navigator && location.protocol !== 'file:',
    swActive: false,
    deferred: null,          // invitation à installer (Chrome, Edge, Android)
    installed: false,
    cached: 0,
    downloading: false,
    failed: false,
    standalone: function () {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    },
    platform: function () {
      var ua = navigator.userAgent || '';
      if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
      if (/Android/.test(ua)) return 'android';
      return 'desktop';
    },
    urls: function () {
      var rec = window.CUBE_VOICE;
      return rec ? rec.keys.map(function (k) { return rec.dir + k + '.mp3'; }) : [];
    },
    ready: function () {
      if (this.isFile) return true;
      return this.swActive && this.cached >= this.urls().length;
    },
    /** Compte les voix déjà sur l'appareil et efface celles qui ne servent plus. */
    refresh: function () {
      var self = this;
      if (!cacheOk()) return Promise.resolve();
      var wanted = {};
      this.urls().forEach(function (u) { wanted[new URL(u, location.href).href] = true; });
      return caches.open(VOIX_CACHE).then(function (c) {
        return c.keys().then(function (reqs) {
          var n = 0;
          reqs.forEach(function (r) {
            if (wanted[r.url]) n++;
            else c.delete(r);
          });
          self.cached = n;
        });
      }).catch(function () { /* rien */ });
    },
    download: function () {
      var self = this;
      if (this.downloading || !cacheOk()) return Promise.resolve();
      this.downloading = true;
      this.failed = false;
      // Demande au navigateur de ne pas effacer ces fichiers pour faire de la place.
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* rien */ }
      var urls = this.urls();
      var queue = urls.slice();
      var errors = 0;
      paintInstall();
      return caches.open(VOIX_CACHE).then(function (c) {
        var worker = function () {
          var u = queue.shift();
          if (!u) return Promise.resolve();
          return c.match(u)
            .then(function (hit) {
              if (hit) return;
              return fetch(u).then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return c.put(u, res);
              });
            })
            .catch(function () { errors++; })
            .then(function () { return self.refresh(); })
            .then(function () { paintInstall(); return worker(); });
        };
        return Promise.all([worker(), worker(), worker(), worker()]);
      }).catch(function () { errors++; }).then(function () {
        self.downloading = false;
        self.failed = errors > 0;
        return self.refresh();
      }).then(paintInstall);
    }
  };

  function paintInstall() {
    var total = offline.urls().length;
    var ready = offline.ready();
    var btn = $('install-open');
    btn.dataset.ready = String(ready);
    $('install-label').textContent = ready ? 'Hors ligne' : 'Télécharger';
    btn.title = ready ? 'Cube Malin marche sans internet sur cet appareil' : 'Installer Cube Malin pour jouer sans internet';

    if (offline.isFile) {
      $('install-lead').textContent = 'Tu utilises la version téléchargée : elle marche déjà sans internet. Rien d’autre à faire !';
      $('install-steps').hidden = true;
      return;
    }

    // Étape 1 : les fichiers
    var stepFiles = $('step-files');
    var status = $('dl-status');
    var dl = $('btn-download');
    $('dl-bar').style.width = (total ? Math.round(100 * offline.cached / total) : 0) + '%';
    stepFiles.dataset.done = String(ready);
    if (!offline.swSupported || !cacheOk()) {
      status.innerHTML = 'Ce navigateur ne peut pas garder l’appli sur l’appareil. Ouvre <strong>' + ONLINE_URL + '</strong> dans Chrome ou Safari.';
      dl.hidden = true;
    } else if (ready) {
      status.innerHTML = '<strong>Tout est sur l’appareil.</strong> Cube Malin marche sans internet.';
      dl.hidden = true;
    } else if (offline.downloading) {
      status.textContent = 'Téléchargement… ' + offline.cached + ' voix sur ' + total + '. Garde la page ouverte.';
      dl.hidden = true;
    } else {
      // Quelques voix sont déjà là (celles écoutées) : on n'en parle qu'à partir d'un vrai début.
      var started = offline.cached >= total / 4;
      status.textContent = offline.failed
        ? 'Le téléchargement s’est arrêté (connexion coupée ?). ' + offline.cached + ' voix sur ' + total + '. Réessaie avec le wifi.'
        : 'Environ 14 Mo. À faire une seule fois, avec le wifi.' + (started ? ' Déjà ' + offline.cached + ' voix sur ' + total + '.' : '');
      dl.hidden = false;
      dl.textContent = offline.failed || started ? 'Continuer le téléchargement' : 'Télécharger';
    }

    // Étape 2 : l'icône
    var how = $('install-how');
    var inst = $('btn-install');
    var isInstalled = offline.installed || offline.standalone();
    $('step-install').dataset.done = String(isInstalled);
    inst.hidden = true;
    if (isInstalled) {
      how.innerHTML = '<strong>C’est fait :</strong> l’appli est installée sur cet appareil.';
    } else if (offline.deferred) {
      how.textContent = 'Appuie sur le bouton : l’icône Cube Malin apparaît avec tes autres applis.';
      inst.hidden = false;
    } else if (offline.platform() === 'ios') {
      how.innerHTML = 'Dans <strong>Safari</strong>, touche le bouton <strong>Partager</strong> (le carré avec une flèche vers le haut), puis <strong>« Sur l’écran d’accueil »</strong>.';
    } else if (offline.platform() === 'android') {
      how.innerHTML = 'Ouvre le menu du navigateur (les <strong>3 points</strong> en haut à droite), puis <strong>« Installer l’application »</strong> ou <strong>« Ajouter à l’écran d’accueil »</strong>.';
    } else {
      how.innerHTML = 'Dans <strong>Chrome</strong> ou <strong>Edge</strong>, clique sur l’icône d’installation à droite de la barre d’adresse. Sinon, garde simplement cette page dans tes favoris.';
    }
  }

  var sheetReturn = null;
  function openInstall() {
    sheetReturn = document.activeElement;
    $('install-sheet').hidden = false;
    paintInstall();
    offline.refresh().then(paintInstall);
    $('install-close').focus();
  }
  function closeInstall() {
    $('install-sheet').hidden = true;
    if (sheetReturn && sheetReturn.focus) sheetReturn.focus();
  }
  $('install-open').addEventListener('click', openInstall);
  $('install-close').addEventListener('click', closeInstall);
  $('install-sheet').addEventListener('click', function (e) { if (e.target === $('install-sheet')) closeInstall(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('install-sheet').hidden) closeInstall(); });
  $('btn-download').addEventListener('click', function () { offline.download(); });
  $('btn-install').addEventListener('click', function () {
    var d = offline.deferred;
    if (!d) return;
    offline.deferred = null;
    d.prompt();
    (d.userChoice || Promise.resolve({})).then(function (r) {
      if (r && r.outcome === 'accepted') offline.installed = true;
      paintInstall();
    });
  });
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();          // on garde l'invitation pour notre propre bouton
    offline.deferred = e;
    paintInstall();
  });
  window.addEventListener('appinstalled', function () {
    offline.installed = true;
    offline.deferred = null;
    paintInstall();
    offline.download();          // l'appli installée doit marcher sans internet
  });

  if (offline.swSupported) {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      return navigator.serviceWorker.ready.then(function () {
        offline.swActive = !!(reg.active || navigator.serviceWorker.controller);
        return offline.refresh();
      });
    }).then(function () {
      paintInstall();
      // Lancée depuis l'icône : on complète les voix manquantes sans rien demander.
      if (offline.standalone() && !offline.ready()) offline.download();
    }).catch(function () {
      offline.swSupported = false;
      paintInstall();
    });
  }

  window.cubeMalin = { view: view, state: state, voice: voice, offline: offline }; // pratique pour déboguer dans la console

  renderPad();
  paintVoice();
  paintInstall();
  setSpeed(state.speed);
  selectLesson(state.li, 0);
})();
