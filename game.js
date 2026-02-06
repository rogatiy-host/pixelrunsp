/* Pixel Runner — FULL PACK (PNG + MP3 + New Record screen + @USERNAME footer)
   Assets:
   - Fighters: assets/fighters/{chase,bobby,blaine,sean,evan,elly,cassie}.png
   - Audio: assets/audio/jump.mp3, click.mp3, sound.mp3
*/

(() => {
  // ----- Config -----
  const PATHS = {
    fighters: "assets/fighters/",
    audio: "assets/audio/"
  };

  const FIGHTERS = [
    { name: "Чейз", file: "chase.png" },
    { name: "Бобби", file: "bobby.png" },
    { name: "Блейн", file: "blaine.png" },
    { name: "Шон", file: "sean.png" },
    { name: "Эван", file: "evan.png" },
    { name: "Кэсси", file: "cassie.png" },
    { name: "Элли", file: "elly.png" }
  ];

  const STORAGE = {
    fighter: "pixelrunner_fighter",
    best: "pixelrunner_best",
    muted: "pixelrunner_muted"
  };

  // ----- DOM -----
  const menu = document.getElementById("menu");
  const stageWrap = document.getElementById("stageWrap");
  const hud = document.getElementById("hud");

  const fightersEl = document.getElementById("fighters");
  const btnStart = document.getElementById("btnStart");
  const btnShowBest = document.getElementById("btnShowBest");

  const scoreNowEl = document.getElementById("scoreNow");
  const scoreBestEl = document.getElementById("scoreBest");
  const fighterBadge = document.getElementById("fighterBadge");

  const btnPause = document.getElementById("btnPause");
  const btnMute = document.getElementById("btnMute");

  const overlay = document.getElementById("overlay");
  const overlaySub = document.getElementById("overlaySub");
  const btnRestart = document.getElementById("btnRestart");
  const btnToMenu = document.getElementById("btnToMenu");

  const modalBackdrop = document.getElementById("modalBackdrop");
  const modalBody = document.getElementById("modalBody");
  const modalOk = document.getElementById("modalOk");

  const recordToast = document.getElementById("recordToast");
  const recordToastSub = document.getElementById("recordToastSub");

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const touchControls = document.getElementById("touchControls");
  const touchJump = document.getElementById("touchJump");
  const touchDuck = document.getElementById("touchDuck");

  // ----- Helpers -----
  function rand(a,b){ return a + Math.random()*(b-a); }
  function clamp(x,a,b){ return Math.max(a, Math.min(b,x)); }

  function escapeHtml(s){
    return s.replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    }[c]));
  }

  // ----- World State -----
  const world = {
    viewW: 960,
    viewH: 360,
    groundY: 280,

    running: false,
    paused: false,

    time: 0,
    speed: 320,
    accel: 12,

    score: 0,
    best: 0,
    bestAtRunStart: 0,

    selected: null,

    // New record state
    hasNewRecordThisRun: false,
    recordToastTimer: 0,

    // bg cycle
    dayPhase: 0
  };

  // Player (collision box + draw size)
  const player = {
    x: 120,
    y: 0,
    vy: 0,
    onGround: true,
    ducking: false,

    // collision
    w: 28,
    h: 36,

    // sprite draw size (под свои PNG можешь поменять)
    drawW: 46,
    drawH: 46
  };

  const obstacles = [];
  const particles = [];
  const confetti = [];

  // ----- Canvas resize -----
  function resizeCanvasToContainer() {
    const rect = stageWrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(220, Math.floor(rect.height));

    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    world.viewW = w;
    world.viewH = h;
    world.groundY = Math.floor(h * 0.78);
  }

  // ----- Assets (images) -----
  const Assets = (() => {
    const fighterImgs = new Map();
    let ready = false;

    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Image load failed: " + src));
        img.src = src;
      });
    }

    async function preloadFighters() {
      const promises = FIGHTERS.map(async (f) => {
        const src = PATHS.fighters + f.file;
        const img = await loadImage(src);
        fighterImgs.set(f.file, img);
      });
      await Promise.all(promises);
      ready = true;
    }

    function getFighterImg(file) {
      return fighterImgs.get(file) || null;
    }

    return { preloadFighters, getFighterImg, get ready(){ return ready; } };
  })();

  // ----- Audio (mp3) -----
  const AudioSys = (() => {
    let muted = false;

    const click = new Audio(PATHS.audio + "click.mp3");
    const jump = new Audio(PATHS.audio + "jump.mp3");
    const bgm = new Audio(PATHS.audio + "sound.mp3");

    click.preload = "auto";
    jump.preload = "auto";
    bgm.preload = "auto";
    bgm.loop = true;
    bgm.volume = 0.35;

    function applyMuted() {
      click.muted = muted;
      jump.muted = muted;
      bgm.muted = muted;
    }

    function setMuted(v) {
      muted = !!v;
      localStorage.setItem(STORAGE.muted, muted ? "1" : "0");
      btnMute.textContent = muted ? "🔇" : "🔊";
      applyMuted();
      if (muted) stopBgm();
    }

    function safePlay(aud, { restart = true } = {}) {
      if (muted) return;
      try {
        if (restart) aud.currentTime = 0;
      } catch {}
      const p = aud.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }

    function clickSfx(){ safePlay(click); }
    function jumpSfx(){ safePlay(jump); }

    function startBgm() {
      if (muted) return;
      safePlay(bgm, { restart: false });
    }

    function stopBgm() {
      try { bgm.pause(); } catch {}
    }

    return { setMuted, clickSfx, jumpSfx, startBgm, stopBgm, get muted(){ return muted; } };
  })();

  // ----- UI helpers -----
  function showModal(title, html){
    document.getElementById("modalTitle").textContent = title;
    modalBody.innerHTML = html;
    modalBackdrop.hidden = false;
  }
  function hideModal(){ modalBackdrop.hidden = true; }

  function updateHUD(){
    scoreNowEl.textContent = String(world.score);
    scoreBestEl.textContent = String(world.best);
  }

  function showMenu(){
    world.running = false;
    world.paused = false;

    menu.style.display = "grid";
    stageWrap.setAttribute("aria-hidden","true");
    hud.setAttribute("aria-hidden","true");

    overlay.hidden = true;
    recordToast.hidden = true;

    // музыка в меню — да (после первого жеста она и так разрешится)
    AudioSys.startBgm();
  }

  function showGame(){
    menu.style.display = "none";
    stageWrap.setAttribute("aria-hidden","false");
    hud.setAttribute("aria-hidden","false");
    overlay.hidden = true;

    resizeCanvasToContainer();

    const isTouch = matchMedia("(hover:none) and (pointer:coarse)").matches;
    touchControls.setAttribute("aria-hidden", isTouch ? "false" : "true");
  }

  // ----- Storage -----
  function bestLoad() {
    const v = Number(localStorage.getItem(STORAGE.best) || "0");
    world.best = Number.isFinite(v) ? v : 0;
    scoreBestEl.textContent = String(world.best);
  }
  function bestSave(v){
    world.best = Math.max(world.best, v|0);
    localStorage.setItem(STORAGE.best, String(world.best));
    scoreBestEl.textContent = String(world.best);
  }

  function fighterLoad(){
    const saved = localStorage.getItem(STORAGE.fighter);
    const found = FIGHTERS.find(f => f.name === saved) || FIGHTERS[0];
    world.selected = found;
    fighterBadge.textContent = `Боец: ${found.name}`;
  }

  function selectFighter(name){
    const f = FIGHTERS.find(x => x.name === name) || FIGHTERS[0];
    world.selected = f;
    localStorage.setItem(STORAGE.fighter, f.name);
    fighterBadge.textContent = `Боец: ${f.name}`;
    refreshFighterUI();
  }

  function buildFightersUI(){
    fightersEl.innerHTML = "";
    FIGHTERS.forEach((f, idx) => {
      const b = document.createElement("button");
      b.className = "fighter";
      b.type = "button";
      b.innerHTML = `<span class="name">${f.name}</span><span class="chip">#${idx+1}</span>`;
      b.addEventListener("click", () => {
        AudioSys.clickSfx();
        selectFighter(f.name);
        AudioSys.startBgm(); // “разрешаем” музыку после жеста
      });
      fightersEl.appendChild(b);
    });
    refreshFighterUI();
  }

  function refreshFighterUI(){
    [...fightersEl.children].forEach(btn => {
      const nm = btn.querySelector(".name")?.textContent || "";
      btn.classList.toggle("selected", nm === world.selected?.name);
    });
  }

  // ----- Game setup -----
  function resetGame(){
    world.time = 0;
    world.speed = 320;
    world.score = 0;
    world.dayPhase = 0;

    world.bestAtRunStart = world.best;
    world.hasNewRecordThisRun = false;
    world.recordToastTimer = 0;
    recordToast.hidden = true;

    player.y = world.groundY - player.h;
    player.vy = 0;
    player.onGround = true;
    player.ducking = false;

    obstacles.length = 0;
    particles.length = 0;
    confetti.length = 0;

    spawnObstacle(true);
    spawnObstacle(true, 1.35);

    updateHUD();
  }

  async function startGame(){
    // preload fighter images once
    if (!Assets.ready) {
      showModal("Загрузка", "Подгружаю бойцов…");
      try {
        await Assets.preloadFighters();
      } catch (e) {
        hideModal();
        showModal("Ошибка", `Не смогла загрузить ассеты.<br><br>${escapeHtml(String(e.message || e))}`);
        return;
      }
      hideModal();
    }

    showGame();
    resetGame();

    world.running = true;
    world.paused = false;

    AudioSys.clickSfx();
    AudioSys.startBgm();

    last = performance.now();
    requestAnimationFrame(loop);
  }

  function gameOver(){
    world.running = false;
    bestSave(world.score);

    overlaySub.textContent = `Счёт: ${world.score} • Рекорд: ${world.best} • Боец: ${world.selected?.name || "—"}`;
    overlay.hidden = false;
  }

  function togglePause(){
    if (!world.running) return;
    world.paused = !world.paused;
    btnPause.textContent = world.paused ? "▶" : "⏸";
    AudioSys.clickSfx();
  }

  // ----- Obstacles -----
  function spawnObstacle(initial=false, extraGapMul=1){
    const base = Math.max(220, world.viewW * 0.38);
    const gap = (base + rand(0, base*0.55)) * extraGapMul;
    const lastX = obstacles.length ? obstacles[obstacles.length-1].x : world.viewW + 100;

    const h = rand(18, 46);
    const w = rand(14, 30);

    obstacles.push({
      x: initial ? (world.viewW + rand(200, 420)) : (lastX + gap),
      y: world.groundY - h,
      w, h
    });
  }

  // ----- Input -----
  function jump(){
    if (!world.running || world.paused) return;
    if (player.onGround){
      player.vy = -520;
      player.onGround = false;
      AudioSys.jumpSfx();
      puff(player.x + 4, player.y + player.h, 10);
    }
  }

  function setDuck(on){
    if (!world.running) return;
    player.ducking = on;
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); jump(); }
    if (e.code === "ArrowDown") { e.preventDefault(); setDuck(true); }
    if (e.code === "KeyP") { e.preventDefault(); togglePause(); }
  }, {passive:false});

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowDown") setDuck(false);
  });

  function bindTouch(el, onDown, onUp){
    el.addEventListener("pointerdown", (e)=>{ e.preventDefault(); el.setPointerCapture(e.pointerId); onDown(); }, {passive:false});
    el.addEventListener("pointerup", (e)=>{ e.preventDefault(); onUp(); }, {passive:false});
    el.addEventListener("pointercancel", (e)=>{ e.preventDefault(); onUp(); }, {passive:false});
    el.addEventListener("contextmenu", (e)=>e.preventDefault());
  }

  bindTouch(touchJump, () => { jump(); }, () => {});
  bindTouch(touchDuck, () => { setDuck(true); }, () => { setDuck(false); });

  stageWrap.addEventListener("pointerdown", (e) => {
    if (e.target === touchJump || e.target === touchDuck) return;
    jump();
  }, {passive:true});

  // ----- Buttons -----
  btnStart.addEventListener("click", () => startGame());

  btnShowBest.addEventListener("click", () => {
    AudioSys.clickSfx();
    showModal("Максимальный рекорд", `<div style="font-size:14px; color:#e8f0ff">
      Твой рекорд: <b style="font-size:20px">${world.best}</b><br><br>
      Боец по умолчанию: <b>${world.selected?.name || "—"}</b>
    </div>`);
  });

  modalOk.addEventListener("click", () => { AudioSys.clickSfx(); hideModal(); });
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop){ AudioSys.clickSfx(); hideModal(); }
  });

  btnPause.addEventListener("click", () => togglePause());

  btnMute.addEventListener("click", () => {
    AudioSys.clickSfx();
    AudioSys.setMuted(!AudioSys.muted);
    if (!AudioSys.muted) AudioSys.startBgm();
  });

  btnRestart.addEventListener("click", () => {
    AudioSys.clickSfx();
    overlay.hidden = true;
    startGame();
  });

  btnToMenu.addEventListener("click", () => {
    AudioSys.clickSfx();
    showMenu();
  });

  // ----- Particles (dust + confetti) -----
  function puff(x,y,count=8){
    for (let i=0;i<count;i++){
      particles.push({
        x: x + rand(-6,6),
        y: y + rand(-4,4),
        vx: rand(-60, 60),
        vy: rand(-120, -40),
        life: rand(0.25, 0.55),
        t: 0,
        s: rand(2,4)
      });
    }
  }

  function spawnConfettiBurst(){
    // “победа над рекордом”
    const cx = world.viewW * 0.5;
    const cy = world.viewH * 0.22;
    const count = Math.floor(clamp(world.viewW / 14, 30, 90));
    for (let i=0;i<count;i++){
      confetti.push({
        x: cx + rand(-40, 40),
        y: cy + rand(-10, 10),
        vx: rand(-260, 260),
        vy: rand(-520, -260),
        g: rand(820, 1100),
        t: 0,
        life: rand(0.9, 1.4),
        w: rand(3,6),
        h: rand(3,8),
        r: rand(-Math.PI, Math.PI),
        vr: rand(-10, 10),
        a: 1
      });
    }
  }

  // ----- Collision -----
  function rectsOverlap(a,b){
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ----- Drawing helpers -----
  function pxRect(x,y,w,h,fill,stroke){
    ctx.fillStyle = fill;
    ctx.fillRect(x|0, y|0, w|0, h|0);
    if (stroke){
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect((x|0)+.5, (y|0)+.5, (w|0)-1, (h|0)-1);
    }
  }

  function lerp(a,b,t){ return a + (b-a)*t; }
  function hexToRgb(hex){
    const h = hex.replace("#","");
    const n = parseInt(h,16);
    return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  }
  function lerpColor(c1,c2,t){
    const a = hexToRgb(c1), b = hexToRgb(c2);
    const r = Math.round(lerp(a.r,b.r,t));
    const g = Math.round(lerp(a.g,b.g,t));
    const bl = Math.round(lerp(a.b,b.b,t));
    return `rgb(${r},${g},${bl})`;
  }

  function drawBackground(dt){
    world.dayPhase = (world.dayPhase + dt * 0.02) % 1;
    const night = 0.5 - 0.5*Math.cos(world.dayPhase * Math.PI*2);

    const skyTop = lerpColor("#1e3a5f", "#0a1020", night);
    const skyBot = lerpColor("#0f1f36", "#050812", night);

    const g = ctx.createLinearGradient(0,0,0,world.viewH);
    g.addColorStop(0, skyTop);
    g.addColorStop(1, skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,world.viewW,world.viewH);

    // stars
    if (night > 0.45){
      ctx.globalAlpha = Math.min(0.7, (night-0.45)*1.6);
      for (let i=0;i<40;i++){
        const x = (i*97 + (world.time*30)) % world.viewW;
        const y = (i*53) % (world.groundY*0.72);
        pxRect(x, y, 2, 2, "rgba(255,255,255,0.9)");
      }
      ctx.globalAlpha = 1;
    }

    drawHills(0.10, "#17314e", "#0b1a2b");
    drawHills(0.18, "#1b3b5f", "#0b1a2b");

    // ground
    pxRect(0, world.groundY, world.viewW, world.viewH-world.groundY, "#0b141f");

    // grass strip
    for (let x=0; x<world.viewW; x+=12){
      const t = (x + world.time*120) % 24;
      const h = 4 + ((t<12)?1:0);
      pxRect(x, world.groundY-6, 12, h, "#1c7c54");
      pxRect(x, world.groundY-2, 12, 2, "#123d2a");
    }
  }

  function drawHills(speedMul, fill, edge){
    const shift = -(world.time * world.speed * speedMul) % 160;
    for (let i=0;i<12;i++){
      const x = shift + i*160;
      const baseY = world.groundY - 40 - (i%3)*18;
      pxRect(x, baseY, 200, 80, fill, edge);
      pxRect(x+18, baseY+16, 36, 18, fill, edge);
      pxRect(x+72, baseY+26, 44, 22, fill, edge);
    }
  }

  function drawPlayer(){
    const img = world.selected ? Assets.getFighterImg(world.selected.file) : null;

    const hitH = player.ducking ? Math.floor(player.h*0.72) : player.h;
    const hitY = player.ducking ? (player.y + (player.h - hitH)) : player.y;

    // shadow
    ctx.globalAlpha = 0.28;
    pxRect(player.x+2, world.groundY+2, player.w-4, 6, "#000000");
    ctx.globalAlpha = 1;

    if (img){
      const dw = player.drawW;
      const dh = player.ducking ? Math.floor(player.drawH*0.78) : player.drawH;

      const dx = player.x - Math.floor((dw - player.w)/2);
      const dy = hitY - (dh - hitH);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, dx|0, dy|0, dw|0, dh|0);
      ctx.imageSmoothingEnabled = true;
    } else {
      pxRect(player.x, hitY, player.w, hitH, "#66a6ff", "rgba(255,255,255,.10)");
    }
  }

  function drawObstacles(){
    for (const o of obstacles){
      pxRect(o.x, o.y, o.w, o.h, "#ff5c7a", "rgba(255,255,255,.12)");
      pxRect(o.x+2, o.y+2, o.w-4, 3, "rgba(255,255,255,.14)");
    }
  }

  function drawParticles(){
    // dust
    for (const p of particles){
      const a = 1 - (p.t / p.life);
      ctx.globalAlpha = Math.max(0, a);
      pxRect(p.x, p.y, p.s, p.s, "rgba(255,255,255,.5)");
      ctx.globalAlpha = 1;
    }

    // confetti
    for (const c of confetti){
      const a = 1 - (c.t / c.life);
      ctx.globalAlpha = Math.max(0, a);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.r);

      // “цвета” конфетти без хардкода палитры в CSS: простые варианты
      const mod = (Math.floor((c.x + c.y) * 0.1) % 5);
      const fill = ["#56e39f","#66a6ff","#ffd166","#ff5c7a","#a78bfa"][mod];

      ctx.fillStyle = fill;
      ctx.fillRect(-(c.w/2)|0, -(c.h/2)|0, c.w|0, c.h|0);
      ctx.restore();

      ctx.globalAlpha = 1;
    }
  }

  function drawPaused(){
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(0,0,world.viewW,world.viewH);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "900 22px ui-monospace, monospace";
    ctx.fillText("ПАУЗА", Math.floor(world.viewW/2)-48, Math.floor(world.viewH/2)-10);

    ctx.fillStyle = "rgba(155,176,204,.95)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText("Нажми P или ⏸", Math.floor(world.viewW/2)-72, Math.floor(world.viewH/2)+14);
  }

  // ----- New record toast -----
  function showNewRecordToast(){
    recordToastSub.textContent = `Ты побила рекорд: ${world.bestAtRunStart} → ${world.score}`;
    recordToast.hidden = false;
    world.recordToastTimer = 2.2; // seconds
  }

  function stepToast(dt){
    if (recordToast.hidden) return;
    world.recordToastTimer -= dt;
    if (world.recordToastTimer <= 0){
      recordToast.hidden = true;
    }
  }

  // ----- Loop -----
  let last = performance.now();
  function loop(now){
    if (!world.running) return;
    const dt = Math.min(0.033, (now-last)/1000);
    last = now;

    if (!world.paused){
      step(dt);
      render(dt);
    } else {
      render(dt);
      drawPaused();
    }

    requestAnimationFrame(loop);
  }

  function step(dt){
    world.time += dt;
    world.speed += world.accel * dt;

    // score
    world.score += Math.floor(dt * (world.speed/10));

    // NEW RECORD trigger (один раз за забег)
    if (!world.hasNewRecordThisRun && world.score > world.bestAtRunStart && world.bestAtRunStart > 0){
      world.hasNewRecordThisRun = true;
      showNewRecordToast();
      spawnConfettiBurst();
    }
    // если первый рекорд вообще 0 — не делаем “победу над рекордом”, просто играем

    // UI best display while running
    if (world.score > world.best) scoreBestEl.textContent = String(world.score);

    // physics
    const gravity = 1400;
    player.vy += gravity * dt;
    player.y += player.vy * dt;

    const targetH = player.ducking ? Math.floor(player.h*0.72) : player.h;
    const groundY = world.groundY - targetH;

    if (player.y >= groundY){
      player.y = groundY;
      player.vy = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    // obstacles move
    for (const o of obstacles){
      o.x -= world.speed * dt;
    }
    while (obstacles.length && obstacles[0].x + obstacles[0].w < -40){
      obstacles.shift();
      spawnObstacle(false, rand(0.95, 1.25));
    }

    // dust particles
    for (let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt;
      if (p.t >= p.life) particles.splice(i,1);
    }

    // confetti
    for (let i=confetti.length-1;i>=0;i--){
      const c = confetti[i];
      c.t += dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += c.g * dt;
      c.r += c.vr * dt;
      if (c.t >= c.life) confetti.splice(i,1);
    }

    // toast timer
    stepToast(dt);

    // collision
    const prH = targetH;
    const prY = player.ducking ? (player.y + (player.h - prH)) : player.y;
    const pr = { x: player.x, y: prY, w: player.w, h: prH };

    for (const o of obstacles){
      if (rectsOverlap(pr, o)){
        gameOver();
        break;
      }
    }

    updateHUD();
  }

  function render(dt){
    ctx.clearRect(0,0,world.viewW,world.viewH);
    drawBackground(dt);
    drawObstacles();
    drawParticles();
    drawPlayer();
  }

  // ----- Init -----
  function init(){
    bestLoad();
    fighterLoad();
    buildFightersUI();
    selectFighter(world.selected?.name || FIGHTERS[0].name);

    const m = localStorage.getItem(STORAGE.muted) === "1";
    AudioSys.setMuted(m);

    showMenu();

    window.addEventListener("resize", () => {
      if (menu.style.display === "none") resizeCanvasToContainer();
    });
  }

  init();
})();