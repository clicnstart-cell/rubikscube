/*
 * Enregistre toutes les phrases de l'appli avec une voix HeyGen (par défaut « voix calme »).
 *
 *   node tools/generate-voice.mjs            # génère seulement les phrases manquantes
 *   node tools/generate-voice.mjs --force    # régénère tout
 *   node tools/generate-voice.mjs --dry      # liste ce qui serait généré, sans rien dépenser
 *
 * Connexion HeyGen : variable HEYGEN_API_KEY, ou session du CLI (`npx hyperframes auth login`),
 * qui écrit ~/.heygen/credentials. Le script relit cette session et la rafraîchit si besoin.
 *
 * Sortie : audio/voix/<clé>.mp3 et js/voice-files.js (la liste des phrases disponibles).
 * Quand un texte change dans js/lessons.js, sa clé change : relancer ce script suffit.
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const L = require(join(ROOT, 'js', 'lessons.js'));

const VOICE_ID = process.env.VOICE_ID || '3a7702a58ec24a3c9eaa65de4d996e4f'; // « voix calme »
const SPEED = Number(process.env.VOICE_SPEED || 0.95);
const OUT = join(ROOT, 'audio', 'voix');
const API = 'https://api.heygen.com/v3';
const force = process.argv.includes('--force');
const dry = process.argv.includes('--dry');

/** Petites retouches pour que la voix lise naturellement (le texte affiché ne change pas). */
function forSpeech(t) {
  return t
    .replace(/n° ?/g, 'numéro ')
    .replace(/(\d+) h\b/g, '$1 heures')
    .replace(/\b2e\b/g, 'deuxième')
    .replace(/SEULEMENT/g, 'seulement')
    .replace(/…/g, '...')
    .replace(/’/g, "'");
}

function credentials() {
  if (process.env.HEYGEN_API_KEY) return { 'X-Api-Key': process.env.HEYGEN_API_KEY };
  const file = join(process.env.HEYGEN_CONFIG_DIR || join(homedir(), '.heygen'), 'credentials');
  if (!existsSync(file)) throw new Error('Pas de connexion HeyGen : lance `npx hyperframes auth login` ou définis HEYGEN_API_KEY.');
  const raw = readFileSync(file, 'utf8').trim();
  let cred;
  try { cred = JSON.parse(raw); } catch { cred = { api_key: raw }; }
  const token = cred.access_token || cred.oauth?.access_token || cred.token;
  if (token) return { Authorization: 'Bearer ' + token, 'X-HeyGen-Source': 'cli' };
  const key = cred.api_key || cred.apiKey;
  if (key) return { 'X-Api-Key': key };
  throw new Error('Format de ~/.heygen/credentials inconnu : définis HEYGEN_API_KEY.');
}

async function speak(text, headers) {
  const res = await fetch(API + '/voices/speech', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: forSpeech(text), voice_id: VOICE_ID, speed: SPEED, language: 'fr' })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const payload = await res.json();
  const url = (payload.data || payload).audio_url;
  if (!url) throw new Error('pas d’audio_url dans la réponse');
  const audio = await fetch(url);
  if (!audio.ok) throw new Error('téléchargement HTTP ' + audio.status);
  return Buffer.from(await audio.arrayBuffer());
}

const lines = L.spokenLines();
const wanted = new Map(lines.map((t) => [L.voiceKey(t), t]));
mkdirSync(OUT, { recursive: true });

const todo = [...wanted].filter(([k]) => force || !existsSync(join(OUT, k + '.mp3')));
const chars = todo.reduce((a, [, t]) => a + t.length, 0);
console.log(`${wanted.size} phrases, ${todo.length} à générer (${chars} caractères, ~${Math.ceil(chars / 14 / 60)} min d'audio).`);
if (dry) { todo.forEach(([k, t]) => console.log(k, t)); process.exit(0); }

let headers;
try {
  headers = credentials();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

let failed = 0;
const queue = todo.slice();
async function worker() {
  while (queue.length) {
    const [k, t] = queue.shift();
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        let bytes;
        try {
          bytes = await speak(t, headers);
        } catch (e) {
          // Session OAuth expirée : on la rafraîchit une fois et on réessaie.
          if (/HTTP 401/.test(e.message) && !process.env.HEYGEN_API_KEY) {
            execSync('npx --yes hyperframes auth refresh', { stdio: 'ignore' });
            headers = credentials();
            bytes = await speak(t, headers);
          } else throw e;
        }
        writeFileSync(join(OUT, k + '.mp3'), bytes);
        console.log('ok  ', k, t.slice(0, 60));
        break;
      } catch (e) {
        if (attempt === 3) { failed++; console.log('ÉCHEC', k, e.message); }
        else await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
}
await Promise.all([worker(), worker(), worker()]);

// Supprime les fichiers des phrases qui n'existent plus.
for (const f of readdirSync(OUT)) {
  if (f.endsWith('.mp3') && !wanted.has(f.slice(0, -4))) { unlinkSync(join(OUT, f)); console.log('supprimé', f); }
}

// La liste des phrases disponibles, lue par l'appli.
const available = [...wanted.keys()].filter((k) => existsSync(join(OUT, k + '.mp3'))).sort();
writeFileSync(join(ROOT, 'js', 'voice-files.js'),
  '/* Généré par tools/generate-voice.mjs : phrases enregistrées avec une vraie voix. */\n' +
  'window.CUBE_VOICE = ' + JSON.stringify({ dir: 'audio/voix/', keys: available }) + ';\n');
console.log(`\n${available.length}/${wanted.size} phrases disponibles` + (failed ? ` — ${failed} échec(s), relance le script` : ''));
process.exit(failed ? 1 : 0);
