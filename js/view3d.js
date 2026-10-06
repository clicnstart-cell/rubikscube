/*
 * Vue 3D du cube (Three.js r128, chargé globalement).
 * - Le modèle (CubeModel.Cube) reste la seule source de vérité.
 * - Une rotation de tranche : on accroche les cubies à un pivot, on anime, puis on recale
 *   tout sur le modèle (pas de dérive des flottants).
 * - Des flèches posées sur le cube montrent le sens de chaque geste.
 */
(function (root) {
  'use strict';
  var THREE = root.THREE;
  var CM = root.CubeModel;

  var STICKER = {
    white: 0xf6f6ef, yellow: 0xffd21a, green: 0x00a650, blue: 0x1f5fe0,
    red: 0xe3233a, orange: 0xff7417, gray: 0x50566a
  };
  var BODY = 0x16171f;
  var HALO = 0xffc530;
  var ARROW_FILL = 0xffffff;
  var ARROW_EDGE = 0x1b2140;
  var ARROW_CUBE = 0xffc530;   // flèches « tout le cube »

  var AXES = ['x', 'y', 'z'];
  var DEFAULT_PITCH = 0.5;
  var DEFAULT_YAW = -0.62;

  // Vue choisie automatiquement pour chaque geste : on garde toujours la face avant (vert)
  // face à l'enfant, et on penche le cube pour bien montrer la tranche qui tourne.
  var MOVE_VIEW = {
    R: [-0.72, 0.42],   // la droite bien visible
    L: [0.72, 0.42],    // on passe du côté gauche
    U: [-0.5, 0.78],    // vu un peu d'en haut
    D: [-0.5, -0.42],   // vu un peu d'en dessous
    F: [-0.32, 0.32],   // presque de face
    B: [-2.5, 0.5],     // de derrière
    x: [-0.62, 0.5],
    y: [-0.62, 0.62],
    z: [-0.32, 0.32]
  };

  function v3(a) { return new THREE.Vector3(a[0], a[1], a[2]); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function reducedMotion() {
    return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function roundedRect(size, r) {
    var s = size / 2;
    var sh = new THREE.Shape();
    sh.moveTo(-s + r, -s);
    sh.lineTo(s - r, -s); sh.quadraticCurveTo(s, -s, s, -s + r);
    sh.lineTo(s, s - r); sh.quadraticCurveTo(s, s, s - r, s);
    sh.lineTo(-s + r, s); sh.quadraticCurveTo(-s, s, -s, s - r);
    sh.lineTo(-s, -s + r); sh.quadraticCurveTo(-s, -s, -s + r, -s);
    return new THREE.ShapeGeometry(sh, 6);
  }

  /** Corps de cubie aux arêtes arrondies (boîte extrudée avec biseau). */
  function roundedBox(size, radius) {
    var inner = size - radius * 2;
    var sh = new THREE.Shape();
    var s = inner / 2;
    sh.moveTo(-s, -s); sh.lineTo(s, -s); sh.lineTo(s, s); sh.lineTo(-s, s); sh.lineTo(-s, -s);
    var g = new THREE.ExtrudeGeometry(sh, {
      depth: inner, bevelEnabled: true, bevelThickness: radius, bevelSize: radius, bevelSegments: 3, curveSegments: 4
    });
    g.translate(0, 0, -inner / 2);
    return g;
  }

  /**
   * Ruban fléché posé sur une face : points 3D, normale de la face, largeur.
   * Renvoie une géométrie (triangles) prête à l'emploi.
   */
  function ribbonArrow(points, normal, width, headW, headL) {
    var n = normal.clone().normalize();
    var pos = [];
    var pts = points.map(function (p) { return p.clone(); });
    // On raccourcit le ruban pour laisser la place à la pointe.
    var last = pts[pts.length - 1];
    var prev = pts[pts.length - 2];
    var dirEnd = last.clone().sub(prev).normalize();
    var tip = last.clone();
    var neck = last.clone().sub(dirEnd.clone().multiplyScalar(headL));
    pts[pts.length - 1] = neck;

    function side(i) {
      var t;
      if (i === 0) t = pts[1].clone().sub(pts[0]);
      else if (i === pts.length - 1) t = pts[i].clone().sub(pts[i - 1]);
      else t = pts[i + 1].clone().sub(pts[i - 1]);
      return new THREE.Vector3().crossVectors(n, t.normalize()).multiplyScalar(width / 2);
    }
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], sa = side(i), sb = side(i + 1);
      var a1 = a.clone().add(sa), a2 = a.clone().sub(sa), b1 = b.clone().add(sb), b2 = b.clone().sub(sb);
      pos.push(a1.x, a1.y, a1.z, a2.x, a2.y, a2.z, b1.x, b1.y, b1.z);
      pos.push(b1.x, b1.y, b1.z, a2.x, a2.y, a2.z, b2.x, b2.y, b2.z);
    }
    var hs = new THREE.Vector3().crossVectors(n, dirEnd).multiplyScalar(headW / 2);
    var h1 = neck.clone().add(hs), h2 = neck.clone().sub(hs);
    pos.push(h1.x, h1.y, h1.z, h2.x, h2.y, h2.z, tip.x, tip.y, tip.z);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }

  function textSprite(text, fg, bg) {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    var ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = fg; ctx.stroke();
    ctx.fillStyle = fg;
    ctx.font = '800 64px "Baloo 2", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 70);
    var tex = new THREE.CanvasTexture(c);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(0.62, 0.62, 0.62);
    sp.renderOrder = 10;
    return sp;
  }

  // ----- Où dessiner les flèches pour chaque geste -----
  var F = 1.74; // au-dessus des autocollants, même quand la tranche avant sort un peu
  var E = 1.2;  // longueur depuis le centre
  function line(a, b) { return [v3(a), v3(b)]; }
  function arc(center, normal, radius, from, to, steps) {
    // Arc dans le plan de la face avant (normale +z) ou du dessus (normale +y).
    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var a = from + (to - from) * (i / steps);
      if (normal[2]) pts.push(new THREE.Vector3(center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius, center[2]));
      else pts.push(new THREE.Vector3(center[0] + Math.cos(a) * radius, center[1], center[2] - Math.sin(a) * radius));
    }
    return pts;
  }

  /** Liste de flèches {points, normal, cube?} pour un geste de base (sans « ' » ni « 2 »). */
  function arrowPaths(face) {
    var front = [0, 0, 1], top = [0, 1, 0], right = [1, 0, 0];
    switch (face) {
      case 'R': return [
        { points: line([1, -E, F], [1, E, F]), normal: front },
        { points: line([1, F, E * 0.55], [1, F, -E]), normal: top }];
      case 'L': return [
        { points: line([-1, E, F], [-1, -E, F]), normal: front },
        { points: line([-1, F, -E], [-1, F, E * 0.55]), normal: top }];
      case 'U': return [
        { points: line([E, 1, F], [-E, 1, F]), normal: front },
        { points: line([F, 1, -E], [F, 1, E * 0.55]), normal: right }];
      case 'D': return [
        { points: line([-E, -1, F], [E, -1, F]), normal: front },
        { points: line([F, -1, E * 0.55], [F, -1, -E]), normal: right }];
      case 'F': return [
        { points: arc([0, 0, F], front, 1.02, Math.PI * 0.72, Math.PI * 0.72 - Math.PI * 1.6, 28), normal: front }];
      case 'B': return [
        { points: line([E, F, -1], [-E, F, -1]), normal: top }];
      case 'y': return [
        { points: line([E, 1, F], [-E, 1, F]), normal: front, cube: true },
        { points: line([E, 0, F], [-E, 0, F]), normal: front, cube: true },
        { points: line([E, -1, F], [-E, -1, F]), normal: front, cube: true }];
      case 'x': return [
        { points: line([-1, -E, F], [-1, E, F]), normal: front, cube: true },
        { points: line([0, -E, F], [0, E, F]), normal: front, cube: true },
        { points: line([1, -E, F], [1, E, F]), normal: front, cube: true }];
      case 'z': return [
        { points: arc([0, 0, F], front, 1.02, Math.PI * 0.72, Math.PI * 0.72 - Math.PI * 1.6, 28), normal: front, cube: true }];
    }
    return [];
  }

  // ======================================================================

  function CubeView(container) {
    this.container = container;
    this.model = new CM.Cube();
    this.viewMode = 'all';
    this.focus = [];
    this.speed = 1;
    this.pieces = {};
    this.anim = null;
    this.arrows = null;
    this.yaw = DEFAULT_YAW;
    this.pitch = DEFAULT_PITCH;
    this.viewTween = null;
    this.spin = null;
    this.autoView = true;
    this._init();
  }

  CubeView.prototype._init = function () {
    var self = this;
    var r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    r.setClearColor(0x000000, 0);
    this.container.appendChild(r.domElement);
    r.domElement.setAttribute('aria-label', 'Rubik’s Cube en 3D. Glisse pour le faire tourner.');
    r.domElement.setAttribute('role', 'img');

    var scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 0, 13);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a93b8, 0.85));
    var key = new THREE.DirectionalLight(0xffffff, 0.75);
    key.position.set(4, 8, 7);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-6, -2, 4);
    scene.add(fill);

    this.world = new THREE.Group();
    scene.add(this.world);
    this.pivot = new THREE.Group();
    this.world.add(this.pivot);

    // Ombre douce sous le cube.
    var sc = document.createElement('canvas');
    sc.width = sc.height = 128;
    var sctx = sc.getContext('2d');
    var grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(10,14,40,0.38)');
    grad.addColorStop(1, 'rgba(10,14,40,0)');
    sctx.fillStyle = grad; sctx.fillRect(0, 0, 128, 128);
    var shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -3.3;
    scene.add(shadow);

    this._buildPieces();
    this.sync();
    this._bindDrag();

    var ro = new ResizeObserver(function () { self.resize(); });
    ro.observe(this.container);
    this.resize();

    var loop = function (t) {
      self._frame(t);
      root.requestAnimationFrame(loop);
    };
    root.requestAnimationFrame(loop);
  };

  CubeView.prototype._buildPieces = function () {
    var self = this;
    var bodyGeo = roundedBox(0.96, 0.09);
    var bodyMat = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.55, metalness: 0.05 });
    var stickerGeo = roundedRect(0.8, 0.14);
    var haloGeo = new THREE.BoxGeometry(1.16, 1.16, 1.16);
    var haloMat = new THREE.MeshBasicMaterial({ color: HALO, side: THREE.BackSide, transparent: true, opacity: 0.9 });
    var zAxis = new THREE.Vector3(0, 0, 1);

    this.model.cubies.forEach(function (q) {
      var g = new THREE.Group();
      g.add(new THREE.Mesh(bodyGeo, bodyMat));
      var halo = new THREE.Mesh(haloGeo, haloMat);
      halo.visible = false;
      g.add(halo);
      var stickers = q.stickers.map(function (s, i) {
        var mat = new THREE.MeshStandardMaterial({ color: STICKER[s.color], roughness: 0.32, metalness: 0, emissive: 0x000000 });
        var m = new THREE.Mesh(stickerGeo, mat);
        var n = v3(s.local);
        m.position.copy(n.clone().multiplyScalar(0.487));
        m.quaternion.setFromUnitVectors(zAxis, n);
        g.add(m);
        return { mesh: m, index: i };
      });
      self.world.add(g);
      self.pieces[q.id] = { group: g, halo: halo, stickers: stickers };
    });
  };

  /** Recale tous les cubies 3D sur le modèle. */
  CubeView.prototype.sync = function () {
    var self = this;
    var m = new THREE.Matrix4();
    this.model.cubies.forEach(function (q) {
      var p = self.pieces[q.id];
      if (p.group.parent !== self.world) self.world.attach(p.group);
      p.group.position.set(q.pos[0], q.pos[1], q.pos[2]);
      m.makeBasis(v3(q.ori[0]), v3(q.ori[1]), v3(q.ori[2]));
      p.group.quaternion.setFromRotationMatrix(m);
    });
    this._recolor();
  };

  CubeView.prototype.setModel = function (cube) {
    this.cancel();
    this.model = cube;
    // Les cubies du nouveau modèle ont les mêmes id : on garde les mêmes maillages.
    this.sync();
  };

  /** Quelles pièces gardent leurs couleurs selon l'étape. */
  CubeView.prototype._visible = function (q, s) {
    var h = q.home;
    switch (this.viewMode) {
      case 'whiteEdges': return q.kind === 'center' || (q.kind === 'edge' && h[1] === -1);
      case 'firstLayer': return q.kind === 'center' || h[1] === -1;
      case 'twoLayers': return q.kind === 'center' || h[1] <= 0;
      case 'yellowTop': return q.kind === 'center' || h[1] <= 0 || s.color === 'yellow';
      default: return true;
    }
  };

  CubeView.prototype._recolor = function () {
    var self = this;
    this.model.cubies.forEach(function (q) {
      var p = self.pieces[q.id];
      var focused = self._isFocus(q);
      p.halo.visible = focused;
      p.stickers.forEach(function (st) {
        var s = q.stickers[st.index];
        var col = self._visible(q, s) ? STICKER[s.color] : STICKER.gray;
        st.mesh.material.color.setHex(col);
        st.mesh.material.emissive.setHex(focused ? col : 0x000000);
        st.mesh.material.emissiveIntensity = 0;
      });
    });
  };

  CubeView.prototype._isFocus = function (q) {
    return this.focus.some(function (h) { return h[0] === q.home[0] && h[1] === q.home[1] && h[2] === q.home[2]; });
  };

  CubeView.prototype.setViewMode = function (mode) { this.viewMode = mode || 'all'; this._recolor(); };
  CubeView.prototype.setFocus = function (homes) { this.focus = homes || []; this._recolor(); };
  CubeView.prototype.setSpeed = function (k) { this.speed = k; };

  // ----- Flèches -----
  CubeView.prototype.showArrow = function (token) {
    this.hideArrow();
    var p = CM.parseToken(token);
    var paths = arrowPaths(p.face);
    if (!paths.length) return;
    var group = new THREE.Group();
    var mats = [];
    paths.forEach(function (a) {
      var pts = p.prime ? a.points.slice().reverse() : a.points;
      var n = v3(a.normal);
      var edge = new THREE.Mesh(ribbonArrow(pts, n, 0.34, 0.74, 0.5),
        new THREE.MeshBasicMaterial({ color: ARROW_EDGE, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
      // Le contour est un peu plus large et la pointe un peu plus longue.
      var inner = pts.map(function (v) { return v.clone().add(n.clone().multiplyScalar(0.012)); });
      var fill = new THREE.Mesh(ribbonArrow(inner, n, 0.18, 0.54, 0.38),
        new THREE.MeshBasicMaterial({ color: a.cube ? ARROW_CUBE : ARROW_FILL, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
      edge.renderOrder = 5; fill.renderOrder = 6;
      group.add(edge); group.add(fill);
      mats.push(edge.material, fill.material);
    });
    if (p.double) {
      var a0 = paths[0];
      var tipPts = p.prime ? a0.points.slice().reverse() : a0.points;
      var tip = tipPts[tipPts.length - 1].clone().add(v3(a0.normal).multiplyScalar(0.25));
      var label = textSprite('×2', '#1b2140', '#ffc530');
      label.position.copy(tip);
      label.material.opacity = 0;
      group.add(label);
      mats.push(label.material);
    }
    this.world.add(group);
    this.arrows = { group: group, mats: mats, born: performance.now() };
  };

  CubeView.prototype.hideArrow = function () {
    if (!this.arrows) return;
    this.world.remove(this.arrows.group);
    this.arrows.group.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
    this.arrows = null;
  };

  // ----- Animation d'un geste -----
  /**
   * Joue un geste. Renvoie une promesse résolue à la fin.
   * opts.arrow (défaut true) : montrer la flèche avant de tourner.
   */
  CubeView.prototype.animateMove = function (token, opts) {
    opts = opts || {};
    var self = this;
    this.cancel();
    var p = CM.parseToken(token);
    var showArrow = opts.arrow !== false;
    var k = this.speed * (reducedMotion() ? 0.6 : 1);
    // 1) la caméra se place  2) la tranche sort et s'allume, la flèche apparaît  3) elle tourne  4) elle rentre
    var aim = showArrow && !opts.fast && this.autoView ? this.aimAt(p.face, 420 * k) : 0;
    var lead = showArrow ? aim + 750 * k : 0;
    var dur = (p.double ? 1000 : 650) * k;
    var settle = showArrow ? 220 * k : 0;
    if (opts.fast) { lead = 0; dur = 140; settle = 0; }

    var cubies = this.model.layerCubies(p);
    var moving = cubies.map(function (q) { return self.pieces[q.id].group; });
    var wholeCube = p.layers.length === 3;
    // La tranche glisse un peu vers l'extérieur pour qu'on voie bien laquelle va tourner.
    var out = new THREE.Vector3();
    if (!wholeCube) out.setComponent(p.axis, p.layers[0] * 0.16);
    var glow = cubies.map(function (q) { return self.pieces[q.id].stickers; });

    this.pivot.rotation.set(0, 0, 0);
    this.pivot.position.set(0, 0, 0);
    this.pivot.updateMatrixWorld(true);
    moving.forEach(function (g) { self.pivot.attach(g); });

    return new Promise(function (resolve) {
      var start = performance.now();
      var arrowShown = false;
      var target = p.quarters * Math.PI / 2;
      var axis = AXES[p.axis];
      var setGlow = function (v) {
        glow.forEach(function (list) {
          list.forEach(function (st) {
            if (!self._focusMesh(st.mesh)) {
              st.mesh.material.emissive.copy(st.mesh.material.color);
              st.mesh.material.emissiveIntensity = v;
            }
          });
        });
      };
      var a = {
        tick: function (now) {
          var t = now - start;
          if (t < aim) return;                    // la caméra se tourne d'abord
          if (showArrow && !opts.fast && !arrowShown) { self.showArrow(token); arrowShown = true; }
          var tl = t - aim;
          var leadOnly = lead - aim;
          if (tl < leadOnly) {
            var e = easeInOut(Math.min(1, tl / Math.max(1, leadOnly * 0.5)));
            self.pivot.position.copy(out).multiplyScalar(e);
            setGlow(0.35 * e + 0.12 * Math.sin(tl / 110) * e);
            return;
          }
          var u = Math.min(1, (t - lead) / dur);
          self.pivot.position.copy(out);
          self.pivot.rotation[axis] = target * easeInOut(u);
          if (u < 1) return;
          var s = settle ? Math.min(1, (t - lead - dur) / settle) : 1;
          self.pivot.position.copy(out).multiplyScalar(1 - easeInOut(s));
          setGlow(0.35 * (1 - s));
          if (s >= 1) a.finish();
        },
        finish: function () {
          if (a.done) return;
          a.done = true;
          self.anim = null;
          self.model.move(p);
          self.pivot.rotation.set(0, 0, 0);
          self.pivot.position.set(0, 0, 0);
          self.sync();
          self.hideArrow();
          resolve(true);
        }
      };
      self.anim = a;
    });
  };

  CubeView.prototype._focusMesh = function (mesh) {
    // Les pièces « en vedette » gardent leur propre pulsation.
    var self = this;
    return this.focus.length && this.model.cubies.some(function (q) {
      return self._isFocus(q) && self.pieces[q.id].stickers.some(function (st) { return st.mesh === mesh; });
    });
  };

  /**
   * Tourne doucement la vue vers le geste à venir. Renvoie la durée du mouvement (0 si la vue
   * est déjà bonne ou si l'enfant tient le cube lui-même avec le doigt).
   */
  CubeView.prototype.aimAt = function (face, ms) {
    var v = MOVE_VIEW[face];
    if (!v || this.dragging) return 0;
    var turns = Math.round((this.yaw - v[0]) / (Math.PI * 2));
    var to = [v[0] + turns * Math.PI * 2, v[1]];
    var dist = Math.abs(to[0] - this.yaw) + Math.abs(to[1] - this.pitch);
    if (dist < 0.05) return 0;
    var dur = Math.max(250, Math.min(ms, ms * dist / 0.8));
    this.viewTween = { from: [this.yaw, this.pitch], to: to, start: performance.now(), dur: dur };
    return dur;
  };

  /** Termine immédiatement l'animation en cours (le modèle reste cohérent). */
  CubeView.prototype.cancel = function () {
    if (this.anim) this.anim.finish();
    this.hideArrow();
  };

  CubeView.prototype.isAnimating = function () { return !!this.anim; };

  // ----- Caméra / interaction -----
  CubeView.prototype.resize = function () {
    var w = this.container.clientWidth || 1;
    var h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    // On recule la caméra si l'écran est étroit, pour que le cube tienne en largeur.
    var vfov = this.camera.fov * Math.PI / 180;
    var need = 5.9;
    var distV = (need / 2) / Math.tan(vfov / 2);
    var hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    var distH = (need / 2) / Math.tan(hfov / 2);
    this.camera.position.set(0, 0.35, Math.max(distV, distH));
    this.camera.lookAt(0, -0.1, 0);
    this.camera.updateProjectionMatrix();
  };

  CubeView.prototype._bindDrag = function () {
    var self = this;
    var el = this.renderer.domElement;
    var drag = null;
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, yaw: self.yaw, pitch: self.pitch, id: e.pointerId };
      self.viewTween = null;
      self.dragging = true;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    });
    el.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      self.yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
      self.pitch = Math.max(-1.3, Math.min(1.3, drag.pitch + (e.clientY - drag.y) * 0.01));
    });
    var end = function () { drag = null; self.dragging = false; el.style.cursor = 'grab'; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };

  /** Revient doucement à la vue de face (vert devant, jaune en haut, rouge à droite). */
  CubeView.prototype.resetView = function () {
    var turns = Math.round((this.yaw - DEFAULT_YAW) / (Math.PI * 2));
    this.viewTween = {
      from: [this.yaw, this.pitch], to: [DEFAULT_YAW + turns * Math.PI * 2, DEFAULT_PITCH], start: performance.now(), dur: 600
    };
  };

  /** Petite pirouette de fête. */
  CubeView.prototype.celebrate = function () {
    if (reducedMotion()) return;
    this.spin = { start: performance.now(), dur: 1400 };
  };

  CubeView.prototype._frame = function (now) {
    if (this.anim) this.anim.tick(now);
    if (this.viewTween) {
      var vt = this.viewTween;
      var u = Math.min(1, (now - vt.start) / vt.dur);
      var e = easeInOut(u);
      this.yaw = vt.from[0] + (vt.to[0] - vt.from[0]) * e;
      this.pitch = vt.from[1] + (vt.to[1] - vt.from[1]) * e;
      if (u >= 1) this.viewTween = null;
    }
    var extraYaw = 0, bounce = 0;
    if (this.spin) {
      var su = Math.min(1, (now - this.spin.start) / this.spin.dur);
      extraYaw = easeInOut(su) * Math.PI * 2;
      bounce = Math.sin(su * Math.PI) * 0.35;
      if (su >= 1) this.spin = null;
    }
    this.world.rotation.set(this.pitch, this.yaw + extraYaw, 0, 'XYZ');
    this.world.position.y = bounce;

    // Pulsation des pièces en vedette.
    var pulse = 0.18 + 0.18 * Math.sin(now / 260);
    var self = this;
    if (this.focus.length) {
      this.model.cubies.forEach(function (q) {
        if (!self._isFocus(q)) return;
        var p = self.pieces[q.id];
        p.halo.material.opacity = 0.55 + 0.4 * Math.sin(now / 260);
        p.stickers.forEach(function (st) { st.mesh.material.emissiveIntensity = pulse; });
      });
    }
    // Apparition + battement des flèches.
    if (this.arrows) {
      var age = now - this.arrows.born;
      var op = Math.min(1, age / 160) * (0.82 + 0.18 * Math.sin(age / 90));
      this.arrows.mats.forEach(function (m) { m.opacity = op; });
    }
    this.renderer.render(this.scene, this.camera);
  };

  root.CubeView = CubeView;
})(this);
