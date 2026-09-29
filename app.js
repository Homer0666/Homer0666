(function () {
  'use strict';

  var BUILD_VER = 'V22';
  try {
    var _bv = document.getElementById('buildVer');
    if (_bv) _bv.textContent = BUILD_VER;
  } catch (e) {}
  console.log('HOMER ' + BUILD_VER);

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

  /* ================= ENFADO Y ATAQUES DE IRA DE HOMER ================= */
  var ANGER_B = 30000;
  var ANGER_REF_B = Math.floor(Date.UTC(2026, 8, 23) / ANGER_B);
  var ATK_CAUSES = [
    'MEQUETREFES MOLESTÁNDOME',
    'MEQUETREFES INSULTÁNDOME',
    'PLANES SALIENDO MAL',
    'EL OJO DEL TÚNEL PARPADEÓ DOS VECES SEGUIDAS',
    'LE ROBARON EL ÚLTIMO DÓNUT DE LA CAFETERA',
    'LA MESA EXTRÁIBLE SE ATASCÓ DE NUEVO',
    'UN SECUAZ LE PISÓ LOS PIES EN LA EXTRACCIÓN',
    'LA CEBOLLA DE LA FURGONETA SOLTÓ HUMO',
    'EL SINTETIZADOR PREDETERMINADO SE DESAFINÓ',
    'LE ENCERRARON EL ESPÍRITU EN LA CÁPSULA HELADA'
  ];
  var moodCacheB = -1;
  var angerVal = 40;
  var atkVal = 5;
  var atkActive = 0;
  var atkCause = '';
  function moodWalk(b, now) {
    if (b === moodCacheB) return;
    if (moodCacheB < 0 || b < moodCacheB) {
      angerVal = 40; atkVal = 5; atkActive = 0; atkCause = '';
      moodCacheB = ANGER_REF_B;
      if (b <= moodCacheB) { moodCacheB = b; return; }
    }
    for (var i = moodCacheB + 1; i <= b; i++) {
      var rag = mulberry32(hashSeed(i * 9188 + 71));
      if (atkActive > 0) {
        /* ataque de ira en curso (13-15 pasos = 6:30-7:30 min): el enfado se dispara */
        atkActive--;
        angerVal += 6 + Math.floor(rag() * 20);
        if (angerVal > 100) angerVal = 100;
        if (atkActive === 0) {
          var c = atkCause;
          atkVal = 0;
          atkCause = '';
          logAttack(c, i);
          angerVal -= 18 + Math.floor(rag() * 32);
          if (angerVal < 10) angerVal = 10 + Math.floor(rag() * 22);
          if (angerVal > 100) angerVal = 100;
        }
        moodCacheB = i;
        continue;
      }
      /* medidor de ataques de ira: igual que el enfado, 65% subir / 35% bajar, sube 1-10 (10 rarísimo) */
      var rak = mulberry32(hashSeed(i * 9188 + 71));
      var upAtk = rak() < 0.65;
      var magAtk = 1 + Math.floor(Math.pow(rak(), 2) * 10);
      if (!upAtk) {
        if (atkVal <= 8) magAtk = 1;
        else if (atkVal <= 20) magAtk = Math.min(magAtk, 3);
      }
      atkVal += upAtk ? magAtk : -magAtk;
      if (atkVal < 0) atkVal = 0;
      if (atkVal > 100) atkVal = 100;
      if (atkVal >= 100) {
        atkActive = 13 + Math.floor(rag() * 3);
        atkCause = ATK_CAUSES[Math.floor(rag() * ATK_CAUSES.length)];
        angerVal = 100;
        moodCacheB = i;
        continue;
      }
      /* evolución normal del enfado: 65% subir / 35% bajar, sube 1-10 (10 rarísimo) */
      var re = mulberry32(hashSeed(i * 3341 + 17));
      var up = re() < 0.65;
      var mag = 1 + Math.floor(Math.pow(re(), 2) * 10);
      /* rebalanceo: en los extremos se vuelve a bajar/subir para no quedarse pegado al 100 o al 0 */
      if (up) {
        if (angerVal >= 85) mag = 1;
        else if (angerVal >= 70) mag = Math.min(mag, 3);
      } else {
        if (angerVal <= 8) mag = 1;
        else if (angerVal <= 20) mag = Math.min(mag, 3);
      }
      angerVal += up ? mag : -mag;
      if (angerVal < 0) angerVal = 0;
      if (angerVal > 100) angerVal = 100;
      moodCacheB = i;
    }
  }
  var overloadPrev = false;
  var overloadFxOn = false;
  var shakeSrc = 0;
  function shakeAdd() {
    shakeSrc++;
    var b = document.body;
    if (b) b.classList.add('overload-shake');
  }
  function shakeSub() {
    shakeSrc = Math.max(0, shakeSrc - 1);
    if (shakeSrc === 0) { var b = document.body; if (b) b.classList.remove('overload-shake'); }
  }
  var beepCtx = null;
  function primeAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || beepCtx) return;
      beepCtx = new AC();
    } catch (e) {}
  }
  function resumeAudio() {
    try {
      primeAudio();
      if (beepCtx && beepCtx.state === 'suspended') beepCtx.resume();
    } catch (e) {}
  }
  if (window.addEventListener) {
    window.addEventListener('pointerdown', resumeAudio, { once: true });
    window.addEventListener('keydown', resumeAudio, { once: true });
  }
  function overloadFx() {
    if (overloadFxOn) return;
    overloadFxOn = true;
    var b = document.body;
    shakeAdd();
    if (navigator.vibrate) {
      try { navigator.vibrate([260, 90, 260, 90, 500]); } catch (e) {}
    }
    try {
      if (!beepCtx) primeAudio();
      if (beepCtx) {
        var ctx = beepCtx;
        if (ctx.state === 'suspended') ctx.resume();
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = 820;
        o.connect(g); g.connect(ctx.destination);
        g.gain.value = 0.12;
        o.start();
        setTimeout(function () { try { o.stop(); } catch (e) {} }, 900);
      }
    } catch (e) {}
  }
  function overloadClear() {
    if (!overloadFxOn) return;
    overloadFxOn = false;
    var b = document.body;
    shakeSub();
    if (navigator.vibrate) {
      try { navigator.vibrate(0); } catch (e) {}
    }
  }
  function renderAnger(now) {
    var b = Math.floor(now / ANGER_B);
    moodWalk(b, now);
    var a = angerVal;
    var overload = atkActive > 0;
    if (overload) hasOverload = true;
    var evacShow = overload && atkCause === 'MEQUETREFES INSULTÁNDOME';
    if (overload && !overloadPrev) overloadFx();
    if (!overload && overloadPrev) overloadClear();
    overloadPrev = overload;
    var rl = $('rageLight');
    if (rl) rl.classList.toggle('on', overload);
    var mask;
    if (a >= 100) mask = 'MÁSCARA TÚNEL';
    else if (a >= 50) mask = 'MÁSCARA HOMER ENFADADA';
    else mask = 'MÁSCARA REALISTA';
    /* fuerza: 0% → 250 kg (mínimo), 100% → 425 kg · ataque de ira al 100 → 666 kg */
    var force = atkVal >= 100 ? 666 : Math.round(250 + (a / 100) * 175);
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
    /* barra de ataques de ira */
    var atf = $('atkFill');
    if (atf) {
      atf.style.width = atkVal + '%';
      atf.classList.toggle('full', atkVal >= 100);
    }
    var ap = $('atkPct');
    if (ap) ap.textContent = atkVal + '%';
    var aw = $('atkWarn');
    if (aw) aw.hidden = atkActive <= 0;
    var ac = $('atkCause');
    if (ac) ac.textContent = atkVal >= 100 ? 'CAUSA DEL ATAQUE: ' + atkCause : 'SIN ATAQUE EN CURSO';
    /* sobrecarga: barras rotas como cristal + símbolo de advertencia */
    var aBar = $('angerBar');
    if (aBar) aBar.classList.toggle('crack', overload);
    var tBar = $('atkBar');
    if (tBar) tBar.classList.toggle('crack', overload);
    var aSym = $('angerSym');
    if (aSym) aSym.style.display = overload ? 'block' : 'none';
    var tSym = $('atkSym');
    if (tSym) tSym.style.display = overload ? 'block' : 'none';
    var load = $('atkLoad');
    if (load) load.hidden = !overload;
    var evac = $('atkEvac');
    if (evac) evac.hidden = !evacShow;
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
  function radarPoint(dx, dy) {
    var cx = 50 + (dx / 40) * 40;
    var cy = 50 + ((dy - 60) / 60) * 40;
    var rx = cx - 50, ry = cy - 50;
    var m = Math.sqrt(rx * rx + ry * ry);
    if (m > 46) { rx = (rx / m) * 46; ry = (ry / m) * 46; }
    return { left: 50 + rx, top: 50 + ry };
  }
  function radarCycle(now) {
    var k = Math.floor(now / POS_B);
    if (k === radarK) return;
    radarK = k;
    var p = posWalk(k);
    var x = p.x, y = p.y, z = p.z;

    /* punto rojo = Homer, en el radar circular (vista en planta x/y) */
    var pt = radarPoint(x, y);
    var bl = pt.left, bt = pt.top;
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
    renderRadarDots(now, x, y, z);
    $('radarState').textContent = isEventNight(now) ? 'TODOS CONVERGEN · VHALROK LOS CONTROLA' : 'CONTACTO EN MOVIMIENTO';
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
    { name: 'NIVEL 0', zone: 'APARCAMIENTO DE ENTES', pres: 'HOMER + MARIO', st: 'CONTROLADO · 100% EXPLORADO', cls: 's0' },
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
      var pres = (i === idx || lv.pres !== '—') ? (i === idx ? 'HOMER + MARIO' : lv.pres) : '—';
      el.innerHTML += '<span class="tl-name">' + lv.name + '</span><span class="tl-zone">' + lv.zone + '</span>' +
        '<span class="tl-st">' + lv.st + '</span>' + (pres !== '—' ? '<span class="tl-pres">' + pres + '</span>' : '');
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
  var events = /*EVENTS_INLINE*/[];

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
      html += '<div class="ev-modal-sec">INSTRUCCIONES</div><ol class="ev-modal-list">';
      ev.instrucciones.forEach(function (t) { html += '<li>' + esc(t) + '</li>'; });
      html += '</ol>';
    } else if (ev.info) {
      html += '<div class="ev-modal-sec">INFORMACIÓN DEL EVENTO</div><p class="ev-modal-text">' + esc(ev.info) + '</p>';
    } else if (!ev.objetivos || !ev.objetivos.length) {
      html += '<p class="ev-modal-text">SIN INFORMACIÓN ADICIONAL.</p>';
    }
    if (ev.objetivos && ev.objetivos.length) {
      html = '<div class="ev-modal-sec">MEQUETREFES A LOS QUE CAZAR</div><ul class="ev-modal-obj">' +
        ev.objetivos.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>' + html;
    }
    body.innerHTML = html;
    if (String(ev.id) === '7') {
      var br = document.createElement('div');
      br.className = 'ev-boss-block';
      br.innerHTML = '<span class="stat-label">REGISTRO SELLADO · SOLO ESTE EVENTO</span>' +
        '<span class="lore-boss-name">EL PRIMER CLIENTE</span>';
      body.appendChild(br);
      var fact = document.createElement('div');
      fact.className = 'ev-factura';
      fact.innerHTML = '<span class="stat-label">FACTURA Nº 0007 · SIN IVA</span>' +
        '<span class="fact-line">A FAVOR DE: <del>█████ █████</del> EL PRIMER CLIENTE</span>' +
        '<span class="fact-line">CONCEPTO: CAZA CONTROLADA DE MEQUETREFES (SAMUEL Y DENÍS)</span>' +
        '<span class="fact-line">OBSERVACIONES: PAGO POR ADELANTADO EN ZAPATILLAS SILENCIOSAS</span>' +
        '<span class="fact-num">47.300,00 €</span>' +
        '<span class="fact-tag">DEBE QUEDARSE CIEGO · HOMER</span>';
      body.appendChild(fact);
    }
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
          { id: 3, titulo: 'DESPERTAR DEL MECHA', fecha: '2026-11-01T04:00', sector: 'HANGAR B', estado: 'CLASIFICADO' },
          { id: 7, titulo: 'HABLAR CON SAMUEL Y DENIS', fecha: '2026-10-03T18:30', sector: 'TUNEL · NIVEL 0', estado: 'PLAN SUPREMO', info: 'Hablar con los mequetrefes sin pegarles ni nada. Cada uno paga 5 euros para las ruedas del mecha.' }
        ];
        renderEvents();
      });
  }

  /* ================= INTRUSOS / BANDALOS DEL TÚNEL ================= */
  var B20 = 20 * MIN;
  var B5H = 5 * 3600000;
  var B4D = 4 * DAY;
  var INTR_B20 = Math.floor(Date.UTC(2026, 8, 23) / B20);
  var INTR_B5H = Math.floor(Date.UTC(2026, 8, 23) / B5H);
  var INTR_B4D = Math.floor(Date.UTC(2026, 8, 23) / B4D);
  var intrCacheB = INTR_B20;
  var intrNowVal = 0;
  function intrNowAt(b) {
    if (b === intrCacheB) return intrNowVal;
    if (b < intrCacheB) { intrCacheB = INTR_B20; intrNowVal = 0; }
    for (var i = intrCacheB + 1; i <= b; i++) {
      var r = mulberry32(hashSeed(i * 7013 + 23));
      var mv = 1 + Math.floor(r() * 3);
      intrNowVal += (r() < 0.5 ? -1 : 1) * mv;
      if (intrNowVal < 0) intrNowVal = 0;
      if (intrNowVal > 3) intrNowVal = 3;
    }
    intrCacheB = b;
    return intrNowVal;
  }
  function intrDoneAt(now) {
    var nb = Math.floor(now / B4D) - INTR_B4D;
    if (nb < 0) return 473;
    var s = 473;
    for (var i = 0; i < nb; i++) {
      var r = mulberry32(hashSeed(i * 9137 + 31));
      s += 1 + Math.floor(r() * 3);
    }
    return s;
  }
  function intrEscAt(now) {
    var dayIdx = Math.floor(now / DAY);
    var startB = Math.floor((dayIdx * DAY) / B5H);
    var curB = Math.floor(now / B5H);
    var s = 0;
    for (var i = startB; i <= curB; i++) {
      var r = mulberry32(hashSeed(i * 8841 + 57));
      s += 1 + Math.floor(r() * 3);
    }
    return Math.min(s, 9);
  }
  function renderIntrusos(now) {
    var nowB = Math.floor(now / B20);
    var inEl = $('intrNow');
    if (inEl) inEl.textContent = intrNowAt(nowB);
    var dn = $('intrDone');
    if (dn) dn.textContent = intrDoneAt(now);
    var es = $('intrEsc');
    if (es) es.textContent = intrEscAt(now);
  }

  /* ================= HISTORIAL DE ATAQUES + RACHA ================= */
  var ATK_LOG_KEY = 'homerAtkLog';
  var atkLog = [];
  try { atkLog = JSON.parse(localStorage.getItem(ATK_LOG_KEY)) || []; } catch (e) { atkLog = []; }
  var atkHKey = -1;
  function logAttack(cause, bucketIdx) {
    if (!cause) return;
    var ts = bucketIdx * ANGER_B;
    for (var i = 0; i < atkLog.length; i++) {
      if (atkLog[i].t === ts) return;
    }
    atkLog.push({ t: ts, c: cause });
    if (atkLog.length > 40) atkLog = atkLog.slice(-40);
    try { localStorage.setItem(ATK_LOG_KEY, JSON.stringify(atkLog)); } catch (e) {}
    atkHKey = -1;
  }
  function renderAtkHistory(now) {
    var hist = $('atkHistory');
    if (!hist) return;
    var b = Math.floor(now / ANGER_B);
    var key = b + '|' + atkLog.length;
    if (key === atkHKey) return;
    atkHKey = key;
    hist.innerHTML = '';
    var list = atkLog.slice().reverse();
    if (!list.length) {
      hist.innerHTML = '<li>SIN ATAQUES REGISTRADOS · EL TÚNEL RESPIRA</li>';
    } else {
      list.forEach(function (e) {
        var li = document.createElement('li');
        var d = new Date(e.t);
        var hot = /QUETREFES|INSULT|MOLEST|BURLA/.test(e.c);
        if (hot) li.classList.add('hot');
        var time = document.createElement('time');
        time.textContent = fmt(d.getDate()) + '/' + fmt(d.getMonth() + 1) + '/' + d.getFullYear() +
          ' ' + fmt(d.getHours()) + ':' + fmt(d.getMinutes());
        var span = document.createElement('span');
        span.textContent = e.c;
        li.appendChild(time);
        li.appendChild(span);
        hist.appendChild(li);
      });
    }
    var streakEl = $('atkStreak');
    if (streakEl) {
      var last = list.length ? list[0].t : ANGER_REF_B * ANGER_B;
      var days = Math.max(0, Math.floor((b * ANGER_B - last) / DAY));
      streakEl.textContent = days + ' DÍAS';
    }
  }

  /* ================= CANAL DE HOMER + PREDICCIÓN ================= */
  var HP_CALM = [
    'SIN SEÑAL... LOS TÚNELES CALLAN.',
    'TODO TRANQUILO EN LOS NIVELES. POR AHORA.',
    'LOS SECUACES SE CAMBIAN DE TURNO SIN RUIDO.',
    'EL GOTEO DE LA TUERÍA... NADA MÁS.'
  ];
  var HP_MID = [
    'HE OÍDO PASOS CERCA DE LA FURGONETA BLANCA.',
    'LAS MESAS EXTRÁIBLES AÚN NO ESTÁN MONTADAS EN MI CUARTO.',
    'ESE CEBOLLA SE ME ESCAPÓ Y NADIE LO HA ORGANIZADO.',
    'ALGO HUELE MAL ENTRE LOS NIVELES DEL TÚNEL...'
  ];
  var HP_HIGH = [
    'MEQUETREFES... VENID AQUÍ, COBARDES.',
    'ELLOS QUIEREN QUE EXPLOTE. Y VAYA A EXPLOTAR.',
    'EL OJO PARPADEA CADA VEZ MÁS RÁPIDO.',
    '¡¡¡NO ME MIRÉIS ASÍ, YO SOLO QUIERO DÓNUTS!!!'
  ];
  var HP_OVER = [
    '¡¡ATAQUE DE IRA EN CURSO!! ¡¡HUID!!',
    '¡¡¡LOS HE ENCONTRADO!!!',
    '¡¡¡NADIE SE BURLA DE HOMER!!!',
    '¡¡¡QUE TIREN LAS MÁQUINAS, ESTO ES UN INFIERNO!!!'
  ];
  var STALK_LINES = [
    '—Sami, ¿tienes los cinco euros?',
    '—Sí. Para las ruedas del mecha, como dijo.',
    '—¿Y Denís los otros cinco?',
    '—Aquí están. No los toques.',
    '—¿Y si nos tiende una emboscada?',
    '—Dice que no va a pegar. Y mira quién viene.',
    '—Es MARIO... el grande. No hace ruido.',
    '—Quédate quieto. Que nos hable primero.',
    '—Homer, no vamos a pelear. Traemos los 10 € de las ruedas.',
    '—Mario dice que tú decidirás. Y que si se van a sacrificar, que sea hoy.',
    '—La táctica de los animatrónicos es real. Los cuatro a la vez.'
  ];
  function renderHomerChat(now) {
    var el = $('homerChat');
    if (!el) return;
    var b = Math.floor(now / ANGER_B);
    if (isEventDay(now)) {
      var k = Math.floor((now - Math.floor(now / DAY) * DAY) / (10 * 60000)) % STALK_LINES.length;
      var msg = STALK_LINES[k];
      if (el.textContent !== msg) el.textContent = msg;
      el.classList.toggle('rage', false);
      var pe = $('chatProb');
      if (pe) { if (pe.textContent !== 'TRANSCRIPCIÓN DEL PACTO') pe.textContent = 'TRANSCRIPCIÓN DEL PACTO'; pe.classList.add('high'); }
      return;
    }
    var pool =
      atkActive > 0 ? HP_OVER :
      angerVal >= 80 ? HP_HIGH :
      angerVal >= 50 ? HP_MID : HP_CALM;
    var msg = pool[b % pool.length];
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('rage', atkActive > 0 || angerVal >= 80);
    var prob = Math.min(99, Math.round(atkVal * 0.55 + angerVal * 0.35));
    var pe = $('chatProb');
    if (pe) {
      if (pe.textContent !== prob + '%') pe.textContent = prob + '%';
      pe.classList.toggle('high', prob >= 65);
    }
  }

  /* ================= REALISMO: TERMÓMETRO DEL TÚNEL ================= */
  function renderTunTemp(now) {
    var tt = $('tunTemp');
    var tf = $('tempFill');
    if (!tt && !tf) return;
    var temp = Math.round(18 + angerVal * 0.13 + (atkActive > 0 ? 6 : 0));
    if (tt && tt.textContent !== temp + '°C') tt.textContent = temp + '°C';
    if (tf) {
      tf.style.width = Math.min(100, (temp / 42) * 100) + '%';
      tf.classList.toggle('hot', temp >= 30);
    }
  }

  /* ================= LISTA DE OBJETIVOS ================= */
  var OBJ_FALLBACK = [
    'CAZAR A LOS MEQUETREFES: SAMUEL Y DENÍS',
    'VIGILAR LA ENTRADA DE BANDALOS AL TÚNEL',
    'CELEBRAR LA FIESTA CON LAS MESAS EXTRÁIBLES'
  ];
  function renderObjectives() {
    var el = $('objList');
    if (!el) return;
    var list = null;
    for (var i = 0; i < events.length; i++) {
      if (events[i].objetivos && events[i].objetivos.length) { list = events[i].objetivos; break; }
    }
    if (!list) list = OBJ_FALLBACK;
    var html = list.map(function (t, i) {
      return '<li' + (i === 0 ? ' class="active"' : '') + '>' +
        '<span class="obj-num">' + fmt(i + 1, 2) + '</span>' +
        '<span class="obj-txt">' + esc(t) + '</span></li>';
    }).join('');
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  /* ================= HISTORIA + LORE + JEFE FINAL ================= */
  var INC_T0 = Date.UTC(2026, 8, 20);
  var LORE_LINES = [
    'El Túnel Faura, nivel 0. Aquí nace un gigante: Homer. Dicen que el túnel le paga los dónuts y él vigila sus niveles noche tras noche.',
    'Hace años, los MEQUETREFES aparecieron con sustancia anestésica de farmacia clandestina. Nadie sabe de dónde sacaron el dinero. Alguien los envió.',
    'El comisario de la zona pidió reforzar los controles: Homer donó las mesas extraíbles y las sillas plegables de su propio cuarto para las celebraciones.',
    'Cada furgoneta blanca que aparca frente al túnel trae una nueva pieza del plan. Homer pagó todas. Hasta las zapatillas que cancelan el ruido de los pasos.',
    'Los bandalos entran al amanecer. Se cuelan por la galería norte. Homer los cuenta uno a uno: los que terminan atrapados nunca vuelven a salir.',
    'El primer cliente. Así le llaman al que paga a los MEQUETREFES. Su nombre solo aparece en el registro sellado del evento siete, cuando el plan se ejecuta.'
  ];
  function renderLore(now) {
    var de = $('daysIncident');
    if (de) de.textContent = 'DÍAS DESDE EL INCIDENTE: ' + Math.max(0, Math.floor((now - INC_T0) / DAY));
    var lt = $('loreText');
    if (lt) {
      var di = Math.floor(now / DAY) - Math.floor(INC_T0 / DAY);
      var line = '『 FRAGMENTO DÍA ' + Math.abs(di) + ' 』 ' + LORE_LINES[Math.abs(di) % LORE_LINES.length];
      if (lt.textContent !== line) lt.textContent = line;
    }
    var boss = $('loreBoss');
    if (boss) {
      var show = false;
      for (var i = 0; i < events.length; i++) {
        if (String(events[i].id) === '7') { show = true; break; }
      }
      boss.hidden = !show;
    }
    var bn = $('loreBossName');
    if (bn) bn.textContent = 'EL PRIMER CLIENTE';
  }

  /* ================= CÁMARA: ANOMALÍAS Y DETECCIÓN DE AUDIO ================= */
  var camAnomUntil = 0;
  var camAnomKind = '';
  function setCamAnom(el, kind) {
    if (!el) return;
    el.className = 'cam-anom' + (kind ? ' on' : '');
    el.innerHTML = kind === 'gone'
      ? '<span class="gone">SEÑAL PERDIDA · HOMER FUERA DE CÁMARA</span>'
      : (kind === 'flick' ? '<span class="flick"></span><span class="snow"></span>' : '');
  }
  function renderCamAnom(now) {
    var an1 = $('camAnom1');
    var an2 = $('camAnom2');
    if (!an1 && !an2) return;
    var b10 = Math.floor(now / B10);
    if (now >= camAnomUntil) {
      var r = mulberry32(hashSeed(b10 * 6071 + 5));
      var roll = r();
      camAnomKind = roll < 0.06 ? 'flick' : (roll < 0.085 ? 'gone' : '');
      camAnomUntil = now + (camAnomKind ? 2500 + Math.floor(r() * 4000) : 0);
      setCamAnom(an1, camAnomKind);
      setCamAnom(an2, camAnomKind);
    }
  }
  function renderCamSide(now) {
    var w = $('camWaves');
    if (!w) return;
    var b10 = Math.floor(now / B10);
    w.classList.toggle('scanning', (b10 % 5) < 2);
    var st = $('camStamp');
    if (st) {
      if (now < camAnomUntil) {
        st.textContent = camAnomKind === 'gone' ? 'HOMER FUERA DE CÁMARA' : 'INTERFERENCIA';
      } else if (st.textContent !== 'SEÑAL ESTABLE') {
        st.textContent = 'SEÑAL ESTABLE';
      }
    }
  }

  /* ================= LINTERNA DEL TÚNEL ================= */
  (function bindTorch() {
    var btn = $('torchBtn');
    if (!btn) return;
    function set(on) {
      document.body.classList.toggle('torch-on', on);
      btn.classList.toggle('on', on);
      btn.textContent = on ? '💡 LINTERNA' : '🔦 LINTERNA';
    }
    btn.addEventListener('click', function () {
      var on = !document.body.classList.contains('torch-on');
      set(on);
      toast(on ? 'LINTERNA DEL TÚNEL ENCENDIDA' : 'LINTERNA APAGADA');
    });
  })();

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
    else if (eyeClicks === 3) toast('SIGUE MIRANDO...');
    else if (eyeClicks === 5) {
      eyeClicks = 0;
      var dq = $('darkFlash');
      if (dq) {
        dq.classList.add('on');
        setTimeout(function () { dq.classList.remove('on'); }, 800);
      }
      toast('EL VIGILANTE TE HA VISTO');
    }
  });

  var cr = $('creditName');
  if (cr) cr.addEventListener('click', function () {
    cr.classList.add('turned');
    setTimeout(function () { toast('LEALTAD RECONOCIDA · BIENVENIDO A LA CORTE'); }, 650);
  });

  /* ================= NOVEDADES: REPLAY · BRUTO · LOGROS · ETC ================= */
  var SAT_REF = Date.UTC(2026, 8, 23);
  var hasOverload = false;
  var armUnlocked = false, brutUsed = false, sigilUsed = false;
  var capOpen = false;
  (function initFlags() {
    try { armUnlocked = localStorage.getItem('homerArm') === '1'; } catch (e) {}
    try { brutUsed = localStorage.getItem('homerBrut') === '1'; } catch (e) {}
    try { sigilUsed = localStorage.getItem('homerSigil') === '1'; } catch (e) {}
  })();

  function renderDonuts(now) {
    var el = $('homeDonuts');
    if (!el) return;
    var d = 12 + Math.floor((now - SAT_REF) / (3 * 3600000));
    if (el.dataset.v !== String(d)) { el.dataset.v = String(d); el.textContent = d; }
  }

  function renderTicker(now) {
    var el = $('heroTicker');
    if (!el) return;
    var n = intrNowAt(Math.floor(now / B20));
    var m;
    if (atkActive > 0) m = 'ATAQUE DE IRA EN CURSO · EVACUAR TÚNEL';
    else if (bruteUntil > now) m = 'MODO BRUTO ACTIVO · HOMER CAZANDO';
    else if (document.body.classList.contains('sigil')) m = 'MODO SIGILO · SILENCIO TOTAL';
    else if (document.body.classList.contains('torch-on')) m = 'LINTERNA ACTIVA · ZONAS OSCURAS';
    else if (n > 0) m = n + ' INTRUSO(S) DETECTADO(S) EN EL TÚNEL';
    else m = 'SEÑAL ESTABLE · SECTORES ACTIVOS · SIN INTRUSOS';
    if (el.textContent !== m) el.textContent = m;
  }

  function renderRoom(now) {
    var f = $('roomFill'), p = $('roomPct'), s = $('roomState'), t = $('roomTag');
    if (!f) return;
    var target = null;
    for (var i = 0; i < events.length; i++) {
      if (String(events[i].id) === '7') target = new Date(events[i].fecha);
    }
    var ms = (!target || isNaN(target)) ? 3 * DAY : target.getTime() - now;
    var pct = ms > 0 ? clampNum(Math.round((1 - ms / (3 * DAY)) * 100), 0, 100) : 100;
    f.style.width = pct + '%';
    if (p) p.textContent = pct + '%';
    if (s) {
      var st = ms <= 0 ? 'FIESTA EN CURSO' : ms <= 12 * 3600000 ? 'MONTAJE ACTIVO' : ms <= 48 * 3600000 ? 'PREPARATIVOS' : 'EN REPOSO';
      if (s.textContent !== st) s.textContent = st;
    }
    if (t) {
      t.textContent = ms <= 0
        ? 'LAS MESAS EXTRÁIBLES ESTÁN DESPLEGADAS: LA FIESTA HA EMPEZADO'
        : 'LAS MESAS Y SILLAS YA ESTÁN LISTAS PARA LA FIESTA';
    }
  }

  var presPrev = -1;
  function renderPressure(now) {
    var pEl = $('presPct'), fEl = $('presFill'), tEl = $('presTag');
    if (!fEl) return;
    var bb = Math.floor(now / B30);
    var r = mulberry32(hashSeed(bb * 4721 + 9));
    var val = 30 + Math.floor(r() * 70);
    var alarm = val >= 95;
    pEl.textContent = val + '%';
    fEl.style.width = val + '%';
    fEl.classList.toggle('hot', alarm);
    tEl.textContent = alarm ? '⚠ VÁLVULAS MÁXIMAS · SECTOR SELLADO' : 'VÁLVULAS ESTABLES';
    tEl.classList.toggle('alarm', alarm);
    var c1 = $('camCrack1'), c2 = $('camCrack2');
    if (c1) c1.classList.toggle('on', alarm);
    if (c2) c2.classList.toggle('on', alarm);
    if (alarm && presPrev !== bb) toast('ALERTA: PRESIÓN MÁXIMA EN SALA DE BOMBAS −2');
    presPrev = bb;
  }

  var replayOn = false, replayK = 0, replayInt = null;
  function stopReplay() {
    replayOn = false;
    var b = $('replayBtn');
    if (b) b.classList.remove('on');
    if (replayInt) { clearInterval(replayInt); replayInt = null; }
  }
  function startReplay(now) {
    replayOn = true;
    var b = $('replayBtn');
    if (b) b.classList.add('on');
    var dayIdx = Math.floor(now / DAY);
    replayK = Math.floor((dayIdx * DAY) / B30);
    var endK = Math.floor(now / B30);
    var bl = $('radarBlip');
    if (bl) bl.style.opacity = '0.95';
    replayInt = setInterval(function () {
      if (!replayOn) return;
      if (replayK > endK) { stopReplay(); toast('REPLAY TERMINADO'); return; }
      var p = posWalk(replayK);
      if (bl) {
        bl.style.left = (50 + (p.x / 40) * 40) + '%';
        bl.style.top = (50 + ((p.y - 60) / 60) * 40) + '%';
      }
      replayK++;
    }, 70);
  }

  var XP_STAT = { 'OPERATIVO': 1, 'PATRULLA': 2, 'VIGILANCIA': 1, 'COMBATE': 3, 'REPARANDO': 1 };
  var xpCacheB = -1, xpVal = 0, xpDesc = 0;
  function renderRankMecha(now) {
    var b = Math.floor(now / B10);
    if (b !== xpCacheB) {
      if (xpCacheB < 0) { xpCacheB = B10T0 - 1; xpVal = 0; xpDesc = 0; }
      for (var i = xpCacheB + 1; i <= b; i++) {
        var s = mechaStateAt(i);
        xpVal += XP_STAT[s.status] || 1;
        if (s.status === 'COMBATE' && s.elec >= 70) xpDesc++;
      }
      xpCacheB = b;
    }
    var rank = xpVal >= 2500 ? 'VHALROK' : xpVal >= 800 ? 'REQUIEM' : 'OPERADOR';
    $('mechaRank').textContent = rank;
    var xf = $('xpFill');
    if (xf) xf.style.width = Math.min(100, (xpVal / 3000) * 100) + '%';
    $('xpNum').textContent = xpVal + ' XP';
    $('descCount').textContent = xpDesc;
    var arm = xpDesc >= 15;
    if (arm && !armUnlocked) {
      armUnlocked = true;
      try { localStorage.setItem('homerArm', '1'); } catch (e) {}
      toast('DESBLOQUEADA: MANO DE 10 TONELADAS');
    }
    var sa = $('secretArm');
    if (sa && arm && sa.hidden) sa.hidden = false;
    var dt = $('descTarget');
    if (dt) dt.textContent = arm ? 'ARMA SECRETA OPERATIVA' : (15 - xpDesc) + ' DESCARGAS PARA EL ARMA SECRETA';
  }

  function formatEuros(n) {
    var s = n.toFixed(2).replace('.', ',');
    return s.replace(/(\d)(?=(\d{3})+[,])/g, '$1.');
  }
  function renderBill(now) {
    var el = $('elecBill');
    if (!el) return;
    var val = 127.4 + ((now - SAT_REF) / 3600000) * 0.19 + intrNowAt(Math.floor(now / B20)) * 2.15;
    var txt = formatEuros(val);
    if (el.textContent !== txt) el.textContent = txt;
  }

  var ACH_DEFS = null;
  function renderLogros(now) {
    var el = $('achList');
    if (!el) return;
    var streakDays = 0;
    if (atkLog.length) {
      streakDays = Math.max(0, Math.floor((Math.floor(now / ANGER_B) * ANGER_B - atkLog[atkLog.length - 1].t) / DAY));
    }
    var fest = false;
    for (var i = 0; i < events.length; i++) {
      if (String(events[i].id) === '7') {
        var d = new Date(events[i].fecha);
        fest = !isNaN(d) && now >= d.getTime();
      }
    }
    var defs = [
      ['01', 'PRIMER BANDALO CAPTURADO', intrDoneAt(now) >= 473],
      ['02', 'RACHA DE 7 DÍAS SIN ATAQUE', streakDays >= 7],
      ['03', 'REPRIMIR EL ENFADO (3 DÍAS SIN ATAQUE)', streakDays >= 3],
      ['04', 'SOBREVIVIR A UN ATAQUE DE IRA', hasOverload],
      ['05', 'MANO DE 10 TONELADAS', armUnlocked],
      ['06', 'ABRIR LA CÁPSULA HELADA', capOpen],
      ['07', 'OPERAR EN SILENCIO', sigilUsed],
      ['08', 'ACTIVAR EL MODO BRUTO', brutUsed],
      ['09', 'PRESENCIAR LA FIESTA DEL TÚNEL', fest]
    ];
    var html = defs.map(function (d) {
      return '<li class="' + (d[2] ? 'ach-done' : '') + '"><span class="ach-mark">' + (d[2] ? '✓' : '🔒') + '</span><span>' + d[1] + '</span></li>';
    }).join('');
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  var CHALLENGES = [
    ['SILENCIO TOTAL: QUE NO HAYA NINGÚN ATAQUE DE IRA EN TODO EL DÍA', 0],
    ['PACIENCIA: DEJAR QUE EL ENFADO SUPERE EL 85% SIN EXPLOTAR', 1],
    ['CAZADOR: QUE AL MENOS UN BANDALO CAIGA BAJO TU VIGILANCIA HOY', 2],
    ['SOMBRA: OPERAR EN MODO SIGILO', 3],
    ['GENEROSO: SUPERAR LOS 100 DÓNUTS SERVIDOS', 4]
  ];
  function renderDesafio(now) {
    var el = $('challengeTxt'), st = $('challengeSt');
    if (!el) return;
    var dayIdx = Math.floor(now / DAY);
    var ch = CHALLENGES[((dayIdx - DAY0) % CHALLENGES.length + CHALLENGES.length) % CHALLENGES.length];
    if (el.textContent !== ch[0]) el.textContent = ch[0];
    var done;
    if (ch[1] === 0) done = atkLog.every(function (e) { return Math.floor(e.t / DAY) !== dayIdx; });
    else if (ch[1] === 1) done = angerVal >= 85;
    else if (ch[1] === 2) done = intrEscAt(now) >= 1;
    else if (ch[1] === 3) done = sigilUsed;
    else done = (12 + Math.floor((now - SAT_REF) / (3 * 3600000))) >= 100;
    if (st) {
      st.textContent = done ? 'HECHO' : 'PENDIENTE';
      st.classList.toggle('done', done);
    }
  }

  function renderArchive(now) {
    var el = $('archList');
    if (!el) return;
    var total = intrDoneAt(now);
    var html = '';
    for (var n = 0; n < Math.min(8, total); n++) {
      var id = total - n;
      var dd = new Date(now - n * 4 * DAY);
      html += '<li><span class="arch-id">BANDALO #' + id + '</span><span class="arch-date">' +
        fmt(dd.getDate()) + '/' + fmt(dd.getMonth() + 1) + '/' + dd.getFullYear() + '</span></li>';
    }
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  var WALKIE_MSG = [
    ['██ █████████ ██████...', 'EL PRIMER CLIENTE VIENE...'],
    ['█████████ EN LA █████ ██████', 'MEQUETREFES EN LA FURGONETA BLANCA'],
    ['DENÍS ██████ EN ███████ █████', 'DENÍS CAZADO EN GALERÍA NORTE'],
    ['ABRE LA ██████ ███████ ███', 'ABRE LA CÁPSULA HELADA YA'],
    ['SAMUEL █████ ██ █████ −2', 'SAMUEL VISTO EN NIVEL −2'],
    ['LAS ██████ ██████████ ESTÁN LISTAS', 'LAS MESAS EXTRÁIBLES ESTÁN LISTAS']
  ];
  function walkieJammed() { return intfState.l >= 8; }
  function walkieCut(msg) {
    if (!walkieJammed()) return msg;
    var cut = msg.substr(0, Math.max(4, Math.floor(msg.length / 2)));
    return cut + ' ▒▒▒ SINTONÍA PERDIDA';
  }
  function renderWalkie(now) {
    var el = $('walkieList');
    if (!el) return;
    var off = Math.floor(now / (6 * 3600000)) % WALKIE_MSG.length;
    var j = walkieJammed();
    var html = '';
    for (var i = 0; i < 4; i++) {
      var raw = WALKIE_MSG[(off + i) % WALKIE_MSG.length][0];
      html += '<li>' + (j ? walkieCut(raw) : raw) + '</li>';
    }
    if (el.innerHTML !== html) el.innerHTML = html;
    el.classList.toggle('jammed', j);
  }

  var bruteUntil = 0;
  function syncBrute(now) {
    var active = bruteUntil > now;
    if (!active && bruteUntil !== 0) bruteUntil = 0;
    var b = $('brutBtn'), fv = $('brutFov');
    document.body.classList.toggle('brut', active);
    if (fv) fv.classList.toggle('on', active);
    if (b) {
      b.classList.toggle('on', active);
      if (active) {
        var left = Math.max(0, Math.ceil((bruteUntil - now) / 1000));
        var mm = Math.floor(left / 60), ss = left % 60;
        var t = '⚔ BRUTO ' + fmt(mm) + ':' + fmt(ss);
        if (b.textContent !== t) b.textContent = t;
      } else if (b.textContent !== '⚔ MODO BRUTO') {
        b.textContent = '⚔ MODO BRUTO';
      }
    }
  }
  function setSigil(on) {
    sigilOn = on;
    document.body.classList.toggle('sigil', on);
    var b = $('sigilBtn');
    if (b) b.classList.toggle('on', on);
    if (on) {
      if (spyOn) setSpy(false);
      document.body.classList.remove('torch-on');
      var tb = $('torchBtn');
      if (tb) { tb.classList.remove('on'); tb.textContent = '🔦 LINTERNA'; }
      if (!sigilUsed) {
        sigilUsed = true;
        try { localStorage.setItem('homerSigil', '1'); } catch (e) {}
        toast('MODO SIGILO · NADA HACE RUIDO');
      }
    }
  }

  var powerNext = 0;
  function powerCheck(now) {
    if (powerNext === 0) powerNext = now + 90000 + Math.random() * 70000;
    if (now >= powerNext) {
      var el = $('powerOut');
      if (el) {
        el.classList.add('on');
        setTimeout(function () { el.classList.remove('on'); }, 3900);
      }
      toast('CORTE DE ENERGÍA EN EL TÚNEL');
      powerNext = now + 150000 + Math.random() * 120000;
    }
  }

  (function bindNewStuff() {
    var rp = $('replayBtn');
    if (rp) rp.addEventListener('click', function () {
      if (replayOn) stopReplay();
      else startReplay(Date.now());
    });
    var bb = $('brutBtn');
    if (bb) bb.addEventListener('click', function () {
      if (bruteUntil > Date.now()) {
        bruteUntil = 0;
        toast('MODO BRUTO DESACTIVADO');
      } else {
        bruteUntil = Date.now() + 10 * MIN;
        if (!brutUsed) {
          brutUsed = true;
          try { localStorage.setItem('homerBrut', '1'); } catch (e) {}
        }
        setSigil(false);
        toast('MODO BRUTO ACTIVADO · HOMER SALE A CAZAR (10 MIN)');
      }
    });
    var sb = $('sigilBtn');
    if (sb) sb.addEventListener('click', function () { setSigil(!document.body.classList.contains('sigil')); });
    var wl = $('walkieList');
    if (wl) wl.addEventListener('click', function (e) {
      var li = e.target.closest ? e.target.closest('li') : null;
      if (!li || li.classList.contains('revealed')) return;
      if (walkieJammed()) {
        li.textContent = '▒▒ SIN FRECUENCIA · INTERFERENCIAS ▒▒';
        li.classList.add('revealed');
        return;
      }
      var idx = Array.prototype.indexOf.call(this.children, li);
      var off = Math.floor(Date.now() / (6 * 3600000)) % WALKIE_MSG.length;
      li.textContent = WALKIE_MSG[(off + idx) % WALKIE_MSG.length][1];
      li.classList.add('revealed');
    });
    var cranks = document.querySelectorAll('.crank');
    if (cranks.length) {
      var order = [3, 1, 2], pos = 0;
      Array.prototype.forEach.call(cranks, function (c) {
        c.addEventListener('click', function () {
          if (capOpen) return;
          if (Number(c.dataset.c) === order[pos]) {
            c.classList.add('turned');
            pos++;
            if (pos === order.length) {
              capOpen = true;
              var st = $('capSt');
              if (st) { st.textContent = 'ABIERTA'; st.classList.add('open'); }
              $('capTxt').textContent = 'DENTRO SOLO HAY HIELO Y UN RECIBO TACHADO. EL ESPÍRITU SIGUE EN EL TÚNEL.';
              toast('LA CÁPSULA HELADA SE ABRE ANTE TI');
            }
          } else {
            pos = 0;
            Array.prototype.forEach.call(cranks, function (x) { x.classList.remove('turned'); });
            toast('SECUENCIA INCORRECTA');
          }
        });
      });
    }
    var sa = $('secretArm');
    if (sa && armUnlocked) sa.hidden = false;
  })();

  /* ================= NOVEDADES 2: GRIETA · VENTILACIÓN · INTERFERENCIAS · LLAVE · ZAPATILLAS · ALTAVOZ ================= */
  function renderVents(now) {
    var v = $('ventsState'), t = $('ventsTag');
    if (!v) return;
    var st, tag;
    if (atkActive > 0) { st = 'REVOLUCIONES MÁXIMAS'; tag = 'HOMER ESTÁ CERCA DEL ALTAVOZ. EL AIRE TIEMBLA.'; }
    else if (intrNowAt(Math.floor(now / B20)) > 0) { st = 'GIRO ALTO'; tag = 'ALGO SE MUEVE BAJO LOS VENTILADORES.'; }
    else {
      var r = mulberry32(hashSeed(Math.floor(now / B30) * 883 + 7));
      if (r() < 0.3) { st = 'GIRO ALTO'; tag = 'HOMER PASA DE LARGO. NO LE VEAS LOS PIES.'; }
      else { st = 'NORMAL'; tag = 'FLUJO DE AIRE ESTABLE'; }
    }
    if (v.textContent !== st) v.textContent = st;
    v.classList.toggle('hot', st === 'REVOLUCIONES MÁXIMAS' || st === 'GIRO ALTO');
    if (t.textContent !== tag) t.textContent = tag;
  }

  var INTF_PERIOD = 180000;
  var intfState = { l: 0, t: Date.now() };
  (function initIntf() {
    try {
      var s = JSON.parse(localStorage.getItem('homerIntf') || 'null');
      if (s && typeof s.l === 'number' && s.t) intfState = s;
    } catch (e) {}
  })();
  function renderIntf(now) {
    var el = $('intfLvl');
    if (!el) return;
    var steps = Math.floor((now - intfState.t) / INTF_PERIOD);
    if (steps > 0) {
      var dir = 0;
      for (var i = 0; i < steps; i++) {
        var bb = Math.floor((intfState.t + i * INTF_PERIOD) / INTF_PERIOD);
        var r = hashSeed(bb * 7717 + 3);
        var up = r % 2 === 0;
        var mag = 1 + ((r >> 3) % 10);
        if (up) { intfState.l += mag; dir = 1; }
        else { intfState.l = Math.max(0, intfState.l - mag); dir = -1; }
      }
      intfState.t += steps * INTF_PERIOD;
      try { localStorage.setItem('homerIntf', JSON.stringify(intfState)); } catch (e) {}
      var dl = $('intfDir');
      if (dl) dl.textContent = dir > 0 ? '▲ SUBIENDO' : '▼ BAJANDO';
    }
    if (intfState.t > now) intfState.t = Math.floor(now / INTF_PERIOD) * INTF_PERIOD;
    el.textContent = intfState.l + ' NIVEL';
    var f = $('intfFill');
    if (f) {
      f.style.width = Math.min(100, intfState.l * 10) + '%';
      f.classList.toggle('max', intfState.l > 10);
    }
    var next = Math.max(0, INTF_PERIOD - (now - intfState.t));
    var mm = Math.floor(next / 60000), ss = Math.floor((next % 60000) / 1000);
    var nx = $('intfNext');
    if (nx) nx.textContent = 'PRÓXIMO CAMBIO EN ' + fmt(mm) + ':' + fmt(ss);
  }

  function renderSneaks(now) {
    var el = $('sneaksSt');
    if (!el) return;
    var cur = intrNowAt(Math.floor(now / B20));
    var recent = cur > 0;
    if (!recent) {
      var bb = Math.floor(now / B20);
      for (var i = 1; i <= 6; i++) {
        if (intrNowAt(bb - i) > 0) { recent = true; break; }
      }
    }
    var st, hot;
    if (cur > 0) { st = 'RECIÉN USADAS'; hot = true; }
    else if (recent) { st = 'AÚN CALIENTES'; hot = true; }
    else { st = 'EN REPOSO'; hot = false; }
    el.classList.toggle('hot', hot);
    if (el.textContent !== st) el.textContent = st;
  }

  function renderKey(now) {
    var kb = $('roomKey'), tg = $('keyTag');
    if (!kb) return;
    var fest = false;
    for (var i = 0; i < events.length; i++) {
      if (String(events[i].id) === '7') {
        var d = new Date(events[i].fecha);
        fest = !isNaN(d) && now >= d.getTime();
      }
    }
    if (fest) {
      kb.style.display = 'none';
      if (tg.textContent !== 'LA LLAVE YA NO ESTÁ EN EL CLAVO. ALGUIEN LA COGIÓ.') tg.textContent = 'LA LLAVE YA NO ESTÁ EN EL CLAVO. ALGUIEN LA COGIÓ.';
    } else {
      kb.style.display = '';
      var rl = $('rageLight');
      kb.classList.toggle('swing', !!(rl && rl.classList.contains('on')));
      if (tg.textContent !== 'LLAVE DEL CUARTO · TIENE UNA MARCA COMO UNA ZAPATILLA') tg.textContent = 'LLAVE DEL CUARTO · TIENE UNA MARCA COMO UNA ZAPATILLA';
    }
  }

  var SPEAKER_LINES = ['SIGAN TRABAJANDO', 'NO MIREN ATRÁS', 'EL TÚNEL ES MÍO', 'QUIETOS', 'FUERA DEL TÚNEL', 'HOMER ESTÁ DESCANSANDO', 'LA FIESTA EMPIEZA AL FINAL DEL TURNO'];
  var VHALROK_LINES = ['MIS CUATRO. DESPIERTAN HOY.', 'LO QUE CONTROLA HOMER, LO CONTROLO YO.', 'MARIO, EL SACRIFICIO LO DECIDE ÉL.', 'LOS 4 SUMAN 2348 KG. CONTAD BIEN.'];
  function speakTunnelLine() {
    var now = Date.now();
    var t = SPEAKER_LINES[Math.floor(Math.random() * SPEAKER_LINES.length)];
    var vhalrokVoice = false;
    if (isEventNight(now)) { t = VHALROK_LINES[Math.floor(Math.random() * VHALROK_LINES.length)]; vhalrokVoice = true; }
    else if (isEventDay(now)) t = 'HOY SE HABLA. SIN PEGARLES.';
    else if (atkActive > 0) t = 'SALGAN DEL TÚNEL';
    else if (intrNowAt(Math.floor(now / B20)) > 0) t = 'BANDALOS EN EL TÚNEL. NO SE MUEVAN.';
    var said = false;
    try {
      if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(t);
        u.lang = 'es-ES';
        u.rate = 0.9;
        u.pitch = vhalrokVoice ? 0.15 : 0.4;
        u.volume = 0.9;
        window.speechSynthesis.speak(u);
        said = true;
      }
    } catch (e) {}
    toast('📢 ' + t);
    return said;
  }
  (function bindSpeaker() {
    var sp = $('speakerBtn');
    if (!sp) return;
    sp.addEventListener('click', function () {
      sp.classList.add('on');
      setTimeout(function () { sp.classList.remove('on'); }, 600);
      speakTunnelLine();
    });
  })();
  (function bootMode3() {
    bindSpy();
  })();

  /* ================= MARIO: SECUAZ MÁS LEAL ================= */
  var marioMoodCacheB = -1;
  var marioAnger = 40;
  var marioAtk = 0;
  var marioSpiking = 0;
  var marioCause = '';
  var marioSpikePrev = false;
  function marioMoodWalk(b) {
    if (b === marioMoodCacheB) return;
    if (marioMoodCacheB < 0 || b < marioMoodCacheB) {
      marioAnger = 40; marioAtk = 0; marioSpiking = 0; marioCause = '';
      marioMoodCacheB = ANGER_REF_B;
      if (b <= marioMoodCacheB) { marioMoodCacheB = b; return; }
    }
    for (var i = marioMoodCacheB + 1; i <= b; i++) {
      var rag = mulberry32(hashSeed(i * 81731 + 5));
      if (marioSpiking > 0) {
        marioSpiking--;
        marioAnger += 6 + Math.floor(rag() * 20);
        if (marioAnger > 100) marioAnger = 100;
        if (marioSpiking === 0) {
          marioAtk = 0;
          marioCause = '';
          marioAnger -= 18 + Math.floor(rag() * 32);
          if (marioAnger < 10) marioAnger = 10 + Math.floor(rag() * 22);
          if (marioAnger > 100) marioAnger = 100;
        }
        marioMoodCacheB = i;
        continue;
      }
      var raka = mulberry32(hashSeed(i * 81731 + 5));
      var upAtk = raka() < 0.62;
      var magAtk = 1 + Math.floor(Math.pow(raka(), 2) * 9);
      if (!upAtk) {
        if (marioAtk <= 8) magAtk = 1;
        else if (marioAtk <= 20) magAtk = Math.min(magAtk, 3);
      }
      marioAtk += upAtk ? magAtk : -magAtk;
      if (marioAtk < 0) marioAtk = 0;
      if (marioAtk > 100) marioAtk = 100;
      if (marioAtk >= 100) {
        marioSpiking = 13 + Math.floor(rag() * 3);
        marioCause = ATK_CAUSES[Math.floor(rag() * ATK_CAUSES.length)];
        marioAnger = 100;
        marioMoodCacheB = i;
        continue;
      }
      var ram = mulberry32(hashSeed(i * 81731 + 5));
      var up = ram() < 0.6;
      var mag = 1 + Math.floor(Math.pow(ram(), 2) * 7);
      if (up) {
        if (marioAnger >= 85) mag = 1;
        else if (marioAnger >= 70) mag = Math.min(mag, 3);
      } else {
        if (marioAnger <= 8) mag = 1;
        else if (marioAnger <= 20) mag = Math.min(mag, 3);
      }
      marioAnger += up ? mag : -mag;
      if (marioAnger < 0) marioAnger = 0;
      if (marioAnger > 100) marioAnger = 100;
      marioMoodCacheB = i;
    }
  }
  function marioSpikeFx() {
    shakeAdd();
    setTimeout(shakeSub, 900);
  }
  function renderMario(now) {
    var b = Math.floor(now / ANGER_B);
    marioMoodWalk(b);
    var spike = marioSpiking > 0;
    var mf = spike ? 350 : Math.round(232 + (marioAnger / 100) * 46);
    if (spike && !marioSpikePrev) marioSpikeFx();
    marioSpikePrev = spike;
    var f = $('marioAngerFill');
    if (f) { f.style.width = marioAnger + '%'; f.classList.toggle('rage', marioAnger >= 80); }
    if ($('marioAngerPct')) $('marioAngerPct').textContent = marioAnger + '%';
    if ($('marioAngerMask')) $('marioAngerMask').textContent = marioAnger >= 100 ? 'MÁSCARA TÚNEL' : marioAnger >= 50 ? 'MÁSCARA HOMER ENFADADA' : 'MÁSCARA REALISTA';
    if ($('marioForce')) $('marioForce').textContent = mf + ' KG';
    if ($('marioForceCard')) $('marioForceCard').innerHTML = mf + ' <i>kg</i>';
    if ($('marioAtkFill')) $('marioAtkFill').style.width = marioAtk + '%';
    if ($('marioAtkPct')) $('marioAtkPct').textContent = marioAtk + '%';
    var maw = $('marioAtkWarn');
    if (maw) maw.hidden = marioSpiking <= 0;
    var mac = $('marioAtkCause');
    if (mac) mac.textContent = spike ? 'CAUSA DEL ATAQUE: ' + marioCause : 'SIN ATAQUE EN CURSO';
    if ($('marioAngerBar')) $('marioAngerBar').classList.toggle('crack', spike);
    if ($('marioAtkBar')) $('marioAtkBar').classList.toggle('crack', spike);
    if ($('marioAngerSym')) $('marioAngerSym').style.display = spike ? 'block' : 'none';
    if ($('marioAtkSym')) $('marioAtkSym').style.display = spike ? 'block' : 'none';
    var homerF = atkVal >= 100 ? 666 : Math.round(250 + (angerVal / 100) * 175);
    var joint = homerF + mf;
    if ($('jointForce')) $('jointForce').textContent = joint + ' KG';
    if ($('jointName')) {
      var jn = (spike || atkActive > 0)
        ? 'ATAQUE DE IRA EN CURSO · MAXIMIZAR DESTRUCCIÓN'
        : 'FUERZA COMBINADA EN TIEMPO REAL';
      if ($('jointName').textContent !== jn) $('jointName').textContent = jn;
    }
    renderDestruccion(homerF, mf);
  }

  var DESTRU_TARGETS = [
    ['PLACA DE CEMENTO', 235],
    ['PARED DE LADRILLO', 265],
    ['PUERTA BLINDADA', 350],
    ['MURO DE HORMIGÓN ARMADO', 430],
    ['BARRERA DEL TÚNEL', 520],
    ['ESTRUCTURA DE UN TREN DE CARGA', 610],
    ['BÓVEDA DE BANCO', 780],
    ['PUENTE PEATONAL', 900]
  ];
  function renderDestruccion(homerF, marioF) {
    var el = $('destruList');
    if (!el) return;
    var joint = homerF + marioF;
    var canBreak = 0;
    var html = DESTRU_TARGETS.map(function (t) {
      var canJ = joint >= t[1];
      var canH = homerF >= t[1];
      var canM = marioF >= t[1];
      var who;
      if (canJ) who = '<span class="who both">EN CONJUNTO</span>';
      else if (canH && canM) who = '<span class="who both">HOMER SOLO · MARIO SOLO</span>';
      else if (canH) who = '<span class="who h">HOMER SOLO</span>';
      else if (canM) who = '<span class="who m">MARIO SOLO</span>';
      else who = '<span class="who na">NADIE AÚN</span>';
      if (canJ) canBreak++;
      return '<li><span class="dst-name">' + t[0] + '</span><span class="dst-need">' + t[1] + ' KG</span>' + who + '</li>';
    }).join('');
    if (el.innerHTML !== html) el.innerHTML = html;
    var su = $('destruSum');
    if (su) su.textContent = 'PODRÍAN ROMPER DE UN PUÑETAZO: ' + canBreak + ' DE ' + DESTRU_TARGETS.length;
  }

  /* ================= NOVEDADES 3: 3 DE OCTUBRE · RADAR 4 · ESPÍA · DIARIO · ALIJO ================= */
  function ev7Date() {
    var ms = -1;
    for (var i = 0; i < events.length; i++) {
      if (String(events[i].id) === '7') {
        var d = new Date(events[i].fecha);
        ms = isNaN(d) ? -1 : d.getTime();
      }
    }
    return ms < 0 ? null : ms;
  }
  function eventDaysLeft(now) {
    var t = ev7Date();
    return t == null ? null : Math.ceil((t - now) / DAY);
  }
  function isEventDay(now) {
    var t = ev7Date();
    if (t == null) return false;
    return Math.floor(t / DAY) === Math.floor(now / DAY);
  }
  function isEventNight(now) {
    var t = ev7Date();
    return t != null && now >= t - 3600000 && now < t + 6 * 3600000;
  }

  function renderTicTac(now) {
    var n = $('tickNum'), c = $('tickClue');
    if (!n) return;
    var left = eventDaysLeft(now);
    if (left == null) { if (n.textContent !== '-- DÍAS') n.textContent = '-- DÍAS'; return; }
    var txt, clue = 'EL PLAN SIGUE EN MARCHA';
    if (left <= 0) { txt = 'HOY ES EL DÍA'; clue = 'LA FIESTA Y EL PACTO: HABLAR CON SAMUEL Y DENÍS'; }
    else if (left === 1) { txt = '1 DÍA'; clue = 'VHALROK SE MUEVE ENTRE LOS 4.'; }
    else if (left <= 3) { txt = left + ' DÍAS'; clue = 'VHALROK SE MUEVE ENTRE LOS 4.'; }
    else if (left <= 10) { txt = left + ' DÍAS'; clue = 'LOS ANIMATRÓNICOS PARPADEAN EN EL RADAR.'; }
    else if (left <= 20) { txt = left + ' DÍAS'; clue = 'LAS MESAS SE DESPLIEGAN SOLAS POR LAS NOCHES.'; }
    else if (left <= 30) { txt = left + ' DÍAS'; clue = 'RECOGER LOS 5 € DE CADA MEQUETREFIE.'; }
    else { txt = left + ' DÍAS'; }
    if (n.textContent !== txt) n.textContent = txt;
    if (c.textContent !== clue) c.textContent = clue;
  }

  function renderThreat(now) {
    var el = $('thr1');
    if (!el) return;
    var left = eventDaysLeft(now);
    var pct = left == null ? 0 : left <= 0 ? 100 : Math.min(100, Math.round((1 - left / 30) * 100));
    var ids = ['thr1', 'thr2', 'thr3', 'thr4'];
    for (var i = 0; i < 4; i++) {
      var f = $(ids[i]);
      if (f) {
        var p = Math.min(100, pct + (i < 2 ? 0 : 2));
        f.style.width = p + '%';
        f.classList.toggle('wake', isEventNight(now) || p >= 100);
      }
    }
    var t = $('threatTag');
    if (t) {
      var msg = isEventNight(now) ? 'HORA DEL PACTO · LOS 4 CONTROLADOS · 2348 KG' : 'LOS CUATRO CONTROLADOS POR VHALROK · 2348 KG';
      if (t.textContent !== msg) t.textContent = msg;
    }
  }

  var R4_IDS = [
    ['radarDotM', 'MARIO', 'tmDotM'],
    ['radarDotFd', 'FREDDY', 'tmDotFd'],
    ['radarDotCh', 'CHICA', 'tmDotCh'],
    ['radarDotBn', 'BONNIE', 'tmDotBn'],
    ['radarDotFx', 'FOXY', 'tmDotFx'],
    ['radarDotVh', 'VHALROK', 'tmDotVh']
  ];
  var radarDotsFirst = true;
  var vhalCacheB = -1;
  var vhalState = { x: 0, y: 60 };
  function vhalWalk(b) {
    if (b === vhalCacheB) return vhalState;
    if (vhalCacheB < 0 || b < vhalCacheB) {
      vhalCacheB = Math.floor(Date.UTC(2026, 8, 23) / POS_B);
      vhalState = { x: 0, y: 60 };
      if (b <= vhalCacheB) { vhalCacheB = b; return vhalState; }
    }
    for (var i = vhalCacheB + 1; i <= b; i++) {
      var r = mulberry32(hashSeed(i * 3319 + 77));
      vhalState.x += (r() * 8 - 4);
      vhalState.y += (r() * 8 - 4);
      if (vhalState.x < -38) vhalState.x = -38;
      if (vhalState.x > 38) vhalState.x = 38;
      if (vhalState.y < 2) vhalState.y = 2;
      if (vhalState.y > 118) vhalState.y = 118;
    }
    vhalCacheB = b;
    return vhalState;
  }
  function renderRadarDots(now, x, y, z) {
    var k = Math.floor(now / POS_B);
    var ra = mulberry32(hashSeed(k * 737 + 19));
    var ang = ra() * Math.PI * 2;
    var rdo = 12 + ra() * 14;
    var v = vhalWalk(k);
    for (var i = 0; i < R4_IDS.length; i++) {
      var el = $(R4_IDS[i][0]);
      var tm = $(R4_IDS[i][2]);
      var dx, dy, lv;
      if (i === 0) {
        dx = x; dy = y; lv = Math.max(0, Math.min(5, Math.round(z)));
      } else if (i === R4_IDS.length - 1) {
        dx = v.x; dy = v.y; lv = Math.abs((k * 3 + 5) % 6);
      } else {
        var a = ang + ((i - 1) * Math.PI) / 2;
        dx = clampNum(x + Math.cos(a) * rdo * 0.8, -40, 40);
        dy = clampNum(y + Math.sin(a) * rdo * 0.8, 0, 120);
        lv = Math.abs(Math.floor(k / 2) + i * 3) % 6;
      }
      if (isEventNight(now)) { dx = x; dy = y; lv = Math.max(0, Math.min(5, Math.round(z))); }
      var pt = radarPoint(dx, dy);
      var dl = pt.left, dt = pt.top;
      if (el) {
        if (radarDotsFirst) {
          el.style.transition = 'none';
          el.style.left = dl + '%';
          el.style.top = dt + '%';
          void el.offsetWidth;
          el.style.transition = '';
        } else {
          el.style.left = dl + '%';
          el.style.top = dt + '%';
        }
      }
      if (tm) {
        if (radarDotsFirst) {
          tm.style.transition = 'none';
          tm.style.left = (5 + ((dx + 40) / 80) * 90) + '%';
          tm.style.top = (6 + (lv / 5) * 88) + '%';
          tm.style.transition = '';
        } else {
          tm.style.left = (5 + ((dx + 40) / 80) * 90) + '%';
          tm.style.top = (6 + (lv / 5) * 88) + '%';
        }
      }
    }
    radarDotsFirst = false;
  }

  function renderLoot(now) {
    var night = isEventNight(now);
    var s5 = $('sam5St'), d5 = $('den5St');
    if (s5) { s5.textContent = night ? 'RECIBIDO' : 'PENDIENTE'; s5.classList.toggle('got', night); }
    if (d5) { d5.textContent = night ? 'RECIBIDO' : 'PENDIENTE'; d5.classList.toggle('got', night); }
    var lm = $('lootMsg');
    if (lm) {
      var msg = night
        ? '✅ ALIJO ABIERTO: "5 € DE CADA UNO. LAS RUEDAS DEL MECHA VAN A RODAR. DIOS MÍO, VAN A HABLAR."'
        : 'EL ALIJO SE ABRE EL DÍA DEL PACTO CON LOS 10 € DE LAS RUEDAS.';
      if (lm.textContent !== msg) lm.textContent = msg;
    }
    var lb = $('lootBtn');
    if (lb) lb.disabled = !night;
  }

  function renderMechaWheels(now) {
    var t = $('wheelSt');
    if (!t) return;
    var night = isEventNight(now);
    var euros = night ? 10 : 0;
    if (t.textContent !== 'FONDOS ' + euros + '/10 €') t.textContent = 'FONDOS ' + euros + '/10 €';
    t.classList.toggle('got', night);
    var f = $('wheelFill');
    if (f) { f.style.width = (euros / 10) * 100 + '%'; f.classList.toggle('ready', night); }
    var tg = $('wheelTag');
    if (tg) tg.textContent = night ? 'RUEDAS MONTADAS · EL MECHA RODARÁ' : 'CADA MEQUETREFIE PAGA 5 € · FALTAN ' + (10 - euros) + ' €';
  }

  var spyOn = false;
  function setSpy(on) {
    spyOn = on;
    document.body.classList.toggle('spy', on);
    var b = $('spyBtn');
    if (b) b.classList.toggle('on', on);
    if (on) setSigil(false);
  }
  function bindSpy() {
    var sp = $('spyBtn');
    if (sp) sp.addEventListener('click', function () { setSpy(!spyOn); });
  }

  function renderSustancia(now) {
    var el = $('anestVal');
    if (!el) return;
    var caps = Math.max(0, intrDoneAt(now) - 473);
    var an = Math.max(0, 24 - Math.floor(caps / 3));
    if (el.textContent !== an + '/24') el.textContent = an + '/24';
    var t = $('anestTag');
    if (t) t.textContent = an <= 0 ? 'SIN SUSTANCIA: NO SE DUERME A NADIE' : 'SE AGOTA CON CADA CAPTURA';
  }

  var SECUACES = [
    ['MARIO · EL PULMÓN DEL TÚNEL', 99],
    ['ADAM', 78],
    ['ALBERTO', 76],
    ['PEDRO EL CONSERJE', 54],
    ['JUAN EL DE LA FURGONETA', 41]
  ];
  function loyalLevel(day, i) {
    var idx = i === 0 ? levelFor(day) : (levelFor(day) + i * 2) % LEVELS.length;
    return LEVELS[idx].name;
  }
  function renderLoyal(now) {
    var el = $('loyalList');
    if (!el) return;
    var day = Math.floor(now / DAY);
    var html = SECUACES.map(function (s, i) {
      var wob = i === 0 ? 0 : Math.floor((hashSeed(day * 333 + i * 7) % 6) - 3);
      var v = Math.max(1, Math.min(100, s[1] + wob));
      return '<li class="' + (i === 0 ? 'star' : '') + '"><span class="loyal-rank">#' + (i + 1) + '</span><span>' + s[0] + '</span><span class="loyal-lvl">' + loyalLevel(day, i) + '</span><span class="loyal-pct' + (i === 0 ? ' max' : '') + '">' + v + '%</span></li>';
    }).join('');
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  var DIARY_LINES = [
    'Hoy Homer me ha mirado dos segundos más. Eso significa que confía.',
    'Los animatrónicos no duermen. Yo tampoco desde el incidente.',
    'Samuel y Denís van a traer 5 € cada uno. Para las ruedas del mecha.',
    'La furgoneta blanca no da demasiado de sí. Los asientos, al menos.',
    'Vhalrok me habló en sueños. Decía nombres de los cuatro.',
    'Si mañana me toca a mí, que Homer recuerde de dónde salí.'
  ];
  function renderDiary(now) {
    var el = $('diaryTxt');
    if (!el) return;
    var di = Math.abs(Math.floor(now / DAY) - Math.floor(INC_T0 / DAY));
    var line = DIARY_LINES[di % DIARY_LINES.length];
    if (el.textContent !== line) el.textContent = line;
    el.classList.toggle('blur', di < 14);
    el.classList.toggle('tremble', atkActive > 0 || marioSpiking > 0);
  }

  function renderBreath(now) {
    var bb = Math.floor(now / (30 * 60000));
    var on = (hashSeed(bb * 1919 + 5) % 7) === 0;
    var ms = document.querySelectorAll('.mon-screen');
    for (var i = 0; i < ms.length; i++) ms[i].classList.toggle('breathe', on);
  }

  function applyCeguera(now) {
    var night = isEventNight(now);
    if (!night) return;
    var hSt = Math.floor((now - ev7Date()) / 3600000);
    var c1 = $('camAnom1'), c2 = $('camAnom2');
    if (c1 && hSt >= 0) {
      c1.style.display = 'flex';
      c1.style.background = '#000';
      c1.style.color = '#333';
      c1.textContent = 'SEÑAL PERDIDA';
    }
    if (c2 && hSt >= 1) {
      c2.style.display = 'flex';
      c2.style.background = '#000';
      c2.style.color = '#333';
      c2.textContent = 'SEÑAL PERDIDA';
    }
  }

  function renderEventNight(now) {
    var night = isEventNight(now);
    document.body.classList.toggle('party', night);
    if (night && !document.body.querySelector('.party-glow')) {
      var d2 = document.createElement('div');
      d2.className = 'party-glow';
      document.body.appendChild(d2);
    } else if (!night && document.body.querySelector('.party-glow')) {
      var pg = document.body.querySelector('.party-glow');
      if (pg) pg.parentNode.removeChild(pg);
    }
  }

  function renderDuelo(now) {
    var t = $('dueloTxt');
    if (!t) return;
    var homerF = atkVal >= 100 ? 666 : Math.round(250 + (angerVal / 100) * 175);
    var mf = marioSpiking > 0 ? 350 : Math.round(232 + (marioAnger / 100) * 46);
    var joint = homerF + mf;
    var anim = 2348;
    var verdict = joint >= anim ? 'IGUALAN A LOS 2348 KG DEL COMBINADO ANIMATRÓNICO' : (anim - joint) + ' KG POR DEBAJO DE LOS 2348 KG ANIMATRÓNICOS';
    t.textContent = joint + ' KG vs ' + anim + ' KG · ' + verdict;
  }

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
    renderMario(now);
    renderCam(now);
    renderCamAnom(now);
    renderCamSide(now);
    renderIntrusos(now);
    renderObjectives();
    renderAtkHistory(now);
    renderHomerChat(now);
    renderTunTemp(now);
    renderLore(now);
    renderDonuts(now);
    renderTicker(now);
    renderTicTac(now);
    renderThreat(now);
    renderRoom(now);
    renderPressure(now);
    renderVents(now);
    renderIntf(now);
    renderSneaks(now);
    renderKey(now);
    renderLoot(now);
    renderMechaWheels(now);
    renderSustancia(now);
    renderLoyal(now);
    renderDiary(now);
    renderBreath(now);
    renderDuelo(now);
    applyCeguera(now);
    renderEventNight(now);
    renderRankMecha(now);
    renderBill(now);
    renderLogros(now);
    renderDesafio(now);
    renderArchive(now);
    renderWalkie(now);
    syncBrute(now);
    powerCheck(now);
    updateCountdowns();
    setTimeout(loop, 500);
  })();
})();