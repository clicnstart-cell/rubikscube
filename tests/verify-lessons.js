/*
 * Vérifie par simulation que chaque démo du parcours est correcte.
 * Lancer : node tests/verify-lessons.js
 */
'use strict';
var M = require('../js/cube.js');
var L = require('../js/lessons.js');
var Cube = M.Cube;

// ---------- Outils (indépendants de l'orientation du cube entier) ----------
var SIDES = ['F', 'R', 'B', 'L'];
var N = M.FACE_NORMAL;
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }

function edgeOk(c, a, b) {   // arête entre les faces a et b bien placée et orientée
  var p = add(N[a], N[b]);
  return c.colorAt(p, a) === c.centerColor(a) && c.colorAt(p, b) === c.centerColor(b);
}
function cornerOk(c, a, b, d) {
  var p = add(add(N[a], N[b]), N[d]);
  return [a, b, d].every(function (f) { return c.colorAt(p, f) === c.centerColor(f); });
}
function cornerPlaced(c, a, b, d) {   // bonnes couleurs, orientation libre
  var p = add(add(N[a], N[b]), N[d]);
  var want = [a, b, d].map(function (f) { return c.centerColor(f); }).sort().join();
  return c.at(p).stickers.map(function (s) { return s.color; }).sort().join() === want;
}
function whiteCross(c) { return SIDES.every(function (s) { return edgeOk(c, 'D', s); }); }
function firstLayer(c) {
  return whiteCross(c) && [['F', 'R'], ['R', 'B'], ['B', 'L'], ['L', 'F']].every(function (p) { return cornerOk(c, 'D', p[0], p[1]); });
}
function twoLayers(c) {
  return firstLayer(c) && [['F', 'R'], ['R', 'B'], ['B', 'L'], ['L', 'F']].every(function (p) { return edgeOk(c, p[0], p[1]); });
}
function yellowUpEdges(c) {
  return SIDES.filter(function (s) { return c.colorAt(add(N.U, N[s]), 'U') === 'yellow'; });
}
function yellowPattern(c) {
  var e = yellowUpEdges(c).join('');
  if (!e) return 'point';
  if (e.length === 4) return 'croix';
  if (e === 'RL' || e === 'FB') return 'ligne-' + (e === 'RL' ? 'couchée' : 'debout');
  if (e.length === 2) return 'L-' + e;
  return '?' + e;
}
function topEdgesPlaced(c) { return SIDES.every(function (s) { return edgeOk(c, 'U', s); }); }
function topCornersPlaced(c) {
  return [['F', 'R'], ['R', 'B'], ['B', 'L'], ['L', 'F']].every(function (p) { return cornerPlaced(c, 'U', p[0], p[1]); });
}
function isDaisy(c) {
  var ups = SIDES.map(function (s) { return add(N.U, N[s]); });
  return ups.every(function (p) { return c.colorAt(p, 'U') === 'white'; });
}

// ---------- Contrôles par niveau ----------
var CHECKS = {
  decouvre: { end: function (c) { return c.isSolved(); } },
  mouvements: { end: function (c) { return c.isSolved(); } },
  marguerite: {
    start: function (c) { return !isDaisy(c); },
    end: isDaisy
  },
  croix: { start: isDaisy, end: whiteCross },
  'coins-blancs': {
    start: function (c) { return whiteCross(c) && !firstLayer(c); },
    end: firstLayer
  },
  couronne: {
    start: function (c) { return firstLayer(c) && !twoLayers(c); },
    end: twoLayers
  },
  'croix-jaune': {
    start: function (c) { return twoLayers(c) && yellowPattern(c) !== 'croix'; },
    end: function (c) { return twoLayers(c) && yellowPattern(c) === 'croix'; }
  },
  'aretes-jaunes': {
    start: function (c) { return twoLayers(c) && yellowPattern(c) === 'croix' && !topEdgesPlaced(c); },
    end: function (c) { return twoLayers(c) && topEdgesPlaced(c) && !topCornersPlaced(c); }
  },
  'coins-jaunes': {
    start: function (c) { return twoLayers(c) && topEdgesPlaced(c) && !topCornersPlaced(c); },
    end: function (c) { return twoLayers(c) && topEdgesPlaced(c) && topCornersPlaced(c) && !c.isSolved(); }
  },
  'tourner-coins': {
    start: function (c) { return topCornersPlaced(c) && !c.isSolved(); },
    end: function (c) { return c.isSolved(); }
  }
};

// Contrôles intermédiaires précis (ce que dit le texte à l'enfant).
var EXTRA = {
  'croix-jaune/La ligne': function (states) { return yellowPattern(states[0]) === 'ligne-debout' && yellowPattern(states[1]) === 'ligne-couchée'; },
  'croix-jaune/Le L': function (s) { return yellowPattern(s[1]) === 'L-BL' && yellowPattern(s[2]) === 'ligne-couchée'; },
  'croix-jaune/Le point': function (s) { return yellowPattern(s[0]) === 'point' && yellowPattern(s[2]) === 'L-BL' && yellowPattern(s[3]) === 'ligne-couchée'; },
  'aretes-jaunes/2 voisines': function (s) {
    var c = s[1]; return edgeOk(c, 'U', 'R') && edgeOk(c, 'U', 'B') && !edgeOk(c, 'U', 'F') && !edgeOk(c, 'U', 'L');
  },
  'aretes-jaunes/2 face à face': function (s) {
    var c = s[0]; return edgeOk(c, 'U', 'F') && edgeOk(c, 'U', 'B') && !edgeOk(c, 'U', 'R');
  },
  'coins-jaunes/Un coin chez lui': function (s) { return cornerPlaced(s[0], 'U', 'F', 'R'); },
  'coins-jaunes/Il faut 2 fois': function (s) { return cornerPlaced(s[0], 'U', 'F', 'R') && !topCornersPlaced(s[1]); },
  'coins-jaunes/Aucun coin chez lui': function (s) {
    var none = !['FR', 'RB', 'BL', 'LF'].some(function (k) { return cornerPlaced(s[0], 'U', k[0], k[1]); });
    return none && cornerPlaced(s[2], 'U', 'F', 'R');
  },
  'couronne/Vers la droite': function (s) {
    var c = s[1]; return c.colorAt([0, 1, 1], 'F') === c.centerColor('F') && c.colorAt([0, 1, 1], 'U') === c.centerColor('R');
  },
  'couronne/Vers la gauche': function (s) {
    var c = s[1]; return c.colorAt([0, 1, 1], 'F') === c.centerColor('F') && c.colorAt([0, 1, 1], 'U') === c.centerColor('L');
  },
  'croix/Les 4 pétales': function (s) {
    // avant chaque F2, le pétale de devant touche le centre de sa couleur
    for (var i = 1; i < s.length; i += 3) {
      var c = s[i];
      if (c.colorAt([0, 1, 1], 'U') !== 'white' || c.colorAt([0, 1, 1], 'F') !== c.centerColor('F')) return false;
    }
    return true;
  }
};

var failures = 0;
var count = 0;
L.LESSONS.forEach(function (lesson) {
  lesson.cases.forEach(function (cs) {
    count++;
    var label = lesson.id + '/' + cs.name;
    var alg = [].concat.apply([], cs.segments.map(function (s) { return M.tokens(s.alg); }));
    var base = cs.base || lesson.base || '';
    var start = new Cube().apply(base).apply(M.invert(alg));
    // états au début de chaque segment, puis l'état final
    var states = [start.clone()];
    var cur = start.clone();
    cs.segments.forEach(function (s) { cur.apply(s.alg); states.push(cur.clone()); });
    var end = cur;

    var errs = [];
    var chk = CHECKS[lesson.id] || {};
    if (chk.start && !chk.start(start)) errs.push('départ invalide');
    if (chk.end && !chk.end(end)) errs.push('arrivée invalide');
    if (EXTRA[label] && !EXTRA[label](states)) errs.push('étapes intermédiaires incorrectes');
    alg.forEach(function (t) { if (!L.MOVE_NAMES[t]) errs.push('pas de nom pour ' + t); });
    (cs.focus || []).forEach(function (h) { if (!start.byHome(h)) errs.push('focus inconnu ' + h); });

    if (errs.length) { failures++; console.log('ÉCHEC  ' + label + ' : ' + errs.join(', ')); }
    else console.log('ok     ' + label + ' (' + alg.length + ' gestes)');
  });
});

// Le modèle lui-même : un mélange suivi de son inverse redonne un cube résolu.
var sc = M.scramble(30);
if (!new Cube().apply(sc).apply(M.invert(sc)).isSolved()) { failures++; console.log('ÉCHEC  inverse du mélange'); }
if (new Cube().apply("R U R' U'").isSolved()) { failures++; console.log('ÉCHEC  détection du cube résolu'); }
if (!new Cube().apply(M.repeat("R U R' U'", 6)).isSolved()) { failures++; console.log('ÉCHEC  (R U R\' U\') x6 devrait résoudre'); }

console.log('\n' + (count - failures) + '/' + count + ' démos correctes' + (failures ? ' — ' + failures + ' problème(s)' : ''));
process.exit(failures ? 1 : 0);
