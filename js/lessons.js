/*
 * Le parcours pédagogique : méthode « couche par couche » pour débutants,
 * adaptée aux enfants de 5 à 10 ans.
 *
 * Pour chaque cas :
 *   - base     : mouvements (depuis un cube résolu) qui donnent l'état visé APRÈS la démo
 *   - segments : la recette découpée en petits morceaux, chacun avec une phrase à lire / dire
 *   - focus    : maisons des pièces à faire briller
 * L'état de départ de la démo est calculé : base + inverse(recette).
 * Le fichier tests/verify-lessons.js vérifie par simulation que chaque démo est correcte.
 *
 * Orientation : blanc en bas, jaune en haut, vert devant.
 * view : quelles pièces restent en couleur (les autres deviennent grises).
 */
(function (root) {
  'use strict';

  var DANSE = "R U R' U'";                 // la petite danse
  var CROIX = "F R U R' U' F'";            // recette de la croix jaune
  var ARETES = "R U R' U R U2 R' U";       // recette des arêtes jaunes
  var COINS = "U R U' L' U R' U' L";       // recette des coins jaunes
  var TOURNE = "R' D' R D";                // recette pour tourner un coin

  var DAISY = 'F2 R2 B2 L2';               // une marguerite toute faite
  var TWIST = "R' D' R D R' D' R D U R' D' R D R' D' R D R' D' R D R' D' R D U'";

  function seg(alg, say, label) { return { alg: alg, say: say, label: label || '' }; }

  function rep(alg, n, sayFn, label) {
    var out = [];
    for (var i = 1; i <= n; i++) out.push(seg(alg, sayFn(i, n), label));
    return out;
  }

  var CENTERS = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  var EDGES = [];
  var CORNERS = [];
  [-1, 0, 1].forEach(function (x) {
    [-1, 0, 1].forEach(function (y) {
      [-1, 0, 1].forEach(function (z) {
        var n = Math.abs(x) + Math.abs(y) + Math.abs(z);
        if (n === 2) EDGES.push([x, y, z]);
        if (n === 3) CORNERS.push([x, y, z]);
      });
    });
  });

  // Mots simples pour chaque mouvement (affichés sur les tuiles et lus à voix haute).
  var MOVE_NAMES = {
    'R': 'Droite monte', "R'": 'Droite descend', 'R2': 'Droite 2 fois',
    'L': 'Gauche descend', "L'": 'Gauche monte', 'L2': 'Gauche 2 fois',
    'U': 'Haut à gauche', "U'": 'Haut à droite', 'U2': 'Haut 2 fois',
    'D': 'Bas à droite', "D'": 'Bas à gauche', 'D2': 'Bas 2 fois',
    'F': 'Face horloge', "F'": 'Face à l’envers', 'F2': 'Face 2 fois',
    'B': 'Dos', "B'": 'Dos à l’envers', 'B2': 'Dos 2 fois',
    'y': 'Tout le cube à gauche', "y'": 'Tout le cube à droite', 'y2': 'Tout le cube 2 fois'
  };

  var LESSONS = [
    {
      id: 'decouvre',
      group: 'intro',
      title: 'Ton cube',
      subtitle: 'Les couleurs et les pièces',
      view: 'all',
      goal: 'Tiens ton cube avec le blanc en bas, le jaune en haut et le vert devant toi. C’est la position de départ de toutes les recettes.',
      tip: 'Un Rubik’s Cube a 6 couleurs : blanc, jaune, vert, bleu, rouge et orange.',
      cases: [
        {
          name: 'Les centres',
          focus: CENTERS,
          segments: [seg("R U R' U'", 'Regarde les centres qui brillent : ils ne changent jamais de place. C’est eux qui disent la couleur de chaque face.')]
        },
        {
          name: 'Les arêtes',
          focus: EDGES,
          segments: [seg('y y y y', 'Les arêtes ont 2 couleurs. Il y en a 12. Fais tourner le cube pour toutes les voir.')]
        },
        {
          name: 'Les coins',
          focus: CORNERS,
          segments: [seg("y' y' y' y'", 'Les coins ont 3 couleurs. Il y en a 8, un à chaque coin du cube.')]
        }
      ]
    },
    {
      id: 'mouvements',
      group: 'intro',
      title: 'Les gestes',
      subtitle: 'Suivre la flèche',
      view: 'all',
      goal: 'Une recette, c’est une suite de petits gestes. La flèche montre dans quel sens tourner la rangée.',
      tip: 'Regarde toujours le cube de face, le vert devant toi. La droite, c’est ta main droite.',
      cases: [
        {
          name: 'La droite',
          segments: [
            seg('R', 'La colonne de droite monte, comme un ascenseur.'),
            seg("R'", 'Et maintenant elle redescend.')
          ]
        },
        {
          name: 'Le haut',
          segments: [
            seg('U', 'La rangée du haut part vers la gauche.'),
            seg("U'", 'Et elle revient vers la droite.')
          ]
        },
        {
          name: 'La face',
          segments: [
            seg('F', 'La face de devant tourne comme les aiguilles d’une horloge.'),
            seg("F'", 'Et à l’envers pour revenir.')
          ]
        },
        {
          name: 'La gauche',
          segments: [
            seg('L', 'Attention : la colonne de gauche descend.'),
            seg("L'", 'Et elle remonte.')
          ]
        },
        {
          name: 'Le bas',
          segments: [
            seg('D', 'La rangée du bas part vers la droite.'),
            seg("D'", 'Et elle revient vers la gauche.')
          ]
        },
        {
          name: 'Tout le cube',
          segments: [
            seg('y', 'Ici, on tourne tout le cube dans tes mains. Rien ne se mélange.'),
            seg("y'", 'Et on le remet comme avant.')
          ]
        }
      ]
    },
    {
      id: 'marguerite',
      group: 'white',
      title: 'La marguerite',
      subtitle: '4 pétales blancs',
      view: 'whiteEdges',
      goal: 'Garde le jaune en haut. Amène les 4 arêtes blanches autour du centre jaune, le blanc vers le ciel. Ça fait une fleur !',
      tip: 'Avant de faire monter un pétale, regarde la place juste au-dessus. Si un pétale blanc y est déjà, tourne le haut pour libérer la place.',
      cases: [
        {
          name: 'Pétale en bas',
          base: DAISY,
          focus: [[0, -1, 1]],
          segments: [seg('F2', 'Le pétale blanc est en bas, sous une place libre. Tourne la face 2 fois : il monte !')]
        },
        {
          name: 'Place déjà prise',
          base: DAISY,
          focus: [[0, -1, 1]],
          segments: [
            seg('U', 'Oh, la place au-dessus a déjà un pétale blanc. Tourne le haut pour la libérer.'),
            seg('F2', 'Maintenant tourne la face 2 fois : le pétale monte.')
          ]
        },
        {
          name: 'Pétale au milieu',
          base: DAISY,
          focus: [[1, -1, 0]],
          segments: [seg('R', 'Le blanc regarde vers toi. La droite monte : le pétale arrive en haut, blanc vers le ciel.')]
        },
        {
          name: 'Pétale à l’envers',
          base: DAISY,
          focus: [[0, -1, 1]],
          segments: [
            seg('F', 'Le pétale est en haut, mais le blanc regarde vers toi. Tourne la face : il glisse sur le côté.'),
            seg("U'", 'Tourne le haut pour libérer la place à droite.'),
            seg('R', 'La droite monte : le pétale est bien rangé !')
          ]
        }
      ]
    },
    {
      id: 'croix',
      group: 'white',
      title: 'La croix blanche',
      subtitle: 'Les pétales descendent',
      view: 'whiteEdges',
      goal: 'Regarde l’autre couleur du pétale de devant. Tourne le haut jusqu’à ce qu’elle touche le centre de la même couleur. Puis tourne la face 2 fois : le pétale descend sous le cube.',
      tip: 'Retourne ton cube pour regarder dessous : une croix blanche apparaît, et chaque bras touche le centre de sa couleur.',
      cases: [
        {
          name: 'Les 4 pétales',
          segments: [].concat.apply([], [["U'", 1], ['U', 2], ['U2', 3], ['U', 4]].map(function (p) {
            return [
              seg(p[0], 'Pétale ' + p[1] + ' : tourne le haut. Sa couleur doit toucher le centre de la même couleur.', 'Pétale ' + p[1]),
              seg('F2', 'Tourne la face 2 fois : le pétale descend.', 'Pétale ' + p[1]),
              seg('y', p[1] < 4 ? 'Tourne tout le cube pour passer au pétale suivant.' : 'La croix blanche est finie ! On remet le vert devant.', 'Pétale ' + p[1])
            ];
          }))
        }
      ]
    },
    {
      id: 'coins-blancs',
      group: 'white',
      title: 'Les coins blancs',
      subtitle: 'La petite danse',
      view: 'firstLayer',
      goal: 'Trouve un coin blanc en haut. Tourne le haut pour le mettre juste au-dessus de sa maison, devant à droite. Puis fais la petite danse jusqu’à ce qu’il soit bien rangé.',
      tip: 'La petite danse : droite monte, haut à gauche, droite descend, haut à droite. Chante-la en la faisant !',
      recipe: { name: 'La petite danse', alg: DANSE },
      cases: [
        {
          name: 'Blanc à droite',
          focus: [[1, -1, 1]],
          segments: [seg('U', 'Tourne le haut : le coin blanc arrive au-dessus de sa maison.')]
            .concat(rep(DANSE, 1, function () { return 'Une seule petite danse et le coin est rangé !'; }, 'Petite danse'))
        },
        {
          name: 'Blanc en haut',
          focus: [[1, -1, 1]],
          segments: [seg("U'", 'Tourne le haut : le coin blanc arrive au-dessus de sa maison.')]
            .concat(rep(DANSE, 3, function (i, n) { return i < n ? 'Petite danse n° ' + i + '. On continue !' : 'Petite danse n° ' + i + ' : le coin est rangé !'; }, 'Petite danse'))
        },
        {
          name: 'Blanc devant',
          focus: [[1, -1, 1]],
          segments: rep(DANSE, 5, function (i, n) { return i < n ? 'Petite danse n° ' + i + '. Le coin n’est pas encore bien tourné, on continue.' : 'Petite danse n° ' + i + ' : le coin est rangé !'; }, 'Petite danse')
        },
        {
          name: 'Coin coincé en bas',
          focus: [[1, -1, 1]],
          segments: rep(DANSE, 2, function (i) { return i === 1 ? 'Le coin est dans sa maison mais mal tourné. Une petite danse le fait sortir…' : '…et une deuxième le range bien tourné.'; }, 'Petite danse')
        }
      ]
    },
    {
      id: 'couronne',
      group: 'middle',
      title: 'La 2e couronne',
      subtitle: 'Les arêtes du milieu',
      view: 'twoLayers',
      goal: 'Cherche en haut une arête sans jaune. Tourne le haut pour faire un T : sa couleur de devant touche le centre de même couleur. La couleur du dessus te dit où elle va : à droite ou à gauche.',
      tip: 'Une arête du milieu est mal placée ? Fais la recette de droite une fois pour la faire sortir en haut, puis recommence.',
      cases: [
        {
          name: 'Vers la droite',
          focus: [[1, 0, 1]],
          segments: [
            seg('U', 'Fais un T : le vert de l’arête touche le centre vert.'),
            seg("U R U' R'", 'Le dessus est rouge comme le centre de droite : l’arête va à droite. Première moitié : on ouvre la porte.', 'Ouvrir'),
            seg("U' F' U F", 'Deuxième moitié : on referme la porte. L’arête est rangée !', 'Fermer')
          ]
        },
        {
          name: 'Vers la gauche',
          focus: [[-1, 0, 1]],
          segments: [
            seg('U2', 'Fais un T : le vert de l’arête touche le centre vert.'),
            seg("U' L' U L", 'Le dessus est orange comme le centre de gauche : l’arête va à gauche. Première moitié : on ouvre la porte.', 'Ouvrir'),
            seg("U F U' F'", 'Deuxième moitié : on referme la porte. L’arête est rangée !', 'Fermer')
          ]
        }
      ]
    },
    {
      id: 'croix-jaune',
      group: 'yellow',
      title: 'La croix jaune',
      subtitle: 'Point, L, ligne, croix',
      view: 'yellowTop',
      goal: 'Regarde le dessus. Tu vois un point, un L, une ligne ou déjà la croix ? La même recette fait avancer : point, puis L, puis ligne, puis croix.',
      tip: 'Ne regarde que le jaune sur le dessus. Les coins ne comptent pas encore.',
      recipe: { name: 'Recette de la croix', alg: CROIX },
      base: "R U R' U R U2 R' U R U' L' U R' U' L",
      cases: [
        {
          name: 'La ligne',
          segments: [
            seg('U', 'Tourne le haut pour coucher la ligne, de gauche à droite.'),
            seg(CROIX, 'Fais la recette de la croix : la croix jaune apparaît !', 'Recette')
          ]
        },
        {
          name: 'Le L',
          segments: [
            seg('U', 'Place le L en haut à gauche, comme les aiguilles d’une horloge à 9 h et à midi.'),
            seg(CROIX, 'Fais la recette : le L devient une ligne.', 'Recette'),
            seg(CROIX, 'Encore une fois : la croix !', 'Recette')
          ]
        },
        {
          name: 'Le point',
          segments: [
            seg(CROIX, 'Seulement le point du milieu ? Fais la recette.', 'Recette'),
            seg('U2', 'Voilà un L ! Tourne le haut pour le mettre en haut à gauche.'),
            seg(CROIX, 'La recette : une ligne.', 'Recette'),
            seg(CROIX, 'Encore la recette : la croix !', 'Recette')
          ]
        }
      ]
    },
    {
      id: 'aretes-jaunes',
      group: 'yellow',
      title: 'Les arêtes jaunes',
      subtitle: 'Chaque arête chez elle',
      view: 'all',
      goal: 'Tourne le haut jusqu’à ce que 2 arêtes aient la bonne couleur sur le côté, comme leur centre. Mets-les derrière et à droite, puis fais la recette.',
      tip: 'Les 2 bonnes arêtes sont face à face ? Fais la recette une fois, et tu auras 2 voisines.',
      recipe: { name: 'Recette des arêtes', alg: ARETES },
      base: COINS,
      cases: [
        {
          name: '2 voisines',
          segments: [
            seg('U', 'Tourne le haut : 2 arêtes sont bien placées, derrière et à droite.'),
            seg(ARETES, 'La recette : les 2 autres arêtes échangent leur place. Fini !', 'Recette')
          ]
        },
        {
          name: '2 face à face',
          segments: [
            seg(ARETES, 'Les 2 bonnes arêtes sont face à face. Fais la recette une fois.', 'Recette'),
            seg("U'", 'Tourne le haut : maintenant 2 voisines sont bonnes, devant et à droite.'),
            seg("y'", 'Tourne tout le cube pour les mettre derrière et à droite.'),
            seg(ARETES, 'La recette encore une fois : toutes les arêtes sont chez elles !', 'Recette')
          ]
        }
      ]
    },
    {
      id: 'coins-jaunes',
      group: 'yellow',
      title: 'Les coins jaunes',
      subtitle: 'Chaque coin dans sa maison',
      view: 'all',
      goal: 'Cherche un coin qui est dans sa maison : ses 3 couleurs sont celles des 3 centres autour, même s’il est mal tourné. Tiens-le devant à droite, en haut. Fais la recette 1 ou 2 fois.',
      tip: 'Aucun coin n’est chez lui ? Fais la recette une fois de n’importe où : un coin le sera.',
      recipe: { name: 'Recette des coins', alg: COINS },
      base: TWIST,
      cases: [
        {
          name: 'Un coin chez lui',
          focus: [[1, 1, 1]],
          segments: [seg(COINS, 'Le coin devant à droite est chez lui. La recette fait tourner les 3 autres coins : ils rentrent tous à la maison !', 'Recette')]
        },
        {
          name: 'Il faut 2 fois',
          focus: [[1, 1, 1]],
          segments: [
            seg(COINS, 'Le coin devant à droite est chez lui. Fais la recette…', 'Recette'),
            seg(COINS, '…pas encore ? Encore une fois : tous les coins sont chez eux !', 'Recette')
          ]
        },
        {
          name: 'Aucun coin chez lui',
          segments: [
            seg(COINS, 'Aucun coin n’est chez lui. Fais la recette une fois.', 'Recette'),
            seg('y', 'Voilà un coin chez lui ! Tourne tout le cube pour le mettre devant à droite.'),
            seg(COINS, 'Et la recette : tous les coins sont chez eux.', 'Recette')
          ]
        }
      ]
    },
    {
      id: 'tourner-coins',
      group: 'yellow',
      title: 'Le dernier secret',
      subtitle: 'Tourner les coins jaunes',
      view: 'all',
      goal: 'Mets un coin mal tourné devant à droite, en haut. Fais la recette 2 ou 4 fois, jusqu’à ce que son jaune regarde le ciel. Puis tourne SEULEMENT le haut pour amener le coin suivant.',
      tip: 'Pendant cette étape, le bas du cube a l’air tout cassé. C’est normal ! Ne lâche pas, il se répare tout seul à la fin.',
      recipe: { name: 'Recette du secret', alg: TOURNE },
      cases: [
        {
          name: '2 coins à tourner',
          segments: [].concat(
            rep(TOURNE, 2, function (i) { return i === 1 ? 'Coin 1, fois 1.' : 'Coin 1, fois 2 : son jaune regarde le ciel !'; }, 'Coin 1'),
            [seg('U', 'Tourne seulement le haut pour amener le coin suivant.')],
            rep(TOURNE, 4, function (i) { return i < 4 ? 'Coin 2, fois ' + i + '. Le cube a l’air cassé : c’est normal !' : 'Coin 2, fois 4 : tout se répare !'; }, 'Coin 2'),
            [seg("U'", 'Un dernier tour du haut… BRAVO, le cube est fini !')]
          )
        },
        {
          name: '3 coins à tourner',
          segments: [].concat(
            rep(TOURNE, 2, function (i) { return 'Coin 1, fois ' + i + '.'; }, 'Coin 1'),
            [seg('U', 'Tourne seulement le haut.')],
            rep(TOURNE, 2, function (i) { return 'Coin 2, fois ' + i + '. Le cube a l’air cassé : c’est normal !'; }, 'Coin 2'),
            [seg('U', 'Tourne seulement le haut.')],
            rep(TOURNE, 2, function (i) { return 'Coin 3, fois ' + i + '.'; }, 'Coin 3'),
            [seg('U2', 'Un dernier tour du haut… BRAVO, le cube est fini !')]
          )
        }
      ]
    }
  ];

  var api = { LESSONS: LESSONS, MOVE_NAMES: MOVE_NAMES, ALGS: { DANSE: DANSE, CROIX: CROIX, ARETES: ARETES, COINS: COINS, TOURNE: TOURNE } };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CubeLessons = api;
})(this);
