(function () {
  'use strict';

  /* ---------- utils ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n, d) { return String(n).padStart(d || 2, '0'); };

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
  function bounded(hash, min, max) {
    return min + mulberry32(hash)() * (max - min);
  }

  var BUCKET = 10 * 60 * 1000;
  var bucket = function (now) { return Math.floor(now / BUCKET); };
  var nowTimestamp = function () { return Date.now(); };

  var STATUS = ['OPERATIVO', 'PATRULLA', 'VIGILANCIA', 'COMBATE', 'REPARANDO', 'OPERATIVO', 'PATRULLA'];

  function mechaState(b) {
    var r = mulberry32(hashSeed(b * 7919 + 13));
    var st = STATUS[Math.floor(r() * STATUS.length)];
    var prevSt = mechaStatus(b - 1);
    var h;
    if (st === 'REPARANDO') {
      h = 25 + r() * 35;
    } else {
      h = 30 + r() * 70;
      if (prevSt === 'REPARANDO') h = Math.min(100, h + 20);
    }
    var elec;
    if (st === 'COMBATE') elec = 50 + r() * 50;
    else if (st === 'REPARANDO') elec = 5 + r() * 15;
    else elec = r() * 100;
    return {
      status: st,
      health: Math.round(h),
      elec: Math.round(elec)
    };
  }
  function mechaStatus(b) { return mechaState(b).status; }

  var tunnelCount = function (now) { return Math.round(bounded(hashSeed(Math.floor(now / 60000) * 31 + 7), 30, 92)); };
  var henchTotal = function (now) { return Math.round(bounded(hashSeed(Math.floor(now / 86400000) * 53 + 3), 104, 180)); };

  /* ---------- registro irreversible · intervenciones ---------- */
  var DAY = 86400000;
  var baseDay = Math.floor(Date.UTC(2026, 8, 23) / DAY);

  var interDayCache = -1;
  var interCache = null;
  function interFor(day) {
    if (day !== interDayCache) {
      var n = Math.floor((day - baseDay) / 2);
      var types = [14, 7, 5];
      var total = 26;
      for (var e = 0; e < n; e++) {
        var d = baseDay + e * 2;
        if (mulberry32(hashSeed(d * 73 + 3))() < 0.55) {
          var t = Math.floor(mulberry32(hashSeed(d * 97 + 11))() * 3);
          types[t]++; total++;
        }
      }
      interDayCache = day;
      interCache = { total: total, types: types };
    }
    return interCache;
  }

  /* ---------- revelaciones contra Homer ---------- */
  function revelFor(day) {
    var w = Math.floor((day - baseDay) / 8);
    var count = 3;
    var active = false;
    for (var i = 0; i <= w; i++) {
      if (mulberry32(hashSeed((baseDay + i * 8) * 731 + 13))() < 0.5) {
        count++;
        if (i === w) active = true;
      }
    }
    return { count: count, active: active };
  }

  /* ---------- fugas del mecha · ciclos de 10 días · 4h ---------- */
  var escCacheW = -1;
  var escCacheCount = 5;
  function escTrig(i) {
    return mulberry32(hashSeed((baseDay + i * 10) * 173 + 23))() < 0.25;
  }
  function escCountFor(w) {
    if (w !== escCacheW) {
      var count = 5;
      for (var i = 0; i < w; i++) { if (escTrig(i)) count++; }
      escCacheW = w;
      escCacheCount = count;
    }
    return escCacheCount;
  }
  function escapeFor(now) {
    var day = Math.floor(now / DAY);
    var w = Math.floor((day - baseDay) / 10);
    var count = escCountFor(w);
    var active = false;
    if (escTrig(w)) {
      count++;
      var winStart = (baseDay + w * 10) * DAY;
      var r = mulberry32(hashSeed(winStart * 1009 + 51));
      var start = winStart + Math.floor(r() * (10 * DAY - 4 * 3600 * 1000));
      active = (now >= start && now < start + 4 * 3600 * 1000);
    }
    return { count: count, active: active };
  }

  /* ---------- ubicación de Homer · furgoneta 10 min entre 15:00-21:00 ---------- */
  function furgWindow(dayIdx) {
    var utcMidnight = dayIdx * DAY;
    var r = mulberry32(hashSeed(dayIdx * 883 + 29));
    var offMin = Math.floor(r() * 351);
    var start = utcMidnight + 15 * 3600 * 1000 + offMin * 60000;
    return { start: start, end: start + 10 * 60000 };
  }
  function homerLocate(now) {
    var day = Math.floor(now / DAY);
    var w = furgWindow(day);
    var inVan = (now >= w.start && now < w.end);
    var next = w, state;
    if (now >= w.end) {
      next = furgWindow(day + 1);
      state = 'TUNEL';
    } else if (inVan) {
      state = 'VAN';
    } else {
      next = w;
      state = 'TUNEL';
    }
    var msLeft = state === 'VAN' ? w.end - now : next.start - now;
    return { state: state, msLeft: msLeft };
  }
  function renderLoc(now) {
    var inf = homerLocate(now);
    var box = document.querySelector('.homer-loc');
    var stateEl = $('homerLoc');
    var subEl = $('homerLocSub');
    var total = Math.max(0, Math.ceil(inf.msLeft / 1000));
    var hh = Math.floor(total / 3600), mm = Math.floor((total % 3600) / 60), ss = total % 60;
    if (inf.state === 'VAN') {
      box.classList.add('van');
      stateEl.textContent = 'EN LA FURGONETA';
      subEl.textContent = 'FUERA DEL TÚNEL · VENTANA ACTIVA';
      $('locCountdown').textContent = 'RETORNO EN ' + fmt(hh) + ':' + fmt(mm) + ':' + fmt(ss);
    } else {
      box.classList.remove('van');
      stateEl.textContent = 'EN EL TÚNEL';
      subEl.textContent = 'CONTINUO · SIN EXCEPCIONES';
      $('locCountdown').textContent = 'PRÓXIMA EXCURSIÓN EN ' + fmt(hh) + ':' + fmt(mm) + ':' + fmt(ss);
    }
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
    if (rev.active) {
      rEl.textContent = 'REVELADO · EXPUESTO';
      rEl.classList.add('revealed');
    } else {
      rEl.textContent = 'EN SILENCIO';
      rEl.classList.remove('revealed');
    }

    var esc = escapeFor(now);
    $('escapeCount').textContent = esc.count;
    var banner = $('cageBanner');
    var txt = $('cageText');
    if (esc.active) {
      banner.classList.add('danger');
      txt.textContent = 'PELIGRO · HOMER SUELTO';
    } else {
      banner.classList.remove('danger');
      txt.textContent = 'EN LA JAULA';
    }
  }

  /* ---------- clock ---------- */
  function tickClock() {
    var d = new Date();
    $('navClock').textContent = fmt(d.getHours()) + ':' + fmt(d.getMinutes()) + ':' + fmt(d.getSeconds());
  }

  /* ---------- tabs ---------- */
  var buttons = document.querySelectorAll('.tab');
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      buttons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      $('page-' + btn.dataset.tab).classList.add('active');
      var inner = $('page-' + btn.dataset.tab).querySelectorAll('.reveal:not(.in)');
      [].forEach.call(inner, function (el, i) {
        setTimeout(function () { el.classList.add('in'); }, i * 70);
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  /* ---------- count-up ---------- */
  function countUp(el, to, dur) {
    var from = parseInt(el.dataset.v || '0', 10) || 0;
    if (from === to) { el.textContent = to; return; }
    var t0 = performance.now();
    dur = dur || 900;
    (function step(t) {
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * e);
      el.dataset.v = String(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- mecha ---------- */
  var lastBucket = -1;
  function renderMecha(now) {
    var b = bucket(now);
    if (b === lastBucket) return;
    lastBucket = b;
    var s = mechaState(b);
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

    $('elecFill').style.width = s.elec + '%';
    $('elecPct').textContent = s.elec + '%';

    var strength = (1.5 + (s.elec / 100) * 6.5);
    $('strengthVal').textContent = strength.toFixed(1).replace('.', ',') + ' T';
    $('powerFill').style.width = (20 + s.elec * 0.8) + '%';
    $('powerPct').textContent = Math.round(20 + s.elec * 0.8) + '%';

    var discharge = $('dischargeVal');
    var shockNote = $('shockNote');
    if (s.elec >= 70) {
      discharge.textContent = 'ACTIVA';
      discharge.classList.add('hot');
      shockNote.textContent = 'ELECTROCUCIÓN ARMADA';
    } else {
      discharge.textContent = 'EN ESPERA';
      discharge.classList.remove('hot');
      shockNote.textContent = 'ELECTROIMÁN LISTO';
    }
  }

  function tickUpdate(now) {
    var msLeft = BUCKET - (now % BUCKET);
    var m = Math.floor(msLeft / 60000), sec = Math.floor((msLeft % 60000) / 1000);
    $('nextUpdate').textContent = 'ACTUALIZACIÓN EN ' + fmt(m) + ':' + fmt(sec);
  }

  /* ---------- hero + tunnel counters ---------- */
  var lastMin = -1;
  var lastDay = -1;
  function renderTunnel(now) {
    var min = Math.floor(now / 60000);
    var day = Math.floor(now / 86400000);
    if (min !== lastMin) {
      lastMin = min;
      var t = tunnelCount(now);
      countUp($('bigTunnel'), t, 400);
      countUp($('homeTunnel'), t, 400);
    }
    if (day !== lastDay) {
      lastDay = day;
      var h = henchTotal(now);
      countUp($('bigHench'), h, 1300);
      countUp($('homeHench'), h, 1300);
    }
  }

  /* ---------- action feed ---------- */
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
    if (status === 'COMBATE') return ALL_ACTIONS.combat;
    if (status === 'REPARANDO') return ALL_ACTIONS.repair;
    if (status === 'VIGILANCIA') return ALL_ACTIONS.vigilance;
    if (status === 'PATRULLA') return ALL_ACTIONS.patrol;
    return ALL_ACTIONS.operative;
  }

  var feedIdx = 0;
  var lastFeedStatus = '';
  var feedTimer = null;
  function pushFeed(status) {
    if (status !== lastFeedStatus) { lastFeedStatus = status; feedIdx = 0; }
    var pool = actionsFor(status);
    if (feedIdx >= pool.length) feedIdx = 0;
    var msg = pool[feedIdx++];
    var d = new Date();
    var li = document.createElement('li');
    if (status === 'REPARANDO') li.classList.add('hot');
    if (/choque|impacto|descarga|pulso|onda/i.test(msg)) li.classList.add('hot');
    li.innerHTML = '<time>' + fmt(d.getHours()) + ':' + fmt(d.getMinutes()) + ':' + fmt(d.getSeconds()) + '</time><span>' + msg + '</span>';
    var ul = $('actionFeed');
    ul.insertBefore(li, ul.firstChild);
    while (ul.children.length > 8) ul.removeChild(ul.lastChild);
  }
  (function bootFeed() {
    var status = mechaState(bucket(Date.now())).status;
    for (var i = 0; i < 8; i++) { pushFeed(status); }
    feedTimer = setInterval(function () {
      pushFeed(mechaState(bucket(Date.now())).status);
    }, 4300);
  })();

  /* ---------- radar ---------- */
  var radarClicks = 0;
  var blipTimer = null;
  $('radar').addEventListener('click', function () {
    radarClicks++;
    if (radarClicks >= 5) {
      radarClicks = 0;
      var blip = $('radarBlip');
      blip.classList.remove('show');
      void blip.offsetWidth;
      blip.classList.add('show');
      clearTimeout(blipTimer);
      blipTimer = setTimeout(function () { blip.classList.remove('show'); }, 2400);
      $('radarState').textContent = 'CONTACTO PERDIDO';
      setTimeout(function () { $('radarState').textContent = 'SIN CONTACTOS'; }, 2600);
      toast('ALGO SE MOVIÓ EN EL TÚNEL... ¿LO VISTE?');
    }
  });

  /* ---------- easter eggs ---------- */
  function toast(msg, dur) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('show'); }, dur || 2800);
  }

  var turns = 0;
  $('healthPct').addEventListener('click', function () {
    turns++;
    if (turns === 3) { turns = 0; toast('EL MECHA TE ESTÁ OBSERVANDO'); }
  });

  var henchClicks = 0;
  $('homeHench').addEventListener('click', function () {
    henchClicks++;
    if (henchClicks === 13) {
      henchClicks = 0;
      var el = this;
      el.textContent = '+++';
      el.style.color = 'var(--red)';
      setTimeout(function () {
        el.style.color = '';
        var t = tunnelCount(Date.now());
        countUp(el, henchTotal(Date.now()) - (t % 7), 900);
      }, 1400);
      toast('LA NÓMINA NO SE PUEDE LEER');
    }
  });

  var buffer = '';
  document.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if (/^[a-z]$/.test(k)) {
      buffer = (buffer + k).slice(-5);
      if (buffer === 'homer') {
        buffer = '';
        toast('TE OYERON · SE HA AÑADIDO A TU FICHA');
      }
    }
  });

  var KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  var idx = 0;
  document.addEventListener('keydown', function (e) {
    var key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
    idx = (key === KONAMI[idx]) ? idx + 1 : (key === KONAMI[0] ? 1 : 0);
    if (idx === KONAMI.length) {
      idx = 0;
      document.body.classList.add('blood');
      setTimeout(function () { document.body.classList.remove('blood'); }, 6000);
      toast('MODO TENEBROSO ACTIVADO');
    }
  });

  var hovers = 0;
  var hoverTimer = null;
  $('navBrand').addEventListener('mouseenter', function () {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () { toast('NO MIRES ATRÁS'); }, 3000);
  });
  $('navBrand').addEventListener('mouseleave', function () { clearTimeout(hoverTimer); });

  var eyeClicks = 0;
  document.querySelector('.watcher-eye').addEventListener('click', function () {
    eyeClicks++;
    if (eyeClicks === 1) toast('TE VE');
    else if (eyeClicks === 2) toast('NO PESTAÑEE');
    else {
      eyeClicks = 0;
      toast('EL OJO NO PERDONA');
    }
  });

  /* ---------- events ---------- */
  var events = [];
  var OVERRIDE_KEY = 'ht_events_v1';

  function cd(ms) {
    var neg = ms < 0; ms = Math.abs(ms);
    var d = Math.floor(ms / 86400000);
    var h = Math.floor((ms % 86400000) / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    return { neg: neg, d: d, h: h, m: m, s: s };
  }

  function stateClass(st) {
    if (st === 'EN PREPARACIÓN') return 'prep';
    if (st === 'CLASIFICADO') return 'class';
    return '';
  }

  function renderEvents() {
    var list = $('eventsList');
    list.innerHTML = '';
    if (!events.length) {
      list.innerHTML = '<div class="ev-empty">SIN EVENTOS REGISTRADOS</div>';
      return;
    }
    Array.prototype.slice.call(events).sort(function (a, b) { return new Date(a.fecha) - new Date(b.fecha); })
      .forEach(function (ev) {
        var date = new Date(ev.fecha);
        if (isNaN(date)) return;
        var el = document.createElement('div');
        el.className = 'ev-card';
        el.innerHTML =
          '<div class="ev-date"><div class="ev-day">' + fmt(date.getDate()) + '</div>' +
          '<div class="ev-my">' + fmt(date.getMonth() + 1) + ' / ' + date.getFullYear() + '</div></div>' +
          '<div class="ev-body"><h3>' + esc(ev.titulo) + '</h3>' +
          '<div class="ev-meta"><span class="sector">◆ ' + esc(ev.sector || 'TÚNEL') + '</span><span>' + fmt(date.getHours()) + ':' + fmt(date.getMinutes()) + '</span></div></div>' +
          '<div class="ev-count"><span class="ev-state ' + stateClass(ev.estado) + '">' + esc(ev.estado || 'CONFIRMADO') + '</span>' +
          '<span class="ev-cd" data-end="' + date.getTime() + '"><small>CUENTA ATRÁS</small><span class="ev-cd-v">--:--:--:--</span></span></div>';
        list.appendChild(el);
      });
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function updateCountdowns() {
    var now = Date.now();
    document.querySelectorAll('.ev-cd').forEach(function (el) {
      var end = parseInt(el.dataset.end, 10);
      var c = cd(end - now);
      var v = el.querySelector('.ev-cd-v');
      var txt = (c.neg ? '—' : fmt(c.d)) + ' : ' + fmt(c.h) + ' : ' + fmt(c.m) + ' : ' + fmt(c.s);
      if (v.textContent !== txt) v.textContent = txt;
    });
  }

  function loadEvents(cb) {
    var local = null;
    try { local = localStorage.getItem(OVERRIDE_KEY); } catch (e) { local = null; }
    if (local) {
      try { events = JSON.parse(local); renderEvents(); cb && cb(); return; } catch (e) { events = []; }
    }
    fetch('events.json')
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (data) { events = Array.isArray(data) ? data : []; renderEvents(); })
      .catch(function () {
        events = [
          { id: 1, titulo: 'INCURSIÓN AL SECTOR 07', fecha: '2026-10-01T22:00', sector: 'TÚNEL · NIVEL −3', estado: 'CONFIRMADO' },
          { id: 2, titulo: 'DESPERTAR DEL MECHA', fecha: '2026-11-01T04:00', sector: 'HANGAR B', estado: 'CLASIFICADO' }
        ];
        renderEvents();
      })
      .then(function () { cb && cb(); });
  }

  /* editor */
  var editorOpen = false;
  $('btnEditor').addEventListener('click', function () {
    editorOpen = !editorOpen;
    $('eventEditor').hidden = !editorOpen;
    if (editorOpen) renderEditList();
  });

  function renderEditList() {
    var box = $('editList');
    box.innerHTML = '';
    events.forEach(function (ev) {
      var row = document.createElement('div');
      row.className = 'edit-row';
      row.innerHTML =
        '<div><div class="er-title">' + esc(ev.titulo) + '</div>' +
        '<div class="er-date">' + esc(ev.fecha) + ' · ' + esc(ev.sector || 'TÚNEL') + ' · ' + esc(ev.estado || '') + '</div></div>' +
        '<button type="button" class="icon-btn" data-act="edit" title="Editar">✎</button>' +
        '<button type="button" class="icon-btn del" data-act="del" title="Eliminar">✕</button>';
      row.querySelector('[data-act="edit"]').addEventListener('click', function () { fillForm(ev); });
      row.querySelector('[data-act="del"]').addEventListener('click', function () { delEvent(ev.id); });
      box.appendChild(row);
    });
  }

  function fillForm(ev) {
    $('evId').value = ev.id;
    $('evTitle').value = ev.titulo;
    $('evDate').value = ev.fecha;
    $('evSector').value = ev.sector || '';
    $('evState').value = ev.estado || 'CONFIRMADO';
    $('evSubmit').textContent = 'GUARDAR';
    $('evCancel').hidden = false;
  }

  function clearForm() {
    $('eventForm').reset();
    $('evId').value = '';
    $('evSubmit').textContent = 'AÑADIR';
    $('evCancel').hidden = true;
  }

  $('eventForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = $('evId').value;
    var payload = {
      titulo: $('evTitle').value.trim(),
      fecha: $('evDate').value,
      sector: $('evSector').value.trim(),
      estado: $('evState').value
    };
    if (!payload.titulo || !payload.fecha) return;
    if (id) {
      var tgt = events.find(function (x) { return String(x.id) === String(id); });
      if (tgt) Object.assign(tgt, payload);
    } else {
      payload.id = Date.now();
      events.push(payload);
    }
    clearForm();
    renderEvents(); renderEditList();
    toast('EVENTO REGISTRADO EN EL CALENDARIO NEGRO');
  });

  $('evCancel').addEventListener('click', clearForm);

  function delEvent(id) {
    events = events.filter(function (x) { return String(x.id) !== String(id); });
    renderEvents(); renderEditList();
  }

  $('btnSaveLocal').addEventListener('click', function () {
    try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(events)); } catch (e) {}
    toast('GUARDADO EN ESTE DISPOSITIVO·SE VE SOLO AQUÍ');
  });

  $('btnPublish').addEventListener('click', function () {
    var out = $('jsonOut');
    out.hidden = false;
    out.value = JSON.stringify(events, null, 2);
    out.focus(); out.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(out.value).then(function () {
        toast('JSON COPIADO · PÉGALO EN events.json DEL REPOSITORIO');
      }).catch(function () {});
    } else {
      toast('JSON LISTO · CÓPIALO Y PÉGALO EN events.json');
    }
  });

  $('btnReset').addEventListener('click', function () {
    try { localStorage.removeItem(OVERRIDE_KEY); } catch (e) {}
    $('jsonOut').hidden = true;
    loadEvents();
    toast('EVENTOS PÚBLICOS RESTABLECIDOS');
  });

  /* ---------- credit link ---------- */
  var cr = $('creditName');
  cr.addEventListener('click', function () {
    cr.classList.add('turned');
    setTimeout(function () {
      toast('LEALTAD RECONOCIDA · BIENVENIDO A LA CORTE');
    }, 650);
  });

  /* ---------- loop ---------- */
  (function loop() {
    var now = nowTimestamp();
    tickClock();
    renderMecha(now);
    tickUpdate(now);
    renderTunnel(now);
    renderBoards(now);
    updateCountdowns();
    setTimeout(loop, 1000);
  })();

  /* ---------- boot ---------- */
  (function boot() {
    var now = nowTimestamp();
    renderMecha(now);
    renderTunnel(now);
    renderBoards(now);
    loadEvents();
    tickClock();
  })();
})();