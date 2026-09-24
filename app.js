(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function fmt(n, d) { return String(n).padStart(d || 2, '0'); }
  function clampNum(v, a, b) { return v < a ? a : v > b ? b : v; }

  function hashSeed(n) {
    n = n >>> 0;
    var h = 2166136261;
    h = Math.imul(h ^ (n & 0xffff), 16777619);
    h = Math.imul(h ^ (n >>> 16), 16777619);
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var DAY = 86400000;
  var MIN = 60000;
  var B30 = 30 * MIN;
  var B10 = 10 * MIN;
  var DAY0 = Math.floor(Date.UTC(2026, 8, 23) / DAY);
  var B30T0 = Math.floor(Date.UTC(2026, 8, 23) / B30);

  function toast(msg, dur) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('show'); }, dur || 2800);
  }

  function countUp(el, to, dur) {
    if (!el) return;
    var from = parseInt(el.dataset.v || '0', 10) || 0;
    if (from === to) { el.textContent = to; return; }
    var t0 = performance.now();
    dur = dur || 900;
    (function step(t) {
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      var v = Math.round(from + (to - from) * e);
      el.textContent = v;
      el.dataset.v = String(v);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  function tickClock() {
    var d = new Date();
    $('navClock').textContent = fmt(d.getHours()) + ':' + fmt(d.getMinutes()) + ':' + fmt(d.getSeconds());
  }

  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeEvModal();
      closeCamFull();
      tabs.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      $('page-' + btn.dataset.tab).classList.add('active');
      var inner = $('page-' + btn.dataset.tab).querySelectorAll('.reveal:not(.in)');
      [].forEach.call(inner, function (el, i) { setTimeout(function () { el.classList.add('in'); }, i * 60); });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (btn.dataset.tab === 'cams') onCamsOpen();
    });
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  /* ================= SECUACES / TÚNEL / FURGONETAS (ciclo 30 min) ================= */
  var secCache30 = -1;
  var secCacheVal = 135;
  var secCacheTunel = 90;
  var secCacheVan = 0;

  function secuacesFor(b30) {
    if (b30 === secCache30) return secCacheVal;
    var v = 135;
    for (var i = B30T0; i <= b30; i++) {
      var r = mulberry32(hashSeed(i * 991 + 7));
      var d = 1 + Math.floor(r() * 5);
      if (r() < 0.5) d = -d;
      v += d;
      if (v > 200) v = 200 - (v - 200);
      if (v < 100) v = 100 + (100 - v);
    }
    secCache30 = b30;
    secCacheVal = v;
    var r2 = mulberry32(hashSeed(b30 * 557 + 3));
    var f = 0.5 + r2() * 0.45;
    secCacheTunel = clampNum(Math.round(v * f), 56, 178);
    secCacheVan = Math.floor(mulberry32(hashSeed(b30 * 811 + 5))() * 343);
    return v;
  }

  function renderLive(now) {
    var b30 = Math.floor(now / B30);
    var s = secuacesFor(b30);
    countUp($('bigHench'), s, 700);
    countUp($('homeHench'), s, 700);
    countUp($('bigTunnel'), secCacheTunel, 700);
    countUp($('homeTunnel'), secCacheTunel, 700);
    countUp($('vanOut'), secCacheVan, 700);
    $('homeHenchSub').textContent = 'CIFRA CONTROLADA';
  }

  /* ================= MECHA ================= */
  var STATUS = ['OPERATIVO', 'PATRULLA', 'VIGILANCIA', 'COMBATE', 'REPARANDO', 'OPERATIVO', 'PATRULLA'];
  var B10T0 = Math.floor(Date.UTC(2026, 8, 23) / B10);
  var lastBuck10 = -1;

  function mechaStateAt(b) {
    var r = mulberry32(hashSeed(b * 7919 + 13));
    var st = STATUS[Math.floor(r() * STATUS.length)];
    var prevSt = '';
    if (b > B10T0) {
      var rp = mulberry32(hashSeed((b - 1) * 7919 + 13));
      prevSt = STATUS[Math.floor(rp() * STATUS.length)];
    }
    var h;
    if (st === 'REPARANDO') h = 25 + r() * 35;
    else {
      h = 30 + r() * 70;
      if (prevSt === 'REPARANDO') h = Math.min(100, h + 20);
    }
    var elec;
    if (st === 'COMBATE') elec = 50 + r() * 50;
    else if (st === 'REPARANDO') elec = 5 + r() * 15;
    else elec = r() * 100;
    return { status: st, health: Math.round(h), elec: Math.round(elec) };
  }

  function renderMecha(now) {
    var b = Math.floor(now / B10);
    if (b === lastBuck10 && lastBuck10 > -10) return;
    lastBuck10 = b;
    var s = mechaStateAt(b);
    var pct = s.health;
    var fill = $('healthFill');
    fill.style.width = pct + '%';
    fill.classList.toggle('mid', pct < 66 && pct >= 34);
    fill.classList.toggle('low', pct < 34);
    var pctEl = $('healthPct');
    pctEl.textContent = pct + '%';
    pctEl.style.color = pct < 34 ? 'var(--red)' : pct < 66 ? 'var(--amber)' : 'var(--green)';
    $('mechaChipText').textContent = s.status;
    $('mechaChip').classList.toggle('chip-repair', s.status === 'REPARANDO');
    $('mechaMode').textContent = 'MODO: ' + s.status;
    $('homeMechaStatus').textContent = s.status;
    $('homeMechaPct').textContent = pct + '%';
    $('homeMechaBar').style.width = pct + '%';

    var gv = (s.elec / 100) * 2.4;
    $('elecFill').style.width = s.elec + '%';
    $('elecVal').textContent = gv.toFixed(2).replace('.', ',') + ' GV';
    $('powerFill').style.width = s.elec + '%';
    $('powerVal').textContent = '56,6 T';
    var fuerza = (56.6 * s.elec) / 100;
    $('strengthVal').textContent = fuerza.toFixed(1).replace('.', ',') + ' T';

    var dis = $('dischargeVal');
    if (s.elec >= 70) {
      dis.textContent = 'ACTIVA';
      dis.classList.add('hot');
      $('shockNote').textContent = 'ELECTROCUCIÓN ARMADA';
    } else {
      dis.textContent = 'EN ESPERA';
      dis.classList.remove('hot');
      $('shockNote').textContent = 'ELECTROIMÁN LISTO';
    }
  }

  function tickUpdate(now) {
    var msLeft = B10 - (now % B10);
    var m = Math.floor(msLeft / MIN), sec = Math.floor((msLeft % MIN) / 1000);
    $('nextUpdate').textContent = 'ACTUALIZACIÓN EN ' + fmt(m) + ':' + fmt(sec);
  }

  /* ================= REGISTRO EN VIVO ================= */
  var ALL_ACTIONS = {
    combat: [
      'Descarga de arco liberada · contacto nulo',
      'Impacto absorbido · blindaje intacto',
      'Pulso iónico dirigido al sector −2',
      'Onda de choque disipada al 94%',
      'Contención del perímetro · sin brechas'
    ],
    patrol: [
      'Patrulla perimetral completada',
      'Canalizando corriente residual',
      'Barrido térmico · sin anomalías',
      'Electroimán cargado al máximo',
      'Sellado de compuertas verificado',
      'Eco detectado · filtrando ruido',
      'Recalibrando servomotores'
    ],
    vigilance: [
      'Vigilancia nocturna en curso',
      'Sensor sísmico activo',
      'Grabando ondas de presión',
      'Electroimán en reposo',
      'Alerte térmico de bajo nivel'
    ],
    repair: [
      'Soldadura de chasis aplicada',
      'Línea de energía restaurada',
      'Válvula de presión purgada',
      'Parche de blindaje instalado',
      'Reintegridad del núcleo · 96%',
      'Recarga de baterías auxiliares'
    ],
    operative: [
      'Núcleo estable · sin fluctuaciones',
      'Compuertas selladas',
      'Sistemas de choque verificados',
      'Humo del túnel bajo control',
      'Señal de radio confirmada'
    ]
  };
  function actionsFor(status) {
    return ALL_ACTIONS[status.toLowerCase()] || ALL_ACTIONS.operative;
  }
  var feedIdx = 0;
  var feedStatus = '';
  function pushFeed(status) {
    if (status !== feedStatus) { feedStatus = status; feedIdx = 0; }
    var pool = actionsFor(status);
    if (feedIdx >= pool.length) feedIdx = 0;
    var msg = pool[feedIdx++];
    var d = new Date();
    var li = document.createElement('li');
    if (status === 'REPARANDO' || /choque|impacto|descarga|pulso|onda/i.test(msg)) li.classList.add('hot');
    li.innerHTML = '<time>' + fmt(d.getHours()) + ':' + fmt(d.getMinutes()) + ':' + fmt(d.getSeconds()) + '</time><span>' + msg + '</span>';
    var ul = $('actionFeed');
    ul.insertBefore(li, ul.firstChild);
    while (ul.children.length > 8) ul.removeChild(ul.lastChild);
  }
  (function bootFeed() {
    var st = mechaStateAt(Math.floor(Date.now() / B10)).status;
    for (var i = 0; i < 8; i++) pushFeed(st);
    setInterval(function () {
      pushFeed(mechaStateAt(Math.floor(Date.now() / B10)).status);
    }, 4300);
  })();

  /* ================= NIVEL DE ENFADO DE HOMER ================= */
  var ANGER_B = 30000;
  var ANGER_REF_B = Math.floor(Date.UTC(2026, 8, 23) / ANGER_B);
  var angerCacheB = -1;
  var angerVal = 40;
  function angerFor(b) {
    if (b === angerCacheB) return angerVal;
    var v, start;
    if (angerCacheB < 0 || b < angerCacheB) {
      v = 40; start = ANGER_REF_B;
      if (b < start) { angerCacheB = b; angerVal = v; return v; }
    } else { v = angerVal; start = angerCacheB; }
    for (var i = start + 1; i <= b; i++) {
      var r = mulberry32(hashSeed(i * 3341 + 17));
      var d = Math.floor(r() * 5) - 2; /* -2 .. 2 (puede subir, bajar o quedarse) */
      v += d;
      if (v > 100) v = 100;
      if (v < 0) v = 0;
    }
    angerCacheB = b;
    angerVal = v;
    return v;
  }
  function renderAnger(now) {
    var b = Math.floor(now / ANGER_B);
    var a = angerFor(b);
    var mask;
    if (a >= 100) mask = 'MÁSCARA TÚNEL';
    else if (a >= 50) mask = 'MÁSCARA HOMER ENFADADA';
    else mask = 'MÁSCARA REALISTA';
    /* fuerza estimada: 0% → 250 kg (mínimo), 100% → 425 kg */
    var force = Math.round(250 + (a / 100) * 175);
    var fill = $('angerFill');
    if (fill) {
      fill.style.width = a + '%';
      fill.classList.toggle('rage', a >= 80);
    }
    var pctEl = $('angerPct');
    if (pctEl) pctEl.textContent = a + '%';
    var maskEl = $('angerMask');
    if (maskEl) maskEl.textContent = mask;
    var forceEl = $('angerForce');
    if (forceEl) forceEl.textContent = force + ' KG';
    var dForce = $('dTargetForce');
    if (dForce) dForce.innerHTML = force + ' <i>kg</i>';
  }

  /* ================= UBICACIÓN X/Y/Z DE HOMER (ciclo 30 s) ================= */
  var POS_B = 30000;
  var POS_REF_B = Math.floor(Date.UTC(2026, 8, 23) / POS_B);
  var posCacheB = -1;
  var posState = { x: 10, y: 60, z: 2.4 };
  function posWalk(b) {
    if (b === posCacheB) return posState;
    if (posCacheB < 0 || b < posCacheB) {
      posState = { x: 10, y: 60, z: 2.4 };
      posCacheB = POS_REF_B;
      if (b <= posCacheB) { posCacheB = b; return posState; }
    }
    for (var i = posCacheB + 1; i <= b; i++) {
      var r = mulberry32(hashSeed(i * 5519 + 41));
      posState.x += (r() * 6 - 3);
      posState.y += (r() * 6 - 3);
      posState.z += (r() * 0.6 - 0.3);
      if (posState.x < -40) posState.x = -40;
      if (posState.x > 40) posState.x = 40;
      if (posState.y < 0) posState.y = 0;
      if (posState.y > 120) posState.y = 120;
      if (posState.z < 0) posState.z = 0;
      if (posState.z > 5) posState.z = 5;
    }
    posCacheB = b;
    return posState;
  }
  function rumboOf(x, y) {
    var dx = x, dy = y - 60;
    if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'ESTE' : 'OESTE';
    return dy >= 0 ? 'NORTE' : 'SUR';
  }
  function renderSecDots(k) {
    var box = $('tmSecs');
    if (!box) return;
    var want = clampNum(secCacheTunel, 0, 220);
    while (box.children.length > want) box.removeChild(box.lastChild);
    var created = [];
    while (box.children.length < want) {
      var d = document.createElement('i');
      d.className = 'tm-sec init';
      box.appendChild(d);
      created.push(d);
    }
    var r = mulberry32(hashSeed(k * 7919 + 13));
    for (var i = 0; i < box.children.length; i++) {
      var el = box.children[i];
      el.style.left = (6 + r() * 88) + '%';
      el.style.top = (10 + r() * 80) + '%';
    }
    if (created.length) {
      requestAnimationFrame(function () {
        created.forEach(function (el) { el.classList.remove('init'); });
      });
    }
  }

  /* ================= RADAR ================= */
  var radarK = -1;
  var radarFirst = true;
  var tmDotFirst = true;
  var blipEl = $('radarBlip');
  var tmDot = $('tmHomer');
  function radarCycle(now) {
    var k = Math.floor(now / POS_B);
    if (k === radarK) return;
    radarK = k;
    var p = posWalk(k);
    var x = p.x, y = p.y, z = p.z;

    /* punto rojo = Homer, en el radar circular (vista en planta x/y) */
    var bl = 50 + (x / 40) * 40;
    var bt = 50 + ((y - 60) / 60) * 40;
    if (radarFirst) {
      radarFirst = false;
      blipEl.style.transition = 'none';
      blipEl.style.left = bl + '%';
      blipEl.style.top = bt + '%';
      void blipEl.offsetWidth;
      blipEl.style.transition = 'left 26s linear, top 26s linear, opacity 2s';
    } else {
      blipEl.style.left = bl + '%';
      blipEl.style.top = bt + '%';
    }
    blipEl.style.opacity = '0.95';

    /* punto rojo en el esquema del túnel (vista en sección x/z) */
    if (tmDot) {
      if (tmDotFirst) tmDot.style.transition = 'none';
      tmDot.style.left = (5 + ((x + 40) / 80) * 90) + '%';
      tmDot.style.top = (6 + (z / 5) * 88) + '%';
      if (tmDotFirst) { void tmDot.offsetWidth; tmDotFirst = false; tmDot.style.transition = ''; }
    }

    /* coordenadas y rumbo (solo del rojo = Homer) */
    var dist = Math.round(Math.sqrt(x * x + y * y + (z * 10) * (z * 10)));
    var zi = Math.max(0, Math.min(5, Math.round(z)));
    var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
    set('coordX', (x >= 0 ? '+' : '') + x.toFixed(1) + ' m');
    set('coordY', (y >= 0 ? '+' : '') + y.toFixed(1) + ' m');
    set('coordZ', '−' + zi);
    set('coordDist', dist + ' m');
    set('coordRumbo', rumboOf(x, y));
    var zone = $('tmZone');
    if (zone) zone.textContent = LEVELS[zi].name + ' · ' + LEVELS[zi].zone;

    renderSecDots(k);
    $('radarState').textContent = 'CONTACTO EN MOVIMIENTO';
  }
  var radarClicks = 0;
  $('radar').addEventListener('click', function () {
    radarClicks++;
    if (radarClicks >= 5) {
      radarClicks = 0;
      blipEl.classList.add('flash');
      setTimeout(function () { blipEl.classList.remove('flash'); }, 1600);
      $('radarState').textContent = 'CONTACTO PERDIDO';
      setTimeout(function () { if (radarK >= 0) $('radarState').textContent = 'CONTACTO EN MOVIMIENTO'; }, 2500);
      toast('ALGO SE MOVIÓ EN EL TÚNEL... ¿LO VISTE?');
    }
  });

  /* ================= UBICACIÓN DE HOMER ================= */
  function furgWindow(dayI) {
    var r = mulberry32(hashSeed(dayI * 883 + 29));
    var offMin = Math.floor(r() * 351);
    var start = dayI * DAY + 15 * 3600 * 1000 + offMin * MIN;
    return { start: start, end: start + 10 * MIN };
  }
  function renderLoc(now) {
    var day = Math.floor(now / DAY);
    var w = furgWindow(day);
    var inVan = now >= w.start && now < w.end;
    var next = w;
    if (now >= w.end) next = furgWindow(day + 1);
    var msLeft = inVan ? w.end - now : next.start - now;
    var total = Math.max(0, Math.ceil(msLeft / 1000));
    var hh = Math.floor(total / 3600), mm = Math.floor((total % 3600) / 60), ss = total % 60;
    var box = document.querySelector('.homer-loc');
    if (inVan) {
      box.classList.add('van');
      $('homerLoc').textContent = 'EN LA FURGONETA';
      $('homerLocSub').textContent = 'FUERA DEL TÚNEL · VENTANA ACTIVA';
      $('locCountdown').textContent = 'RETORNO EN ' + fmt(hh) + ':' + fmt(mm) + ':' + fmt(ss);
    } else {
      box.classList.remove('van');
      $('homerLoc').textContent = 'EN EL TÚNEL';
      $('homerLocSub').textContent = 'CONTINUO · SIN EXCEPCIONES';
      $('locCountdown').textContent = 'PRÓXIMA EXCURSIÓN EN ' + fmt(hh) + ':' + fmt(mm) + ':' + fmt(ss);
    }
  }

  /* ================= NIVELES DEL TÚNEL ================= */
  var LEVELS = [
    { name: 'NIVEL 0', zone: 'APARCAMIENTO DE ENTES', pres: 'HOMER SIMPSON', st: 'CONTROLADO · 100% EXPLORADO', cls: 's0' },
    { name: 'NIVEL −1', zone: 'GALERÍA NORTE', pres: '—', st: 'EXPLORANDO · AMENAZA 1', cls: 's1' },
    { name: 'NIVEL −2', zone: 'SALA DE BOMBAS', pres: '—', st: 'INVESTIGADO · ESTABLE', cls: 's2' },
    { name: 'NIVEL −3', zone: 'HANGAR B', pres: '—', st: 'EXPLORACIÓN PARCIAL · AMENAZA MEDIA', cls: 's3' },
    { name: 'NIVEL −4', zone: 'ACUÍFEROS', pres: '—', st: 'INVESTIGADO · AMENAZA GRAVE', cls: 's4' },
    { name: 'NIVEL −5', zone: 'PROFUNDIDAD DESCONOCIDA', pres: 'PRESENCIA DESCONOCIDA', st: 'INACCESIBLE · AMENAZA EXTREMA · PROHIBIDO ENTRAR HOY', cls: 's5' }
  ];
  function levelFor(day) {
    var r = mulberry32(hashSeed(day * 613 + 2));
    return Math.floor(r() * LEVELS.length);
  }
  function renderLevels(day) {
    var idx = levelFor(day);
    $('todayLevelTag').textContent = 'NIVEL DE HOY: ' + LEVELS[idx].name;
    var box = $('levelsList');
    box.innerHTML = '';
    LEVELS.forEach(function (lv, i) {
      var el = document.createElement('div');
      el.className = 'tl-row ' + lv.cls + (i === idx ? ' today' : '');
      if (i === idx) el.innerHTML = '<span class="tl-badge">HOY</span>';
      el.innerHTML += '<span class="tl-name">' + lv.name + '</span><span class="tl-zone">' + lv.zone + '</span>' +
        '<span class="tl-st">' + lv.st + '</span>' + (lv.pres !== '—' ? '<span class="tl-pres">' + lv.pres + '</span>' : '');
      box.appendChild(el);
    });
  }

  /* ================= LUNA / REUNIÓN ================= */
  function moonPhase(now) {
    var syn = 29.53058867 * DAY;
    var epoch = Date.UTC(2000, 0, 6, 18, 14);
    return ((now - epoch) % syn + syn) % syn / syn;
  }
  var MOON_EMOJI = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
  function renderMoon(now) {
    var t = moonPhase(now);
    var idx = Math.min(7, Math.floor(t * 8));
    $('moonEmoji').textContent = MOON_EMOJI[idx];
    var isFull = Math.abs(t - 0.5) <= (1 / 29.53);
    if (isFull) {
      $('moonState').textContent = 'ABIERTA HOY';
      $('moonState').style.color = 'var(--red)';
      $('moonAcc').textContent = 'ACCESO PERMITIDO · AHORA';
    } else {
      $('moonState').textContent = 'PROGRAMADA';
      $('moonState').style.color = '';
      $('moonAcc').textContent = 'SOLO DURANTE LUNA LLENA';
    }
    $('moonCond').textContent = 'LUNA LLENA';
  }

  /* ================= TABLEROS (revelaciones / escapes / intervenciones) ================= */
  function interFor(day) {
    if (day === interDayCache) return interCache;
    var n = Math.floor((day - DAY0) / 2);
    var types = [14, 7, 5];
    var total = 26;
    for (var e = 0; e < n; e++) {
      var d = DAY0 + e * 2;
      if (mulberry32(hashSeed(d * 73 + 3))() < 0.55) {
        var t = Math.floor(mulberry32(hashSeed(d * 97 + 11))() * 3);
        types[t]++; total++;
      }
    }
    interDayCache = day;
    interCache = { total: total, types: types };
    return interCache;
  }
  var interDayCache = -1;
  var interCache = null;

  function revelFor(day) {
    var w = Math.floor((day - DAY0) / 8);
    var count = 3, active = false;
    for (var i = 0; i <= w; i++) {
      if (mulberry32(hashSeed((DAY0 + i * 8) * 731 + 13))() < 0.5) {
        count++;
        if (i === w) active = true;
      }
    }
    return { count: count, active: active };
  }

  var escCacheW = -1, escCacheCount = 5;
  function escTrig(i) { return mulberry32(hashSeed((DAY0 + i * 10) * 173 + 23))() < 0.25; }
  function escCountFor(w) {
    if (w !== escCacheW) {
      var count = 5;
      for (var i = 0; i < w; i++) if (escTrig(i)) count++;
      escCacheW = w; escCacheCount = count;
    }
    return escCacheCount;
  }
  function renderBoards(now) {
    var day = Math.floor(now / DAY);
    renderLoc(now);
    var inter = interFor(day);
    countUp($('interRepaired'), inter.types[0], 500);
    countUp($('interRebuilt'), inter.types[1], 500);
    countUp($('interUpgraded'), inter.types[2], 500);
    countUp($('interTotal'), inter.total, 700);

    var rev = revelFor(day);
    $('revelCount').textContent = rev.count;
    var rEl = $('revelStatus');
    if (rev.active) { rEl.textContent = 'REVELADO · EXPUESTO'; rEl.classList.add('revealed'); }
    else { rEl.textContent = 'EN SILENCIO'; rEl.classList.remove('revealed'); }

    var w0 = Math.floor((day - DAY0) / 10);
    var esc = { count: escCountFor(w0), active: false };
    if (escTrig(w0)) {
      esc.count++;
      var winStart = (DAY0 + w0 * 10) * DAY;
      var r = mulberry32(hashSeed(winStart * 1009 + 51));
      var start = winStart + Math.floor(r() * (10 * DAY - 4 * 3600 * 1000));
      esc.active = now >= start && now < start + 4 * 3600 * 1000;
    }
    $('escapeCount').textContent = esc.count;
    var banner = $('cageBanner');
    if (esc.active) { banner.classList.add('danger'); $('cageText').textContent = 'PELIGRO · HOMER SUELTO'; }
    else { banner.classList.remove('danger'); $('cageText').textContent = 'EN LA JAULA'; }

    renderLevels(day);
    renderMoon(now);
  }

  /* ================= INTERRUPTORES ================= */
  function bindSwitch(elId, stId, name) {
    var el = $(elId), st = $(stId);
    if (!el || !st) return;
    el.addEventListener('click', function () {
      var on = !el.classList.contains('on');
      el.classList.toggle('on', on);
      st.textContent = on ? 'ON' : 'OFF';
      onSwitch(name, on, el);
    });
  }
  var staticSource = null;
  function startStatic() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    stopStatic();
    var ctx = new AC();
    var len = ctx.sampleRate * 4;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2200;
    filter.Q.value = 0.6;
    var dry = ctx.createGain();
    dry.gain.value = 1;
    var delay = ctx.createDelay(2);
    delay.delayTime.value = 0.3;
    var fb = ctx.createGain();
    fb.gain.value = 0.5;
    var wet = ctx.createGain();
    wet.gain.value = 0.55;
    var master = ctx.createGain();
    master.gain.value = 0.4;
    src.connect(filter);
    filter.connect(dry);
    dry.connect(master);
    filter.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    master.connect(ctx.destination);
    src.start();
    staticSource = { ctx: ctx, src: src, master: master };
  }
  function stopStatic() {
    if (staticSource) {
      try { staticSource.src.stop(); } catch (e) {}
      try { staticSource.master.disconnect(); } catch (e) {}
      try { staticSource.ctx.close(); } catch (e) {}
      staticSource = null;
    }
  }
  function onSwitch(name, on, el) {
    if (name === 'general') {
      if (on) {
        var m = $('videoModal');
        var v = $('switchVideo');
        v.muted = true;
        v.loop = true;
        m.hidden = false;
        v.currentTime = 0;
        startStatic();
        var fail = function () {
          stopStatic();
          m.hidden = true;
          document.body.classList.add('gray');
          setTimeout(function () {
            document.body.classList.remove('gray');
            el.classList.remove('on');
            $('swGeneralSt').textContent = 'OFF';
          }, 5000);
        };
        v.onerror = fail;
        var played = v.play();
        if (played && played.catch) played.catch(fail);
        m.onclick = function () {
          m.onclick = null;
          try { v.pause(); } catch (e) {}
          stopStatic();
          m.hidden = true;
          el.classList.remove('on');
          $('swGeneralSt').textContent = 'OFF';
        };
      }
    } else if (name === 'sound') {
      setSound(on);
    } else if (name === 'fnaf') {
      setFnaf(on);
    }
  }
  bindSwitch('swGeneral', 'swGeneralSt', 'general');
  bindSwitch('swCam', 'swCamSt', 'cam');
  bindSwitch('swLuz', 'swLuzSt', 'luz');
  bindSwitch('swAlarm', 'swAlarmSt', 'alarm');
  bindSwitch('swAcc', 'swAccSt', 'acc');
  bindSwitch('swSound', 'swSoundSt', 'sound');
  bindSwitch('swFnaf', 'swFnafSt', 'fnaf');

  /* ================= SONIDO ================= */
  var audioOn = false;
  var fondo = null;
  var screamTimer = null;
  var camTimer = null;
  var camNextAt = 0;

  function playOnce(src, vol, onend) {
    var a = new Audio();
    a.src = src;
    if (vol != null) a.volume = vol;
    var fin = function () { if (onend) onend(); };
    a.onended = fin;
    a.onerror = fin;
    a.play().catch(function () { if (onend) onend(); });
    return a;
  }
  function scheduleCam() {
    clearTimeout(camTimer);
    camNextAt = Date.now() + 31000;
    camTimer = setTimeout(function () {
      if (!audioOn) return;
      var pool = ['camara-pasos.mp3', 'camara-sonido.mp3', 'camara-grito.mp3'];
      var src = pool[Math.floor(Math.random() * pool.length)];
      $('camNote').textContent = 'SONIDO DETECTADO · SEÑAL DE FUENTE DESCONOCIDA';
      playOnce(src, 0.8, function () {
        if (audioOn) { $('camNote').textContent = 'EL TÚNEL RECUPERA EL SILENCIO'; scheduleCam(); }
      });
    }, 31000);
  }
  function setSound(on) {
    audioOn = on;
    clearTimeout(camTimer);
    clearInterval(screamTimer);
    if (fondo) { fondo.pause(); fondo = null; }
    if (on) {
      fondo = new Audio('fondo.mp3');
      fondo.loop = true;
      fondo.volume = 0.3;
      fondo.play().catch(function () {});
      screamTimer = setInterval(function () {
        playOnce('grito.mp3', 0.9, null);
        toast('¿OÍSTE ESO?');
      }, 34000);
      scheduleCam();
    }
  }

  /* ================= RADIO FNAF (tiempo real, como un sitio de música) ================= */
  var fnafOn = false;
  var fnafAudio = null;
  var fnafStartedOnce = false;
  var FNAF_REF = Date.UTC(2026, 8, 23);
  function fnafPos() {
    if (!fnafAudio || !fnafAudio.duration) return 0;
    return ((Date.now() - FNAF_REF) / 1000) % fnafAudio.duration;
  }
  function syncFnaf() {
    if (!fnafAudio || !fnafAudio.duration || isNaN(fnafAudio.duration)) return;
    var t = fnafPos();
    try {
      if (Math.abs(fnafAudio.currentTime - t) > 0.35) fnafAudio.currentTime = t;
    } catch (e) {}
  }
  function setFnaf(on) {
    fnafOn = on;
    if (on) fnafStartedOnce = true;
    var sel = $('swFnaf'), sst = $('swFnafSt');
    if (sel) sel.classList.toggle('on', on);
    if (sst) sst.textContent = on ? 'ON' : 'OFF';
    if (fnafAudio) { fnafAudio.pause(); }
    if (on) {
      if (!fnafAudio) {
        fnafAudio = new Audio('fnaf.mp3');
        fnafAudio.loop = true;
        fnafAudio.volume = 0.42;
        fnafAudio.addEventListener('loadedmetadata', syncFnaf);
        fnafAudio.addEventListener('error', function () {
          toast('SEÑAL DE RADIO PERDIDA');
          fnafOn = false;
          var el = $('swFnaf'), st = $('swFnafSt');
          if (el) el.classList.remove('on');
          if (st) st.textContent = 'OFF';
        });
      }
      syncFnaf();
      var p = fnafAudio.play();
      if (p && p.catch) p.catch(function () {});
      toast('RADIO FNAF SINTONIZADA');
    }
  }
  setInterval(function () {
    if (!fnafOn || !fnafAudio || fnafAudio.paused) return;
    var t = fnafPos();
    try {
      if (Math.abs(fnafAudio.currentTime - t) > 0.6) fnafAudio.currentTime = t;
    } catch (e) {}
  }, 4000);

  function renderCam(now) {
    if (!$('page-cams').classList.contains('active')) return;
    var d = new Date();
    $('camTime').textContent = fmt(d.getDate()) + '/' + fmt(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + fmt(d.getHours()) + ':' + fmt(d.getMinutes()) + ':' + fmt(d.getSeconds()) + ':' + fmt(d.getMilliseconds(), 3);
    var c2 = $('cam2Time');
    if (c2) c2.textContent = fmt(d.getDate()) + '/' + fmt(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + fmt(d.getHours()) + ':' + fmt(d.getMinutes()) + ':' + fmt(d.getSeconds()) + ':' + fmt(d.getMilliseconds(), 3);
  }
  function onCamsOpen() {
    var v = $('camVideo');
    if (v && v.complete && v.naturalWidth === 0) toast('SEÑAL INTERFERIDA · CAM-01');
    var c2 = $('cam2Video');
    if (c2) {
      var p = c2.play();
      if (p && p.catch) p.catch(function () {});
    }
    if (!fnafStartedOnce) {
      setFnaf(true);
    } else if (fnafOn) {
      var f = fnafAudio && fnafAudio.play();
      if (f && f.catch) f.catch(function () {});
      syncFnaf();
    }
  }

  /* ================= CÁMARA EN PANTALLA COMPLETA ================= */
  function openCamFull(which) {
    var m = $('camFullModal');
    if (!m) return;
    var img = $('camFullImg'), vid = $('camFullVideo'), stamp = $('camFullStamp');
    vid.pause();
    if (which === 1) {
      if (stamp) stamp.textContent = 'CAM 01 · TÚNEL FAURA';
      img.src = 'camara.jpeg';
      img.classList.remove('hide');
      vid.classList.add('hide');
    } else {
      if (stamp) stamp.textContent = 'CAM 02 · GALERÍA NORTE';
      img.classList.add('hide');
      vid.classList.remove('hide');
      vid.currentTime = 0;
      var p = vid.play();
      if (p && p.catch) p.catch(function () {});
    }
    m.hidden = false;
  }
  function closeCamFull() {
    var m = $('camFullModal');
    if (!m) return;
    m.hidden = true;
    $('camFullVideo').pause();
  }
  (function bindCamFull() {
    var m = $('camFullModal');
    if (!m) return;
    m.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.cam-full-head')) return;
      closeCamFull();
    });
    var cam1 = document.querySelector('#page-cams .cams-mons .monitor:first-child .mon-screen');
    if (cam1) cam1.addEventListener('click', function () { openCamFull(1); });
    var cam2 = document.querySelector('#page-cams .cams-mons .monitor:nth-child(2) .mon-screen');
    if (cam2) cam2.addEventListener('click', function () { openCamFull(2); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !m.hidden) closeCamFull(); });
  })();

  /* ================= EVENTOS ================= */
  var events = [];

  function cd(ms) {
    var neg = ms < 0; ms = Math.abs(ms);
    return {
      neg: neg,
      d: Math.floor(ms / DAY),
      h: Math.floor((ms % DAY) / 3600000),
      m: Math.floor((ms % 3600000) / MIN),
      s: Math.floor((ms % MIN) / 1000)
    };
  }
  function stateClass(st) {
    if (st === 'EN PREPARACIÓN') return 'prep';
    if (st === 'CLASIFICADO') return 'class';
    if (st === 'PROGRAMADA') return 'prep';
    return '';
  }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function renderEvents() {
    var list = $('eventsList');
    list.innerHTML = '';
    if (!events.length) { list.innerHTML = '<div class="ev-empty">SIN EVENTOS REGISTRADOS</div>'; return; }
    events.slice().sort(function (a, b) { return new Date(a.fecha) - new Date(b.fecha); })
      .forEach(function (ev) {
        var date = new Date(ev.fecha);
        if (isNaN(date)) return;
        var el = document.createElement('div');
        var featured = ev.info || ev.instrucciones;
        el.className = 'ev-card' + (featured ? ' ev-featured' : '');
        var btns = featured
          ? '<div class="ev-actions">' +
              (ev.info ? '<button class="ev-btn-info" data-act="info" data-id="' + esc(ev.id) + '" title="Información del evento">i</button>' : '') +
              (ev.instrucciones ? '<button class="ev-btn-inst" data-act="inst" data-id="' + esc(ev.id) + '">INSTRUCCIONES</button>' : '') +
            '</div>'
          : '';
        el.innerHTML =
          '<div class="ev-date">' +
          '<div class="ev-topline">' + fmt(date.getDate()) + '</div>' +
          '<div class="ev-my">' + fmt(date.getMonth() + 1) + ' · ' + date.getFullYear() + '</div></div>' +
          '<div class="ev-body">' +
          (featured ? '<span class="ev-ribbon">MISIÓN PRINCIPAL</span>' : '') +
          '<h3>' + esc(ev.titulo) + '</h3>' +
          '<div class="ev-meta"><span class="sector">◆ ' + esc(ev.sector || 'TÚNEL') + '</span>' +
          '<span class="ev-time">' + fmt(date.getHours()) + ':' + fmt(date.getMinutes()) + '</span></div></div>' +
          '<div class="ev-count"><span class="ev-state ' + stateClass(ev.estado) + '">' + esc(ev.estado || 'CONFIRMADO') + '</span>' +
          '<span class="ev-cd" data-end="' + date.getTime() + '"><small>CUENTA ATRÁS · D/H/M/S</small>' +
          '<span class="ev-cd-grid">' +
          '<span class="cd-cell"><b data-cd="d">--</b><i>DÍAS</i></span>' +
          '<span class="cd-cell"><b data-cd="h">--</b><i>HORAS</i></span>' +
          '<span class="cd-cell"><b data-cd="m">--</b><i>MIN</i></span>' +
          '<span class="cd-cell"><b data-cd="s">--</b><i>SEG</i></span>' +
          '</span></span>' + btns + '</div>';
        list.appendChild(el);
      });
    list.querySelectorAll('.ev-btn-info,.ev-btn-inst').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); openEvModal(b.dataset.id, b.dataset.act); });
    });
  }
  function findEvent(id) {
    for (var i = 0; i < events.length; i++) { if (String(events[i].id) === String(id)) return events[i]; }
    return null;
  }
  function openEvModal(id, act) {
    var ev = findEvent(id);
    if (!ev) return;
    var date = new Date(ev.fecha);
    var title = $('evModalTitle'), meta = $('evModalMeta'), body = $('evModalBody');
    title.textContent = ev.titulo;
    meta.innerHTML = '<span class="sector">◆ ' + esc(ev.sector || 'TÚNEL') + '</span>' +
      '<span>' + fmt(date.getDate()) + '/' + fmt(date.getMonth() + 1) + '/' + date.getFullYear() + ' · ' +
      fmt(date.getHours()) + ':' + fmt(date.getMinutes()) + '</span>' +
      '<span>' + esc(ev.estado || 'CONFIRMADO') + '</span>';
    var html = '';
    if (act === 'inst' && ev.instrucciones) {
      html = '<div class="ev-modal-sec">INSTRUCCIONES</div><ol class="ev-modal-list">';
      ev.instrucciones.forEach(function (t) { html += '<li>' + esc(t) + '</li>'; });
      html += '</ol>';
    } else if (ev.info) {
      html = '<div class="ev-modal-sec">INFORMACIÓN DEL EVENTO</div><p class="ev-modal-text">' + esc(ev.info) + '</p>';
    } else {
      html = '<p class="ev-modal-text">SIN INFORMACIÓN ADICIONAL.</p>';
    }
    body.innerHTML = html;
    var m = $('evModal');
    m.hidden = false;
    requestAnimationFrame(function () { m.classList.add('open'); });
  }
  function closeEvModal() {
    var m = $('evModal');
    if (!m) return;
    m.classList.remove('open');
    setTimeout(function () { m.hidden = true; }, 200);
  }
  (function bindEvModal() {
    var m = $('evModal');
    if (!m) return;
    var close = $('evModalClose');
    if (close) close.addEventListener('click', closeEvModal);
    m.addEventListener('click', function (e) { if (e.target === m) closeEvModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !m.hidden) closeEvModal(); });
  })();
  function updateCountdowns() {
    var now = Date.now();
    document.querySelectorAll('.ev-cd').forEach(function (el) {
      var end = parseInt(el.dataset.end, 10);
      var c = cd(end - now);
      var cells = el.querySelectorAll('[data-cd]');
      var vals = {
        d: c.neg ? '—' : fmt(c.d),
        h: c.neg ? '—' : fmt(c.h),
        m: c.neg ? '—' : fmt(c.m),
        s: c.neg ? '—' : fmt(c.s)
      };
      cells.forEach(function (cell) {
        if (cell.textContent !== vals[cell.dataset.cd]) cell.textContent = vals[cell.dataset.cd];
      });
    });
  }
  function loadEvents() {
    fetch('events.json')
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (data) {
        events = Array.isArray(data) ? data : [];
        renderEvents();
      })
      .catch(function () {
        events = [
          { id: 1, titulo: '🌕 REUNIÓN CON EL JEFE', fecha: '2026-09-26T21:00', sector: 'NIVEL 0 · APARCAMIENTO DE ENTES · SÓLO LUNA LLENA', estado: 'PROGRAMADA' },
          { id: 2, titulo: 'INCURSIÓN AL SECTOR 07', fecha: '2026-10-14T22:00', sector: 'TÚNEL · NIVEL −3', estado: 'CONFIRMADO' },
          { id: 3, titulo: 'DESPERTAR DEL MECHA', fecha: '2026-11-01T04:00', sector: 'HANGAR B', estado: 'CLASIFICADO' }
        ];
        renderEvents();
      });
  }

  /* ================= MEDIA FALLBACK ================= */
  var himg = $('homerImg');
  if (himg) {
    himg.addEventListener('error', function () {
      this.classList.add('svg-fb');
      this.onerror = null;
      this.src = 'homer.svg';
    });
  }
  var wvid = document.querySelector('.watcher-video');
  if (wvid) {
    wvid.addEventListener('playing', function () { wvid.classList.add('on'); });
    wvid.addEventListener('error', function () { wvid.classList.remove('on'); });
  }
  var imgTunel = $('tunelImg');
  if (imgTunel) imgTunel.addEventListener('error', function () { imgTunel.style.display = 'none'; });
  var cam2v = $('cam2Video');
  if (cam2v) cam2v.addEventListener('error', function () {
    this.classList.add('off');
  });

  /* ================= EASTER EGGS ================= */
  var turns = 0;
  var hpEl = $('healthPct');
  if (hpEl) hpEl.addEventListener('click', function () {
    turns++;
    if (turns === 3) { turns = 0; toast('EL MECHA TE ESTÁ OBSERVANDO'); }
  });

  var henchClicks = 0;
  var hhEl = $('homeHench');
  if (hhEl) hhEl.addEventListener('click', function () {
    henchClicks++;
    if (henchClicks === 13) {
      henchClicks = 0;
      var el = this;
      el.textContent = '+++';
      el.style.color = 'var(--red)';
      setTimeout(function () {
        el.style.color = '';
        countUp(el, secuacesFor(Math.floor(Date.now() / B30)), 900);
      }, 1400);
      toast('LA NÓMINA NO SE PUEDE LEER');
    }
  });

  var buffer = '';
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    if (/^[a-z]$/.test(k)) {
      buffer = (buffer + k).slice(-5);
      if (buffer === 'homer') { buffer = ''; toast('TE OYERON · SE HA AÑADIDO A TU FICHA'); }
    }
  });

  var KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  var kidx = 0;
  document.addEventListener('keydown', function (e) {
    var key = (e.key || '').toLowerCase();
    kidx = (key === KONAMI[kidx]) ? kidx + 1 : (key === KONAMI[0] ? 1 : 0);
    if (kidx === KONAMI.length) {
      kidx = 0;
      document.body.classList.add('blood');
      setTimeout(function () { document.body.classList.remove('blood'); }, 6000);
      toast('MODO TENEBROSO ACTIVADO');
    }
  });

  var hoverTimer = null;
  var nb = $('navBrand');
  if (nb) {
    nb.addEventListener('mouseenter', function () {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () { toast('NO MIRES ATRÁS'); }, 3000);
    });
    nb.addEventListener('mouseleave', function () { clearTimeout(hoverTimer); });
  }

  var eyeClicks = 0;
  var we = document.querySelector('.watcher');
  if (we) we.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('video')) return;
    eyeClicks++;
    if (eyeClicks === 1) toast('TE VE');
    else if (eyeClicks === 2) toast('NO PESTAÑEE');
    else { eyeClicks = 0; toast('EL OJO NO PERDONA'); }
  });

  var cr = $('creditName');
  if (cr) cr.addEventListener('click', function () {
    cr.classList.add('turned');
    setTimeout(function () { toast('LEALTAD RECONOCIDA · BIENVENIDO A LA CORTE'); }, 650);
  });

  /* ================= LOOP ================= */
  loadEvents();
  (function loop() {
    var now = Date.now();
    tickClock();
    renderLive(now);
    renderMecha(now);
    tickUpdate(now);
    renderBoards(now);
    radarCycle(now);
    renderAnger(now);
    renderCam(now);
    updateCountdowns();
    setTimeout(loop, 500);
  })();
})();