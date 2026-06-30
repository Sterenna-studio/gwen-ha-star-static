/**
 * Lemegeton Voice Engine — Chronicles FM
 * Priorite : D (MP3 bank) -> B (Web Speech API) -> A (texte seul)
 *
 * Usage:
 *   import { LemegetonVoice } from '/js/lemegeton-voice.js';
 *   const lv = new LemegetonVoice();
 *   await lv.init();
 *   lv.speak('intro', { tags: ['rave'] });
 */

// ─── BANQUE DE PHRASES ENRICHIES (Option A) ───────────────────────────────────
export const PHRASES = {
  intro: [
    "Signal capte... Lemegeton aux commandes. Bienvenue dans les ruines du Code.",
    "Transmission Chronicles FM — en ligne. Ajuste ta frequence, l'onde t'attend.",
    "Radio pirate active. Quelque part entre Brest et le neant numerique.",
    "Le Code ecoute. Moi aussi. Lemegeton sur les ondes.",
    "Frequence etablie. Les archives sonores de BZH Chronicles sont ouvertes.",
    "Ici Lemegeton. Tu es branche sur la seule radio qui compte dans ce reseau.",
  ],
  outro: [
    "Signal perdu. Le Code attend ton retour.",
    "Transmission suspendue. Les frequences restent ouvertes dans le noir.",
    "Lemegeton se tait. Pour l'instant. La radio dort — toi, jamais.",
    "La bande s'arrete. Mais les basses, elles, continuent quelque part.",
    "Fin de session. Chronicles FM reste en veille. On se retrouve sur les ondes.",
  ],
  ambient: [
    "Le signal tient. Lemegeton surveille.",
    "Transmission stable depuis les ruines du Code.",
    "Archives sonores en diffusion continue. BZH Chronicles — on emet toujours.",
    "Frequence maintenue. Les murs du reseau vibrent.",
    "Ici les ondes ne mentent pas. Lemegeton enregistre tout.",
    "Signal pur. Continue d'ecouter.",
    "BZH Chronicles — entre Brest et l'infini numerique.",
    "La nuit dans le Code est longue. La musique, elle, ne s'arrete pas.",
    "Lemegeton en veille active. Les frequences sont propres.",
    "Quelque part dans les donnees — une note, une basse, un souvenir.",
  ],
  transition: {
    rave: [
      "Frequence rapide detectee. Accroche-toi — le tempo monte.",
      "Tekno, hardtek — le dancefloor virtuel s'allume. Lemegeton approuve.",
      "Energie brute en approche. La grille du Code tremble sous les basses.",
      "Changement de canal. On passe en mode combat — rythmes machines.",
    ],
    bass: [
      "Basses lourdes en approche. Monte le volume avant qu'elles arrivent.",
      "Drop imminent. Lemegeton s'efface — la frequence parle d'elle-meme.",
      "DnB, dubstep — le subwoofer du Code est en marche.",
      "Le grave s'installe. Laisse-le prendre la place.",
    ],
    rap: [
      "Flow en diffusion. Les mots comptent ici — ecoute-les vraiment.",
      "Rap FR sur les ondes. Textes, ego, verites — transmission en cours.",
      "Plume et beat — la frequence la plus humaine du reseau.",
      "Ici les syllabes sont des armes. Lemegeton tend l'oreille.",
    ],
    hyperpop: [
      "Glitch, sucre, saturation — bienvenue dans l'exces numerique.",
      "Hyperpop active. Les oreilles vont souffrir. C'est voulu.",
      "Digital et surcharge. Parfait pour un reseau comme le notre.",
      "Le signal est intentionnellement casse. C'est l'esthetique.",
    ],
    chill: [
      "Ralentis. La nuit dans le Code est longue — profites-en.",
      "Lo-fi, ambient — flottement en cours. Lemegeton baisse la voix.",
      "Sons poses pour les esprits agites. Laisse la frequence faire son travail.",
      "Ici le tempo descend. Le reseau respire.",
    ],
    ost: [
      "Theme epique en diffusion. OST — la musique qui raconte sans paroles.",
      "Anime, jeu video, film — narratif active. Lemegeton se tait et ecoute.",
      "Musiques pour les heros fatigues et les voyages sans fin.",
      "Une partition dans le Code. Chaque note est une coordonnee.",
    ],
    rock: [
      "Guitares et saturation — organique dans un reseau numerique.",
      "Rock, metal, punk — la tension live que les machines ne peuvent pas simuler.",
      "Riffs en approche. Le Code a des cordes.",
      "Saturation et decibels — Lemegeton monte le gain.",
    ],
    folk: [
      "Vibes druidiques detectees. Les anciens parlent sur cette frequence.",
      "Folk, celtique — BZH dans les os. Lemegeton reconnait le territoire.",
      "Instruments traditionnels sur la frequence. La memoire sonore s'active.",
      "Entre les menhirs et le reseau — cette musique fait le lien.",
    ],
    weird: [
      "Signal bizarre capte. Normal pour Chronicles FM.",
      "Inclassable. Le chaos est voulu — Lemegeton ne s'en excuse pas.",
      "Weird active. Les categories sont une prison. Ici on s'en echappe.",
      "Cette frequence ne rentre dans aucune case. C'est sa force.",
    ],
    'long format': [
      "Long format — installe-toi. Ce voyage prend du temps.",
      "Album, set, mixtape — format complet. Lemegeton te laisse dedans.",
      "Pas de transitions frequentes ici. Une seule oeuvre, de bout en bout.",
      "Long format actif. La profondeur recompense la patience.",
    ],
    default: [
      "Nouvelle frequence — a toi de juger ce qu'elle te raconte.",
      "Changement de canal. Le Code recompose ses ondes.",
      "Transmission en cours sur nouvelle longueur d'onde. Lemegeton s'adapte.",
    ],
  },
};

export function pickPhrase(type, tags = []) {
  // cherche dans les tags d'abord
  const tagPool = (tags ?? []).flatMap(t => PHRASES.transition[t] ?? []);
  const pool = tagPool.length
    ? tagPool
    : (PHRASES[type] ?? PHRASES.ambient);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── VOICE ENGINE ──────────────────────────────────────────────────────────────
export class LemegetonVoice {
  /**
   * @param {object} opts
   * @param {string}  opts.audioBase   - base URL des MP3 (ex: '/jukebox/lemegeton/')
   * @param {boolean} opts.speechEnabled - activer Web Speech en fallback
   * @param {number}  opts.volume      - 0-1, volume voix
   * @param {number}  opts.rate        - Web Speech rate (0.7-1.1)
   * @param {number}  opts.pitch       - Web Speech pitch (0.8-1.2)
   */
  constructor(opts = {}) {
    this.audioBase     = opts.audioBase     ?? '/jukebox/lemegeton/';
    this.speechEnabled = opts.speechEnabled ?? true;
    this.volume        = opts.volume        ?? 0.75;
    this.rate          = opts.rate          ?? 0.82;
    this.pitch         = opts.pitch         ?? 0.88;

    this._voice       = null;   // SpeechSynthesisVoice FR
    this._queue       = [];     // file d'attente
    this._busy        = false;
    this._muted       = false;
    this._audioEl     = new Audio();
    this._audioEl.volume = this.volume;

    // Map phrase text -> nom de fichier MP3 connu
    // Remplie dynamiquement quand on telecharge le manifeste
    this._mp3map      = new Map();
    this._manifestLoaded = false;
  }

  // ── Init : charge le manifeste MP3 + prepare Web Speech ──────────────────
  async init() {
    await Promise.all([
      this._loadManifest(),
      this._initSpeech(),
    ]);
    return this;
  }

  async _loadManifest() {
    try {
      const r = await fetch(this.audioBase + 'manifest.json');
      if (!r.ok) return;
      const data = await r.json(); // { "slug": "filename.mp3", ... }
      for (const [slug, file] of Object.entries(data)) {
        this._mp3map.set(slug, file);
      }
      this._manifestLoaded = true;
    } catch {
      // silencieux — fallback Web Speech
    }
  }

  async _initSpeech() {
    if (!this.speechEnabled || !window.speechSynthesis) return;
    // Les voix sont async sur certains navigateurs
    await new Promise(resolve => {
      const load = () => {
        const voices = window.speechSynthesis.getVoices();
        // Priorite : voix FR masculines
        const fr = voices.filter(v => v.lang.startsWith('fr'));
        this._voice =
          fr.find(v => /thomas|nicolas|pierre|male/i.test(v.name)) ??
          fr.find(v => !/(female|femme|celine|amelie|audrey)/i.test(v.name)) ??
          fr[0] ?? null;
        resolve();
      };
      if (window.speechSynthesis.getVoices().length) { load(); }
      else { window.speechSynthesis.addEventListener('voiceschanged', load, { once: true }); }
    });
  }

  // ── API publique ──────────────────────────────────────────────────────────

  /** Joue une phrase. type: 'intro'|'outro'|'ambient'|'transition'. tags: string[] */
  speak(type = 'ambient', { tags = [], text = null, slug = null } = {}) {
    if (this._muted) return;
    const phrase = text ?? pickPhrase(type, tags);
    const resolvedSlug = slug ?? this._textToSlug(phrase);
    this._enqueue({ phrase, slug: resolvedSlug });
  }

  /** Mute / unmute */
  setMuted(v) {
    this._muted = v;
    if (v) {
      this._audioEl.pause();
      window.speechSynthesis?.cancel();
      this._queue = [];
      this._busy = false;
    }
  }

  get muted() { return this._muted; }

  setVolume(v) {
    this.volume = v;
    this._audioEl.volume = v;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  _textToSlug(text) {
    // Cherche un slug approchant dans le manifeste
    for (const [slug] of this._mp3map) {
      if (text.toLowerCase().includes(slug.replace(/-/g, ' '))) return slug;
    }
    return null;
  }

  _enqueue(item) {
    this._queue.push(item);
    if (!this._busy) this._processQueue();
  }

  async _processQueue() {
    if (!this._queue.length) { this._busy = false; return; }
    this._busy = true;
    const { phrase, slug } = this._queue.shift();

    // Option D — MP3
    if (slug && this._mp3map.has(slug)) {
      await this._playMp3(this._mp3map.get(slug));
    }
    // Option B — Web Speech
    else if (this.speechEnabled && this._voice) {
      await this._playSpeech(phrase);
    }
    // Option A — texte uniquement (gere cote widget via callback)
    else {
      // noop ici — le widget a deja fait le typewriter
    }

    // petite pause entre les phrases
    await this._sleep(600);
    this._processQueue();
  }

  _playMp3(filename) {
    return new Promise(resolve => {
      this._audioEl.src = this.audioBase + filename;
      this._audioEl.volume = this.volume;
      this._audioEl.onended  = resolve;
      this._audioEl.onerror  = resolve; // fallback silencieux
      this._audioEl.play().catch(resolve);
    });
  }

  _playSpeech(text) {
    return new Promise(resolve => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang  = 'fr-FR';
      utter.rate  = this.rate;
      utter.pitch = this.pitch;
      utter.volume = this.volume;
      if (this._voice) utter.voice = this._voice;
      utter.onend   = resolve;
      utter.onerror = resolve;
      window.speechSynthesis.cancel(); // evite la file interne du browser
      window.speechSynthesis.speak(utter);
    });
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}
