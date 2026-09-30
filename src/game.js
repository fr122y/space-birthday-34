const COMPANY = "Спецвузавтоматика";
const ASSET_ROOT = `${import.meta.env.BASE_URL}assets/`;
const LEVELS = [
  { name: "Пусковой комплекс", time: 134, boss: "Хранитель орбиты", color: "#46eaff" },
  { name: "Пояс астероидов", time: 138, boss: "Железный роевик", color: "#83f1bb" },
  { name: "Туманность связи", time: 142, boss: "Сигнальный фантом", color: "#cc8cff" },
  { name: "Тёмная сторона", time: 146, boss: "Собиратель гравитации", color: "#ff9d55" },
  { name: "Юбилейная орбита", time: 150, boss: "Командир комет", color: "#ffd348" },
];
const SPRITES = ["rocket.svg", "drone.svg", "scout.svg", "turret.svg", "asteroid.svg", "star.svg", "pickup-spread.svg", "pickup-rapid.svg", "pickup-shield.svg", "pickup-heal.svg", "pickup-laser.svg", "debuff-slow.svg", "debuff-jam.svg", "debuff-gravity.svg", ...LEVELS.map((_, i) => `boss-${i + 1}.svg`), ...LEVELS.map((_, i) => `bg-${i + 1}.svg`), "landing-scene.svg"];
const W = 480;
const H = 800;
const BOSS_HP = [44, 78, 100, 124, 148];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rand = (a, b) => a + Math.random() * (b - a);

export function initBirthdayGame(root) {
  if (!root) return;
  root.innerHTML = `
    <section class="birthday-game" aria-label="Космическая игра к 34-летию">
      <div class="game-frame">
        <canvas class="game-canvas" aria-label="Игровое поле" tabindex="0"></canvas>
        <div class="landing-screen">
          <div class="location-badge"><span class="location-pin">◆</span> РОСТОВ-НА-ДОНУ</div>
          <div class="landing-callout callout-left-top">БОЛЬШИЕ<br>ЦЕЛИ<span></span></div>
          <div class="landing-callout callout-left-bottom">ЛЮДИ<br>СОЗДАЮТ<br>БУДУЩЕЕ<span></span></div>
          <div class="landing-callout callout-right-top">ВМЕСТЕ<br>ДАЛЬШЕ<span></span></div>
          <div class="landing-callout callout-right-bottom">НАДЁЖНЫЕ<br>РЕШЕНИЯ<span></span></div>
          <div class="landing-headline">
            <p class="eyebrow">Курс — вперёд. Команда — вместе.</p>
            <h1>С ДНЁМ РОЖДЕНИЯ,<br><strong>${COMPANY}!</strong></h1>
            <div class="anniversary"><span class="laurel">✳</span><span>34 <small>ГОДА</small></span><span class="laurel">✳</span></div>
            <p class="landing-subtitle">34 года надёжных решений, сильной команды и движения вперёд.</p>
            <button class="play-button" type="button"><span>ИГРАТЬ</span><b>›</b></button>
            <p class="landing-hint">ПРОЙДИТЕ ПЯТЬ ОРБИТ И ВЕРНИТЕСЬ ГЕРОЕМ</p>
          </div>
          <div class="landing-bottom-brand">СПЕЦВУЗАВТОМАТИКА<i>34</i></div>
        </div>
        <div class="hud hidden" aria-live="polite">
          <div class="hud-top"><div class="hud-level"><span class="hud-kicker">ОРБИТА</span><strong class="level-number">01</strong><span class="level-name">Пусковой комплекс</span></div>
            <div class="hud-right"><div class="score-block"><span class="hud-kicker">СЧЁТ</span><strong class="score-value">000000</strong></div><button class="icon-button pause-button" aria-label="Пауза" title="Пауза">Ⅱ</button><button class="icon-button sound-button" aria-label="Выключить звук" title="Звук">♫</button></div>
          </div>
          <div class="hud-bottom"><div class="health-block"><span class="hud-kicker">КОРПУС</span><div class="health-pips"></div></div><div class="status-list"></div><div class="wave-block"><span class="hud-kicker">ДО ВСТРЕЧИ</span><div class="wave-bar"><i></i></div><b class="wave-countdown">02:14</b></div></div>
          <div class="boss-hud hidden"><div class="boss-title"><span>ЦЕЛЬ</span><strong></strong><em></em></div><div class="boss-track"><i></i></div></div>
          <div class="toast-message" aria-live="polite"></div>
        </div>
        <div class="screen-overlay hidden" role="dialog" aria-modal="true"></div>
        <div class="mobile-controls" aria-hidden="true"><div class="touch-ring"><span></span></div><div class="touch-label">ВЕДИТЕ КОРАБЛЬ</div></div>
      </div>
      <div class="game-footer"><span>«${COMPANY}» · 34 ГОДА</span><span class="footer-instructions">WASD / стрелки — полёт <i>·</i> выстрел автоматический <i>·</i> P — пауза</span><span class="best-score">ЛУЧШИЙ РЕЗУЛЬТАТ <b>000000</b></span></div>
    </section>`;

  const frame = root.querySelector(".game-frame");
  const canvas = root.querySelector("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const landing = root.querySelector(".landing-screen");
  const hud = root.querySelector(".hud");
  const overlay = root.querySelector(".screen-overlay");
  const pauseButton = root.querySelector(".pause-button");
  const soundButton = root.querySelector(".sound-button");
  const playButton = root.querySelector(".play-button");
  const healthPips = root.querySelector(".health-pips");
  const statusList = root.querySelector(".status-list");
  const testMode = new URLSearchParams(location.search).get("test") === "1";
  const images = Object.create(null);
  for (const file of SPRITES) { const img = new Image(); img.src = `${ASSET_ROOT}${file}`; images[file] = img; }
  let dpr = 1;
  let worldScale = 1;
  let worldX = 0;
  let worldY = 0;
  let state = "landing";
  let previous = 0;
  let elapsed = 0;
  let gameClock = 0;
  let levelIndex = 0;
  let score = 0;
  let best = 0;
  let audio = null;
  let muted = false;
  let boss = null;
  let transitionTimer = 0;
  let invulnFlash = 0;
  let toastUntil = 0;
  let bossWarn = 0;
  let fireTimer = 0;
  let spawnTimer = 1;
  let nextHealAt = 18;
  let player = newPlayer();
  let shots = [];
  let enemyShots = [];
  let enemies = [];
  let pickups = [];
  let particles = [];
  let fireworks = [];
  let keys = new Set();
  let pointer = { active: false, id: null, x: W / 2, y: H * 0.77, downX: W / 2, downY: H * 0.77, startX: 0, startY: 0 };
  let stars = Array.from({ length: 115 }, () => ({ x: rand(0, W), y: rand(0, H), z: rand(.2, 1), size: rand(.7, 2), phase: rand(0, Math.PI * 2) }));
  let bgOffset = 0;
  let ending = "";
  let lastShownSecond = -1;
  let bossesDefeated = 0;
  let launchAge = -1;

  try { best = Number(localStorage.getItem("spaceBirthday34Best") || 0) || 0; } catch { best = 0; }
  root.querySelector(".best-score b").textContent = formatScore(best);

  function newPlayer() { return { x: W / 2, y: H * .78, radius: 13, hp: 5, maxHp: 5, invuln: 0, spread: 0, rapid: 0, shield: 0, laser: 0, slow: 0, jam: 0, gravity: 0 }; }
  function resize() {
    const rect = frame.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    worldScale = Math.min(canvas.width / W, canvas.height / H);
    worldX = (canvas.width - W * worldScale) / 2;
    worldY = (canvas.height - H * worldScale) / 2;
    ctx.setTransform(dpr * worldScale, 0, 0, dpr * worldScale, dpr * worldX, dpr * worldY);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(frame); resize();
  function formatScore(n) { return String(Math.max(0, Math.floor(n))).padStart(6, "0"); }
  function level() { return LEVELS[levelIndex]; }
  function setMessage(text, duration = 2.5) { const el = root.querySelector(".toast-message"); el.textContent = text; el.classList.add("show"); toastUntil = elapsed + duration; }
  function sound(type = "shot") {
    if (muted) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain();
      const now = audio.currentTime;
      const specs = { shot: [600, 240, .045, "square"], hit: [150, 45, .22, "sawtooth"], pickup: [420, 920, .17, "sine"], boss: [90, 45, .48, "sawtooth"], launch: [180, 760, .65, "triangle"], win: [440, 880, .85, "triangle"], lose: [220, 80, .62, "sawtooth"], pause: [400, 320, .1, "sine"] }[type] || [500, 220, .06, "sine"];
      osc.type = specs[3]; osc.frequency.setValueAtTime(specs[0], now); osc.frequency.exponentialRampToValueAtTime(Math.max(35, specs[1]), now + specs[2]);
      gain.gain.setValueAtTime(.045, now); gain.gain.exponentialRampToValueAtTime(.001, now + specs[2]); osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + specs[2]);
    } catch { /* audio is an optional enhancement */ }
  }
  function renderHud() {
    root.querySelector(".level-number").textContent = String(levelIndex + 1).padStart(2, "0");
    root.querySelector(".level-name").textContent = level().name;
    root.querySelector(".score-value").textContent = formatScore(score);
    healthPips.innerHTML = Array.from({ length: player.maxHp }, (_, i) => `<i class="${i < player.hp ? "full" : ""}"></i>`).join("");
    const statusNames = [[player.spread, "РАЗБРОС"], [player.rapid, "СКОРОСТЬ"], [player.shield, "ЩИТ"], [player.laser, "ЛАЗЕР"], [player.slow, "ЗАМЕДЛЕНИЕ"], [player.jam, "СБОЙ ПРИЦЕЛА"], [player.gravity, "ГРАВИТАЦИЯ"]].filter(([time]) => time > 0);
    statusList.innerHTML = statusNames.map(([time, name]) => `<span class="status-chip ${name === "ЩИТ" || name === "РАЗБРОС" || name === "СКОРОСТЬ" || name === "ЛАЗЕР" ? "good" : "bad"}">${name}<b>${Math.ceil(time)}с</b></span>`).join("");
    const wave = root.querySelector(".wave-block");
    wave.classList.toggle("hidden", Boolean(boss));
    const remaining = Math.max(0, level().time - gameClock);
    root.querySelector(".wave-countdown").textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(Math.floor(remaining % 60)).padStart(2, "0")}`;
    root.querySelector(".wave-bar i").style.width = `${clamp(gameClock / level().time * 100, 0, 100)}%`;
    const bh = root.querySelector(".boss-hud");
    bh.classList.toggle("hidden", !boss);
    if (boss) {
      bh.querySelector(".boss-title strong").textContent = boss.name;
      bh.querySelector(".boss-title em").textContent = boss.phaseLabel || "";
      bh.querySelector(".boss-track i").style.width = `${Math.max(0, boss.hp / boss.maxHp * 100)}%`;
    }
  }
  function startGame(startAt = 0) {
    state = "playing"; ending = ""; launchAge = 0; bossesDefeated = startAt ? bossesDefeated : 0; levelIndex = clamp(startAt, 0, LEVELS.length - 1); score = 0; startLevel(levelIndex, true);
    landing.classList.add("launching"); setTimeout(() => { landing.classList.add("hidden"); landing.classList.remove("launching"); hud.classList.remove("hidden"); canvas.focus({ preventScroll: true }); setMessage(`ОРБИТА ${String(levelIndex + 1).padStart(2, "0")} · ${level().name.toUpperCase()}`, 3); }, 780);
    sound("launch");
  }
  function startLevel(index, fresh = false) {
    levelIndex = clamp(index, 0, LEVELS.length - 1); gameClock = 0; boss = null; bossWarn = 0; transitionTimer = 0; spawnTimer = .5; nextHealAt = 18; shots = []; enemyShots = []; enemies = []; pickups = []; player = fresh ? newPlayer() : { ...player, x: W / 2, y: H * .78, invuln: 2.4 };
    if (fresh) score = 0;
    renderHud();
  }
  function pause(show = true) {
    if (state === "paused") { state = "playing"; overlay.classList.add("hidden"); overlay.innerHTML = ""; previous = performance.now(); sound("pause"); return; }
    if (state !== "playing") return;
    state = "paused"; overlay.innerHTML = `<div class="dialog-card"><span class="dialog-kicker">ПОЛЁТ ПРИОСТАНОВЛЕН</span><h2>Пауза</h2><p>Передохните. Ваша орбита ждёт.</p><button class="primary-action resume-action">ПРОДОЛЖИТЬ <b>›</b></button><button class="secondary-action restart-action">ЗАНОВО ЭТУ ОРБИТУ</button></div>`; overlay.classList.remove("hidden"); overlay.querySelector(".resume-action").onclick = () => pause(false); overlay.querySelector(".restart-action").onclick = () => { overlay.classList.add("hidden"); overlay.innerHTML = ""; state = "playing"; startLevel(levelIndex, true); score = 0; setMessage("НОВЫЙ ЗАХОД · УДАЧНОГО ПОЛЁТА"); }; sound("pause");
  }
  function finish(success) {
    if (state === "won" || state === "lost") return;
    state = success ? "won" : "lost"; ending = success ? "win" : "lose"; sound(success ? "win" : "lose");
    overlay.innerHTML = success ? `<div class="dialog-card victory-card"><span class="dialog-kicker">МИССИЯ ВЫПОЛНЕНА</span><h2>С днём рождения!</h2><p class="gold-copy">${COMPANY} · 34 года</p><p>Пять орбит пройдены. Впереди — только новые высоты.</p><div class="final-score">ВАШ РЕЗУЛЬТАТ <strong>${formatScore(score)}</strong></div><button class="primary-action replay-action">ЕЩЁ ОДИН ПОЛЁТ <b>›</b></button><button class="secondary-action home-action">НА ГЛАВНУЮ</button></div>` : `<div class="dialog-card"><span class="dialog-kicker">СИСТЕМА ВОССТАНОВЛЕНИЯ</span><h2>Кораблю нужен ремонт</h2><p>Орбита ${String(levelIndex + 1).padStart(2, "0")} ждёт повторного захода. Ваши улучшения сохраняются до новой попытки.</p><div class="final-score">РЕЗУЛЬТАТ <strong>${formatScore(score)}</strong></div><button class="primary-action retry-action">ПОВТОРИТЬ ОРБИТУ <b>›</b></button><button class="secondary-action home-action">НА ГЛАВНУЮ</button></div>`;
    overlay.classList.remove("hidden"); overlay.querySelector(".replay-action, .retry-action").onclick = () => { overlay.classList.add("hidden"); overlay.innerHTML = ""; state = "playing"; startGame(success ? 0 : levelIndex); };
    overlay.querySelector(".home-action").onclick = () => { state = "landing"; overlay.classList.add("hidden"); overlay.innerHTML = ""; hud.classList.add("hidden"); landing.classList.remove("hidden", "launching"); boss = null; player = newPlayer(); };
    if (score > best) { best = score; try { localStorage.setItem("spaceBirthday34Best", String(best)); } catch { /* storage can be disabled */ } root.querySelector(".best-score b").textContent = formatScore(best); }
  }
  function showBoss() {
    boss = { x: W / 2, y: 100, baseY: 100, radius: 58, hp: BOSS_HP[levelIndex], maxHp: BOSS_HP[levelIndex], age: 0, fire: 2, pattern: 0, phase: 1, name: level().boss, phaseLabel: "ФАЗА 1", telegraph: 0, pendingAttack: false, sweepX: 0 };
    bossWarn = 2.6; enemies = []; enemyShots = []; root.querySelector(".boss-hud").classList.remove("hidden"); sound("boss"); setMessage(`ВНИМАНИЕ · ${level().boss.toUpperCase()}`, 3.2);
  }
  function playerShoot(dt) {
    fireTimer -= dt;
    const period = player.rapid > 0 && player.jam <= 0 ? .105 : .22;
    if (fireTimer > 0) return;
    fireTimer = period * (player.slow > 0 ? 1.25 : 1);
    const spread = player.spread > 0;
    const laser = player.laser > 0;
    const angles = spread ? [-.25, 0, .25] : [0];
    for (const a of angles) shots.push({ x: player.x + Math.sin(a) * 8, y: player.y - 19, vx: Math.sin(a) * (spread ? 55 : 0), vy: -610, radius: 4, damage: laser ? 12 : 1, laser, life: 1.7 });
    if (!muted && Math.random() < .18) sound("shot");
  }
  function shootEnemy(x, y, angle, speed = 190, size = 5, color = "#ff719d") { enemyShots.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: size, color, life: 7 }); }
  function enemyFire(e) {
    const aim = Math.atan2(player.y - e.y, player.x - e.x);
    if (e.kind === "scout") { shootEnemy(e.x, e.y + 10, aim, levelIndex === 0 ? 132 : 155 + levelIndex * 10, 4); }
    else if (e.kind === "turret") { for (let n = -1; n <= 1; n++) shootEnemy(e.x, e.y + 11, aim + n * .19, levelIndex === 0 ? 115 : 135 + levelIndex * 8, 5, "#ffb450"); }
    else { shootEnemy(e.x, e.y + 12, aim + Math.sin(e.age * 2) * .18, levelIndex === 0 ? 110 : 130 + levelIndex * 9, 5, "#f7759b"); }
  }
  function bossAttack(dt) {
    if (!boss) return;
    boss.fire -= dt;
    if (boss.pendingAttack) {
      boss.telegraph = Math.max(0, boss.telegraph - dt);
      if (boss.telegraph > 0) return;
      boss.pendingAttack = false;
    } else if (boss.fire <= 0) {
      const interval = levelIndex === 0 ? 3.3 : boss.phase === 1 ? 2.1 - levelIndex * .12 : 1.38 - levelIndex * .07;
      boss.fire = Math.max(.85, interval);
      boss.telegraph = .62;
      boss.pendingAttack = true;
      return;
    } else return;
    boss.pattern++;
    const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
    const hue = ["#ff7085", "#ffb34c", "#d28bff", "#fb8462", "#ffdf56"][levelIndex];
    if (levelIndex === 0) {
      for (let i = -2; i <= 2; i++) shootEnemy(boss.x, boss.y + 30, aim + i * .31, 140, 6, hue);
    } else if (levelIndex === 1) {
      const y = 175 + (boss.pattern % 2) * 95;
      for (let i = 0; i < 8; i++) { const x = (boss.pattern % 2 ? W - 20 : 20) + i * (W - 40) / 7; shootEnemy(x, y, boss.pattern % 2 ? 2.18 : .95, 138, 7, hue); }
      for (let i = -2; i <= 2; i++) shootEnemy(boss.x, boss.y + 25, aim + i * .15, 190, 4, hue);
    } else if (levelIndex === 2) {
      for (let i = -2; i <= 2; i++) shootEnemy(boss.x, boss.y + 25, aim + i * .14, 230, 4, hue);
      if (boss.pattern % 2 === 0) for (let i = 0; i < 12; i++) shootEnemy(boss.x, boss.y, boss.age + i * Math.PI / 6, 110, 5, "#a9a4ff");
    } else if (levelIndex === 3) {
      const drift = boss.age * 1.5;
      for (let i = 0; i < 8; i++) shootEnemy(boss.x, boss.y + 20, drift + i * Math.PI / 4, 145, 7, hue);
      shootEnemy(boss.x, boss.y + 20, aim, 245, 6, "#ffffff");
    } else {
      const amount = boss.phase === 1 ? 9 : 13;
      for (let i = 0; i < amount; i++) shootEnemy(boss.x, boss.y + 30, aim + (i - (amount - 1) / 2) * (boss.phase === 1 ? .15 : .11), 210 + boss.phase * 18, 5, hue);
      if (boss.pattern % 2 === 0) for (let i = 0; i < 10; i++) shootEnemy(boss.x, boss.y + 6, boss.age + i * Math.PI / 5, 115, 4, "#aefaff");
    }
  }
  function spawnEnemy() {
    if (boss || bossWarn > 0) return;
    const n = Math.random();
    const kind = n < .55 ? "scout" : n < .79 ? "drone" : "turret";
    const x = rand(35, W - 35);
      const base = { x, y: -32, startX: x, age: 0, radius: kind === "turret" ? 21 : 16, hp: kind === "drone" ? 2 : 1, kind, fire: rand(2.2, 3.7) * (levelIndex === 0 ? 2 : 1), phase: rand(0, 7) };
    enemies.push(base);
    if (gameClock > 48 && Math.random() < .16) enemies.push({ ...base, x: clamp(x + rand(-70, 70), 30, W - 30), startX: x, y: -76, fire: rand(1.5, 2.7) });
  }
  function dropPickup(x, y) {
    if (Math.random() > .24) return;
    const options = ["spread", "rapid", "shield", "heal", "laser", ...(levelIndex > 0 ? ["slow", "jam", "gravity"] : [])];
    const type = options[Math.floor(Math.random() * options.length)]; pickups.push({ x, y, type, age: 0, radius: 13, vy: 68 });
  }
  function applyPickup(p) {
    const names = { spread: "РАЗБРОС", rapid: "СКОРОСТРЕЛЬНОСТЬ", shield: "ЩИТ", heal: `РЕМОНТ +${p.healAmount || 1}`, laser: "ЛАЗЕР", slow: "ЗАМЕДЛЕНИЕ", jam: "СБОЙ ПРИЦЕЛА", gravity: "ГРАВИТАЦИЯ" };
    if (p.type === "spread") player.spread = 13;
    if (p.type === "rapid") player.rapid = 12;
    if (p.type === "shield") player.shield = 10;
    if (p.type === "heal") player.hp = Math.min(player.maxHp, player.hp + (p.healAmount || 1));
    if (p.type === "laser") player.laser = 11;
    if (p.type === "slow") player.slow = 8;
    if (p.type === "jam") player.jam = 8;
    if (p.type === "gravity") player.gravity = 8;
    setMessage(`${p.type === "slow" || p.type === "jam" || p.type === "gravity" ? "СБОЙ СИСТЕМЫ" : "УСИЛЕНИЕ"} · ${names[p.type]}`, 2); sound("pickup"); renderHud();
  }
  function hitPlayer() {
    if (player.invuln > 0 || player.shield > 0 || state !== "playing") return;
    player.hp--; player.invuln = 1.65; invulnFlash = 1.65; sound("hit"); burst(player.x, player.y, "#ff668b", 17); renderHud();
    if (player.hp <= 0) finish(false); else setMessage("ПОПАДАНИЕ · КОРПУС ПОВРЕЖДЁН", 1.6);
  }
  function burst(x, y, color, amount = 10) { for (let i = 0; i < amount; i++) { const a = rand(0, Math.PI * 2), speed = rand(35, 210); particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size: rand(2, 5), life: rand(.3, .8), max: .8, color }); } }
  function update(dt) {
    elapsed += dt;
    if (launchAge >= 0) { launchAge += dt; if (launchAge > 1.15) launchAge = -1; }
    stars.forEach(s => { s.y += (22 + 95 * s.z) * dt; s.phase += dt * (1 + s.z); if (s.y > H) { s.y = -3; s.x = rand(0, W); } });
    bgOffset = (bgOffset + 16 * dt) % H;
    if (state === "won") { fireworks = fireworks.filter(p => p.life > 0); for (const p of fireworks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 50 * dt; p.life -= dt; } if (Math.random() < dt * 2) firework(rand(45, W - 45), rand(60, H * .6)); return; }
    if (state !== "playing") return;
    if (transitionTimer > 0) { transitionTimer -= dt; if (transitionTimer <= 0) { if (levelIndex >= LEVELS.length - 1) finish(true); else { startLevel(levelIndex + 1); setMessage(`ОРБИТА ${String(levelIndex + 1).padStart(2, "0")} · ${level().name.toUpperCase()}`, 3); } } return; }
    gameClock += dt; player.invuln = Math.max(0, player.invuln - dt); invulnFlash = Math.max(0, invulnFlash - dt);
    for (const key of ["spread", "rapid", "shield", "laser", "slow", "jam", "gravity"]) player[key] = Math.max(0, player[key] - dt);
    const assistNeeded = levelIndex === 0 ? player.hp <= 3 : player.hp < player.maxHp;
    if (assistNeeded && gameClock >= nextHealAt) {
      const alreadyAssisted = pickups.some(p => p.assisted);
      const healAmount = levelIndex === 0 ? 2 : 1;
      if (!alreadyAssisted) { pickups.push({ x: clamp(player.x + rand(-32, 32), 30, W - 30), y: Math.max(75, player.y - 170), type: "heal", age: 0, radius: 13, vy: 66, assisted: true, healAmount }); setMessage(`РЕМОНТНЫЙ МОДУЛЬ · ПОДБЕРИТЕ +${healAmount}`, 2.7); }
      nextHealAt = gameClock + (levelIndex === 0 ? 25 : 35);
    }
    if (bossWarn > 0) { bossWarn -= dt; if (bossWarn <= 0) showBoss(); }
    const speed = player.gravity > 0 ? 180 : 300;
    let dx = (keys.has("ArrowRight") || keys.has("d") || keys.has("D") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") || keys.has("A") ? 1 : 0);
    let dy = (keys.has("ArrowDown") || keys.has("s") || keys.has("S") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("w") || keys.has("W") ? 1 : 0);
    if (Math.abs(dx) + Math.abs(dy) > 1) { const m = Math.hypot(dx, dy); dx /= m; dy /= m; }
    player.x += dx * speed * dt; player.y += dy * speed * dt;
    if (pointer.active) { const targetX = pointer.downX + (pointer.x - pointer.startX); const targetY = pointer.downY + (pointer.y - pointer.startY); const ease = Math.min(1, dt * 12); player.x += (targetX - player.x) * ease; player.y += (targetY - player.y) * ease; }
    player.x = clamp(player.x, 24, W - 24); player.y = clamp(player.y, 78, H - 48);
    playerShoot(dt);
    if (!boss && bossWarn <= 0) { spawnTimer -= dt; if (spawnTimer <= 0) { spawnEnemy(); const rate = Math.max(.72, 2.15 - levelIndex * .2 - gameClock / level().time * .3); spawnTimer = rand(rate * .62, rate * 1.18); } }
    if (!boss && bossWarn <= 0 && gameClock >= level().time) { bossWarn = 2.5; enemies = []; enemyShots = []; setMessage(`РАДАР · ЦЕЛЬ НА ПОДХОДЕ`, 2.4); }
    for (const e of enemies) {
      e.age += dt; e.y += (e.kind === "turret" ? 43 : 69 + levelIndex * 3) * dt;
      e.x = e.startX + Math.sin(e.age * (e.kind === "scout" ? 1.9 : 1.15) + e.phase) * (e.kind === "turret" ? 42 : 65);
      e.fire -= dt; if (e.fire <= 0 && e.y > 15 && e.y < H * .68) { enemyFire(e); e.fire = (rand(2.05, 3.35) - levelIndex * .08) * (levelIndex === 0 ? 2 : 1); }
      if (Math.hypot(player.x - e.x, player.y - e.y) < e.radius + 12) { e.hp = 0; hitPlayer(); }
    }
    enemies = enemies.filter(e => e.hp > 0 && e.y < H + 60);
    if (boss) {
      boss.age += dt; bossWarn = 0; boss.x = W / 2 + Math.sin(boss.age * (levelIndex === 3 ? .8 : .47)) * (W * .27); boss.y = boss.baseY + Math.sin(boss.age * 1.3) * 13;
      if (levelIndex === 4) { const phase = boss.hp < boss.maxHp * .48 ? 2 : 1; if (phase !== boss.phase) { boss.phase = phase; boss.phaseLabel = phase === 2 ? "ФАЗА 2 · КОМЕТНЫЙ ШТОРМ" : "ФАЗА 1"; setMessage(phase === 2 ? "КОМАНДИР КОМЕТ · ФИНАЛЬНАЯ ФАЗА" : "", 2.5); burst(boss.x, boss.y, "#ffe975", 45); } }
      bossAttack(dt);
      if (boss.telegraph > 0 && boss.telegraph < .52) { /* telegraph is rendered as a warning pulse */ }
      if (Math.hypot(player.x - boss.x, player.y - boss.y) < boss.radius + 8) hitPlayer();
    }
    for (const s of shots) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
    shots = shots.filter(s => s.life > 0 && s.y > -20);
    for (const s of enemyShots) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (player.gravity > 0) { const a = Math.atan2(player.y - s.y, player.x - s.x); s.vx += Math.cos(a) * 28 * dt; s.vy += Math.sin(a) * 28 * dt; } if (Math.hypot(s.x - player.x, s.y - player.y) < s.radius + 9) { s.life = 0; hitPlayer(); } }
    enemyShots = enemyShots.filter(s => s.life > 0 && s.x > -30 && s.x < W + 30 && s.y > -30 && s.y < H + 30);
    for (const s of shots) {
      if (boss && Math.hypot(s.x - boss.x, s.y - boss.y) < boss.radius + 8 + s.radius) { boss.hp -= s.damage; s.life = 0; burst(s.x, s.y, level().color, 1); if (boss.hp <= 0) { bossesDefeated = Math.max(bossesDefeated, levelIndex + 1); score += 2000 + levelIndex * 1250; burst(boss.x, boss.y, level().color, 65); boss = null; enemyShots = []; transitionTimer = 3.2; if (levelIndex < LEVELS.length - 1) player.spread = Math.max(player.spread, LEVELS[levelIndex + 1].time + 40); renderHud(); setMessage(levelIndex === LEVELS.length - 1 ? "ПОБЕДА · ЮБИЛЕЙ СПАСЁН" : "ЦЕЛЬ УНИЧТОЖЕНА · РАЗБРОС ПОЛУЧЕН", 3); sound("boss"); } continue; }
      for (const e of enemies) if (e.hp > 0 && Math.hypot(s.x - e.x, s.y - e.y) < e.radius + s.radius) { e.hp -= s.damage; s.life = 0; burst(s.x, s.y, e.kind === "turret" ? "#ffbb62" : "#6cefff", 3); if (e.hp <= 0) { score += e.kind === "turret" ? 180 : 100; burst(e.x, e.y, "#52dfff", 12); dropPickup(e.x, e.y); } break; }
    }
    for (const p of pickups) { p.age += dt; p.y += p.vy * dt; p.x += Math.sin(p.age * 2.2) * 24 * dt; if (Math.hypot(p.x - player.x, p.y - player.y) < p.radius + 15) { p.y = H + 80; applyPickup(p); } }
    pickups = pickups.filter(p => p.y < H + 35);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(.2, dt); p.vy *= Math.pow(.2, dt); p.life -= dt; }
    particles = particles.filter(p => p.life > 0);
    const toast = root.querySelector(".toast-message"); if (elapsed > toastUntil) toast.classList.remove("show");
    const second = Math.ceil(gameClock); if (second !== lastShownSecond && (boss || second % 2 === 0)) { renderHud(); lastShownSecond = second; }
    if (score > best) { best = score; root.querySelector(".best-score b").textContent = formatScore(best); }
  }
  function image(file, x, y, w, h, alpha = 1, rotate = 0) { const img = images[file]; if (!img?.complete || !img.naturalWidth) return false; ctx.save(); ctx.globalAlpha = alpha; if (rotate) { ctx.translate(x, y); ctx.rotate(rotate); ctx.drawImage(img, -w / 2, -h / 2, w, h); } else ctx.drawImage(img, x - w / 2, y - h / 2, w, h); ctx.restore(); return true; }
  function drawBackground() {
    const landingAsset = images["landing-scene.svg"];
    const hasLandingAsset = state === "landing" && landingAsset?.complete && landingAsset.naturalWidth;
    if (!hasLandingAsset) { ctx.fillStyle = "#04142f"; ctx.fillRect(0, 0, W, H); }
    const bg = images[`bg-${levelIndex + 1}.svg`];
    if (!hasLandingAsset && bg?.complete && bg.naturalWidth) { ctx.globalAlpha = .33; ctx.drawImage(bg, 0, 0, W, H); ctx.globalAlpha = 1; }
    const grad = ctx.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, "rgba(4,18,45,.08)"); grad.addColorStop(1, "rgba(3,13,31,.66)"); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    for (const s of stars) { const shimmer = .4 + .6 * Math.sin(s.phase); ctx.globalAlpha = shimmer * (.45 + s.z * .55); ctx.fillStyle = s.z > .82 ? "#ffe27b" : s.z > .5 ? "#68d8ff" : "#d8ebff"; const size = s.size * (s.z > .78 ? 1.5 : 1); ctx.fillRect(Math.round(s.x), Math.round(s.y), size, size); if (s.z > .91) { ctx.fillRect(s.x - size * 2, s.y + size / 2, size * 5, 1); ctx.fillRect(s.x + size / 2, s.y - size * 2, 1, size * 5); } }
    ctx.globalAlpha = 1;
    if (state === "landing" && !(landingAsset?.complete && landingAsset.naturalWidth)) drawLandingWorld();
  }
  function drawLandingWorld() {
    // Pixel skyline and the curved blue edge of Earth keep the title screen alive without asset dependencies.
    const baseY = H * .79;
    ctx.fillStyle = "#08245a";
    for (let x = -6; x < W + 24; x += 14) { const h = 12 + ((x * 7 + 64) % 31 + 31) % 31; ctx.fillRect(x, baseY - h, 12, h); if (x % 3 === 0) { ctx.fillRect(x + 3, baseY - h - 8, 3, 8); ctx.fillRect(x + 6, baseY - h - 4, 2, 4); } }
    ctx.fillStyle = "#09234f"; ctx.beginPath(); ctx.moveTo(0, baseY + 2); ctx.lineTo(W, baseY + 2); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    for (let x = 7; x < W; x += 24) { ctx.fillStyle = x % 3 ? "#ffd45a" : "#74dcff"; ctx.fillRect(x, baseY + 8 + x % 16, 3, 5); }
    // Rostov river and bridge.
    ctx.strokeStyle = "#ffcb54"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, baseY + 19); ctx.lineTo(W, baseY + 19); ctx.stroke();
    ctx.strokeStyle = "#6de7ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, baseY + 27); ctx.quadraticCurveTo(W / 2, baseY + 8, W, baseY + 27); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(315, baseY + 17); ctx.quadraticCurveTo(356, baseY - 6, 397, baseY + 17); ctx.moveTo(328, baseY + 17); ctx.lineTo(328, baseY + 4); ctx.moveTo(386, baseY + 17); ctx.lineTo(386, baseY + 4); ctx.stroke();
    // Domed Earth horizon.
    ctx.beginPath(); ctx.ellipse(W / 2, H + 112, W * .77, 145, 0, Math.PI, Math.PI * 2); ctx.fillStyle = "#062e70"; ctx.fill();
    ctx.beginPath(); ctx.ellipse(W / 2, H + 103, W * .76, 138, 0, Math.PI, Math.PI * 2); ctx.strokeStyle = "#1686e8"; ctx.lineWidth = 8; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(W / 2, H + 96, W * .74, 132, 0, Math.PI, Math.PI * 2); ctx.strokeStyle = "#34dcff"; ctx.lineWidth = 3; ctx.stroke();
    for (let i = 0; i < 18; i++) { const x = 26 + i * 26, y = H - 28 - Math.cos((x / W - .5) * Math.PI) * 22; ctx.fillStyle = i % 3 ? "#20a3dc" : "#54eaff"; ctx.fillRect(x, y, 4, 3); }
    // Launch rocket.
    const rocketY = state === "landing" ? 148 + Math.sin(elapsed * 2.4) * 3 : 100 - Math.min(260, elapsed * 260);
    if (!image("rocket.svg", W / 2, rocketY, 68, 118)) drawRocket(W / 2, rocketY, 1.25);
    ctx.globalAlpha = .65; ctx.fillStyle = "#60eaff"; ctx.beginPath(); ctx.ellipse(W / 2, 300, 112 + Math.sin(elapsed * 2) * 4, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  function drawRocket(x, y, scale = 1) { ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.fillStyle = "#ff9a43"; ctx.beginPath(); ctx.moveTo(-10, 20); ctx.lineTo(-17, 43); ctx.lineTo(-7, 40); ctx.lineTo(0, 31); ctx.lineTo(7, 40); ctx.lineTo(17, 43); ctx.lineTo(10, 20); ctx.fill(); ctx.fillStyle = "#e6f5ff"; ctx.beginPath(); ctx.moveTo(0, -47); ctx.lineTo(13, -20); ctx.lineTo(15, 26); ctx.lineTo(-15, 26); ctx.lineTo(-13, -20); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#4196e6"; ctx.fillRect(-8, -11, 16, 15); ctx.fillStyle = "#ffcf4f"; ctx.beginPath(); ctx.moveTo(-6, 30); ctx.lineTo(0, 57 + Math.random() * 10); ctx.lineTo(6, 30); ctx.fill(); ctx.restore(); }
  function drawPlayer() {
    if (player.invuln > 0 && Math.floor(elapsed * 14) % 2) return;
    if (player.shield > 0) { ctx.beginPath(); ctx.arc(player.x, player.y, 24 + Math.sin(elapsed * 9) * 2, 0, Math.PI * 2); ctx.strokeStyle = "rgba(87,238,255,.84)"; ctx.lineWidth = 3; ctx.stroke(); }
    if (!image("rocket.svg", player.x, player.y, 48, 56)) drawRocket(player.x, player.y + 3, .58);
    ctx.fillStyle = "#ffa33e"; ctx.beginPath(); ctx.moveTo(player.x - 5, player.y + 20); ctx.lineTo(player.x, player.y + 30 + Math.random() * 7); ctx.lineTo(player.x + 5, player.y + 20); ctx.fill();
  }
  function drawEnemy(e) {
    const file = e.kind === "scout" ? "scout.svg" : e.kind === "turret" ? "turret.svg" : "drone.svg";
    if (!image(file, e.x, e.y, e.radius * 2.4, e.radius * 2.1, 1, Math.sin(e.age * 3) * .05)) {
      ctx.save(); ctx.translate(e.x, e.y); ctx.fillStyle = e.kind === "turret" ? "#ff9d4d" : e.kind === "scout" ? "#f66686" : "#7f8dff"; ctx.beginPath(); ctx.moveTo(0, e.radius); ctx.lineTo(e.radius, -e.radius * .4); ctx.lineTo(0, -e.radius); ctx.lineTo(-e.radius, -e.radius * .4); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff0a5"; ctx.fillRect(-4, -2, 8, 4); ctx.restore();
    }
  }
  function drawBoss() {
    if (!boss) return;
    if (boss.telegraph > 0 && boss.telegraph < .5) { ctx.save(); ctx.globalAlpha = .22 + Math.sin(elapsed * 22) * .12; ctx.fillStyle = "#ff526d"; ctx.fillRect(0, boss.y + 105, W, 3); ctx.strokeStyle = "#ff576f"; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(boss.x, boss.y + 36); ctx.stroke(); ctx.restore(); }
    if (!image(`boss-${levelIndex + 1}.svg`, boss.x, boss.y, 145, 115)) { ctx.save(); ctx.translate(boss.x, boss.y); ctx.rotate(Math.sin(boss.age) * .04); ctx.fillStyle = level().color; ctx.beginPath(); ctx.moveTo(-65, -18); ctx.lineTo(-38, -42); ctx.lineTo(-15, -34); ctx.lineTo(0, -52); ctx.lineTo(20, -34); ctx.lineTo(44, -42); ctx.lineTo(65, -12); ctx.lineTo(52, 30); ctx.lineTo(0, 47); ctx.lineTo(-54, 30); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#061a3b"; ctx.fillRect(-27, -8, 16, 8); ctx.fillRect(11, -8, 16, 8); ctx.fillStyle = "#fff"; ctx.fillRect(-23, -7, 5, 3); ctx.fillRect(15, -7, 5, 3); ctx.restore(); }
    if (boss.phase === 2) { ctx.strokeStyle = `rgba(255,229,105,${.4 + Math.sin(elapsed * 9) * .3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(boss.x, boss.y, 72 + Math.sin(elapsed * 5) * 6, 0, Math.PI * 2); ctx.stroke(); }
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const surfaceGradient = ctx.createRadialGradient(canvas.width / dpr / 2, canvas.height / dpr / 2, 8, canvas.width / dpr / 2, canvas.height / dpr / 2, Math.max(canvas.width, canvas.height) / dpr * .68);
    surfaceGradient.addColorStop(0, "#09224c"); surfaceGradient.addColorStop(1, "#020a1b"); ctx.fillStyle = surfaceGradient; ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    const landingAsset = images["landing-scene.svg"];
    if (state === "landing" && landingAsset?.complete && landingAsset.naturalWidth) {
      const viewWidth = canvas.width / dpr, viewHeight = canvas.height / dpr;
      const cover = Math.max(viewWidth / landingAsset.naturalWidth, viewHeight / landingAsset.naturalHeight);
      const drawWidth = landingAsset.naturalWidth * cover, drawHeight = landingAsset.naturalHeight * cover;
      ctx.drawImage(landingAsset, (viewWidth - drawWidth) / 2, (viewHeight - drawHeight) / 2, drawWidth, drawHeight);
    }
    ctx.setTransform(dpr * worldScale, 0, 0, dpr * worldScale, dpr * worldX, dpr * worldY);
    drawBackground();
    if (state === "playing" || state === "paused" || state === "lost" || state === "won") {
      for (const p of pickups) drawPickup(p);
      for (const e of enemies) drawEnemy(e);
      drawBoss();
      for (const s of shots) { ctx.fillStyle = s.laser ? "#8fffff" : "#a9f4ff"; ctx.shadowColor = "#36e8ff"; ctx.shadowBlur = s.laser ? 13 : 8; ctx.fillRect(s.x - (s.laser ? 3 : 2), s.y - (s.laser ? 14 : 6), s.laser ? 6 : 4, s.laser ? 26 : 12); ctx.shadowBlur = 0; }
      for (const s of enemyShots) { ctx.fillStyle = s.color; ctx.shadowColor = s.color; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
      for (const p of particles) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); } ctx.globalAlpha = 1;
      drawPlayer();
    }
    if (launchAge >= 0) {
      const y = H * .49 - launchAge * 360;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - launchAge / 1.15); ctx.shadowColor = "#4ceaff"; ctx.shadowBlur = 32; ctx.fillStyle = "rgba(80,230,255,.18)"; ctx.beginPath(); ctx.ellipse(W / 2, H * .65, 75 + launchAge * 45, 110 + launchAge * 70, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      if (launchAge < .9) { if (!image("rocket.svg", W / 2, y, 64, 82)) drawRocket(W / 2, y, .86); ctx.fillStyle = "#ffc947"; ctx.beginPath(); ctx.moveTo(W / 2 - 8, y + 32); ctx.lineTo(W / 2, y + 56 + Math.random() * 18); ctx.lineTo(W / 2 + 8, y + 32); ctx.fill(); }
      ctx.restore();
    }
    if (state === "won") { for (const p of fireworks) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4); } ctx.globalAlpha = 1; }
  }
  function drawPickup(p) {
    const bad = ["slow", "jam", "gravity"].includes(p.type);
    const file = `${bad ? "debuff" : "pickup"}-${p.type}.svg`;
    if (image(file, p.x, p.y, 30, 30, .94)) return;
    const colors = { spread: "#5beaff", rapid: "#ffdb5c", shield: "#5ea6ff", heal: "#80ffbb", laser: "#ff78f5", slow: "#fc6580", jam: "#ff9254", gravity: "#bd82ff" };
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(p.age * 3) * .08); ctx.fillStyle = "#071a3b"; ctx.strokeStyle = colors[p.type]; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-11, -11, 22, 22, 5); ctx.fill(); ctx.stroke(); ctx.fillStyle = colors[p.type]; ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(({ spread: "S", rapid: "R", shield: "◇", heal: "+", laser: "L", slow: "↓", jam: "!", gravity: "G" })[p.type], 0, 1); ctx.restore();
  }
  function firework(x, y) { const colors = ["#5ceaff", "#ffe05a", "#ff72a1", "#a994ff", "#9dffb0"]; const color = colors[Math.floor(Math.random() * colors.length)]; for (let i = 0; i < 25; i++) { const a = i / 25 * Math.PI * 2, speed = rand(35, 135); fireworks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: rand(.8, 1.7), color }); } }
  function toCanvasPoint(event) { const r = canvas.getBoundingClientRect(); const bx = (event.clientX - r.left) * dpr; const by = (event.clientY - r.top) * dpr; return { x: (bx - worldX) / worldScale, y: (by - worldY) / worldScale }; }
  canvas.addEventListener("pointerdown", e => { if (e.pointerType === "mouse" && state !== "playing") return; canvas.setPointerCapture(e.pointerId); const p = toCanvasPoint(e); pointer = { active: true, id: e.pointerId, x: p.x, y: p.y, downX: player.x, downY: player.y, startX: p.x, startY: p.y }; root.querySelector(".mobile-controls").classList.add("touching"); root.querySelector(".touch-ring").style.left = `${p.x / W * 100}%`; root.querySelector(".touch-ring").style.top = `${p.y / H * 100}%`; });
  canvas.addEventListener("pointermove", e => { if (pointer.active && pointer.id === e.pointerId) { const p = toCanvasPoint(e); pointer.x = p.x; pointer.y = p.y; } });
  const stopPointer = e => { if (pointer.id === e.pointerId) { pointer.active = false; pointer.id = null; root.querySelector(".mobile-controls").classList.remove("touching"); } };
  canvas.addEventListener("pointerup", stopPointer); canvas.addEventListener("pointercancel", stopPointer); canvas.addEventListener("lostpointercapture", stopPointer);
  playButton.addEventListener("click", () => startGame(0));
  pauseButton.addEventListener("click", () => pause());
  soundButton.addEventListener("click", () => { muted = !muted; soundButton.textContent = muted ? "♪̸" : "♫"; soundButton.setAttribute("aria-label", muted ? "Включить звук" : "Выключить звук"); if (!muted) sound("pickup"); });
  const keydownHandler = e => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault(); keys.add(e.key); if (e.key === "p" || e.key === "P" || e.key === "Escape") pause(); if (e.key === "Enter" && state === "landing") startGame(0); if (e.key === "Enter" && state === "paused") pause(false); };
  window.addEventListener("keydown", keydownHandler, { passive: false });
  const keyupHandler = e => keys.delete(e.key);
  window.addEventListener("keyup", keyupHandler);
  const blurHandler = () => pause();
  const visibilityHandler = () => { if (document.hidden) pause(); };
  window.addEventListener("blur", blurHandler);
  document.addEventListener("visibilitychange", visibilityHandler);
  let animationFrame = 0;
  function frameLoop(ts) { const dt = previous ? Math.min(.04, (ts - previous) / 1000) : 0; previous = ts; update(dt); draw(); animationFrame = requestAnimationFrame(frameLoop); }
  animationFrame = requestAnimationFrame(frameLoop);
  if (testMode) {
    const testApi = {
      getState: () => ({ screen: state, bossIndex: boss ? levelIndex : bossesDefeated >= 5 ? 5 : null, bossesDefeated, elapsedSeconds: gameClock, level: levelIndex + 1, health: player.hp, bossHealth: boss?.hp ?? null, bossX: boss?.x ?? null, enemies: enemies.length, enemyShots: enemyShots.map(s => ({ x: s.x, y: s.y, vx: s.vx, vy: s.vy, radius: s.radius })), effects: { spread: player.spread, rapid: player.rapid, shield: player.shield, laser: player.laser, slow: player.slow, jam: player.jam, gravity: player.gravity }, player: { x: player.x, y: player.y } }),
      snapshot: () => ({ state, level: levelIndex + 1, score, health: player.hp, boss: Boolean(boss), bossHealth: boss?.hp ?? null, gameClock, effects: { ...player }, enemies: enemies.length, player: { x: player.x, y: player.y } }),
      startLevel: n => { overlay.classList.add("hidden"); landing.classList.add("hidden"); hud.classList.remove("hidden"); state = "playing"; score = 0; bossesDefeated = Math.max(0, Number(n) - 1); startLevel(Number(n) - 1, true); },
      setHealth: n => { player.hp = clamp(Number(n), 0, player.maxHp); renderHud(); },
      advanceToBoss: () => { gameClock = level().time; bossWarn = 0; showBoss(); renderHud(); },
      defeatCurrentBoss: () => { if (!boss) { bossWarn = 0; showBoss(); } if (boss) { boss.hp = 0; bossesDefeated = levelIndex + 1; boss = null; enemyShots = []; if (levelIndex >= 4) finish(true); else { transitionTimer = 0; state = "playing"; startLevel(levelIndex + 1); gameClock = level().time - .1; showBoss(); } } },
      defeatBoss: () => testApi.defeatCurrentBoss(),
      damagePlayer: () => hitPlayer(),
      pause: () => pause(),
      resume: () => pause(false),
      setPlayerPosition: (x, y) => { player.x = clamp(Number(x), 20, W - 20); player.y = clamp(Number(y), 70, H - 35); },
      close: () => { delete window.__gameTest; }
    };
    window.__SPACE_BIRTHDAY_TEST__ = testApi;
    window.__gameTest = testApi;
  }
  return { destroy() { cancelAnimationFrame(animationFrame); resizeObserver.disconnect(); window.removeEventListener("keydown", keydownHandler); window.removeEventListener("keyup", keyupHandler); window.removeEventListener("blur", blurHandler); document.removeEventListener("visibilitychange", visibilityHandler); delete window.__SPACE_BIRTHDAY_TEST__; delete window.__gameTest; root.innerHTML = ""; } };
}
