
const SPRITES = window.SPRITE_DATA;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  characterSelect: document.getElementById('characterSelect'),
  colorSelect: document.getElementById('colorSelect'),
  difficultySelect: document.getElementById('difficultySelect'),
  starterModuleGrid: document.getElementById('starterModuleGrid'),
  windowSubtitle: document.getElementById('windowSubtitle'),
  windowCoreReadout: document.getElementById('windowCoreReadout'),
  windowThreatReadout: document.getElementById('windowThreatReadout'),
  minimap: document.getElementById('minimap'),
  bestScoreLabel: document.getElementById('bestScoreLabel'),
  muteBtn: document.getElementById('muteBtn'),
  startBtn: document.getElementById('startBtn'),
  menuStartBtn: document.getElementById('menuStartBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  resumeBtn: document.getElementById('resumeBtn'),
  backToMenuBtn: document.getElementById('backToMenuBtn'),
  pauseMenuBtn: document.getElementById('pauseMenuBtn'),
  replayBtn: document.getElementById('replayBtn'),
  endMenuBtn: document.getElementById('endMenuBtn'),
  waveLabel: document.getElementById('waveLabel'),
  enemiesLabel: document.getElementById('enemiesLabel'),
  coreLabel: document.getElementById('coreLabel'),
  robotLabel: document.getElementById('robotLabel'),
  colorLabel: document.getElementById('colorLabel'),
  damageLabel: document.getElementById('damageLabel'),
  speedLabel: document.getElementById('speedLabel'),
  scoreLabel: document.getElementById('scoreLabel'),
  menuOverlay: document.getElementById('menuOverlay'),
  betweenOverlay: document.getElementById('betweenOverlay'),
  pauseOverlay: document.getElementById('pauseOverlay'),
  endOverlay: document.getElementById('endOverlay'),
  endKicker: document.getElementById('endKicker'),
  endTitle: document.getElementById('endTitle'),
  endText: document.getElementById('endText'),
  upgradeTitle: document.getElementById('upgradeTitle'),
  upgradeText: document.getElementById('upgradeText'),
  upgradeButtons: document.getElementById('upgradeButtons')
};

const COLOR_LABELS = { original:'Cyan', blue:'Bleu', green:'Vert', gold:'Or', purple:'Violet', red:'Rouge' };
const DIFFICULTY = {
  easy:   { label: 'Tranquille', enemyHp: 0.82, enemySpeed: 0.88, coreHp: 1.25, score: 0.8 },
  normal: { label: 'Normal',     enemyHp: 1.0,  enemySpeed: 1.0,  coreHp: 1.0,  score: 1.0 },
  hard:   { label: 'Hardcore',   enemyHp: 1.25, enemySpeed: 1.12, coreHp: 0.82, score: 1.35 }
};

const keys = { down: new Set(), pressed: new Set() };
window.addEventListener('keydown', (e) => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if (!keys.down.has(e.code)) keys.pressed.add(e.code);
  keys.down.add(e.code);
});
window.addEventListener('keyup', (e) => keys.down.delete(e.code));

function show(el){ el.classList.remove('hidden'); el.classList.add('show'); }
function hide(el){ el.classList.add('hidden'); el.classList.remove('show'); }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function rand(min,max){ return Math.random() * (max - min) + min; }
function distance(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function shuffle(list){ return [...list].sort(() => Math.random() - 0.5); }

const assets = {};
async function preloadAll(){
  const load = src => new Promise((resolve,reject)=>{
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  for (const [character, data] of Object.entries(SPRITES)) {
    assets[character] = {};
    for (const [color, anims] of Object.entries(data.files)) {
      assets[character][color] = {};
      for (const [anim, files] of Object.entries(anims)) {
        assets[character][color][anim] = await Promise.all(files.map(load));
      }
    }
  }
}

function baseStats(character){
  return {
    maxHp: 155,
    speed: 180,
    damage: 34,
    cooldown: 0.50,
    radius: 40,
    touchDamage: 16,
    meleeRange: 92,
    dashPower: 455
  };
}

const WAVE_CONFIG = [
  { title:'Initialisation', enemies:[['hover_drone'], ['hover_drone'], ['hover_drone']] },
  { title:'Signal rouge', enemies:[['hover_drone'], ['hover_drone'], ['hover_drone'], ['hover_drone'], ['stone_guardian']] },
  { title:'Percée', enemies:[['hover_drone'], ['hover_drone'], ['hover_drone'], ['hover_drone'], ['hover_drone'], ['stone_guardian']] },
  { title:'Surcharge', enemies:[['hover_drone'], ['hover_drone'], ['stone_guardian'], ['stone_guardian'], ['hover_drone'], ['stone_guardian']] },
  { title:'Red Protocol', enemies:[['hover_drone'], ['hover_drone'], ['hover_drone'], ['stone_guardian'], ['stone_guardian'], ['stone_guardian'], ['stone_guardian', true], ['boss', true]] }
];

const UPGRADES = [
  { cat:'guardian', title:'+10 dégâts', desc:'Ton coup et ta vague d’énergie frappent plus fort.', apply:p => p.damage += 10 },
  { cat:'guardian', title:'+25 vitesse', desc:'Déplacement plus nerveux dans la grande arène.', apply:p => p.speed += 25 },
  { cat:'guardian', title:'Overclock', desc:'Cooldown d’attaque réduit de 16%.', apply:p => p.cooldown = Math.max(0.14, p.cooldown * 0.84) },
  { cat:'guardian', title:'+30 PV max', desc:'Augmente tes PV max et soigne.', apply:p => { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); } },
  { cat:'core', title:'Réparation noyau', desc:'Restaure 75 PV au noyau cyan.', apply:(p,g) => g.core.hp = Math.min(g.core.maxHp, g.core.hp + 75) },
  { cat:'core', title:'Noyau renforcé', desc:'+80 PV max au noyau et réparation partielle.', apply:(p,g) => { g.core.maxHp += 80; g.core.hp = Math.min(g.core.maxHp, g.core.hp + 80); } },
  { cat:'core', title:'Pulse du noyau', desc:'Le noyau repousse périodiquement les ennemis proches.', apply:(p,g) => { g.core.pulseDamage += 10; g.core.pulseInterval = Math.max(2.2, g.core.pulseInterval - .35); } },
  { cat:'core', title:'Auto-réparation', desc:'Le noyau récupère lentement ses PV.', apply:(p,g) => { g.core.regen += 1.2; } },
  { cat:'guardian', title:'Vague amplifiée', desc:'La vague d’énergie devient plus large et plus longue.', apply:p => { p.waveRange += 70; p.waveWidth += 10; } },
  { cat:'guardian', title:'Dash amélioré', desc:'Dash plus disponible et plus long.', apply:p => { p.dashCooldown = Math.max(0.55, p.dashCooldown * 0.75); p.dashPower += 70; } },
  { cat:'drone', title:'Mini drone allié', desc:'Ajoute un drone bleu qui tire automatiquement.', apply:p => { p.companionDrones += 1; } },
  { cat:'drone', title:'Cadence drones', desc:'Les mini drones alliés tirent plus vite.', apply:p => { p.droneCooldown = Math.max(0.30, p.droneCooldown * 0.78); } },
  { cat:'drone', title:'Drones perforants', desc:'Les tirs des drones font +6 dégâts.', apply:p => { p.droneDamage += 6; } },
  { cat:'drone', title:'Drone gardien', desc:'Un drone reste près du noyau pour le défendre.', apply:p => { p.guardianDrones += 1; p.companionDrones += 1; } },
  { cat:'drone', title:'Drone ralentisseur', desc:'Les tirs de drone ralentissent brièvement les ennemis.', apply:p => { p.droneSlow = Math.min(.55, p.droneSlow + .18); } }
];

const game = {
  mode: 'menu',
  difficultyKey: 'normal',
  selectedCharacter: 'stone_guardian',
  selectedColor: 'original',
  starterModule: 'wave',
  world: { left: -720, right: 720, top: -520, bottom: 520 },
  camera: { x: 0, y: 0 },
  player: null,
  core: null,
  enemies: [],
  projectiles: [],
  effects: [],
  particles: [],
  walls: [],
  waveIndex: -1,
  spawnQueue: [],
  spawnTimer: 0,
  score: 0,
  time: 0,
  shake: 0,
  shakeX: 0,
  shakeY: 0,
  hitFreeze: 0,
  floatingTexts: [],
  bossSpawned: false,
  bestScore: Number(localStorage.getItem('corebots_best_score') || 0),
  muted: localStorage.getItem('corebots_muted') === '1',
  audioCtx: null,
  lastTime: 0
};

const stars = Array.from({length:110},()=>({x:rand(-900,900),y:rand(-700,700),r:rand(.6,1.8),a:rand(.12,.52)}));

function syncSelection(){
  game.selectedCharacter = 'stone_guardian';
  ui.characterSelect.value = 'stone_guardian';
  game.selectedColor = ui.colorSelect.value;
  game.difficultyKey = ui.difficultySelect.value;
}

function makeCore(){
  const mod = DIFFICULTY[game.difficultyKey];
  const maxHp = Math.round(300 * mod.coreHp);
  return { x: 0, y: 0, r: 48, maxHp, hp: maxHp, pulse: 0, hitFlash: 0, regen: 0, pulseDamage: 0, pulseInterval: 4.4, pulseTimer: 4.4, underAttack: 0 };
}

function makePlayer(color){
  const s = baseStats('stone_guardian');
  return {
    kind:'player',
    character:'stone_guardian',
    color,
    x: 0,
    y: 180,
    facing:'front',
    lastAim:{x:0,y:1},
    anim:'appear',
    animFrame:0,
    animClock:0,
    state:'spawning',
    stateTimer:.7,
    maxHp:s.maxHp,
    hp:s.maxHp,
    speed:s.speed,
    damage:s.damage,
    cooldown:s.cooldown,
    radius:s.radius,
    meleeRange:s.meleeRange,
    waveRange:235,
    waveWidth:62,
    waveSpeed:620,
    attackCd:0,
    dashCd:0,
    dashCooldown:1.1,
    dashTime:0,
    dashPower:s.dashPower,
    touchDamage:s.touchDamage,
    flash:0,
    invuln:.4,
    dashVx:0,
    dashVy:0,
    companionDrones:0,
    guardianDrones:0,
    droneDamage:14,
    droneCooldown:.72,
    droneSlow:0,
    droneTimers:[],
    kills:0
  };
}

function generateWalls(){
  const walls = [];
  const candidates = [
    {x:-210,y:-145,w:120,h:34},{x:130,y:-160,w:150,h:34},
    {x:-255,y:128,w:150,h:34},{x:190,y:135,w:120,h:34},
    {x:-80,y:-250,w:38,h:130},{x:88,y:235,w:38,h:125},
    {x:-395,y:-40,w:115,h:32},{x:360,y:50,w:115,h:32},
    {x:-455,y:210,w:42,h:160},{x:455,y:-220,w:42,h:160},
    {x:-40,y:365,w:160,h:36},{x:10,y:-370,w:160,h:36}
  ];
  const shuffled = shuffle(candidates);
  const count = 6 + ((Math.random()*4)|0);
  for(let i=0;i<count;i++){
    const c = shuffled[i];
    walls.push({...c, hp:9999});
  }
  return walls;
}

function makeEnemy(character, elite=false){
  const requestedType = character;
  if(character === 'boss') character = 'stone_guardian';
  const isBoss = requestedType === 'boss';
  if(isBoss) game.bossSpawned = true;
  const s = character === 'stone_guardian'
    ? {maxHp:isBoss ? 520 : 145,speed:isBoss ? 118 : 150,radius:isBoss ? 62 : 40,coreDamage:isBoss ? 38 : 22,playerDamage:isBoss ? 26 : 16}
    : {maxHp:75,speed:190,radius:28,coreDamage:12,playerDamage:9};

  const d = DIFFICULTY[game.difficultyKey];
  const edge = (Math.random()*4)|0;
  let x,y;
  const pad = 60;
  if(edge===0){ x=rand(game.world.left,game.world.right); y=game.world.top-pad; }
  else if(edge===1){ x=game.world.right+pad; y=rand(game.world.top,game.world.bottom); }
  else if(edge===2){ x=rand(game.world.left,game.world.right); y=game.world.bottom+pad; }
  else { x=game.world.left-pad; y=rand(game.world.top,game.world.bottom); }

  const eliteMul = elite ? 1.9 : 1;
  if(isBoss) sfx('boss');
  return {
    kind:'enemy',
    character,
    color:'red',
    elite,
    boss:isBoss,
    x,y,
    facing:'front',
    anim:'appear',
    animFrame:0,
    animClock:0,
    state:'spawning',
    stateTimer:.65,
    maxHp:Math.round(s.maxHp * d.enemyHp * eliteMul),
    hp:Math.round(s.maxHp * d.enemyHp * (isBoss ? 1 : eliteMul)),
    speed:Math.round(s.speed * d.enemySpeed * (isBoss ? 1 : (elite ? 1.07 : 1))),
    baseSpeed:Math.round(s.speed * d.enemySpeed * (isBoss ? 1 : (elite ? 1.07 : 1))),
    slowTimer:0,
    slowFactor:1,
    stuckTimer:0,
    pathBias:{x:0,y:0,t:0},
    radius:Math.round(s.radius * (isBoss ? 1.28 : (elite ? 1.13 : 1))),
    coreDamage:Math.round(s.coreDamage * (elite ? 1.35 : 1)),
    playerDamage:Math.round(s.playerDamage * (elite ? 1.25 : 1)),
    contactCd:0,
    attackCd:0,
    flash:0,
    dead:false,
    targetMode: Math.random() < .78 ? 'core' : 'player'
  };
}


function setStarterModule(moduleKey){
  game.starterModule = moduleKey;
  if(ui.starterModuleGrid){
    ui.starterModuleGrid.querySelectorAll('.starter-card').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.module === moduleKey);
    });
  }
}

function applyStarterModule(){
  const p = game.player;
  if(!p || !game.core) return;

  if(game.starterModule === 'wave'){
    p.waveRange += 70;
    p.waveWidth += 10;
  } else if(game.starterModule === 'drone'){
    p.companionDrones += 1;
    p.droneTimers.push(rand(0,.25));
  } else if(game.starterModule === 'core'){
    game.core.maxHp += 70;
    game.core.hp += 70;
  } else if(game.starterModule === 'dash'){
    p.dashCooldown = Math.max(.55, p.dashCooldown * .72);
    p.dashPower += 90;
  }
}

function resetRun(){
  ensureAudio();
  syncSelection();
  game.world = { left: -720, right: 720, top: -520, bottom: 520 };
  game.camera = { x: 0, y: 0 };
  game.core = makeCore();
  game.player = makePlayer(game.selectedColor);
  applyStarterModule();
  game.walls = generateWalls();
  game.enemies = [];
  game.projectiles = [];
  game.effects = [];
  game.particles = [];
  game.waveIndex = -1;
  game.spawnQueue = [];
  game.spawnTimer = .4;
  game.score = 0;
  game.time = 0;
  game.bossSpawned = false;
  game.floatingTexts = [];
  game.hitFreeze = 0;
  hide(ui.menuOverlay); hide(ui.betweenOverlay); hide(ui.pauseOverlay); hide(ui.endOverlay);
  game.mode = 'playing';
  nextWave();
}

function returnToMenu(){
  game.mode = 'menu';
  game.player = null;
  game.core = null;
  game.enemies = [];
  game.projectiles = [];
  game.effects = [];
  game.spawnQueue = [];
  hide(ui.betweenOverlay); hide(ui.pauseOverlay); hide(ui.endOverlay);
  show(ui.menuOverlay);
  updateWindowReadout();
}

function setPaused(paused){
  if(game.mode === 'menu' || game.mode === 'between' || game.mode === 'victory' || game.mode === 'gameover') return;
  game.mode = paused ? 'paused' : 'playing';
  if(paused) show(ui.pauseOverlay); else hide(ui.pauseOverlay);
}

function endRun(victory, reason){
  game.mode = victory ? 'victory' : 'gameover';
  if(game.score > game.bestScore){
    game.bestScore = game.score;
    localStorage.setItem('corebots_best_score', String(game.bestScore));
  }
  sfx(victory ? 'win' : 'lose');
  ui.endKicker.textContent = victory ? 'Victoire' : 'Échec du protocole';
  ui.endTitle.textContent = victory ? 'Noyau sécurisé' : 'Défense brisée';
  ui.endText.textContent = victory
    ? `Score final : ${game.score}. Le protocole rouge a été contenu.`
    : `${reason || 'Le noyau a été détruit.'} Score : ${game.score}. Vague atteinte : ${Math.max(1, game.waveIndex + 1)}.`;
  show(ui.endOverlay);
}

function nextWave(){
  game.waveIndex++;
  if(game.waveIndex >= WAVE_CONFIG.length){
    endRun(true);
    return;
  }
  game.spawnQueue = WAVE_CONFIG[game.waveIndex].enemies.map(([type, elite])=>({type, elite:!!elite}));
  game.spawnTimer = .5;
  game.mode = 'playing';
  hide(ui.betweenOverlay);
  burst(game.core.x, game.core.y, 20, '#58dbe6', 2.2);
}

function openUpgradeChoice(){
  game.mode = 'between';
  const opts = shuffle(UPGRADES).slice(0,3);
  ui.upgradeTitle.textContent = `Vague ${game.waveIndex + 1} nettoyée`;
  ui.upgradeText.textContent = 'Choisis un module avant de relancer le protocole.';
  ui.upgradeButtons.innerHTML = '';
  for(const up of opts){
    const btn = document.createElement('button');
    btn.className = 'upgrade-btn';
    btn.innerHTML = `<small>${up.cat}</small><strong>${up.title}</strong><span>${up.desc}</span>`;
    btn.addEventListener('click', ()=>{
      up.apply(game.player, game);
      sfx('upgrade');
      while(game.player.droneTimers.length < game.player.companionDrones) game.player.droneTimers.push(rand(0,.4));
      nextWave();
    });
    ui.upgradeButtons.appendChild(btn);
  }
  show(ui.betweenOverlay);
}

function facingVector(f){
  if(f==='left') return {x:-1,y:0};
  if(f==='right') return {x:1,y:0};
  if(f==='back') return {x:0,y:-1};
  return {x:0,y:1};
}

function lockAnim(e, anim, duration, state){
  e.anim = anim;
  e.animFrame = 0;
  e.animClock = 0;
  e.state = state;
  e.stateTimer = duration;
}

function rectCircleCollide(rect, c){
  const closestX = clamp(c.x, rect.x - rect.w/2, rect.x + rect.w/2);
  const closestY = clamp(c.y, rect.y - rect.h/2, rect.y + rect.h/2);
  return Math.hypot(c.x-closestX, c.y-closestY) < c.radius;
}

function resolveWalls(entity){
  for(const w of game.walls){
    if(!rectCircleCollide(w, entity)) continue;
    const left = w.x - w.w/2, right = w.x + w.w/2;
    const top = w.y - w.h/2, bottom = w.y + w.h/2;
    const dxLeft = Math.abs(entity.x - left);
    const dxRight = Math.abs(right - entity.x);
    const dyTop = Math.abs(entity.y - top);
    const dyBottom = Math.abs(bottom - entity.y);
    const min = Math.min(dxLeft, dxRight, dyTop, dyBottom);
    if(min === dxLeft) entity.x = left - entity.radius;
    else if(min === dxRight) entity.x = right + entity.radius;
    else if(min === dyTop) entity.y = top - entity.radius;
    else entity.y = bottom + entity.radius;
  }
}

function doAttack(){
  const p = game.player;
  if(!p || p.attackCd > 0 || p.state === 'spawning') return;
  p.attackCd = p.cooldown;
  sfx('attack');
  lockAnim(p, 'front_attack', .28, 'attacking');
  const v = p.lastAim || facingVector(p.facing);

  const fx = {
    type:'energyWave',
    x:p.x + v.x*46,
    y:p.y + v.y*46,
    vx:v.x*p.waveSpeed,
    vy:v.y*p.waveSpeed,
    dir:{x:v.x,y:v.y},
    length:p.waveRange,
    width:p.waveWidth,
    travelled:0,
    life:.46,
    ttl:.46,
    damage:p.damage,
    hit:new Set()
  };
  game.effects.push(fx);

  game.effects.push({
    type:'melee',
    x:p.x + v.x*(p.radius+42),
    y:p.y + v.y*(p.radius+42),
    r:p.meleeRange*.62,
    life:.12,
    ttl:.12,
    damage:Math.round(p.damage*.85),
    hit:new Set()
  });

  luminousLine(p.x, p.y, p.x + v.x*p.waveRange, p.y + v.y*p.waveRange, '#bff8ff', .18, 5);
  luminousLine(p.x + -v.y*18, p.y + v.x*18, p.x + v.x*p.waveRange + -v.y*18, p.y + v.y*p.waveRange + v.x*18, '#58dbe6', .15, 2);
  luminousLine(p.x + v.y*18, p.y + -v.x*18, p.x + v.x*p.waveRange + v.y*18, p.y + v.y*p.waveRange + -v.x*18, '#58dbe6', .15, 2);
  burst(p.x + v.x*78, p.y + v.y*78, 14, '#58dbe6', 1.4);
  screenShake(.45);
}

function doDash(dx,dy){
  const p = game.player;
  if(!p || p.dashCd > 0 || p.state === 'spawning') return;
  const len = Math.hypot(dx,dy) || 1;
  p.dashCd = p.dashCooldown;
  p.dashTime = .12;
  p.dashVx = (dx/len) * p.dashPower;
  p.dashVy = (dy/len) * p.dashPower;
  p.invuln = .16;
  burst(p.x, p.y, 8, '#7dd3fc', 1.6);
}

function updatePlayer(dt){
  const p = game.player;
  if(!p) return;
  p.attackCd = Math.max(0, p.attackCd - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.flash = Math.max(0, p.flash - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  if(p.stateTimer > 0) p.stateTimer -= dt;

  if(keys.pressed.has('KeyR')) lockAnim(p, 'appear', .65, 'spawning');

  let dx=0, dy=0;
  if(keys.down.has('ArrowLeft') || keys.down.has('KeyA')) dx--;
  if(keys.down.has('ArrowRight') || keys.down.has('KeyD')) dx++;
  if(keys.down.has('ArrowUp') || keys.down.has('KeyW')) dy--;
  if(keys.down.has('ArrowDown') || keys.down.has('KeyS')) dy++;

  if(dx || dy){
    const n = Math.hypot(dx,dy)||1;
    p.lastAim = {x:dx/n, y:dy/n};
  }

  if(game.mode === 'playing' && p.state !== 'spawning'){
    if(keys.pressed.has('Space')) doAttack();
    if(keys.pressed.has('ShiftLeft') || keys.pressed.has('ShiftRight')) doDash(dx || p.lastAim.x, dy || p.lastAim.y);
  }

  if(p.dashTime > 0){
    p.dashTime -= dt;
    p.x += p.dashVx * dt;
    p.y += p.dashVy * dt;
  } else if(game.mode === 'playing' && p.state !== 'spawning' && p.state !== 'attacking') {
    if(dx || dy){
      const len = Math.hypot(dx,dy)||1;
      p.x += (dx/len) * p.speed * dt;
      p.y += (dy/len) * p.speed * dt;
      if(Math.abs(dx) > Math.abs(dy)) p.facing = dx > 0 ? 'right' : 'left';
      else p.facing = dy < 0 ? 'back' : 'front';
    }
  }

  p.x = clamp(p.x, game.world.left, game.world.right);
  p.y = clamp(p.y, game.world.top, game.world.bottom);
  resolveWalls(p);

  if(p.state === 'spawning' && p.stateTimer <= 0) p.state = 'idle';
  if(p.state === 'attacking' && p.stateTimer <= 0) p.state = 'idle';

  if(p.state === 'spawning') p.anim = 'appear';
  else if(p.state === 'attacking') p.anim = 'front_attack';
  else if(p.facing === 'left') p.anim = 'left_idle';
  else if(p.facing === 'right') p.anim = 'right_idle';
  else if(p.facing === 'back') p.anim = 'back_idle';
  else p.anim = 'front_idle';

  animate(p, dt);
  updateCompanionDrones(dt);
}

function updateCompanionDrones(dt){
  const p = game.player;
  if(!p || p.companionDrones <= 0) return;
  while(p.droneTimers.length < p.companionDrones) p.droneTimers.push(rand(0,.3));

  for(let i=0;i<p.companionDrones;i++){
    p.droneTimers[i] -= dt;
    if(p.droneTimers[i] > 0) continue;

    let target = null;
    let best = Infinity;
    const pos = companionDronePosition(i, p.companionDrones);
    for(const e of game.enemies){
      if(e.dead || e.state === 'spawning') continue;
      const d = Math.hypot(e.x-pos.x, e.y-pos.y);
      if(d < best && d < 430){
        best = d;
        target = e;
      }
    }
    if(target){
      const dx = target.x - pos.x, dy = target.y - pos.y;
      const n = Math.hypot(dx,dy)||1;
      sfx('shoot');
      game.projectiles.push({
        owner:'drone',
        x:pos.x,
        y:pos.y,
        vx:dx/n*430,
        vy:dy/n*430,
        r:7,
        damage:p.droneDamage,
        life:1.1,
        color:'#60a5fa'
      });
      burst(pos.x, pos.y, 4, '#60a5fa', .8);
    }
    p.droneTimers[i] = p.droneCooldown;
  }
}

function companionDronePosition(i,count){
  const p = game.player;
  const guardianCount = Math.min(p.guardianDrones || 0, count);
  if(i < guardianCount){
    const angle = game.time*1.45 + (Math.PI*2/Math.max(1,guardianCount))*i;
    const radius = 96 + Math.sin(game.time*2+i)*8;
    return { x:game.core.x + Math.cos(angle)*radius, y:game.core.y + Math.sin(angle)*radius };
  }
  const orbitIndex = i - guardianCount;
  const orbitCount = Math.max(1, count - guardianCount);
  const angle = game.time*1.8 + (Math.PI*2/orbitCount)*orbitIndex;
  const radius = 74 + Math.sin(game.time*2+i)*6;
  return { x:p.x + Math.cos(angle)*radius, y:p.y + Math.sin(angle)*radius };
}


function updateCore(dt){
  const c = game.core;
  if(!c) return;
  c.pulse += dt;
  c.hitFlash = Math.max(0, c.hitFlash - dt);
  c.underAttack = Math.max(0, (c.underAttack || 0) - dt);

  if(c.regen > 0 && game.mode === 'playing'){
    c.hp = Math.min(c.maxHp, c.hp + c.regen * dt);
  }

  if(c.pulseDamage > 0 && game.mode === 'playing'){
    c.pulseTimer -= dt;
    if(c.pulseTimer <= 0){
      c.pulseTimer = c.pulseInterval;
      game.effects.push({type:'corePulse', x:c.x, y:c.y, r:40, maxR:210, damage:c.pulseDamage, hit:new Set(), life:.42, ttl:.42});
      burst(c.x, c.y, 18, '#58dbe6', 1.7);
      screenShake(.45);
    }
  }
}


function updateEnemies(dt){
  const p = game.player;
  const c = game.core;
  for(const e of game.enemies){
    if(e.dead) continue;
    e.flash = Math.max(0, e.flash - dt);
    e.contactCd = Math.max(0, e.contactCd - dt);
    e.attackCd = Math.max(0, e.attackCd - dt);
    e.slowTimer = Math.max(0, (e.slowTimer || 0) - dt);
    e.speed = e.baseSpeed * (e.slowTimer > 0 ? (e.slowFactor || .75) : 1);
    if(e.pathBias && e.pathBias.t > 0) e.pathBias.t -= dt;
    if(e.stateTimer > 0) e.stateTimer -= dt;

    if(e.state === 'spawning'){
      e.anim = 'appear';
      if(e.stateTimer <= 0) e.state = 'idle';
      animate(e, dt);
      continue;
    }

    const target = e.targetMode === 'player' && p ? p : c;
    let dx = target.x - e.x, dy = target.y - e.y;
    const len = Math.hypot(dx,dy)||1;
    dx/=len; dy/=len;

    const oldX = e.x, oldY = e.y;
    if(e.pathBias && e.pathBias.t > 0){
      dx = dx*.72 + e.pathBias.x*.28;
      dy = dy*.72 + e.pathBias.y*.28;
      const n2 = Math.hypot(dx,dy)||1;
      dx/=n2; dy/=n2;
    }
    e.x += dx * e.speed * dt;
    e.y += dy * e.speed * dt;
    e.x = clamp(e.x, game.world.left-80, game.world.right+80);
    e.y = clamp(e.y, game.world.top-80, game.world.bottom+80);
    if(e.character !== 'hover_drone') resolveWalls(e);
    const moved = Math.hypot(e.x-oldX, e.y-oldY);
    if(e.character !== 'hover_drone' && moved < 4*dt && distance(e, game.core) > 120){
      e.stuckTimer = (e.stuckTimer || 0) + dt;
      if(e.stuckTimer > .35){
        const side = Math.random() < .5 ? -1 : 1;
        e.pathBias = {x:-dy*side, y:dx*side, t:.9};
        e.stuckTimer = 0;
      }
    } else {
      e.stuckTimer = 0;
    }

    if(Math.abs(dx) > Math.abs(dy)) e.facing = dx > 0 ? 'right' : 'left';
    else e.facing = dy < 0 ? 'back' : 'front';

    if(e.facing === 'left') e.anim = 'left_idle';
    else if(e.facing === 'right') e.anim = 'right_idle';
    else if(e.facing === 'back') e.anim = 'back_idle';
    else e.anim = 'front_idle';

    if(distance(e,c) < e.radius + c.r - 2 && e.attackCd <= 0){
      c.hp -= e.coreDamage;
      c.hitFlash = .28;
      c.underAttack = 1.4;
      addFloatingText(c.x, c.y - 78, `CORE -${e.coreDamage}`, '#ef4444', 20);
      sfx('core');
      addHitFreeze(.04);
      e.attackCd = .9;
      burst(c.x, c.y, 16, '#ef4444', 1.6);
      luminousLine(c.x-70, c.y-10, c.x+70, c.y+10, '#ef4444', .16, 5);
      luminousLine(c.x+40, c.y-60, c.x-40, c.y+60, '#ef4444', .14, 4);
      screenShake(1.2);
      if(c.hp <= 0){
        c.hp = 0;
        endRun(false, 'Le noyau cyan a été détruit.');
      }
    }

    if(p && distance(e,p) < e.radius + p.radius - 5 && e.contactCd <= 0 && p.invuln <= 0){
      p.hp -= e.playerDamage;
      p.flash = .24;
      addFloatingText(p.x, p.y - p.radius - 34, `-${e.playerDamage}`, '#fecaca', 20);
      addHitFreeze(.04);
      p.invuln = .35;
      e.contactCd = .7;
      burst(p.x, p.y, 12, '#ef4444', 1.45);
      luminousLine(p.x-42, p.y-20, p.x+42, p.y+20, '#ef4444', .12, 4);
      screenShake(.85);
      if(p.hp <= 0){
        p.hp = 0;
        lockAnim(p, 'die', .75, 'dead');
        endRun(false, 'Ton robot a été détruit.');
      }
    }

    if(e.boss){
      e.bossTimer = (e.bossTimer || 0) - dt;
      if(e.bossTimer <= 0){
        e.bossTimer = 2.6;
        const dirx = (game.core.x - e.x);
        const diry = (game.core.y - e.y);
        const n = Math.hypot(dirx,diry)||1;
        const vx = dirx/n, vy = diry/n;
        game.effects.push({
          type:'enemyWave',
          x:e.x+vx*50,
          y:e.y+vy*50,
          vx:vx*360,
          vy:vy*360,
          dir:{x:vx,y:vy},
          length:250,
          width:42,
          travelled:0,
          life:.7,
          ttl:.7,
          damage:18,
          hitPlayer:false,
          hitCore:false
        });
        luminousLine(e.x, e.y, e.x+vx*250, e.y+vy*250, '#ef4444', .2, 5);
        burst(e.x, e.y, 10, '#ef4444', 1.3);
        sfx('boss');
      }
    }

    animate(e, dt);
  }
  game.enemies = game.enemies.filter(e=>!e.dead);
}

function damageEnemy(e, amount){
  if(e.dead || e.state === 'spawning') return false;
  e.hp -= amount;
  e.flash = .18;
  e.hitStop = .055;
  addFloatingText(e.x, e.y - e.radius - 18, `-${amount}`, e.boss ? '#fbbf24' : '#bff8ff', e.boss ? 24 : 18);
  addHitFreeze(e.boss ? .055 : .032);
  sfx(e.boss ? 'boss' : 'hit');
  hitSpark(e.x, e.y - e.radius*.25, '#bff8ff');
  if(e.hp <= 0){
    e.dead = true;
    game.player.kills++;
    const gain = Math.round((e.boss ? 900 : (e.elite ? 140 : 55)) * DIFFICULTY[game.difficultyKey].score);
    game.score += gain;
    burst(e.x, e.y, e.elite ? 26 : 16, '#58dbe6', e.elite ? 2.2 : 1.6);
    game.effects.push({type:'death',x:e.x,y:e.y,r:e.radius*1.5,life:.35,ttl:.35});
  }
  return true;
}

function updateProjectiles(dt){
  for(const pr of game.projectiles){
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;

    for(const w of game.walls){
      if(pr.x > w.x-w.w/2 && pr.x < w.x+w.w/2 && pr.y > w.y-w.h/2 && pr.y < w.y+w.h/2){
        pr.life = -1;
        break;
      }
    }
    if(pr.life <= 0) continue;

    for(const e of game.enemies){
      if(e.dead || e.state === 'spawning') continue;
      if(Math.hypot(pr.x-e.x, pr.y-e.y) <= pr.r + e.radius){
        damageEnemy(e, pr.damage);
        if(pr.owner === 'drone' && game.player?.droneSlow > 0){
          e.slowTimer = .85;
          e.slowFactor = 1 - game.player.droneSlow;
        }
        pr.life = -1;
        break;
      }
    }
  }
  game.projectiles = game.projectiles.filter(p=>p.life>0 && p.x>game.world.left-140 && p.x<game.world.right+140 && p.y>game.world.top-140 && p.y<game.world.bottom+140);
}

function updateEffects(dt){
  for(const fx of game.effects){
    fx.life -= dt;

    if(fx.type === 'enemyWave'){
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.travelled += Math.hypot(fx.vx*dt, fx.vy*dt);
      const p = game.player;
      const c = game.core;
      if(p && !fx.hitPlayer){
        const px = p.x - fx.x, py = p.y - fx.y;
        const forward = px*fx.dir.x + py*fx.dir.y;
        const side = Math.abs(px*(-fx.dir.y) + py*fx.dir.x);
        if(forward > -32 && forward < 80 && side < fx.width + p.radius && p.invuln <= 0){
          fx.hitPlayer = true;
          p.hp -= fx.damage;
          p.flash = .28;
          p.invuln = .35;
          addFloatingText(p.x,p.y-p.radius-36,`-${fx.damage}`,'#fecaca',22);
          sfx('core');
          screenShake(1.1);
          if(p.hp <= 0){ p.hp = 0; endRun(false, 'Ton robot a été détruit par le boss.'); }
        }
      }
      if(c && !fx.hitCore){
        const cx = c.x - fx.x, cy = c.y - fx.y;
        const forward = cx*fx.dir.x + cy*fx.dir.y;
        const side = Math.abs(cx*(-fx.dir.y) + cy*fx.dir.x);
        if(forward > -40 && forward < 90 && side < fx.width + c.r){
          fx.hitCore = true;
          c.hp -= fx.damage;
          c.underAttack = 1.4;
          c.hitFlash = .3;
          addFloatingText(c.x,c.y-78,`CORE -${fx.damage}`,'#ef4444',20);
          sfx('core');
          screenShake(1.15);
          if(c.hp <= 0){ c.hp = 0; endRun(false, 'Le noyau a été détruit par le boss.'); }
        }
      }
      if(fx.travelled > fx.length) fx.life = -1;
    }

    if(fx.type === 'corePulse'){
      const progress = 1 - fx.life / fx.ttl;
      const radius = 40 + (fx.maxR - 40) * progress;
      fx.r = radius;
      for(const e of game.enemies){
        if(e.dead || e.state === 'spawning' || fx.hit.has(e)) continue;
        if(Math.hypot(e.x-fx.x, e.y-fx.y) <= radius + e.radius){
          fx.hit.add(e);
          damageEnemy(e, fx.damage);
          const dx = e.x - fx.x, dy = e.y - fx.y;
          const n = Math.hypot(dx,dy)||1;
          e.x += dx/n * 36;
          e.y += dy/n * 36;
        }
      }
    }

    if(fx.type === 'energyWave'){
      const move = fx.ttl > 0 ? fx.vx * dt : 0;
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.travelled += Math.hypot(fx.vx*dt, fx.vy*dt);

      for(const e of game.enemies){
        if(e.dead || e.state === 'spawning' || fx.hit.has(e)) continue;
        const px = e.x - fx.x;
        const py = e.y - fx.y;
        const forward = px*fx.dir.x + py*fx.dir.y;
        const side = Math.abs(px*(-fx.dir.y) + py*fx.dir.x);
        if(forward > -28 && forward < 70 && side < fx.width + e.radius){
          fx.hit.add(e);
          damageEnemy(e, fx.damage);
        }
      }

      if(fx.travelled > fx.length) fx.life = -1;
    }

    if(fx.type === 'melee'){
      for(const e of game.enemies){
        if(e.dead || e.state === 'spawning' || fx.hit.has(e)) continue;
        if(Math.hypot(e.x-fx.x, e.y-fx.y) <= e.radius + fx.r){
          fx.hit.add(e);
          damageEnemy(e, fx.damage);
        }
      }
    }
  }
  game.effects = game.effects.filter(fx=>fx.life>0);
}




function ensureAudio(){
  if(game.muted) return null;
  if(!game.audioCtx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    game.audioCtx = new AC();
  }
  if(game.audioCtx.state === 'suspended') game.audioCtx.resume();
  return game.audioCtx;
}

function playTone(freq=220, duration=.08, type='sine', gain=.045, slide=0){
  const ac = ensureAudio();
  if(!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if(slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq+slide), now+duration);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now+.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now+duration);
  osc.connect(g).connect(ac.destination);
  osc.start(now);
  osc.stop(now+duration+.02);
}

function sfx(kind){
  if(kind === 'attack'){ playTone(160,.08,'sawtooth',.035,180); playTone(520,.11,'triangle',.025,-140); }
  else if(kind === 'hit'){ playTone(95,.06,'square',.035,70); }
  else if(kind === 'core'){ playTone(70,.15,'sawtooth',.05,40); }
  else if(kind === 'upgrade'){ playTone(420,.08,'triangle',.035,160); setTimeout(()=>playTone(640,.09,'triangle',.03,120),65); }
  else if(kind === 'shoot'){ playTone(720,.045,'triangle',.018,-110); }
  else if(kind === 'boss'){ playTone(55,.25,'sawtooth',.055,35); playTone(110,.25,'square',.025,-30); }
  else if(kind === 'win'){ playTone(420,.11,'triangle',.03,120); setTimeout(()=>playTone(620,.11,'triangle',.03,120),110); setTimeout(()=>playTone(840,.16,'triangle',.035,160),220); }
  else if(kind === 'lose'){ playTone(220,.18,'sawtooth',.045,-80); setTimeout(()=>playTone(130,.28,'sawtooth',.045,-40),120); }
}

function addFloatingText(x,y,text,color='#ffffff',size=18){
  game.floatingTexts.push({x,y,text,color,size,life:.78,ttl:.78,vy:-36});
}

function addHitFreeze(duration=.035){
  game.hitFreeze = Math.max(game.hitFreeze || 0, duration);
}

function screenShake(amount){
  game.shake = Math.max(game.shake || 0, amount);
}

function luminousLine(x1,y1,x2,y2,color='#58dbe6',life=.22,width=3){
  game.effects.push({
    type:'line',
    x1,y1,x2,y2,
    color,
    life,
    ttl:life,
    width
  });
}

function hitSpark(x,y,color='#bff8ff'){
  for(let i=0;i<5;i++){
    const a = rand(0, Math.PI*2);
    const len = rand(20,56);
    luminousLine(x, y, x + Math.cos(a)*len, y + Math.sin(a)*len, color, rand(.10,.18), rand(2,5));
  }
  burst(x, y, 12, color, 1.7);
  screenShake(.9);
}

function burst(x,y,count,color,power=1){
  for(let i=0;i<count;i++){
    const a = rand(0, Math.PI*2);
    const sp = rand(45,140) * power;
    const ttl = rand(.28,.65);
    game.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:rand(2,5),life:ttl,ttl,color});
  }
}

function updateFloatingTexts(dt){
  for(const ft of game.floatingTexts){
    ft.y += ft.vy * dt;
    ft.life -= dt;
  }
  game.floatingTexts = game.floatingTexts.filter(ft => ft.life > 0);
}

function updateParticles(dt){
  for(const p of game.particles){
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= .97;
    p.vy *= .97;
    p.life -= dt;
  }
  game.particles = game.particles.filter(p=>p.life>0);
}

function spawnTick(dt){
  if(game.mode !== 'playing' || game.spawnQueue.length === 0) return;
  game.spawnTimer -= dt;
  if(game.spawnTimer <= 0){
    const next = game.spawnQueue.shift();
    game.enemies.push(makeEnemy(next.type, next.elite));
    game.spawnTimer = Math.max(.34, .72 - game.waveIndex*.06);
  }
}

function waveClearCheck(){
  if(game.mode !== 'playing') return;
  if(game.spawnQueue.length === 0 && game.enemies.length === 0){
    if(game.waveIndex >= WAVE_CONFIG.length - 1) endRun(true);
    else openUpgradeChoice();
  }
}

function animate(e, dt){
  const frames = assets[e.character]?.[e.color]?.[e.anim] || assets[e.character]?.[e.color]?.front_idle;
  if(!frames || !frames.length) return;
  const fps = e.anim === 'appear' ? 10 : e.anim === 'die' ? 7 : e.anim === 'front_attack' ? 11 : 7;
  e.animClock += dt;
  if(e.animClock >= 1/fps){
    e.animClock = 0;
    if(e.state === 'spawning' && e.animFrame >= frames.length - 1) return;
    e.animFrame = (e.animFrame + 1) % frames.length;
  }
}

function updateCamera(dt){
  const target = game.player || game.core || {x:0,y:0};
  game.camera.x += (target.x - game.camera.x) * Math.min(1, dt*5.5);
  game.camera.y += (target.y - game.camera.y) * Math.min(1, dt*5.5);
  const halfW = canvas.width/2, halfH = canvas.height/2;
  game.camera.x = clamp(game.camera.x, game.world.left + halfW, game.world.right - halfW);
  game.camera.y = clamp(game.camera.y, game.world.top + halfH, game.world.bottom - halfH);
  const s = game.shake || 0;
  game.shakeX = s > 0 ? rand(-s*7, s*7) : 0;
  game.shakeY = s > 0 ? rand(-s*7, s*7) : 0;
}

function worldToScreen(x,y){
  return { x: x - game.camera.x + canvas.width/2, y: y - game.camera.y + canvas.height/2 };
}

function withWorld(fn){
  ctx.save();
  ctx.translate(canvas.width/2 - game.camera.x + (game.shakeX || 0), canvas.height/2 - game.camera.y + (game.shakeY || 0));
  fn();
  ctx.restore();
}

function drawBg(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#07101d';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  withWorld(()=>{
    for(const s of stars){
      ctx.fillStyle = `rgba(255,255,255,${s.a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(88,219,230,.075)';
    ctx.lineWidth = 1;
    for(let x=game.world.left; x<=game.world.right; x+=64){
      ctx.beginPath(); ctx.moveTo(x, game.world.top); ctx.lineTo(x, game.world.bottom); ctx.stroke();
    }
    for(let y=game.world.top; y<=game.world.bottom; y+=64){
      ctx.beginPath(); ctx.moveTo(game.world.left, y); ctx.lineTo(game.world.right, y); ctx.stroke();
    }

    const phase = (game.time * 90) % 256;
    ctx.strokeStyle = 'rgba(88,219,230,.16)';
    ctx.lineWidth = 2;
    for(let y=game.world.top + phase; y<=game.world.bottom; y+=256){
      ctx.beginPath();
      ctx.moveTo(game.world.left, y);
      ctx.lineTo(game.world.right, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(125,211,252,.10)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(game.world.left, 0);
    ctx.lineTo(game.world.right, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, game.world.top);
    ctx.lineTo(0, game.world.bottom);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(88,219,230,.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(game.world.left, game.world.top, game.world.right-game.world.left, game.world.bottom-game.world.top);
    ctx.restore();
  });

  const wave = WAVE_CONFIG[Math.max(0, game.waveIndex)]?.title || 'Menu';
  ctx.fillStyle = 'rgba(255,255,255,.86)';
  ctx.font = '800 16px Inter, Arial';
  ctx.fillText(`COREBOTS V4 // ${wave.toUpperCase()}`, 24, 34);
}

function drawWalls(){
  withWorld(()=>{
    for(const w of game.walls){
      const grd = ctx.createLinearGradient(w.x-w.w/2, w.y-w.h/2, w.x+w.w/2, w.y+w.h/2);
      grd.addColorStop(0, 'rgba(88,219,230,.20)');
      grd.addColorStop(1, 'rgba(30,41,59,.95)');
      ctx.fillStyle = grd;
      ctx.strokeStyle = 'rgba(125,211,252,.38)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(w.x-w.w/2, w.y-w.h/2, w.w, w.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(w.x-w.w/2+8, w.y-w.h/2+8, Math.max(10,w.w-16), 3);
      ctx.strokeStyle = 'rgba(88,219,230,.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w.x-w.w/2+10, w.y);
      ctx.lineTo(w.x+w.w/2-10, w.y);
      ctx.stroke();
    }
  });
}

function drawCore(){
  const c = game.core;
  if(!c) return;
  withWorld(()=>{
    const hpRatio = c.hp / c.maxHp;
    const pulse = 1 + Math.sin(c.pulse*4) * .04;
    ctx.save();
    ctx.translate(c.x,c.y);

    ctx.globalAlpha = .16 + Math.sin(c.pulse*3)*.04;
    ctx.fillStyle = '#58dbe6';
    ctx.beginPath(); ctx.arc(0,0,c.r*2.3*pulse,0,Math.PI*2); ctx.fill();

    ctx.globalAlpha = .65;
    ctx.strokeStyle = c.hitFlash > 0 ? '#ef4444' : '#58dbe6';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0,0,c.r*1.35,0,Math.PI*2); ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = c.hitFlash > 0 ? '#fecaca' : '#bff8ff';
    ctx.beginPath(); ctx.arc(0,0,c.r*.72*pulse,0,Math.PI*2); ctx.fill();

    ctx.fillStyle = '#0b1020';
    ctx.beginPath(); ctx.arc(0,0,c.r*.38,0,Math.PI*2); ctx.fill();

    ctx.strokeStyle = '#58dbe6';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0,0,c.r*.92, -Math.PI/2, -Math.PI/2 + Math.PI*2*hpRatio); ctx.stroke();
    ctx.restore();

    drawBarWorld(c.x-82, c.y+c.r+18, 164, 10, hpRatio, hpRatio < .35 ? '#ef4444' : '#58dbe6');
    if(hpRatio < .32){
      ctx.globalAlpha = .25 + Math.sin(game.time*10)*.18;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(c.x,c.y,c.r*1.75,0,Math.PI*2);
      ctx.stroke();
    }
  });
}

function drawBarWorld(x,y,w,h,ratio,color,bg='rgba(255,255,255,.14)'){
  ctx.fillStyle = bg; ctx.fillRect(x,y,w,h);
  ctx.fillStyle = color; ctx.fillRect(x,y,w*clamp(ratio,0,1),h);
}

function drawBar(x,y,w,h,ratio,color,bg='rgba(255,255,255,.14)'){
  ctx.fillStyle = bg; ctx.fillRect(x,y,w,h);
  ctx.fillStyle = color; ctx.fillRect(x,y,w*clamp(ratio,0,1),h);
}

function drawEntity(e){
  const frames = assets[e.character]?.[e.color]?.[e.anim];
  if(!frames || !frames.length) return;
  const img = frames[Math.min(e.animFrame, frames.length-1)];
  const meta = SPRITES[e.character];
  const scale = e.boss ? 1.48 : (e.elite ? 1.13 : 1);
  const w = meta.cellWidth * scale;
  const h = meta.cellHeight * scale;
  const hitJitter = e.flash > 0 ? rand(-3,3) : 0;

  if(e.flash > 0){
    ctx.save();
    ctx.globalAlpha = .32;
    ctx.fillStyle = e.kind === 'enemy' ? '#fecaca' : '#ffffff';
    ctx.shadowBlur = 24;
    ctx.shadowColor = e.kind === 'enemy' ? '#ef4444' : '#58dbe6';
    ctx.beginPath();
    ctx.arc(e.x, e.y-h*.08, e.radius+24, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  ctx.drawImage(img, e.x-w/2 + hitJitter, e.y-h/2, w, h);

  if(e.flash > 0){
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(.55, e.flash * 3.2);
    ctx.drawImage(img, e.x-w/2 + hitJitter, e.y-h/2, w, h);
    ctx.restore();
  }

  const bw = e.kind === 'player' ? 132 : (e.boss ? 150 : (e.elite ? 90 : 70));
  const by = e.y - h/2 - 16;
  drawBarWorld(e.x-bw/2, by, bw, 8, e.hp/e.maxHp, e.kind === 'player' ? '#5eead4' : '#f87171');

  if(e.kind === 'player' && e.dashCd > 0){
    drawBarWorld(e.x-bw/2, by+11, bw, 4, 1 - e.dashCd/e.dashCooldown, '#f6c451', 'rgba(255,255,255,.10)');
  }
}

function drawCompanionDrones(){
  const p = game.player;
  if(!p || p.companionDrones <= 0) return;
  withWorld(()=>{
    const frames = assets.hover_drone?.blue?.front_idle;
    if(!frames) return;
    const img = frames[((game.time*8)|0) % frames.length];
    const meta = SPRITES.hover_drone;
    const scale = .55;
    for(let i=0;i<p.companionDrones;i++){
      const pos = companionDronePosition(i,p.companionDrones);
      ctx.drawImage(img, pos.x-meta.cellWidth*scale/2, pos.y-meta.cellHeight*scale/2, meta.cellWidth*scale, meta.cellHeight*scale);
    }
  });
}

function drawProjectiles(){
  withWorld(()=>{
    for(const p of game.projectiles){
      ctx.save();
      const color = p.color || '#58dbe6';
      const speed = Math.hypot(p.vx,p.vy) || 1;
      const tx = p.x - (p.vx/speed) * 24;
      const ty = p.y - (p.vy/speed) * 24;

      ctx.globalAlpha = .55;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 14;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  });
}

function drawEffects(){
  withWorld(()=>{
    for(const fx of game.effects){
      const t = Math.max(0, fx.life / fx.ttl);
      ctx.save();

      if(fx.type === 'line'){
        ctx.globalAlpha = t;
        ctx.strokeStyle = fx.color || '#58dbe6';
        ctx.lineWidth = (fx.width || 3) * (0.6 + t*.7);
        ctx.shadowBlur = 18;
        ctx.shadowColor = fx.color || '#58dbe6';
        ctx.beginPath();
        ctx.moveTo(fx.x1, fx.y1);
        ctx.lineTo(fx.x2, fx.y2);
        ctx.stroke();
      } else if(fx.type === 'melee'){
        ctx.globalAlpha = .12 + (1-t)*.35;
        ctx.strokeStyle = '#58dbe6';
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#58dbe6';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(fx.x,fx.y,fx.r*(1.1-t*.2),0,Math.PI*2);
        ctx.stroke();
      } else if(fx.type === 'enemyWave'){
        const angle = Math.atan2(fx.dir.y, fx.dir.x);
        ctx.save();
        ctx.translate(fx.x, fx.y);
        ctx.rotate(angle);
        ctx.globalCompositeOperation = 'screen';
        const grad = ctx.createRadialGradient(0,0,4,0,0,fx.width*1.9);
        grad.addColorStop(0, `rgba(254,202,202,${0.25*t})`);
        grad.addColorStop(.48, `rgba(239,68,68,${0.18*t})`);
        grad.addColorStop(1, 'rgba(239,68,68,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, 72 + (1-t)*26, fx.width*1.05, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = .36*t;
        ctx.strokeStyle = '#fecaca';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 9]);
        ctx.lineDashOffset = game.time * 55;
        ctx.beginPath();
        ctx.ellipse(0, 0, 82 + (1-t)*30, fx.width*1.22, 0, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      } else if(fx.type === 'corePulse'){
        ctx.globalAlpha = .36*t;
        ctx.strokeStyle = '#58dbe6';
        ctx.shadowBlur = 22;
        ctx.shadowColor = '#58dbe6';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.r || 60, 0, Math.PI*2);
        ctx.stroke();
      } else if(fx.type === 'energyWave'){
        const angle = Math.atan2(fx.dir.y, fx.dir.x);

        // Transparent distortion bubble.
        ctx.save();
        ctx.translate(fx.x, fx.y);
        ctx.rotate(angle);
        ctx.globalCompositeOperation = 'screen';

        const grad = ctx.createRadialGradient(0,0,4,0,0,fx.width*1.9);
        grad.addColorStop(0, `rgba(190,248,255,${0.28*t})`);
        grad.addColorStop(.42, `rgba(88,219,230,${0.16*t})`);
        grad.addColorStop(1, 'rgba(88,219,230,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, 72 + (1-t)*26, fx.width*1.05, 0, 0, Math.PI*2);
        ctx.fill();

        // Refractive transparent outline.
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = .38*t;
        ctx.strokeStyle = '#e6fdff';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 9]);
        ctx.lineDashOffset = -game.time * 55;
        ctx.beginPath();
        ctx.ellipse(0, 0, 82 + (1-t)*30, fx.width*1.22, 0, 0, Math.PI*2);
        ctx.stroke();

        // Inner luminous cuts.
        ctx.setLineDash([]);
        ctx.globalAlpha = .26*t;
        ctx.lineWidth = 3;
        for(let i=-1;i<=1;i++){
          ctx.beginPath();
          ctx.moveTo(-62, i*fx.width*.34);
          ctx.lineTo(84, i*fx.width*.18);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        ctx.globalAlpha = t*.5;
        ctx.fillStyle = '#58dbe6';
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#58dbe6';
        ctx.beginPath();
        ctx.arc(fx.x,fx.y,fx.r*(1.2-t*.2),0,Math.PI*2);
        ctx.fill();
      }

      ctx.restore();
    }
  });
}

function drawFloatingTexts(){
  withWorld(()=>{
    for(const ft of game.floatingTexts){
      ctx.save();
      const t = ft.life / ft.ttl;
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = ft.color;
      ctx.font = `900 ${ft.size}px Inter, Arial`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  });
}

function drawParticles(){
  withWorld(()=>{
    for(const p of game.particles){
      ctx.save();
      ctx.globalAlpha = clamp(p.life/p.ttl,0,1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  });
}

function drawPlayerRange(){
  const p = game.player;
  if(!p) return;
  withWorld(()=>{
    const v = p.lastAim || facingVector(p.facing);
    ctx.save();
    ctx.globalAlpha = .08;
    ctx.strokeStyle = '#58dbe6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x + v.x*p.waveRange*.48, p.y + v.y*p.waveRange*.48, p.waveRange*.5, p.waveWidth, Math.atan2(v.y,v.x), 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  });
}


function updateWindowReadout(){
  const c = game.core;
  const p = game.player;
  const threats = game.enemies.length + game.spawnQueue.length;
  if(ui.windowSubtitle){
    if(game.mode === 'menu') ui.windowSubtitle.textContent = 'HUB / préparation';
    else if(game.mode === 'between') ui.windowSubtitle.textContent = 'INTER-VAGUE / choix module';
    else if(game.mode === 'paused') ui.windowSubtitle.textContent = 'PAUSE / protocole suspendu';
    else if(game.mode === 'victory') ui.windowSubtitle.textContent = 'VICTOIRE / noyau sécurisé';
    else if(game.mode === 'gameover') ui.windowSubtitle.textContent = 'ÉCHEC / protocole rompu';
    else ui.windowSubtitle.textContent = `RUN / ${COLOR_LABELS[p?.color || 'original']} / ${DIFFICULTY[game.difficultyKey].label}`;
  }
  if(ui.windowCoreReadout){
    const ratio = c ? Math.max(0, Math.round((c.hp/c.maxHp)*100)) : '--';
    ui.windowCoreReadout.textContent = `CORE ${ratio}%`;
  }
  if(ui.windowThreatReadout){
    ui.windowThreatReadout.textContent = `THREATS ${threats}`;
  }
}


function isOnScreenWorld(x,y,margin=24){
  const s = worldToScreen(x,y);
  return s.x > -margin && s.x < canvas.width + margin && s.y > -margin && s.y < canvas.height + margin;
}

function drawOffscreenIndicators(){
  if(!game.player || game.mode === 'menu') return;

  const targets = [];
  for(const e of game.enemies){
    if(e.dead || isOnScreenWorld(e.x,e.y,30)) continue;
    targets.push({x:e.x,y:e.y,color:e.boss ? '#fbbf24' : '#ef4444', label:e.boss ? 'BOSS' : '!'});
  }
  if(game.core && !isOnScreenWorld(game.core.x,game.core.y,60)){
    targets.push({x:game.core.x,y:game.core.y,color:'#58dbe6', label:'CORE'});
  }

  for(const t of targets.slice(0,10)){
    const sx = t.x - game.camera.x + canvas.width/2;
    const sy = t.y - game.camera.y + canvas.height/2;
    const cx = canvas.width/2, cy = canvas.height/2;
    const dx = sx - cx, dy = sy - cy;
    const a = Math.atan2(dy, dx);
    const x = clamp(cx + Math.cos(a)*(canvas.width/2-34), 28, canvas.width-28);
    const y = clamp(cy + Math.sin(a)*(canvas.height/2-34), 28, canvas.height-28);

    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(a);
    ctx.fillStyle = t.color;
    ctx.shadowBlur = 14;
    ctx.shadowColor = t.color;
    ctx.beginPath();
    ctx.moveTo(16,0);
    ctx.lineTo(-10,-9);
    ctx.lineTo(-6,0);
    ctx.lineTo(-10,9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = t.color;
    ctx.font = '900 12px Inter, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(t.label, x, y-14);
    ctx.restore();
  }

  if(game.core && game.core.underAttack > 0){
    ctx.save();
    ctx.globalAlpha = Math.min(1, game.core.underAttack);
    ctx.fillStyle = 'rgba(239,68,68,.14)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fecaca';
    ctx.font = '900 22px Inter, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CORE UNDER ATTACK', canvas.width/2, 68);
    ctx.restore();
  }
}


function drawMinimap(){
  if(!ui.minimap) return;
  const m = ui.minimap;
  const mctx = m.getContext('2d');
  const w = m.width, h = m.height;
  mctx.clearRect(0,0,w,h);
  mctx.fillStyle = 'rgba(5,12,22,.92)';
  mctx.fillRect(0,0,w,h);

  const sx = w / (game.world.right - game.world.left);
  const sy = h / (game.world.bottom - game.world.top);
  const mapX = x => (x - game.world.left) * sx;
  const mapY = y => (y - game.world.top) * sy;

  mctx.strokeStyle = 'rgba(88,219,230,.35)';
  mctx.strokeRect(1,1,w-2,h-2);

  for(const wall of game.walls || []){
    mctx.fillStyle = 'rgba(125,211,252,.22)';
    mctx.fillRect(mapX(wall.x-wall.w/2), mapY(wall.y-wall.h/2), wall.w*sx, wall.h*sy);
  }

  if(game.core){
    mctx.fillStyle = game.core.underAttack > 0 ? '#ef4444' : '#58dbe6';
    mctx.beginPath();
    mctx.arc(mapX(game.core.x), mapY(game.core.y), 5, 0, Math.PI*2);
    mctx.fill();
  }

  for(const e of game.enemies || []){
    if(e.dead) continue;
    mctx.fillStyle = e.boss ? '#fbbf24' : '#ef4444';
    mctx.beginPath();
    mctx.arc(mapX(e.x), mapY(e.y), e.boss ? 4.5 : 2.5, 0, Math.PI*2);
    mctx.fill();
  }

  if(game.player){
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.arc(mapX(game.player.x), mapY(game.player.y), 4, 0, Math.PI*2);
    mctx.fill();

    const camL = game.camera.x - canvas.width/2;
    const camT = game.camera.y - canvas.height/2;
    mctx.strokeStyle = 'rgba(255,255,255,.25)';
    mctx.strokeRect(mapX(camL), mapY(camT), canvas.width*sx, canvas.height*sy);
  }
}

function updateHud(){
  const p = game.player, c = game.core;
  ui.waveLabel.textContent = game.waveIndex >= 0 ? `${game.waveIndex+1} / ${WAVE_CONFIG.length}` : '-';
  ui.enemiesLabel.textContent = `${game.enemies.length + game.spawnQueue.length}`;
  ui.coreLabel.textContent = c ? `${Math.ceil(c.hp)} / ${c.maxHp}` : '-';
  ui.robotLabel.textContent = p ? `${SPRITES[p.character].displayName} + ${p.companionDrones} drone(s)` : '-';
  ui.colorLabel.textContent = p ? COLOR_LABELS[p.color] : '-';
  ui.damageLabel.textContent = p ? `${p.damage}` : '-';
  ui.speedLabel.textContent = p ? `${p.speed}` : '-';
  ui.scoreLabel.textContent = `${game.score}`;
  if(ui.bestScoreLabel) ui.bestScoreLabel.textContent = `${game.bestScore}`;
  drawMinimap();
  updateWindowReadout();
}

function update(dt){
  syncSelection();
  if(keys.pressed.has('KeyP')) setPaused(game.mode !== 'paused');

  if(game.hitFreeze > 0){
    game.hitFreeze = Math.max(0, game.hitFreeze - dt);
    dt *= .18;
  }
  if(game.mode === 'playing'){
    game.time += dt;
    updateCore(dt);
    updatePlayer(dt);
    spawnTick(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateEffects(dt);
    updateParticles(dt);
    updateFloatingTexts(dt);
    waveClearCheck();
  } else if(game.mode === 'between' || game.mode === 'gameover' || game.mode === 'victory'){
    game.time += dt;
    updateCore(dt);
    updatePlayer(dt);
    updateParticles(dt);
    updateFloatingTexts(dt);
  }
  game.shake = Math.max(0, (game.shake || 0) - dt * 4.2);
  updateCamera(dt);
}

function render(){
  drawBg();
  drawWalls();
  drawCore();
  drawPlayerRange();
  drawEffects();
  drawProjectiles();
  drawParticles();
  drawFloatingTexts();
  drawOffscreenIndicators();

  withWorld(()=>{
    const drawables = [...game.enemies];
    if(game.player) drawables.push(game.player);
    drawables.sort((a,b)=>a.y-b.y);
    for(const e of drawables) drawEntity(e);
  });
  drawCompanionDrones();
  updateHud();
}

function loop(now){
  const dt = Math.min(.033, (now - game.lastTime)/1000 || .016);
  game.lastTime = now;
  update(dt);
  render();
  keys.pressed.clear();
  requestAnimationFrame(loop);
}


if(ui.starterModuleGrid){
  ui.starterModuleGrid.querySelectorAll('.starter-card').forEach(btn => {
    btn.addEventListener('click', () => setStarterModule(btn.dataset.module));
  });
  setStarterModule(game.starterModule);
}

ui.startBtn.addEventListener('click', resetRun);
ui.menuStartBtn.addEventListener('click', resetRun);
ui.replayBtn.addEventListener('click', resetRun);
ui.backToMenuBtn.addEventListener('click', returnToMenu);
ui.pauseMenuBtn.addEventListener('click', returnToMenu);
ui.endMenuBtn.addEventListener('click', returnToMenu);
ui.pauseBtn.addEventListener('click', ()=>setPaused(game.mode !== 'paused'));
ui.resumeBtn.addEventListener('click', ()=>setPaused(false));

if(ui.muteBtn){
  ui.muteBtn.textContent = game.muted ? 'Son : OFF' : 'Son : ON';
  ui.muteBtn.addEventListener('click', ()=>{
    game.muted = !game.muted;
    localStorage.setItem('corebots_muted', game.muted ? '1' : '0');
    ui.muteBtn.textContent = game.muted ? 'Son : OFF' : 'Son : ON';
    if(!game.muted) sfx('upgrade');
  });
}



(async function boot(){
  await preloadAll();
  syncSelection();
  show(ui.menuOverlay);
  requestAnimationFrame((t)=>{ game.lastTime=t; loop(t); });
})();
