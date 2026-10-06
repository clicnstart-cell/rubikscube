/*
 * Modèle logique du Rubik's Cube (aucune dépendance, utilisable dans le navigateur et dans Node).
 *
 * Repère : x vers la droite, y vers le haut, z vers l'avant (vers l'enfant).
 * Chaque petit cube (« cubie ») connaît sa maison (home), sa position actuelle (pos),
 * son orientation (ori = images des axes locaux x, y, z) et ses autocollants.
 *
 * Couleurs : blanc en bas (D), jaune en haut (U), vert devant (F),
 *            bleu derrière (B), rouge à droite (R), orange à gauche (L).
 */
(function (root) {
  'use strict';

  var FACE_COLOR = { U: 'yellow', D: 'white', F: 'green', B: 'blue', R: 'red', L: 'orange' };
  var FACE_NORMAL = {
    R: [1, 0, 0], L: [-1, 0, 0],
    U: [0, 1, 0], D: [0, -1, 0],
    F: [0, 0, 1], B: [0, 0, -1]
  };

  // axis : 0 = x, 1 = y, 2 = z ; dir : sens d'un quart de tour « normal » (+1 = +90°)
  var MOVES = {
    R: { axis: 0, layers: [1], dir: -1 },
    L: { axis: 0, layers: [-1], dir: 1 },
    U: { axis: 1, layers: [1], dir: -1 },
    D: { axis: 1, layers: [-1], dir: 1 },
    F: { axis: 2, layers: [1], dir: -1 },
    B: { axis: 2, layers: [-1], dir: 1 },
    x: { axis: 0, layers: [-1, 0, 1], dir: -1 },
    y: { axis: 1, layers: [-1, 0, 1], dir: -1 },
    z: { axis: 2, layers: [-1, 0, 1], dir: -1 }
  };

  /** "R'" -> { face:'R', prime:true, double:false, quarter:+1, ... } */
  function parseToken(tok) {
    var m = /^([RLUDFBxyz])(2|'|2')?$/.exec(tok);
    if (!m) throw new Error('Mouvement inconnu : ' + tok);
    var def = MOVES[m[1]];
    var double = m[2] === '2' || m[2] === "2'";
    var prime = m[2] === "'";
    var quarters = double ? 2 : (prime ? -def.dir : def.dir);
    return { token: tok, face: m[1], prime: prime, double: double, axis: def.axis, layers: def.layers, quarters: quarters };
  }

  function tokens(alg) {
    if (Array.isArray(alg)) return alg.slice();
    return String(alg || '').trim().split(/\s+/).filter(Boolean);
  }

  function invertToken(tok) {
    var p = parseToken(tok);
    if (p.double) return p.face + '2';
    return p.prime ? p.face : p.face + "'";
  }

  function invert(alg) {
    return tokens(alg).reverse().map(invertToken);
  }

  /** Répète un algorithme n fois. */
  function repeat(alg, n) {
    var out = [];
    for (var i = 0; i < n; i++) out = out.concat(tokens(alg));
    return out;
  }

  // Rotation entière d'un vecteur d'un quart de tour (+90°) autour d'un axe.
  function rot90(v, axis) {
    var x = v[0], y = v[1], z = v[2];
    if (axis === 0) return [x, -z, y];
    if (axis === 1) return [z, y, -x];
    return [-y, x, z];
  }

  function rotate(v, axis, quarters) {
    var k = ((quarters % 4) + 4) % 4;
    for (var i = 0; i < k; i++) v = rot90(v, axis);
    return v;
  }

  function eq(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }

  function Cube() { this.reset(); }

  Cube.prototype.reset = function () {
    var cubies = [];
    var id = 0;
    for (var x = -1; x <= 1; x++) {
      for (var y = -1; y <= 1; y++) {
        for (var z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          var home = [x, y, z];
          var stickers = [];
          Object.keys(FACE_NORMAL).forEach(function (f) {
            var n = FACE_NORMAL[f];
            if ((n[0] && n[0] === x) || (n[1] && n[1] === y) || (n[2] && n[2] === z)) {
              stickers.push({ face: f, color: FACE_COLOR[f], local: n.slice(), normal: n.slice() });
            }
          });
          cubies.push({
            id: id++,
            home: home,
            pos: home.slice(),
            ori: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
            stickers: stickers,
            kind: stickers.length === 1 ? 'center' : stickers.length === 2 ? 'edge' : 'corner'
          });
        }
      }
    }
    this.cubies = cubies;
    return this;
  };

  Cube.prototype.clone = function () {
    var c = Object.create(Cube.prototype);
    c.cubies = this.cubies.map(function (q) {
      return {
        id: q.id, home: q.home.slice(), pos: q.pos.slice(), kind: q.kind,
        ori: q.ori.map(function (v) { return v.slice(); }),
        stickers: q.stickers.map(function (s) {
          return { face: s.face, color: s.color, local: s.local.slice(), normal: s.normal.slice() };
        })
      };
    });
    return c;
  };

  /** Les cubies touchés par un mouvement (avant de le faire). */
  Cube.prototype.layerCubies = function (move) {
    var p = typeof move === 'string' ? parseToken(move) : move;
    return this.cubies.filter(function (q) { return p.layers.indexOf(q.pos[p.axis]) !== -1; });
  };

  Cube.prototype.move = function (tok) {
    var p = typeof tok === 'string' ? parseToken(tok) : tok;
    this.layerCubies(p).forEach(function (q) {
      q.pos = rotate(q.pos, p.axis, p.quarters);
      q.ori = q.ori.map(function (v) { return rotate(v, p.axis, p.quarters); });
      q.stickers.forEach(function (s) { s.normal = rotate(s.normal, p.axis, p.quarters); });
    });
    return this;
  };

  Cube.prototype.apply = function (alg) {
    var self = this;
    tokens(alg).forEach(function (t) { self.move(t); });
    return this;
  };

  Cube.prototype.at = function (pos) {
    for (var i = 0; i < this.cubies.length; i++) if (eq(this.cubies[i].pos, pos)) return this.cubies[i];
    return null;
  };

  Cube.prototype.byHome = function (home) {
    for (var i = 0; i < this.cubies.length; i++) if (eq(this.cubies[i].home, home)) return this.cubies[i];
    return null;
  };

  /** Couleur visible à la position `pos`, sur la face orientée selon `normal` (ou nom de face). */
  Cube.prototype.colorAt = function (pos, normal) {
    if (typeof normal === 'string') normal = FACE_NORMAL[normal];
    var q = this.at(pos);
    if (!q) return null;
    for (var i = 0; i < q.stickers.length; i++) if (eq(q.stickers[i].normal, normal)) return q.stickers[i].color;
    return null;
  };

  /** Couleur du centre d'une face (le cube entier peut avoir été tourné avec x/y/z). */
  Cube.prototype.centerColor = function (face) {
    var n = FACE_NORMAL[face];
    return this.colorAt(n, n);
  };

  /** Vrai si chaque face est d'une seule couleur. */
  Cube.prototype.isSolved = function () {
    var self = this;
    return Object.keys(FACE_NORMAL).every(function (f) {
      var n = FACE_NORMAL[f];
      var c = self.centerColor(f);
      return self.cubies.every(function (q) {
        return q.stickers.every(function (s) { return !eq(s.normal, n) || s.color === c; });
      });
    });
  };

  /** Mélange aléatoire sans mouvements inutiles (pas deux fois la même face d'affilée). */
  function scramble(length, rand) {
    rand = rand || Math.random;
    var faces = ['R', 'L', 'U', 'D', 'F', 'B'];
    var suffix = ['', "'", '2'];
    var out = [];
    var last = '';
    while (out.length < (length || 20)) {
      var f = faces[Math.floor(rand() * faces.length)];
      if (f === last) continue;
      last = f;
      out.push(f + suffix[Math.floor(rand() * suffix.length)]);
    }
    return out;
  }

  var api = {
    Cube: Cube,
    FACE_COLOR: FACE_COLOR,
    FACE_NORMAL: FACE_NORMAL,
    MOVES: MOVES,
    parseToken: parseToken,
    tokens: tokens,
    invert: invert,
    invertToken: invertToken,
    repeat: repeat,
    scramble: scramble
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CubeModel = api;
})(this);
