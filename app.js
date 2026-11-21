/* Tubig: map-first water service checker. Runs in the browser; nothing a user enters is stored on a server.
   The chosen place name (or, with "Use my location", coordinates) is sent to OpenStreetMap Nominatim. */
(() => {
  'use strict';
  /* ---------- helpers ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const core = s => norm(s).replace(/\bcity of\b|\bcity\b|\bmunicipality of\b|\bwater district\b|\bmetro\b/g, ' ').replace(/\s+/g, ' ').trim();
  const fmtN = n => (n == null || n === '' ? '—' : Number(n).toLocaleString('en-US'));
  const peso = n => '₱' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = n => (Math.round(n * 1000) / 10).toString().replace(/\.0$/, '') + '%';
  const fmtDate = d => { const t = new Date(d + 'T00:00:00'); return isNaN(t) ? d : t.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }); };
  const lc = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  const bLabel = b => /^(barangay|poblacion)/i.test(b) ? b : 'Barangay ' + b;
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesk = () => innerWidth >= 900;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* unavailable */ } }
  };
  const I = {
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    city: '<svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V8l6-4v17M19 21V11l-8-3"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
    ring: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
    locate: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>',
    drop: '<svg viewBox="0 0 24 24"><path d="M12 3s-7 8.2-7 12.4a7 7 0 0 0 14 0C19 11.2 12 3 12 3z"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    gauge: '<svg viewBox="0 0 24 24"><path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/></svg>',
    flask: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/></svg>',
    bill: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/></svg>',
    tool: '<svg viewBox="0 0 24 24"><path d="M14 6a4 4 0 0 0-5 5l-6 6 3 3 6-6a4 4 0 0 0 5-5l-3 3-3-3z"/></svg>',
    plug: '<svg viewBox="0 0 24 24"><path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.01"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
    print: '<svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><rect x="6" y="14" width="12" height="7"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>'
  };
  function toast(msg) {
    const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = I.check + esc(msg);
    $('#toasts').appendChild(el); setTimeout(() => el.remove(), 2600);
  }

  /* ---------- data ---------- */
  const D = {};
  const load = (f, opt) => fetch('data/' + f).then(r => { if (!r.ok) { if (opt) return null; throw new Error(f); } return r.json(); }).catch(e => { if (opt) return null; throw e; });
  const ready = Promise.all([load('obligations.json'), load('districts.json'), load('complaints.json'), load('mcwd.json'), load('tariffs.json', true)])
    .then(([o, d, c, m, t]) => { D.ob = o; D.districts = d; D.complaints = c; D.mcwd = m; D.tariffs = t || { districts: {} }; D.dIndex = Object.fromEntries(d.map((x, i) => [x.id, i])); });
  let placesP = null;
  function loadPlaces() {
    if (!placesP) placesP = load('places.json').then(p => {
      D.places = p; D.muniByCode = Object.fromEntries(p.munis.map((m, i) => [m.c, i]));
      const idx = [];
      p.munis.forEach((m, i) => {
        idx.push({ t: norm(m.n), full: norm(m.n + ' ' + m.p), name: m.n, sub: m.p, mi: i, b: null, pop: m.pop || 0, kind: 0 });
        (p.brgys[m.c] || []).forEach(([bn, pop]) => idx.push({ t: norm(bn), full: norm(bn + ' ' + m.n + ' ' + m.p), name: bn, sub: `${m.n}, ${m.p}`, mi: i, b: bn, pop: pop || 0, kind: 1 }));
      });
      D.index = idx;
    });
    return placesP;
  }

  /* ---------- state ---------- */
  const S = Object.assign({ muni: null, brgy: null, ptype: null, answers: {}, lat: null, lon: null, exact: false }, store.get('tubig-state', {}));
  const save = () => store.set('tubig-state', { muni: S.muni, brgy: S.brgy, ptype: S.ptype, answers: S.answers, lat: S.lat, lon: S.lon, exact: S.exact });
  const muni = () => (S.muni && D.places) ? D.places.munis[D.muniByCode[S.muni]] : null;
  const wd = () => { const m = muni(); return m && m.wd != null ? D.districts[m.wd] : null; };
  const jvOp = () => (S.ptype === 'wd' && wd() && wd().op) ? wd().op : null;
  const isMCWD = () => S.ptype === 'wd' && wd() && wd().n === 'Mabalacat City Water District';
  const detectType = m => /metro manila/i.test(m.p) ? 'mwss' : (m.wd != null ? 'wd' : 'lgu');
  const placeLabel = () => { const m = muni(); return m ? (S.brgy ? bLabel(S.brgy) + ', ' : '') + `${m.n}, ${m.p}` : ''; };
  const providerName = () => { const w = wd(); if (S.ptype === 'wd' && w) return w.n; if (S.ptype === 'mwss') return 'Manila Water or Maynilad'; return D.ob.providers[S.ptype].name; };
  const tariffFor = () => {
    const w = wd(); if (S.ptype !== 'wd' || !w) return null;
    const t = D.tariffs.districts || {};
    return t[w.id] || null;
  };

  /* ---------- map ---------- */
  const PH = [[4.4, 116.6], [21.3, 127.0]];
  const map = L.map('map', { zoomControl: false });
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  const pad = () => isDesk() ? { paddingTopLeft: [452, 80], paddingBottomRight: [40, 40] } : { paddingTopLeft: [20, 70], paddingBottomRight: [20, sheetPx() + 20] };
  const fitPH = () => map.fitBounds(PH, pad());
  let pinLayer = null;
  function showPin(lat, lon, label, exact) {
    if (pinLayer) map.removeLayer(pinLayer);
    const r = exact ? 700 : 2500;
    pinLayer = L.layerGroup([
      L.circle([lat, lon], { radius: r, color: '#1D4E89', weight: 2, fillColor: '#78A6E0', fillOpacity: .18 }),
      L.circleMarker([lat, lon], { radius: 9, color: '#fff', weight: 3, fillColor: '#CF5921', fillOpacity: 1 }).bindTooltip(esc(label), { permanent: true, direction: 'top', offset: [0, -10], className: 'pin-tip' })
    ]).addTo(map);
    map.flyToBounds(L.latLng(lat, lon).toBounds(r * 3.2), Object.assign({ duration: RM ? 0 : 1.2, maxZoom: 15 }, pad()));
  }
  const geoCache = {};
  async function geocode(m, b) {
    const key = m.c + '|' + (b || ''); if (geoCache[key]) return geoCache[key];
    const qs = [b ? `${b}, ${m.n}, ${m.p}, Philippines` : null, `${m.n}, ${m.p}, Philippines`].filter(Boolean);
    for (const q of qs) {
      try {
        const j = await (await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=' + encodeURIComponent(q))).json();
        if (j && j[0]) return (geoCache[key] = { lat: +j[0].lat, lon: +j[0].lon, exact: !!b && q === qs[0] });
      } catch { /* next */ }
    }
    return null;
  }
  let pinnedFor = null;
  async function placeOnMap(force) {
    const m = muni(); if (!m) return;
    if (S.lat == null) { const g = await geocode(m, S.brgy); if (!g) return; S.lat = g.lat; S.lon = g.lon; S.exact = g.exact; save(); }
    const key = S.lat + ',' + S.lon;
    if (pinnedFor === key && !force) return;
    pinnedFor = key;
    showPin(S.lat, S.lon, S.brgy ? bLabel(S.brgy) : m.n, S.exact);
  }

  /* ---------- bottom sheet ---------- */
  const panel = $('#panel'), scroller = $('#panel-scroll');
  const SNAP = { min: () => 92, peek: () => Math.round(innerHeight * .46), half: () => Math.round(innerHeight * .66), full: () => innerHeight - 64 };
  let sheet = 'peek';
  function sheetPx() { return isDesk() ? 0 : SNAP[sheet](); }
  function setSheet(s) {
    sheet = s; if (isDesk()) { panel.style.height = ''; return; }
    panel.style.height = SNAP[s]() + 'px';
    document.documentElement.style.setProperty('--sheet-peek', Math.min(SNAP[s](), SNAP.half()) + 'px');
    $('#grabber').setAttribute('aria-label', s === 'full' ? 'Collapse panel' : 'Expand panel');
  }
  (() => {
    const g = $('#grabber'); let y0 = null, h0, moved;
    g.addEventListener('pointerdown', e => { if (isDesk()) return; y0 = e.clientY; h0 = panel.getBoundingClientRect().height; moved = false; panel.classList.add('dragging'); g.setPointerCapture(e.pointerId); });
    g.addEventListener('pointermove', e => { if (y0 == null) return; const dy = y0 - e.clientY; if (Math.abs(dy) > 4) moved = true; panel.style.height = Math.max(80, Math.min(SNAP.full(), h0 + dy)) + 'px'; });
    g.addEventListener('pointerup', () => {
      if (y0 == null) return; panel.classList.remove('dragging'); y0 = null;
      if (!moved) { setSheet(sheet === 'full' ? 'peek' : 'full'); return; }
      const h = panel.getBoundingClientRect().height;
      setSheet(Object.keys(SNAP).reduce((a, k) => Math.abs(SNAP[k]() - h) < Math.abs(SNAP[a]() - h) ? k : a, 'peek'));
    });
    g.addEventListener('keydown', e => { if (e.key === 'ArrowUp') setSheet('full'); if (e.key === 'ArrowDown') setSheet('min'); });
    addEventListener('resize', debounce(() => setSheet(sheet), 150));
  })();

  /* ---------- obligations helpers ---------- */
  const dim = id => D.ob.dimensions.find(d => d.id === id);
  const ruleFor = d => d.rules._all || d.rules[S.ptype];
  const tgt = id => dim(id).target.text.replace(/\.$/, '');
  function shortRule(id) {
    const t = S.ptype, r = ruleFor(dim(id)), tf = tariffFor();
    switch (id) {
      case 'hours': return r.min ? `${r.min === 24 ? '24' : r.min + '+'} hours a day` : 'No minimum';
      case 'pressure': return r.psi ? `${r.psi}+ psi at the tap` : 'No minimum';
      case 'quality': return 'Safe to drink';
      case 'outage': return t === 'wd' ? 'No charge after 15 days out' : t === 'mwss' ? 'Fixed within 6 hours' : 'No rule';
      case 'complaint': return isMCWD() ? 'Action within 24 hours' : (t === 'wd' || t === 'lgu') ? 'Action within 72 hours via 8888' : t === 'mwss' ? 'Act "with dispatch"' : t === 'private' ? 'Answer within 10 days' : 'Via NWRB if registered';
      case 'bill': return tf && tf.min ? `${peso(tf.min)} for the first 10 m³` : ({ wd: 'LWUA-approved rate', mwss: 'MWSS-approved rate', private: 'NWRB-approved rate', lgu: 'Set by local council', community: 'Set by the association' })[t];
      case 'connect': return (t === 'wd' || t === 'lgu') ? '3 to 20 working days' : 'No rule';
      default: return r.status === 'none' ? 'No rule' : '';
    }
  }
  const DIM_ICON = { hours: 'clock', pressure: 'gauge', quality: 'flask', outage: 'plug', complaint: 'chat', bill: 'bill', connect: 'tool', testing: 'flask', contamination: 'alert', wsp: 'list', disclosure: 'info', coverage: 'pin' };
  const ST_ICON = { binding: I.check, unconfirmed: I.ring, none: I.minus };

  /* ---------- questions & evaluation ---------- */
  const Q = [
    { id: 'hours', type: 'one', title: 'How many hours a day do you have water?', help: 'Think of a typical day lately.',
      opts: [['24', 'All day'], ['18', '18 to 23 hours'], ['12', '12 to 17 hours'], ['7', '7 to 11 hours'], ['1', '1 to 6 hours'], ['0', 'No water at all']] },
    { id: 'pressure', type: 'one', title: 'How strong is the flow?',
      opts: [['strong', 'Strong, even upstairs'], ['ground', 'Only OK on the ground floor'], ['trickle', 'A trickle; we fill buckets'], ['none', 'Nothing comes out']] },
    { id: 'quality', type: 'many', title: 'Anything wrong with the water?', help: 'Choose all that apply.',
      opts: [['color', 'Brown or yellow color'], ['cloudy', 'Cloudy'], ['particles', 'Sand, rust or bits'], ['smell', 'Bad smell'], ['taste', 'Bad taste'], ['sick', 'Someone got sick'], ['ok', 'Nothing wrong']] },
    { id: 'outage', type: 'one', title: 'Longest time without water in the last 3 months?',
      opts: [['none', 'Never ran out'], ['lt1', 'Less than a day'], ['1', '1 to 3 days'], ['4', '4 to 14 days'], ['15', '15 days or more']] },
    { id: 'charged', type: 'one', showIf: a => a.outage === '15', title: 'Were you still billed the minimum charge for that time?',
      opts: [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']] },
    { id: 'complaint', type: 'one', title: 'Have you reported a problem before?',
      opts: [['not', 'Not yet'], ['acted', 'Yes, and they fixed it quickly'], ['slow', 'Yes, nothing for 3+ days'], ['never', 'Yes, still nothing']] },
    { id: 'bill', type: 'one', title: 'Has your water rate gone up this year?',
      opts: [['no', 'No'], ['hearing', 'Yes, after a public hearing'], ['nohearing', "Yes, and I didn't hear of a hearing"], ['unsure', 'Not sure']] },
    { id: 'connect', type: 'one', title: 'Waiting for a new connection?',
      opts: [['no', 'No'], ['short', 'Yes, under a month'], ['long', 'Yes, over a month']] }
  ];
  const LABEL = {}; Q.forEach(q => LABEL[q.id] = Object.fromEntries(q.opts));
  const activeQ = () => Q.filter(q => !q.showIf || q.showIf(S.answers));
  const EXAMPLE = { hours: '7', pressure: 'trickle', quality: ['color', 'particles'], outage: '1', complaint: 'slow', bill: 'unsure', connect: 'no' };

  function evaluate() {
    const a = S.answers, t = S.ptype, out = [];
    const push = (id, you, v, note, ask) => { const d = dim(id), r = ruleFor(d); out.push({ id, title: d.title, owed: r.text, short: shortRule(id), r, you, v, note, ask }); };
    if (a.hours != null) {
      const h = +a.hours, r = ruleFor(dim('hours')), you = LABEL.hours[a.hours];
      if (r.min == null) push('hours', you, h >= 24 ? 'met' : 'norule', h >= 24 ? '' : `No minimum is set for your provider. ${tgt('hours')}, but it is only a target.`, h >= 24 ? '' : "Tell me the district's own target for hours of supply in my barangay, and when it will be met.");
      else if (h >= r.min) push('hours', you, 'met');
      else push('hours', you, 'notmet', `The rule is at least ${r.min} hours a day.`, `Restore at least ${r.min} hours of supply a day, as required.`);
    }
    if (a.pressure) {
      const r = ruleFor(dim('pressure')), you = LABEL.pressure[a.pressure];
      if (a.pressure === 'strong') push('pressure', you, 'met');
      else if (r.psi == null) push('pressure', you, 'norule', `No minimum is set for your provider. ${tgt('pressure')}, but it is only a target.`, 'Measure the pressure at my connection and tell me the result.');
      else if (a.pressure === 'ground') push('pressure', you, 'check', `${r.psi} psi lifts water about ${Math.round(r.psi * 0.703 * 10) / 10} m, roughly a second-floor tap. A gauge reading would settle it.`, 'Measure the pressure at my connection and tell me the result.');
      else push('pressure', you, 'notmet', `The rule is at least ${r.psi} psi.`, `Restore at least ${r.psi} psi at my connection.`);
    }
    if (a.quality && a.quality.length) {
      const signs = a.quality.filter(v => v !== 'ok');
      const you = a.quality.includes('ok') ? 'Nothing wrong' : signs.map((v, i) => i ? lc(LABEL.quality[v]) : LABEL.quality[v]).join(', ');
      if (!signs.length) push('quality', you, 'met');
      else push('quality', you, 'check', (signs.includes('sick') ? 'Someone got sick: go to your health office now. ' : '') + 'This can mean the water fails national limits. Only a lab test can confirm it.', 'Test the water at my tap at a DOH-accredited laboratory and give me the results.');
    }
    if (a.outage) {
      const you = LABEL.outage[a.outage];
      if (t === 'wd') {
        if (a.outage === '15') {
          if (a.charged === 'yes') push('outage', you + ', still billed', 'notmet', 'After 15+ days without water, no minimum charge or disconnection is allowed.', 'Remove the minimum charge for the period without water, and confirm I will not be disconnected.');
          else push('outage', you, a.charged === 'no' ? 'met' : 'check', a.charged === 'no' ? '' : 'Check your bill: no minimum charge after 15 days without water.', 'Confirm that no minimum charge will apply for the period without water.');
        } else if (a.outage === 'none' || a.outage === 'lt1') push('outage', you, 'met');
        else push('outage', you, 'check', isMCWD() ? "The 15-day rule doesn't apply yet. Mabalacat promises repairs within 24 hours." : "The 15-day rule doesn't apply yet. Your district's Citizen's Charter sets repair times.", 'Explain the cause of the interruption and when full service will be restored.');
      } else if (t === 'mwss') {
        if (a.outage === 'none') push('outage', you, 'met');
        else if (a.outage === 'lt1') push('outage', you, 'check', 'Unplanned outages must be fixed within 6 hours.', 'Confirm the interruption was restored within 6 hours.');
        else push('outage', you, 'notmet', 'Unplanned outages must be fixed within 6 hours' + (a.outage === '15' ? '; over 15 days earns a bill rebate.' : '.'), a.outage === '15' ? 'Credit the rebate owed for a failure lasting over 15 days.' : 'Explain why service was not restored within 6 hours.');
      } else push('outage', you, a.outage === 'none' ? 'met' : 'norule', a.outage === 'none' ? '' : 'No rule on restoring service was found for this provider type.', 'Explain the cause of the interruption and when service will be restored.');
    }
    if (a.complaint && a.complaint !== 'not') {
      const you = LABEL.complaint[a.complaint];
      if (a.complaint === 'acted') push('complaint', you, 'met');
      else if (isMCWD()) push('complaint', you, 'notmet', "Mabalacat's Citizen's Charter promises action on service requests within 24 hours.", 'Give me a reference number and act on my earlier report.');
      else if (t === 'wd' || t === 'lgu') push('complaint', you, a.complaint === 'never' ? 'notmet' : 'check', "Your Citizen's Charter sets the time; 8888 complaints must be acted on within 72 hours.", 'Give me a reference number and act on my earlier report.');
      else push('complaint', you, 'check', ruleFor(dim('complaint')).text, 'Give me a reference number and act on my earlier report.');
    }
    if (a.bill && a.bill !== 'no') {
      const you = LABEL.bill[a.bill], r = ruleFor(dim('bill'));
      if (r.status === 'none') push('bill', you, 'norule', 'No outside review of rates was found for this provider type.');
      else if (a.bill === 'hearing') push('bill', you, 'met');
      else push('bill', you, 'check', t === 'wd' ? 'Every rate increase needs a public hearing first. Ask for the notice and date.' : r.text, t === 'wd' ? 'Send me the date and notice of the public hearing held before the latest rate increase.' : 'Explain the basis for the latest rate increase.');
    }
    if (a.billCheck) {
      const b = a.billCheck;
      push('bill', `Billed ${peso(b.a)} for ${b.c} m³`, 'check', `At the latest LWUA-approved rate, ${b.c} m³ costs ${peso(b.exp)}.`, `Itemize my bill and show the approved rate used. At the latest LWUA-approved rate, ${b.c} m³ costs ${peso(b.exp)}, but I was billed ${peso(b.a)}.`);
    }
    if (a.connect && a.connect !== 'no') {
      const you = LABEL.connect[a.connect], r = ruleFor(dim('connect'));
      if (r.status === 'none') push('connect', you, 'norule', 'No processing-time rule was found for this provider type.');
      else if (a.connect === 'short') push('connect', you, 'check', 'The limit is 3, 7 or 20 working days depending on the application.');
      else push('connect', you, 'notmet', 'Even the longest limit, 20 working days, has passed.', 'Act on my connection application or give written reasons for the delay.');
    }
    const order = { notmet: 0, check: 1, norule: 2, met: 3 };
    return out.sort((x, y) => order[x.v] - order[y.v]);
  }
  const VLAB = { notmet: 'Not met', check: 'Check this', norule: 'No rule', met: 'Met' };

  /* ---------- views ---------- */
  const V = $('#view'), FOOT = $('#panel-foot');
  function render(html, foot = '', size) {
    V.innerHTML = html; FOOT.innerHTML = foot; scroller.scrollTop = 0;
    V.classList.remove('slide-in'); void V.offsetWidth; V.classList.add('slide-in');
    if (size) setSheet(size);
  }
  const go = h => { location.hash = h; };

  /* SEARCH */
  function viewSearch() {
    const resume = S.muni && muni() ? `<div class="resume"><div><b>${esc(placeLabel())}</b>${Object.keys(S.answers).length ? 'Your answers are saved.' : 'Pick up where you left off.'}</div><button class="btn btn-sm btn-primary" id="resume-go">Open</button></div>` : '';
    render(`
      <h1 class="h-title">Check your water service</h1>
      <p class="h-sub">See what your provider owes you, then report what you get.</p>
      <div class="search" role="search">
        <span class="s-icon">${I.search}</span>
        <label for="q" class="sr-only">Barangay or town</label>
        <input id="q" type="text" placeholder="Your barangay or town" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="q-list" aria-autocomplete="list">
        <button class="btn btn-quiet icon-only s-clear" id="q-clear" type="button" aria-label="Clear" hidden>${I.x}</button>
      </div>
      <ul class="results-list" id="q-list" role="listbox" aria-label="Places" hidden></ul>
      <div id="home-extra">
        <div class="quick">
          <button class="chip" type="button" id="locate-chip">${I.locate}Use my location</button>
          <button class="chip" type="button" data-ex="Dau|Mabalacat City">Dau, Mabalacat</button>
          <button class="chip" type="button" data-ex="|City of Olongapo">Olongapo</button>
          <button class="chip" type="button" data-ex="|Quezon City">Quezon City</button>
        </div>
        ${resume}
        <p class="section-label">How it works</p>
        <ul class="how">
          <li><span class="hi">${I.pin}</span><div><b>Find your barangay</b><span>We find your provider and its rules.</span></div></li>
          <li><span class="hi">${I.list}</span><div><b>Answer 7 quick questions</b><span>Hours, pressure, quality, outages, bills.</span></div></li>
          <li><span class="hi">${I.mail}</span><div><b>Send a complaint</b><span>A ready letter, script and contacts.</span></div></li>
        </ul>
        <p class="privacy">${I.lock}No sign-up. Your answers stay on your device.</p>
      </div>`, '', 'peek');
    if (pinLayer) { map.removeLayer(pinLayer); pinLayer = null; pinnedFor = null; }
    fitPH();
    bindSearch();
    $$('[data-ex]').forEach(b => b.onclick = async () => { await loadPlaces(); const [br, mn] = b.dataset.ex.split('|'); const e = D.index.find(x => br ? (x.b === br && x.sub.startsWith(mn)) : (!x.b && x.name === mn)); if (e) choose(e); });
    $('#locate-chip').onclick = locate;
    const rg = $('#resume-go'); if (rg) rg.onclick = () => go('#/owed');
  }
  function bindSearch() {
    const input = $('#q'), list = $('#q-list'), clr = $('#q-clear'), extra = $('#home-extra');
    let res = [], act = -1;
    const hl = (text, toks) => { let o = esc(text); toks.filter(t => t.length > 1).forEach(t => { o = o.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i'), '<b>$1</b>'); }); return o; };
    function find(q) {
      const n = norm(q); if (n.length < 2) return [];
      const toks = n.split(' '), out = [];
      for (const e of D.index) {
        if (!toks.every(t => e.full.includes(t))) continue;
        out.push([(e.t === n || n.startsWith(e.t + ' ')) ? 0 : 1, e.t.startsWith(toks[0]) ? 0 : 1, e.kind, -e.pop, e]);
        if (out.length > 3000) break;
      }
      out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
      return out.slice(0, 8).map(x => x[4]);
    }
    function draw() {
      const q = input.value, open = norm(q).length >= 2;
      list.hidden = !open; extra.hidden = open; input.setAttribute('aria-expanded', open);
      if (!open) return;
      const toks = norm(q).split(' ');
      list.innerHTML = res.length ? res.map((e, i) => `<li role="option" id="o${i}" data-i="${i}" aria-selected="${i === act}"><span class="ri">${e.b ? I.pin : I.city}</span><span>${hl(e.b ? bLabel(e.name) : e.name, toks)}<small>${esc(e.sub)}</small></span></li>`).join('')
        : `<li class="none">No match for "${esc(q)}". Try just your town.</li>`;
      if (act >= 0) input.setAttribute('aria-activedescendant', 'o' + act); else input.removeAttribute('aria-activedescendant');
    }
    input.addEventListener('focus', () => { loadPlaces(); if (!isDesk()) setSheet('full'); });
    input.addEventListener('input', async () => { clr.hidden = !input.value; await loadPlaces(); res = find(input.value); act = res.length ? 0 : -1; draw(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' && res.length) { act = (act + 1) % res.length; draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp' && res.length) { act = (act - 1 + res.length) % res.length; draw(); e.preventDefault(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (res[act]) choose(res[act]); }
      else if (e.key === 'Escape') { input.value = ''; res = []; draw(); }
    });
    list.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) choose(res[+li.dataset.i]); });
    clr.onclick = () => { input.value = ''; clr.hidden = true; res = []; draw(); input.focus(); };
  }
  async function choose(e) {
    await ready; await loadPlaces();
    const m = D.places.munis[e.mi];
    if (S.muni !== m.c || S.brgy !== e.b) S.answers = {};
    S.muni = m.c; S.brgy = e.b; S.ptype = detectType(m); S.lat = S.lon = null; save();
    go('#/owed');
  }
  function locate() {
    if (!navigator.geolocation) { toast("Your browser can't share location"); return; }
    toast('Finding you…');
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        await loadPlaces(); await ready;
        const { latitude: lat, longitude: lon } = pos.coords;
        const a = ((await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&addressdetails=1&lat=${lat}&lon=${lon}`)).json()).address) || {};
        const town = a.city || a.town || a.municipality || a.village, prov = a.state || a.province || '';
        const all = D.places.munis.map((m, i) => [m, i]);
        const pick = all.find(([m]) => core(m.n) === core(town) && (!prov || norm(prov).includes(norm(m.p).split(' ')[0]))) || all.find(([m]) => core(m.n) === core(town));
        if (!pick) throw 0;
        const [m, mi] = pick, names = [a.quarter, a.suburb, a.neighbourhood, a.village, a.hamlet].filter(Boolean).map(norm);
        const b = (D.places.brgys[m.c] || []).find(([n]) => names.includes(norm(n)));
        await choose({ mi, b: b ? b[0] : null });
        S.lat = lat; S.lon = lon; S.exact = true; save(); placeOnMap(true);
      } catch { toast("Couldn't match your location. Type your barangay."); }
    }, () => toast('Location not shared. Type your barangay.'), { timeout: 12000 });
  }
  $('#locate-fab').onclick = locate;

  /* OWED */
  function placeHead() {
    const w = wd(), P = D.ob.providers;
    return `<div class="place"><span class="pi">${I.drop}</span><div><h2>${esc(providerName())}</h2><p>${esc(placeLabel())}</p>
      ${S.ptype === 'wd' && w && w.op ? `<span class="op-chip">Run by ${esc(w.op)}</span>` : ''}
      <div class="change-type"><label for="ptype">Provider type:</label><select id="ptype">${Object.entries(P).map(([k, v]) => `<option value="${k}" ${k === S.ptype ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div></div></div>`;
  }
  function viewOwed() {
    const m = muni(), dims = D.ob.dimensions;
    const key = ['hours', 'pressure', 'quality', 'bill', 'complaint', 'outage'];
    const fact = id => { const d = dim(id), r = ruleFor(d); return `<button class="fact ${r.status === 'none' ? 'none' : ''}" data-open="${id}" type="button"><span class="fk">${I[DIM_ICON[id]]}${esc(d.title)}</span><span class="fv">${esc(shortRule(id))}</span></button>`; };
    const row = d => { const r = ruleFor(d); return `<details class="rule" id="r-${d.id}"><summary><span class="ricon ${r.status}">${ST_ICON[r.status]}</span><span><b>${esc(d.title)}${r.status === 'unconfirmed' ? '<span class="tag-mini">text not yet confirmed</span>' : ''}</b><span class="rsum">${esc(shortRule(d.id) || (r.status === 'none' ? 'No rule' : 'Required'))}</span></span>${I.chev}</summary>
      <div class="rbody"><p>${esc(r.text)}</p>${r.status === 'none' && d.target ? `<p>For comparison: ${esc(d.target.text)} (a target, not a requirement)</p>` : ''}
      ${d.id === 'bill' && S.ptype === 'wd' ? `<p><a href="#/bill">Check your bill against the tariff</a></p>` : ''}
      ${d.id === 'complaint' && isMCWD() ? `<p>Mabalacat's Citizen's Charter: ${esc(D.mcwd.contacts.serviceRequest)}</p>` : ''}
      ${r.cite ? `<p class="src">Source: ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.cite)}</a>` : esc(r.cite)}</p>` : ''}</div></details>`; };
    const noHrs = ruleFor(dim('hours')).status === 'none';
    render(`<button class="back" id="back">${I.left}Search</button>
      ${placeHead()}
      ${S.ptype === 'lgu' && detectType(m) === 'lgu' ? `<div class="callout">${I.info}<p>No water district found for ${esc(m.n)}. Pick the provider type that serves you.</p></div>` : ''}
      <p class="section-label">What you're owed</p>
      <div class="facts">${key.map(fact).join('')}</div>
      ${noHrs ? `<div class="callout">${I.alert}<p><b>No minimum hours or pressure.</b> No national rule sets them for ${S.ptype === 'wd' ? 'water districts' : 'your provider type'}. ${jvOp() ? `Your district's contract with ${esc(jvOp().replace(/ \(.*\)$/, ''))} may promise them, and only the district can enforce it. Tubig asks for that report.` : 'Tubig asks your provider for its own target.'}</p></div>` : ''}
      <p class="section-label">All rules</p>
      <div class="rules">${dims.map(row).join('')}</div>`,
      `<button class="btn" id="to-bill">${I.bill}Check bill</button><button class="btn btn-primary" id="to-report">Report a problem</button>`, 'half');
    $('#back').onclick = () => go('#/');
    $('#ptype').onchange = e => { S.ptype = e.target.value; save(); viewOwed(); toast('Rules updated'); };
    $$('[data-open]').forEach(b => b.onclick = () => { const d = $('#r-' + b.dataset.open); d.open = true; if (!isDesk()) setSheet('full'); setTimeout(() => d.scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' }), 320); });
    $('#to-report').onclick = () => go('#/report/1');
    $('#to-bill').onclick = () => go('#/bill');
  }

  /* REPORT (one question per card) */
  function viewReport(n) {
    const qs = activeQ(); n = Math.max(1, Math.min(qs.length, n || 1));
    const q = qs[n - 1], isLast = n === qs.length;
    const sel = v => q.type === 'many' ? (S.answers[q.id] || []).includes(v) : S.answers[q.id] === v;
    render(`<button class="back" id="back">${I.left}${n === 1 ? 'Rules' : 'Back'}</button>
      <div class="progress" aria-hidden="true">${qs.map((_, i) => `<span class="${i < n ? 'on' : ''}"></span>`).join('')}</div>
      <p class="q-count">Question ${n} of ${qs.length}</p>
      <h2 class="q-title" id="q-title">${esc(q.title)}</h2>${q.help ? `<p class="q-help">${esc(q.help)}</p>` : ''}
      <div class="choices" role="${q.type === 'many' ? 'group' : 'radiogroup'}" aria-labelledby="q-title">
      ${q.opts.map(([v, l]) => `<button type="button" class="choice ${q.type === 'many' ? 'multi' : ''}" data-v="${v}" role="${q.type === 'many' ? 'checkbox' : 'radio'}" aria-checked="${sel(v)}"><span class="cmark">${I.check}</span>${esc(l)}</button>`).join('')}
      </div>
      ${n === 1 ? `<button class="btn btn-quiet skip-q" id="example">Just exploring? Use example answers</button>` : ''}`,
      `<button class="btn" id="skip">Skip</button><button class="btn btn-primary" id="next" ${q.type === 'many' && !(S.answers[q.id] || []).length ? 'disabled' : ''}>${isLast ? 'See results' : 'Next'}</button>`, 'full');
    const next = () => { const qs2 = activeQ(); const i = qs2.indexOf(q); if (i >= qs2.length - 1) go('#/gap'); else go('#/report/' + (i + 2)); };
    $('#back').onclick = () => n === 1 ? go('#/owed') : go('#/report/' + (n - 1));
    $('#skip').onclick = () => { delete S.answers[q.id]; save(); next(); };
    $('#next').onclick = next;
    const ex = $('#example'); if (ex) ex.onclick = () => { S.answers = JSON.parse(JSON.stringify(EXAMPLE)); save(); toast('Example answers loaded'); go('#/gap'); };
    $$('.choice').forEach(b => b.onclick = () => {
      const v = b.dataset.v;
      if (q.type === 'many') {
        let cur = S.answers[q.id] || [];
        if (v === 'ok') cur = cur.includes('ok') ? [] : ['ok'];
        else { cur = cur.filter(x => x !== 'ok'); cur = cur.includes(v) ? cur.filter(x => x !== v) : cur.concat(v); }
        if (cur.length) S.answers[q.id] = cur; else delete S.answers[q.id];
        save();
        $$('.choice').forEach(c => c.setAttribute('aria-checked', (S.answers[q.id] || []).includes(c.dataset.v)));
        $('#next').disabled = !(S.answers[q.id] || []).length;
      } else {
        S.answers[q.id] = v; if (q.id === 'outage' && v !== '15') delete S.answers.charged; save();
        $$('.choice').forEach(c => c.setAttribute('aria-checked', c.dataset.v === v));
        setTimeout(next, RM ? 0 : 220);
      }
    });
  }

  /* GAP */
  function viewGap() {
    const rows = evaluate(); S.rows = rows;
    if (!rows.length) { render(`<button class="back" id="back">${I.left}Questions</button><h2 class="h-title">Nothing to compare yet</h2><p class="h-sub">Answer at least one question first.</p>`, `<button class="btn btn-primary" id="go-q">Answer questions</button>`, 'half'); $('#back').onclick = $('#go-q').onclick = () => go('#/report/1'); return; }
    const c = k => rows.filter(r => r.v === k).length;
    const head = c('notmet') ? `${c('notmet')} rule${c('notmet') > 1 ? 's' : ''} broken` : c('check') ? `${c('check')} thing${c('check') > 1 ? 's' : ''} to check` : c('norule') ? 'No rules to hold them to' : 'Your service meets the rules';
    render(`<button class="back" id="back">${I.left}Questions</button>
      <h2 class="h-title">Your results</h2>
      <div class="verdict-hero"><p class="vh-big">${esc(head)}</p>
        <div class="vh-row">${['notmet', 'check', 'norule', 'met'].filter(k => c(k)).map(k => `<span><span class="dot ${k}"></span>${c(k)} ${VLAB[k].toLowerCase()}</span>`).join('')}</div></div>
      <ul class="findings">${rows.map(r => `<li class="finding"><div class="f-top"><span class="f-name">${esc(r.title)}</span><span class="status ${r.v}"><span class="dot ${r.v}"></span>${VLAB[r.v]}</span></div>
        <div class="f-compare"><div><p class="k">You said</p><p class="v">${esc(r.you)}</p></div><div><p class="k">The rule</p><p class="v">${esc(r.short || 'No rule')}</p></div></div>
        ${r.note ? `<p class="f-note">${esc(r.note)}</p>` : ''}</li>`).join('')}</ul>`,
      `<button class="btn" id="edit">Edit answers</button><button class="btn btn-primary" id="act">Write complaint</button>`, 'full');
    $('#back').onclick = $('#edit').onclick = () => go('#/report/1');
    $('#act').onclick = () => go('#/act');
  }

  /* ACT */
  let actTab = 'letter';
  function viewAct() {
    const rows = S.rows || evaluate(); S.rows = rows;
    const issues = rows.filter(r => r.v !== 'met');
    const contacts = contactsFor(rows);
    const to = (contacts.find(x => x.email) || {}).email || '';
    const subject = 'Water service complaint, ' + placeLabel();
    const sig = JSON.stringify(S.answers) + S.ptype;
    const letter = S.letter && S.letterFor === sig ? S.letter : buildLetter(issues);
    const tabs = { letter: 'Letter', contacts: 'Who to contact', script: 'Phone script' };
    const body = {
      letter: `<label for="letter" class="sr-only">Complaint letter</label><textarea id="letter" class="letter" spellcheck="true">${esc(letter)}</textarea>
        <p class="src-line">Fill in the parts in [brackets]. Edit anything you like.</p>
        <div class="tool-row"><button class="btn btn-sm" id="dl">${I.down}Download</button><button class="btn btn-sm" id="pr">${I.print}Print</button></div>`,
      contacts: `<ol class="contacts">${contacts.map((c, i) => `<li class="contact"><span class="cn">${i + 1}</span><div><b>${esc(c.name)}</b><span class="when">${esc(c.when)}</span><p>${esc(c.how)}</p>${c.note ? `<p>${esc(c.note)}</p>` : ''}${c.links ? `<div class="links">${c.links.map(l => `<a class="btn btn-sm" href="${esc(l.href)}" ${l.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${I[l.icon] || ''}${esc(l.label)}</a>`).join('')}</div>` : ''}</div></li>`).join('')}</ol>`,
      script: scriptHTML(issues)
    }[actTab];
    const foot = actTab === 'letter' ? `<button class="btn" id="copy">${I.copy}Copy</button><a class="btn btn-primary" id="mail" href="#">${I.mail}Email it</a>`
      : actTab === 'contacts' && (S.ptype === 'wd' || S.ptype === 'lgu') ? `<a class="btn btn-primary" href="tel:8888">${I.phone}Call 8888</a>` : '';
    render(`<button class="back" id="back">${I.left}Results</button>
      <h2 class="h-title">Send your complaint</h2>
      <p class="h-sub">To ${esc(providerName())}${issues.length ? `, about ${issues.length} issue${issues.length > 1 ? 's' : ''}` : ''}.</p>
      <div class="seg" role="tablist">${Object.entries(tabs).map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === actTab}">${l}</button>`).join('')}</div>
      <div role="tabpanel">${body}</div>`, foot, 'full');
    $('#back').onclick = () => go('#/gap');
    $$('[data-tab]').forEach(b => b.onclick = () => { actTab = b.dataset.tab; viewAct(); });
    const ta = $('#letter');
    if (ta) {
      const sync = () => { S.letter = ta.value; S.letterFor = sig; $('#mail').href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(ta.value)}`; };
      ta.addEventListener('input', sync); sync();
      $('#copy').onclick = async () => { try { await navigator.clipboard.writeText(ta.value); toast('Letter copied'); } catch { ta.select(); toast('Press Ctrl+C to copy'); } };
      $('#dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ta.value], { type: 'text/plain' })); a.download = 'water-complaint.txt'; a.click(); toast('Letter downloaded'); };
      $('#pr').onclick = () => { $('#print-letter').textContent = ta.value; window.print(); };
    }
  }
  function buildLetter(issues) {
    const where = placeLabel();
    const cite = r => (r.id === 'complaint' && isMCWD()) ? ` (${D.mcwd.contacts.serviceRequestCite})` : (r.r && r.r.cite && r.r.status !== 'none' ? ` (${r.r.cite})` : '');
    const lines = issues.map(r => {
      const head = `- ${r.title}: ${r.you}.`;
      if (r.v === 'notmet') return `${head} ${(r.note || '').replace(/\.$/, '')}${cite(r)}.`;
      if (r.v === 'norule') return `${head} There is no binding standard for this, so I am asking for your own service target.`;
      return `${head} ${(r.note || '').replace(/^Someone got sick: go to your health office now\. /, '')}`.trim();
    });
    const asks = [...new Set(issues.map(r => r.ask).filter(Boolean))];
    if (jvOp() && issues.some(r => r.id === 'hours' || r.id === 'pressure')) asks.push(`Send me the district's latest joint venture compliance report, showing ${jvOp().replace(/ \(.*\)$/, '')}'s targets and results for hours of supply and water pressure, and the action the district has taken where targets were missed.`);
    const date = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    return `${date}

To: ${providerName()}${isMCWD() ? '\n' + D.mcwd.contacts.address : ''}

Subject: Water service complaint, ${where}

Good day.

I am a customer at [house number and street], ${where}. I am writing to report problems with the water service at my connection.

${lines.length ? lines.join('\n') : '- [Describe the problem]'}

I respectfully ask that you:
${asks.map((a, i) => `${i + 1}. ${a}`).join('\n')}${asks.length ? '\n' : ''}${asks.length + 1}. Send me a written reply with a reference number for this complaint.

Thank you. I look forward to your response.

[Your name]
Account number: [from your water bill]
Contact: [phone or email]`;
  }
  function contactsFor(rows) {
    const t = S.ptype, m = muni(), w = wd(), out = [];
    if (isMCWD()) {
      const c = D.mcwd.contacts;
      out.push({ name: 'Mabalacat City Water District', when: 'Start here', how: `Email, call or visit ${c.address}. Ask for a reference number.`, note: c.charterNote, email: c.email,
        links: [{ href: 'mailto:' + c.email, label: 'Email', icon: 'mail' }, { href: 'tel:' + c.landline.replace(/[^0-9+]/g, ''), label: c.landline, icon: 'phone' }, { href: 'tel:' + c.hotlines[0].replace(/[^0-9]/g, '').slice(0, 11), label: c.hotlines[0].replace(/ \(.*\)/, ''), icon: 'phone' }] });
    } else if (t === 'wd' && w) out.push({ name: w.n, when: 'Start here', how: "Use the complaints desk in the district's Citizen's Charter (website or office). Ask for a reference number." });
    else if (t === 'mwss') { out.push({ name: 'Your concessionaire', when: 'Start here', how: 'Maynilad 1626 or Manila Water 1627. Ask for a reference number.', links: [{ href: 'tel:1626', label: 'Maynilad 1626', icon: 'phone' }, { href: 'tel:1627', label: 'Manila Water 1627', icon: 'phone' }] }); out.push({ name: 'MWSS Regulatory Office', when: 'If not resolved', how: 'Handles unresolved complaints about the concessionaires.' }); }
    else if (t === 'private') { out.push({ name: 'Your water company', when: 'Start here', how: 'Write to customer service and keep a copy.' }); out.push({ name: 'National Water Resources Board', when: 'If not resolved', how: 'File a written, sworn complaint. Answer due in 10 days.' }); }
    else if (t === 'lgu') out.push({ name: `${m.n} hall`, when: 'Start here', how: "Ask for the waterworks office and its Citizen's Charter." });
    else { out.push({ name: 'Your waterworks association', when: 'Start here', how: 'Raise it with the officers in writing.' }); out.push({ name: 'NWRB', when: 'If not resolved', how: 'If the association is registered with NWRB.' }); }
    if (t === 'wd' || t === 'lgu') {
      out.push({ name: "8888 Citizens' Complaint Center", when: 'No action in time', how: 'Call 8888, any time. Agencies must act within 72 hours.', links: [{ href: 'tel:8888', label: 'Call 8888', icon: 'phone' }] });
      out.push({ name: 'Anti-Red Tape Authority', when: 'Charter ignored', how: 'File online or call 1-ARTA (12782).', links: [{ href: 'https://ecms.arta.gov.ph/', label: 'File online', icon: 'ext' }] });
    }
    if (rows.some(r => r.id === 'quality' && r.v !== 'met')) out.push({ name: `${m.n.replace(/^City of /, '')} Health Office`, when: 'Water quality or illness', how: 'Ask the sanitary inspector to test the water at your tap.' });
    if (t === 'wd' && rows.some(r => r.id === 'bill' && r.v !== 'met')) out.push({ name: 'LWUA', when: 'Rate questions', how: 'LWUA reviews water district rates.', links: [{ href: 'https://lwua.gov.ph/', label: 'lwua.gov.ph', icon: 'ext' }] });
    return out;
  }
  function scriptHTML(issues) {
    const say = r => ({ hours: /hour/.test(r.you) ? `We only get water ${lc(r.you)} a day.` : `We have ${lc(r.you)}.`, pressure: `The pressure is weak: ${lc(r.you)}.`, quality: `The water has problems: ${lc(r.you)}.`, outage: `Our longest outage was ${lc(r.you)}.`, complaint: `I already reported this. ${r.you}.`, bill: `About our bill: ${lc(r.you)}.`, connect: `I'm waiting for a connection: ${lc(r.you)}.` }[r.id] || `${r.title}: ${r.you}.`);
    const top = issues.slice(0, 3), rule = top.find(r => r.v === 'notmet' && r.note);
    const lines = [`Good day. I'm calling about water service in ${placeLabel()}. My account number is [account number].`, ...(top.length ? [top.map(say).join(' ')] : []), ...(rule ? [rule.note] : []), 'Can I get a reference number, and when will someone act on this?'];
    return `<div class="script">${lines.map(t => `<p class="bubble">${esc(t)}</p>`).join('')}<p class="tip">Write down the date, who you spoke to, and the reference number.</p></div>`;
  }

  /* BILL */
  function computeBill(tf, cum) {
    if (!tf || tf.min == null) return null;
    if (cum <= 10) return { total: tf.min };
    if (!tf.blocks || !tf.blocks.length) return { total: null };
    let total = tf.min, used = cum - 10, from = 11;
    for (const b of tf.blocks) {
      if (used <= 0) break;
      const span = b.to == null ? used : Math.min(used, b.to - Math.max(b.from, from) + 1);
      if (span <= 0) continue;
      total += span * b.rate; used -= span; from += span;
    }
    return { total: used > 0 ? null : Math.round(total * 100) / 100 };
  }
  function viewBill() {
    const tf = tariffFor(), w = wd();
    const table = tf ? `<div class="tariff"><table><thead><tr><th>Water used</th><th class="num">Charge</th></tr></thead><tbody>
      <tr><td>First 10 m³ (minimum)</td><td class="num">${peso(tf.min)}</td></tr>
      ${(tf.blocks || []).map(b => `<tr><td>${b.to == null ? `${b.from} m³ and up` : `${b.from} to ${b.to} m³`}</td><td class="num">${peso(b.rate)} per m³</td></tr>`).join('')}</tbody></table></div>
      <p class="src-line">Residential, ½-inch meter. Latest rate LWUA has on record${tf.effective ? `, approved ${esc(fmtDate(tf.effective))}` : ''}. Source: ${tf.url ? `<a href="${esc(tf.url)}" target="_blank" rel="noopener">${esc(tf.source)}</a>` : esc(tf.source || '')}.</p>
      ${jvOp() ? `<div class="callout info">${I.info}<p>Your district is run with ${esc(jvOp().replace(/ \(.*\)$/, ''))}. Rates under a joint venture may be newer than what LWUA has posted. Ask the district for its current approved schedule.</p></div>` : ''}` : '';
    render(`<button class="back" id="back">${I.left}Rules</button>
      <h2 class="h-title">Check your bill</h2>
      <p class="h-sub">${esc(S.ptype === 'wd' && w ? w.n : providerName())}</p>
      ${tf ? table : `<div class="callout info">${I.info}<p>We don't have this provider's approved tariff yet. ${S.ptype === 'wd' ? 'Water district rates are approved by LWUA; ask your district for its schedule.' : ''}</p></div>`}
      ${tf ? `<div class="field"><label for="cum">Water used this month</label><div class="input-wrap"><input id="cum" type="number" inputmode="decimal" min="0" step="1" placeholder="e.g. 18"><span class="unit">m³</span></div><p class="hint">On your bill as "consumption" or "cu.m."</p></div>
      <div class="field"><label for="amt">Amount billed (optional)</label><div class="input-wrap prefix"><span class="pre">₱</span><input id="amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="e.g. 520.00"></div><p class="hint">This month's water charge, without unpaid balances.</p></div>
      <div id="bill-out" aria-live="polite"></div>` : ''}`,
      `<button class="btn btn-primary" id="to-report">Report a problem</button>`, 'full');
    $('#back').onclick = () => go('#/owed');
    $('#to-report').onclick = () => go('#/report/1');
    if (!tf) return;
    const out = $('#bill-out'), cum = $('#cum'), amt = $('#amt');
    const upd = () => {
      const c = parseFloat(cum.value), a = parseFloat(amt.value);
      if (!(c >= 0)) { out.innerHTML = ''; return; }
      const r = computeBill(tf, c);
      if (!r || r.total == null) { out.innerHTML = `<div class="bill-result"><p>We only have the minimum charge for this district (${peso(tf.min)} for the first 10 m³). Rates above 10 m³ aren't in our data yet.</p></div>`; return; }
      const exp = r.total;
      if (!(a > 0)) { out.innerHTML = `<div class="bill-result ok"><span class="br-big">${peso(exp)}</span><p>What ${c} m³ should cost at this rate, before arrears or other fees.</p></div>`; return; }
      const diff = a - exp, tol = Math.max(5, exp * .03), over = diff > tol, under = diff < -tol;
      out.innerHTML = `<div class="bill-result ${over ? 'over' : 'ok'}"><span class="br-big">${over ? '+' + peso(diff) : under ? '−' + peso(-diff) : peso(exp)}</span>
        <p>${over ? `You were billed ${peso(diff)} more than ${c} m³ costs at this rate (${peso(exp)}). A newer rate, fees, arrears or VAT may explain it. Ask the district to itemize the bill and show the approved rate.`
          : under ? `You were billed ${peso(-diff)} less than ${c} m³ costs at this rate (${peso(exp)}). A senior or PWD discount, a newer lower rate, or a misread meter could explain it. Check the meter reading on your bill.`
          : `Your bill matches what ${c} m³ costs at this rate (${peso(exp)}).`}</p>
        ${over ? `<button class="btn btn-sm" id="add-bill" style="margin-top:10px">Add to my complaint</button>` : ''}</div>`;
      const ab = $('#add-bill'); if (ab) ab.onclick = () => { S.answers.billCheck = { c, a, exp }; save(); toast('Added to your complaint'); go('#/gap'); };
    };
    cum.addEventListener('input', upd); amt.addEventListener('input', upd);
  }

  /* ---------- pages ---------- */
  const P = $('#page');
  function pageNav(k) { $$('.page-bar [data-page]').forEach(a => a.dataset.page === k ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')); }
  const DS = { q: '', region: '', sort: 'name', page: 1 };
  function pageDistricts() {
    pageNav('districts');
    const regions = [...new Set(D.districts.map(d => d.r))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    P.innerHTML = `<h1>Water districts</h1><p class="lead">All 554 districts, with what the public record holds on each.</p>
      <div class="toolbar"><input id="ds" type="search" placeholder="Search a district or province" aria-label="Search districts" value="${esc(DS.q)}">
      <select id="dr" aria-label="Region"><option value="">All regions</option>${regions.map(r => `<option ${r === DS.region ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
      <select id="dsort" aria-label="Sort"><option value="name">A to Z</option><option value="conn">Most connections</option><option value="cmp">Most news complaints</option></select></div>
      <p class="count" id="dc"></p><div class="table-scroll"><table class="table"><thead><tr><th>District</th><th>Province</th><th class="num">Connections</th><th class="num">COA reports</th><th class="num">News complaints</th></tr></thead><tbody id="dt"></tbody></table></div><div class="pager" id="dp"></div>`;
    $('#dsort').value = DS.sort;
    const draw = () => {
      const q = norm(DS.q);
      const rows = D.districts.filter(d => (!q || norm(d.n + ' ' + d.p).includes(q)) && (!DS.region || d.r === DS.region));
      rows.sort({ name: (a, b) => a.n.localeCompare(b.n), conn: (a, b) => (b.conn || 0) - (a.conn || 0), cmp: (a, b) => (b.cmp || 0) - (a.cmp || 0) }[DS.sort]);
      const pages = Math.max(1, Math.ceil(rows.length / 25)); DS.page = Math.min(DS.page, pages);
      $('#dc').textContent = `${rows.length} districts`;
      $('#dt').innerHTML = rows.slice((DS.page - 1) * 25, DS.page * 25).map(d => `<tr data-id="${d.id}"><td><a href="#/district/${d.id}">${esc(d.n)}</a>${d.op ? `<br><small class="count">${esc(d.op)}</small>` : ''}</td><td>${esc(d.p)}</td><td class="num">${fmtN(d.conn)}</td><td class="num">${esc(d.coa || '—')}</td><td class="num">${fmtN(d.cmp || 0)}</td></tr>`).join('') || `<tr><td colspan="5">No match. Try a shorter search.</td></tr>`;
      $('#dp').innerHTML = pages > 1 ? `<button class="btn btn-sm" data-p="${DS.page - 1}" ${DS.page === 1 ? 'disabled' : ''}>Previous</button><span>${DS.page} / ${pages}</span><button class="btn btn-sm" data-p="${DS.page + 1}" ${DS.page === pages ? 'disabled' : ''}>Next</button>` : '';
      $$('[data-p]').forEach(b => b.onclick = () => { DS.page = +b.dataset.p; draw(); $('#pages').scrollTop = 0; });
    };
    $('#ds').oninput = debounce(e => { DS.q = e.target.value; DS.page = 1; draw(); }, 150);
    $('#dr').onchange = e => { DS.region = e.target.value; DS.page = 1; draw(); };
    $('#dsort').onchange = e => { DS.sort = e.target.value; draw(); };
    $('#dt').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) go('#/district/' + tr.dataset.id); };
    draw();
  }
  async function pageDistrict(id) {
    pageNav('districts');
    const d = D.districts[D.dIndex[id]];
    if (!d) { P.innerHTML = '<h1>Not found</h1><p><a href="#/districts">All districts</a></p>'; return; }
    await loadPlaces();
    const di = D.dIndex[id], towns = D.places.munis.filter(m => m.wd === di);
    const news = D.complaints.filter(c => norm(c.wd) === norm(d.n)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const tf = (D.tariffs.districts || {})[d.id];
    P.innerHTML = `<p><a href="#/districts">Water districts</a> / ${esc(d.p)}</p><h1>${esc(d.n)}</h1>
      <p class="lead">${esc(d.p)}, ${esc(d.r)}.${d.op ? ` Run by a private partner: ${esc(d.op)}.` : ''}</p>
      ${towns.length ? `<p style="margin-top:16px"><a class="btn btn-primary" href="#/owed" id="chk">Check water in ${esc(towns[0].n)}</a></p>` : ''}
      <div class="kv"><div><span>Connections (LWUA)</span><b>${fmtN(d.conn)}</b></div><div><span>COA reports on file</span><b>${esc(d.coa || '—')}</b></div><div><span>News complaints</span><b>${news.length}</b></div><div><span>Minimum bill (10 m³)</span><b>${tf && tf.min ? peso(tf.min) : '—'}</b></div></div>
      ${d.n === 'Mabalacat City Water District' ? mcwdHTML() : ''}
      <h2>Complaints in the news</h2>${news.length ? `<ul class="news">${news.map(c => `<li>${esc(c.sum)}<div class="meta">${esc(c.date)} · ${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.src)}</a>` : esc(c.src)}</div></li>`).join('')}</ul>` : '<p class="lead">None found for 2016 to 2026. That may mean no coverage, not no problems.</p>'}`;
    const ck = $('#chk'); if (ck) ck.onclick = e => { e.preventDefault(); const m = towns[0]; S.muni = m.c; S.brgy = null; S.ptype = 'wd'; S.answers = {}; S.lat = S.lon = null; save(); go('#/owed'); };
  }
  function mcwdHTML() {
    const M = D.mcwd, k = M.kpi, max = Math.max(...M.complaints.rows.map(r => r.total));
    const cell = (r, i) => { const a = r.a[i], t = r.t[i], miss = r.hi ? a < t : a > t, f = r.fmt === 'pct' ? fmtPct : fmtN; return `<td class="num ${miss ? 'miss' : ''}">${f(a)}${miss ? ' ✕' : ''}</td>`; };
    return `<div class="duo" style="margin-top:28px"><div class="box"><h3>What the district reports</h3><p class="count">Actual values; ✕ = missed target. District-wide totals only.</p>
      <div class="table-scroll"><table class="table" style="border:0"><thead><tr><th>Indicator</th>${k.years.map(y => `<th class="num">${y}</th>`).join('')}</tr></thead><tbody>${k.rows.map(r => `<tr style="cursor:default"><td>${esc(r.k)}</td>${k.years.map((_, i) => cell(r, i)).join('')}</tr>`).join('')}</tbody></table></div><p class="count" style="margin-top:8px">${esc(k.cite)}</p></div>
      <div class="box"><h3>What households report</h3><p class="count">Complaints logged by the operator, by type.</p>
      <div class="bars">${M.complaints.rows.map(r => `<div class="bar-row"><span>${r.y}</span><div class="bar" style="width:${Math.round(r.total / max * 100)}%" role="img" aria-label="${r.y}: ${fmtN(r.total)} complaints"><span class="s-nowater" style="width:${r.nowater * 100}%"></span><span class="s-pressure" style="width:${r.pressure * 100}%"></span><span class="s-quality" style="width:${r.quality * 100}%"></span></div><b>${fmtN(r.total)}</b></div>`).join('')}</div>
      <div class="legend"><span><i class="s-nowater"></i>No water</span><span><i class="s-pressure"></i>Low pressure</span><span><i class="s-quality"></i>Quality</span></div><p class="count" style="margin-top:8px">${esc(M.complaints.cite)}</p></div></div>
      <h2>What the state auditor found</h2><ul>${M.findings.map(f => `<li style="margin-bottom:8px">${esc(f)}</li>`).join('')}</ul>`;
  }
  function pageAbout() {
    pageNav('about');
    const Pv = D.ob.providers, keys = Object.keys(Pv), nT = Object.keys(D.tariffs.districts || {}).length;
    P.innerHTML = `<h1>About Tubig</h1>
      <p class="lead">Tubig (Filipino for "water") is a prototype by Gregor Posadas, PhD student at UC Berkeley, for DevEng 203 (Fall 2026). It helps households see the service their water provider owes them, check their bill, and file a complaint that cites the rule.</p>
      <h2>Built on public records</h2>
      <div class="stats"><div class="stat"><b>240</b><span>service obligations</span></div><div class="stat"><b>554</b><span>water districts</span></div><div class="stat"><b>~4,500</b><span>state audit reports</span></div><div class="stat"><b>${fmtN(D.complaints.length)}</b><span>news-reported complaints</span></div><div class="stat"><b>42,010</b><span>barangays</span></div></div>
      <div class="cards">
        <div class="dcard"><b>Service obligations</b><p>Laws, regulations and contracts on what providers owe households, with sources.</p><a class="btn btn-sm" href="data/obligations.json" download>${I.down}JSON</a></div>
        <div class="dcard"><b>Water district crosswalk</b><p>Every district matched across LWUA, NWRB, COA and complaint records.</p><a class="btn btn-sm" href="data/districts.json" download>${I.down}JSON</a></div>
        <div class="dcard"><b>Complaints in the news</b><p>Reported water-service complaints, 2016 to 2026, checked against sources.</p><a class="btn btn-sm" href="data/complaints.json" download>${I.down}JSON</a></div>
        <div class="dcard"><b>Tariffs</b><p>Approved residential rates${nT ? ` for ${nT} providers` : ''}.</p>${nT ? `<a class="btn btn-sm" href="data/tariffs.json" download>${I.down}JSON</a>` : '<span class="count">Being collected</span>'}</div>
      </div>
      <h2>Rules by provider type</h2><p class="lead">"No rule found" is a finding, not missing data.</p>
      <div class="table-scroll" style="margin-top:12px"><table class="table matrix"><thead><tr><th>Service</th>${keys.map(k => `<th>${esc(Pv[k].name)}</th>`).join('')}</tr></thead><tbody>${D.ob.dimensions.map(d => `<tr style="cursor:default"><th>${esc(d.title)}</th>${keys.map(k => { const r = d.rules._all || d.rules[k]; return `<td>${r.status === 'none' ? '<span class="count">No rule found</span>' : esc(r.text)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
      <h2>Questions</h2><div class="faq">
        <details><summary>Is my information stored?</summary><p>No accounts, nothing sent to us. Answers stay in your browser. The place you pick goes to OpenStreetMap to show it on the map.</p></details>
        <details><summary>Why is there no minimum for hours or pressure?</summary><p>No national rule requires water districts to supply water 24 hours a day, at a set pressure, or in a set amount per person. Utilities regulated by NWRB and those run by local governments have minimums (18 hours a day and 8 psi under NWRB Res. 14-0921); water districts do not. LWUA and the Commission on Audit track hours of supply as a performance indicator, but each district sets its own target. Districts must meet national drinking-water quality standards and act on complaints within their Citizen's Charter times and 72 hours for 8888 complaints.</p></details>
        <details><summary>What if a private company runs my water district?</summary><p>Joint venture contracts reviewed so far promise 24-hour supply within 2 to 5 years and 10 psi within 4 to 5 years. These are contract terms, not regulations: only the water district's board can enforce them, by forfeiting the operator's performance bond or ending the contract. The contracts are usually not public, so ask your district for its annual joint venture compliance report. Your complaint goes to the water district, which answers for its partner.</p></details>
        <details><summary>Will this change?</summary><p>A bill creating a Water Regulatory Commission with power to set minimum service standards passed the House in December 2025 and is pending in the Senate. Until then, the gaps Tubig shows are gaps in the rules, not only in service.</p></details>
        <details><summary>Is this legal advice?</summary><p>No. Rules are summarized from an inventory of 240 obligations. Always check the linked source.</p></details>
        <details><summary>Are the contacts current?</summary><p>They come from official websites and Citizen's Charters and can change. Call to confirm.</p></details></div>
      <p class="count" style="margin-top:32px">Data are preliminary and under human verification. Map © OpenStreetMap contributors. <a href="https://github.com/gregor-posadas/tubig">Source code</a></p>`;
  }

  /* ---------- menu, theme ---------- */
  const menuBtn = $('#menu-btn'), menu = $('#menu');
  menuBtn.onclick = e => { e.stopPropagation(); const open = menu.hidden; menu.hidden = !open; menuBtn.setAttribute('aria-expanded', open); };
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); } });
  $$('a', menu).forEach(a => a.addEventListener('click', () => { menu.hidden = true; }));
  const themeBtn = $('#theme-btn');
  const syncTheme = () => { themeBtn.textContent = document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode'; };
  themeBtn.onclick = () => { const d = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = d; try { localStorage.setItem('tubig-theme', d); } catch { /* */ } syncTheme(); menu.hidden = true; };
  syncTheme();

  /* ---------- router ---------- */
  async function route() {
    await ready;
    const [v = '', arg] = location.hash.replace(/^#\/?/, '').split('/');
    const pages = ['districts', 'district', 'about'];
    $('#pages').hidden = !pages.includes(v); $('#app').hidden = pages.includes(v);
    if (pages.includes(v)) {
      document.title = { districts: 'Water districts · Tubig', district: 'Water district · Tubig', about: 'About · Tubig' }[v];
      await ({ districts: pageDistricts, district: () => pageDistrict(arg), about: pageAbout })[v](); $('#pages').scrollTop = 0; return;
    }
    setTimeout(() => map.invalidateSize(), 30);
    document.title = 'Tubig · Check your water service';
    if (['owed', 'report', 'gap', 'act', 'bill'].includes(v)) {
      await loadPlaces();
      if (!muni()) { go('#/'); return; }
      ({ owed: viewOwed, report: () => viewReport(+arg || 1), gap: viewGap, act: viewAct, bill: viewBill })[v]();
      placeOnMap();
    } else viewSearch();
    if (v) $('#panel').focus({ preventScroll: true });
  }
  addEventListener('hashchange', route);
  setSheet('peek');
  route();
})();
