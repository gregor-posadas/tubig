/* Tubig. Runs entirely in the browser. Nothing a user enters is sent to a server we run.
   The chosen place name (or, with "Use my location", the coordinates) goes to OpenStreetMap Nominatim. */
(() => {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const core = s => norm(s).replace(/\bcity of\b|\bcity\b|\bmunicipality of\b|\bwater district\b|\bmetro\b/g, ' ').replace(/\s+/g, ' ').trim();
  const fmtN = n => (n == null || n === '' ? '—' : Number(n).toLocaleString('en-US'));
  const fmtPct = n => (Math.round(n * 1000) / 10).toString().replace(/\.0$/, '') + '%';
  const lc = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  const bLabel = b => /^(barangay|poblacion)/i.test(b) ? b : 'Barangay ' + b;
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } }
  };

  const ICON = {
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    city: '<svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V8l6-4v17M19 21V11l-8-3"/><path d="M8 10v.01M8 14v.01M8 18v.01M15 14v.01M15 18v.01"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.01"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    ring: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
    print: '<svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><rect x="6" y="14" width="12" height="7"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>',
    saved: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
    file: '<svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
  };

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = ICON.check + `<span>${esc(msg)}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, 2600);
  }

  /* ---------- data ---------- */
  const D = {};
  const load = f => fetch('data/' + f).then(r => { if (!r.ok) throw new Error(f); return r.json(); });
  const ready = Promise.all([load('obligations.json'), load('districts.json'), load('complaints.json'), load('mcwd.json')])
    .then(([o, d, c, m]) => { D.ob = o; D.districts = d; D.complaints = c; D.mcwd = m; D.dIndex = Object.fromEntries(d.map((x, i) => [x.id, i])); });
  let placesP = null;
  function loadPlaces() {
    if (!placesP) placesP = load('places.json').then(p => {
      D.places = p;
      D.muniByCode = Object.fromEntries(p.munis.map((m, i) => [m.c, i]));
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
  const S = Object.assign({ muni: null, brgy: null, ptype: null, answers: {}, step: 1, lat: null, lon: null, savedAt: null }, store.get('tubig-state', {}));
  const save = () => {
    S.savedAt = Date.now();
    store.set('tubig-state', { muni: S.muni, brgy: S.brgy, ptype: S.ptype, answers: S.answers, step: S.step, lat: S.lat, lon: S.lon, savedAt: S.savedAt });
    const n = $('#saved-note');
    if (n) n.innerHTML = ICON.saved + 'Progress saved in this browser';
  };
  const muni = () => (S.muni && D.places) ? D.places.munis[D.muniByCode[S.muni]] : null;
  const wd = () => { const m = muni(); return m && m.wd != null ? D.districts[m.wd] : null; };
  const isMCWD = () => S.ptype === 'wd' && wd() && wd().n === 'Mabalacat City Water District';
  function detectType(m) { if (/metro manila/i.test(m.p)) return 'mwss'; if (m.wd != null) return 'wd'; return 'lgu'; }
  const placeLabel = () => { const m = muni(); return m ? (S.brgy ? bLabel(S.brgy) + ', ' : '') + `${m.n}, ${m.p}` : ''; };

  /* ---------- maps ---------- */
  const PH_BOUNDS = [[4.4, 116.6], [21.3, 127.0]];
  const tiles = () => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
  const homeMap = L.map('map', { scrollWheelZoom: false });
  tiles().addTo(homeMap);
  const fitPH = () => { if (homeMap.getSize().x < 640) homeMap.setView([12.4, 122.3], 5); else homeMap.fitBounds(PH_BOUNDS); };
  fitPH();
  let homePin = null;
  function pinOn(map, lat, lon, label, zoom, fly) {
    const g = L.layerGroup([
      L.circle([lat, lon], { radius: zoom >= 14 ? 500 : 2200, color: '#1D4E89', weight: 2, fillColor: '#78A6E0', fillOpacity: .22 }),
      L.circleMarker([lat, lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#CF5921', fillOpacity: 1 }).bindTooltip(esc(label), { permanent: true, direction: 'top', offset: [0, -10], className: 'pin-label' })
    ]).addTo(map);
    if (fly && !reduceMotion) map.flyTo([lat, lon], zoom, { duration: 1.2 }); else map.setView([lat, lon], zoom);
    return g;
  }
  const geoCache = {};
  async function geocode(m, b) {
    const key = m.c + '|' + (b || '');
    if (geoCache[key]) return geoCache[key];
    const qs = [b ? `${b}, ${m.n}, ${m.p}, Philippines` : null, `${m.n}, ${m.p}, Philippines`].filter(Boolean);
    for (const q of qs) {
      try {
        const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' } });
        const j = await r.json();
        if (j && j[0]) return (geoCache[key] = { lat: +j[0].lat, lon: +j[0].lon, exact: !!b && q === qs[0] });
      } catch { /* try next */ }
    }
    return null;
  }

  /* ---------- search ---------- */
  const input = $('#place'), list = $('#place-list'), clearBtn = $('#search-clear');
  let results = [], active = -1;
  function highlight(text, toks) {
    let out = esc(text);
    toks.filter(t => t.length > 1).forEach(t => { out = out.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i'), '<mark>$1</mark>'); });
    return out;
  }
  function search(q) {
    const n = norm(q);
    if (n.length < 2) return [];
    const toks = n.split(' ');
    const out = [];
    for (const e of D.index) {
      if (!toks.every(t => e.full.includes(t))) continue;
      const exact = (e.t === n || n.startsWith(e.t + ' ')) ? 0 : 1;
      const starts = e.t.startsWith(toks[0]) ? 0 : 1;
      out.push([exact, starts, e.kind, -e.pop, e]);
      if (out.length > 3000) break;
    }
    out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
    return out.slice(0, 8).map(x => x[4]);
  }
  function renderList(q) {
    const open = q && norm(q).length >= 2;
    if (!open) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); return; }
    const toks = norm(q).split(' ');
    list.innerHTML = results.length ? results.map((e, i) => `<li role="option" id="opt-${i}" aria-selected="${i === active}" data-i="${i}">
        <span class="opt-icon">${e.b ? ICON.pin : ICON.city}</span>
        <span><span class="opt-main">${highlight(e.b ? bLabel(e.name) : e.name, toks)}</span><span class="opt-sub">${esc(e.sub)}</span></span></li>`).join('')
      : `<li class="empty" role="option" aria-disabled="true">No barangay or town matches "${esc(q)}". Check the spelling, or try just the town.</li>`;
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
    if (active >= 0) input.setAttribute('aria-activedescendant', 'opt-' + active); else input.removeAttribute('aria-activedescendant');
    const a = $('#opt-' + active); if (a) a.scrollIntoView({ block: 'nearest' });
  }
  input.addEventListener('focus', () => loadPlaces());
  input.addEventListener('input', async () => {
    clearBtn.hidden = !input.value;
    await loadPlaces();
    results = search(input.value); active = results.length ? 0 : -1; renderList(input.value);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { if (results.length) { active = (active + 1) % results.length; renderList(input.value); } e.preventDefault(); }
    else if (e.key === 'ArrowUp') { if (results.length) { active = (active - 1 + results.length) % results.length; renderList(input.value); } e.preventDefault(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0 && results[active]) choose(results[active]); }
    else if (e.key === 'Escape') { results = []; renderList(''); }
  });
  list.addEventListener('mousedown', e => { const li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); choose(results[+li.dataset.i]); } });
  input.addEventListener('blur', () => setTimeout(() => renderList(''), 120));
  clearBtn.addEventListener('click', () => { input.value = ''; clearBtn.hidden = true; results = []; renderList(''); input.focus(); });
  $('#search-form').addEventListener('submit', e => e.preventDefault());
  $$('[data-example]').forEach(b => b.addEventListener('click', async () => {
    await loadPlaces();
    const [br, mn] = b.dataset.example.split('|');
    const e = D.index.find(x => br ? (x.b === br && x.sub.startsWith(mn)) : (!x.b && x.name === mn));
    if (e) choose(e);
  }));

  async function choose(e) {
    await ready; await loadPlaces();
    const m = D.places.munis[e.mi];
    const changed = S.muni !== m.c || S.brgy !== e.b;
    S.muni = m.c; S.brgy = e.b; S.ptype = detectType(m); S.lat = S.lon = null;
    if (changed) { S.answers = {}; S.step = 1; }
    input.value = e.b ? `${bLabel(e.b)}, ${m.n}` : m.n;
    results = []; renderList('');
    save();
    location.hash = '#/check/1';
    geocode(m, e.b).then(g => { if (g) { S.lat = g.lat; S.lon = g.lon; S.exact = g.exact; save(); if (current.view === 'check' && S.step === 1) drawMiniMap(); } });
  }

  /* use my location */
  $('#locate-btn').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Your browser cannot share its location. Type your barangay instead.'); return; }
    const btn = $('#locate-btn'); btn.disabled = true; btn.lastChild.textContent = ' Finding you…';
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        await loadPlaces(); await ready;
        const { latitude: lat, longitude: lon } = pos.coords;
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&addressdetails=1&lat=${lat}&lon=${lon}`);
        const j = await r.json(); const a = j.address || {};
        const town = a.city || a.town || a.municipality || a.village; const prov = a.state || a.province || a.region || '';
        const cand = D.places.munis.map((m, i) => [m, i]).filter(([m]) => core(m.n) === core(town) && (!prov || norm(prov).includes(norm(m.p).split(' ')[0]) || norm(m.p).includes(norm(prov).split(' ')[0])));
        const pick = cand[0] || D.places.munis.map((m, i) => [m, i]).find(([m]) => core(m.n) === core(town));
        if (!pick) throw new Error('nomatch');
        const [m, mi] = pick;
        const bn = [a.quarter, a.suburb, a.neighbourhood, a.village, a.hamlet].filter(Boolean).map(norm);
        const b = (D.places.brgys[m.c] || []).find(([n]) => bn.includes(norm(n)));
        await choose({ mi, b: b ? b[0] : null });
        toast(b ? `Found ${bLabel(b[0])}, ${m.n}` : `Found ${m.n}. Pick your barangay for a closer match.`);
      } catch { toast("We couldn't match your location. Type your barangay instead."); }
      finally { btn.disabled = false; btn.lastChild.textContent = ' Use my location'; }
    }, () => { btn.disabled = false; btn.lastChild.textContent = ' Use my location'; toast('Location permission was not given. Type your barangay instead.'); }, { timeout: 12000 });
  });

  /* resume banner */
  async function renderResume() {
    const el = $('#resume');
    if (!S.muni) { el.hidden = true; return; }
    await loadPlaces();
    if (!muni()) { el.hidden = true; return; }
    el.innerHTML = `<p><strong>Continue where you left off:</strong> ${esc(placeLabel())}, step ${S.step} of 4.</p>
      <a class="btn btn-primary btn-sm" href="#/check/${S.step}">Continue</a>
      <button class="btn btn-ghost btn-sm" type="button" id="resume-dismiss">Dismiss</button>`;
    el.hidden = false;
    $('#resume-dismiss').onclick = () => { el.hidden = true; };
  }

  /* ---------- obligations ---------- */
  const STATUS = {
    binding: ['tag-binding', ICON.check, 'Binding rule'],
    unconfirmed: ['tag-unconfirmed', ICON.ring, 'Binding, text not yet confirmed'],
    none: ['tag-none', ICON.minus, 'No rule found']
  };
  const tagHTML = s => { const [c, i, l] = STATUS[s]; return `<span class="tag ${c}">${i}${l}</span>`; };
  const ruleFor = d => d.rules._all || d.rules[S.ptype];
  const citeHTML = r => r.cite ? `<span class="cite">Source: ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.cite)}</a>` : esc(r.cite)}</span>` : '';

  /* ---------- questions & evaluation ---------- */
  const Q = [
    { id: 'hours', type: 'radio', legend: 'On a typical day lately, how many hours does water come out of your tap?', help: 'Count the hours when you can actually fill a container.',
      opts: [['24', 'All day (24 hours)'], ['18', '18 to 23 hours'], ['12', '12 to 17 hours'], ['7', '7 to 11 hours'], ['1', '1 to 6 hours'], ['0', 'No water at all']] },
    { id: 'pressure', type: 'radio', legend: 'How strong is the flow when water comes?',
      opts: [['strong', 'Strong: reaches upstairs and the shower'], ['ground', 'Usable on the ground floor only'], ['trickle', 'A trickle: we fill buckets'], ['none', 'No flow']] },
    { id: 'quality', type: 'check', legend: 'Have you noticed any of these in your water?', help: 'Choose all that apply.',
      opts: [['color', 'Brown, yellow or other color'], ['cloudy', 'Cloudy'], ['particles', 'Sand, rust or particles'], ['smell', 'A smell (rust, chlorine, sewage)'], ['taste', 'A bad taste'], ['sick', 'Someone got sick after drinking it'], ['ok', 'None of these']] },
    { id: 'outage', type: 'radio', legend: 'In the past 3 months, what was the longest stretch with no water at all?',
      opts: [['none', 'No interruptions'], ['lt1', 'Less than a day'], ['1', '1 to 3 days'], ['4', '4 to 14 days'], ['15', '15 days or more']] },
    { id: 'charged', type: 'radio', sub: true, showIf: a => a.outage === '15', legend: 'During that stretch, were you still charged the minimum charge or warned about disconnection?',
      opts: [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']] },
    { id: 'complaint', type: 'radio', legend: 'Have you already reported a problem to your provider?',
      opts: [['not', 'Not yet'], ['acted', 'Yes, and they acted within 3 days'], ['slow', 'Yes, but nothing for 3 days or more'], ['never', 'Yes, and nothing has happened at all']] },
    { id: 'bill', type: 'radio', legend: 'Has your water rate gone up in the past year?',
      opts: [['no', 'No'], ['hearing', 'Yes, after a public hearing'], ['nohearing', 'Yes, and I never heard of a hearing'], ['unsure', 'Not sure']] },
    { id: 'connect', type: 'radio', legend: 'Are you waiting for a new water connection?',
      opts: [['no', 'No'], ['short', 'Yes, for less than a month'], ['long', 'Yes, for more than a month']] }
  ];
  const LABEL = {}; Q.forEach(q => LABEL[q.id] = Object.fromEntries(q.opts));
  const EXAMPLE = { hours: '7', pressure: 'trickle', quality: ['color', 'particles'], outage: '1', complaint: 'slow', bill: 'unsure', connect: 'no' };

  function evaluate() {
    const a = S.answers, t = S.ptype, out = [];
    const dim = id => D.ob.dimensions.find(d => d.id === id);
    const push = (id, you, v, note, ask) => { const d = dim(id), r = ruleFor(d); out.push({ id, title: d.title, owed: r.text, r, you, v, note, ask }); };
    const tgt = id => dim(id).target.text.replace(/\.$/, '');
    if (a.hours != null) {
      const h = +a.hours, r = ruleFor(dim('hours')), you = LABEL.hours[a.hours];
      if (r.min == null) push('hours', you, h >= 24 ? 'met' : 'norule', h >= 24 ? '' : `There is no minimum to measure against. ${tgt('hours')} (not binding).`, h >= 24 ? '' : "Tell me the district's own target for hours of supply in my barangay, and when it will be met.");
      else if (h >= r.min) push('hours', you, 'met');
      else push('hours', you, 'notmet', `You get less than the required ${r.min} hours a day.`, `Restore at least ${r.min} hours of supply a day, as required.`);
    }
    if (a.pressure) {
      const r = ruleFor(dim('pressure')), you = LABEL.pressure[a.pressure];
      if (a.pressure === 'strong') push('pressure', you, 'met');
      else if (r.psi == null) push('pressure', you, 'norule', `There is no minimum to measure against. ${tgt('pressure')} (not binding).`, 'Measure the pressure at my connection and tell me the result.');
      else if (a.pressure === 'ground') push('pressure', you, 'check', `${r.psi} psi lifts water about ${Math.round(r.psi * 0.703 * 10) / 10} meters, roughly to a second-floor tap. A gauge reading would settle it.`, 'Measure the pressure at my connection and tell me the result.');
      else push('pressure', you, 'notmet', `A trickle or no flow is well below the required ${r.psi} psi.`, `Restore at least ${r.psi} psi at my connection.`);
    }
    if (a.quality && a.quality.length) {
      const signs = a.quality.filter(v => v !== 'ok');
      const you = a.quality.includes('ok') ? 'No problems noticed' : signs.map(v => LABEL.quality[v]).join('; ');
      if (!signs.length) push('quality', you, 'met');
      else push('quality', you, 'check', (signs.includes('sick') ? 'Someone got sick: contact your city or municipal health office now. ' : '') + 'These signs can mean the water fails national limits on color, turbidity, taste or odor. Only a lab test can confirm it.', 'Test the water at my tap at a DOH-accredited laboratory and give me the results.');
    }
    if (a.outage) {
      const you = LABEL.outage[a.outage];
      if (t === 'wd') {
        if (a.outage === '15') {
          if (a.charged === 'yes') push('outage', you + '; still charged or warned about disconnection', 'notmet', 'After 15 or more days without water, the district may not charge the minimum charge or disconnect you.', 'Remove the minimum charge for the period without water, and confirm I will not be disconnected.');
          else push('outage', you, a.charged === 'no' ? 'met' : 'check', a.charged === 'no' ? '' : 'Check your bill: no minimum charge should apply after 15 days without water.', 'Confirm that no minimum charge will apply for the period without water.');
        } else if (a.outage === 'none' || a.outage === 'lt1') push('outage', you, 'met');
        else push('outage', you, 'check', isMCWD() ? `The 15-day rule does not apply yet. Compare with Mabalacat's Citizen's Charter: ${D.mcwd.contacts.serviceRequest}` : "The 15-day rule does not apply yet. Compare with the repair times in your district's Citizen's Charter.", 'Explain the cause of the interruption and when full service will be restored.');
      } else if (t === 'mwss') {
        if (a.outage === 'none') push('outage', you, 'met');
        else if (a.outage === 'lt1') push('outage', you, 'check', 'Unplanned interruptions must be fixed within 6 hours.', 'Explain the interruption and confirm it was restored within 6 hours.');
        else push('outage', you, 'notmet', 'Unplanned interruptions must be fixed within 6 hours' + (a.outage === '15' ? ', and failures over 15 days qualify for a bill rebate.' : '.'), a.outage === '15' ? 'Credit the rebate owed for a failure lasting over 15 days.' : 'Explain why service was not restored within 6 hours.');
      } else push('outage', you, a.outage === 'none' ? 'met' : 'norule', a.outage === 'none' ? '' : 'No rule on how fast service must come back was found for this provider type.', 'Explain the cause of the interruption and when service will be restored.');
    }
    if (a.complaint && a.complaint !== 'not') {
      const you = LABEL.complaint[a.complaint];
      if (a.complaint === 'acted') push('complaint', you, 'met');
      else if (isMCWD()) push('complaint', you, 'notmet', "Mabalacat's Citizen's Charter promises action on service requests within 24 hours.", 'Give me a reference number and act on my earlier report.');
      else if (t === 'wd' || t === 'lgu') push('complaint', you, a.complaint === 'never' ? 'notmet' : 'check', "Your provider's Citizen's Charter sets how fast it must act. Complaints sent through 8888 must be acted on within 72 hours.", 'Give me a reference number and act on my earlier report.');
      else push('complaint', you, 'check', ruleFor(dim('complaint')).text, 'Give me a reference number and act on my earlier report.');
    }
    if (a.bill && a.bill !== 'no') {
      const you = LABEL.bill[a.bill], r = ruleFor(dim('bill'));
      if (r.status === 'none') push('bill', you, 'norule', 'No outside review of rates was found for this provider type.');
      else if (a.bill === 'hearing') push('bill', you, 'met');
      else push('bill', you, 'check', t === 'wd' ? 'Every rate increase needs a public hearing first. You can ask for the hearing notice and date.' : r.text, t === 'wd' ? 'Send me the date and notice of the public hearing held before the latest rate increase.' : 'Explain the basis for the latest rate increase.');
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
  const VERDICT = { met: ['v-met', ICON.check, 'Met'], notmet: ['v-notmet', ICON.x, 'Not met'], check: ['v-check', ICON.alert, 'Needs checking'], norule: ['v-norule', ICON.minus, 'No rule'] };
  const verdictHTML = v => { const [c, i, l] = VERDICT[v]; return `<span class="verdict ${c}">${i}${l}</span>`; };

  /* ---------- wizard ---------- */
  const STEPS = [
    { n: 1, name: "What you're owed", sub: 'Your provider and its rules' },
    { n: 2, name: 'Your water service', sub: '7 quick questions' },
    { n: 3, name: 'The gap', sub: 'Rules versus reality' },
    { n: 4, name: 'Take action', sub: 'Letter, contacts, script' }
  ];
  let miniMap = null;

  function renderStepper() {
    const answered = Object.keys(S.answers).length > 0;
    $('#stepper').innerHTML = STEPS.map(s => {
      const cls = s.n < S.step ? 'done' : s.n === S.step ? 'current' : '';
      const locked = s.n > 2 && !answered;
      return `<li class="${cls}"><span class="step-dot">${s.n < S.step ? ICON.check : s.n}</span>
        <button type="button" data-step="${s.n}" ${locked ? 'disabled aria-disabled="true"' : ''} ${s.n === S.step ? 'aria-current="step"' : ''}>
        <span class="step-name">${esc(s.name)}</span><span class="step-sub">${esc(locked ? 'Answer step 2 first' : s.sub)}</span></button></li>`;
    }).join('');
    $$('#stepper button[data-step]').forEach(b => b.onclick = () => { if (!b.disabled) location.hash = '#/check/' + b.dataset.step; });
    $('#mobile-progress').innerHTML = `<div class="mp-label"><span>Step ${S.step} of 4</span><span>${esc(STEPS[S.step - 1].name)}</span></div><div class="mp-bar"><span style="width:${S.step * 25}%"></span></div>`;
    if (S.savedAt) $('#saved-note').innerHTML = ICON.saved + 'Progress saved in this browser';
  }
  function renderPlaceSummary() {
    const m = muni();
    $('#place-summary').innerHTML = `<span class="ps-place">${esc(S.brgy ? bLabel(S.brgy) : m.n)}</span><span class="ps-sep"></span><span class="ps-prov">${esc(S.brgy ? m.n + ', ' : '')}${esc(m.p)}</span>`;
  }
  function renderNav() {
    const nav = $('#step-nav');
    const back = S.step > 1 ? `<button class="btn" type="button" data-go="${S.step - 1}">${ICON.left}Back</button>` : '<span></span>';
    let next = '';
    if (S.step === 1) next = `<button class="btn btn-primary" type="button" data-go="2">Describe my service${ICON.right}</button>`;
    if (S.step === 2) next = `<button class="btn btn-primary" type="button" data-go="3" ${Object.keys(S.answers).length ? '' : 'disabled'}>See the gap${ICON.right}</button>`;
    if (S.step === 3) next = `<button class="btn btn-primary" type="button" data-go="4">Take action${ICON.right}</button>`;
    if (S.step === 4) next = (S.ptype === 'wd' && wd()) ? `<a class="btn" href="#/district/${wd().id}">See this district's record${ICON.right}</a>` : '';
    nav.innerHTML = back + next;
    $$('[data-go]', nav).forEach(b => b.onclick = () => { location.hash = '#/check/' + b.dataset.go; });
  }
  function renderStep(focus) {
    const p = $('#step-panel');
    ({ 1: step1, 2: step2, 3: step3, 4: step4 })[S.step](p);
    p.classList.remove('enter'); void p.offsetWidth; p.classList.add('enter');
    renderStepper(); renderNav();
    if (focus) { p.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); }
  }

  function step1(p) {
    const m = muni(), P = D.ob.providers, t = S.ptype, w = wd();
    let name, desc, note = '';
    if (t === 'wd' && w) { name = w.n; desc = P.wd.plain; }
    else if (t === 'mwss') { name = 'Manila Water or Maynilad'; desc = P.mwss.plain + ' Which one depends on your side of Metro Manila.'; }
    else { name = P[t].name; desc = P[t].plain; }
    if (S.ptype === 'lgu' && detectType(m) === 'lgu') note = `We didn't find a water district for ${esc(m.n)} among the 554 we track. Water here may come from the city or municipal government, a community association or a private company. Choose the one that serves you.`;
    const dims = D.ob.dimensions;
    const ruleRow = (d, open) => {
      const r = ruleFor(d);
      return `<details class="rule" ${open ? 'open' : ''}><summary><span><span class="rule-title">${esc(d.title)}</span>${d.question ? `<span class="rule-q">${esc(d.question)}</span>` : ''}</span>${tagHTML(r.status)}${ICON.chev}</summary>
        <div class="rule-body"><p>${esc(r.text)}</p>
        ${r.status === 'none' && d.target ? `<p class="rule-target"><strong>For comparison:</strong> ${esc(d.target.text)} This is a target, not a requirement. <a href="${esc(d.target.url)}" target="_blank" rel="noopener">${esc(d.target.cite)}</a></p>` : ''}
        ${d.id === 'complaint' && isMCWD() ? `<p class="rule-target"><strong>Mabalacat's Citizen's Charter:</strong> ${esc(D.mcwd.contacts.serviceRequest)} <a href="${esc(D.mcwd.contacts.charter)}" target="_blank" rel="noopener">${esc(D.mcwd.contacts.serviceRequestCite)}</a></p>` : ''}
        ${citeHTML(r)}</div></details>`;
    };
    p.innerHTML = `<p class="step-eyebrow">Step 1 of 4</p><h2>What you're owed</h2>
      <p class="step-intro">These are the service standards that apply to your provider type, drawn from laws, regulations, national standards and contracts. Open any row to see the rule and its source.</p>
      <div class="provider-card">
        <div>
          <p class="pc-label">Your provider</p>
          <p class="pc-name">${esc(name)}</p>
          <p class="pc-desc">${esc(desc)}</p>
          ${t === 'wd' && w && w.op ? `<span class="pc-op">${ICON.info.replace('<svg', '<svg width="14" height="14"')}Operated by a private partner: ${esc(w.op)}</span>` : ''}
          <div class="field" style="margin-top:16px;max-width:320px">
            <label for="ptype">Not right? Change provider type</label>
            <select id="ptype">${Object.entries(P).map(([k, v]) => `<option value="${k}" ${k === t ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
          </div>
        </div>
        <div id="mini-map" class="mini-map" role="img" aria-label="Map showing ${esc(placeLabel())}"></div>
      </div>
      ${note ? `<div class="notice">${ICON.info}<p>${note}</p></div>` : ''}
      <div class="legend"><span class="legend-label">Labels:</span>${tagHTML('binding')}${tagHTML('unconfirmed')}${tagHTML('none')}</div>
      <h3 class="rules-group">Things you can check yourself</h3>
      <div class="rules">${dims.filter(d => d.group === 'check').map((d, i) => ruleRow(d, i === 0)).join('')}</div>
      <h3 class="rules-group">What your provider must do behind the scenes</h3>
      <div class="rules">${dims.filter(d => d.group === 'behind').map(d => ruleRow(d, false)).join('')}</div>`;
    $('#ptype').onchange = e => { S.ptype = e.target.value; save(); renderStep(false); toast('Provider type changed. Rules updated.'); };
    drawMiniMap();
  }
  async function drawMiniMap() {
    const el = $('#mini-map'); if (!el) return;
    if (miniMap) { miniMap.remove(); miniMap = null; }
    miniMap = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false });
    tiles().addTo(miniMap);
    if (S.lat == null) {
      miniMap.fitBounds(PH_BOUNDS);
      const g = await geocode(muni(), S.brgy);
      if (!g || !$('#mini-map')) return;
      S.lat = g.lat; S.lon = g.lon; S.exact = g.exact; save();
    }
    pinOn(miniMap, S.lat, S.lon, S.brgy ? bLabel(S.brgy) : muni().n, S.exact || S.brgy ? 13 : 11, false);
  }

  function step2(p) {
    p.innerHTML = `<p class="step-eyebrow">Step 2 of 4</p><h2>Your water service</h2>
      <p class="step-intro">Think about the past few weeks. Answer what you can and skip anything you're not sure about. Your answers stay in this browser.</p>
      <div class="example-bar"><p>Just exploring? Load answers from a real household in Mabalacat City (March 2026).</p><button class="btn btn-sm" type="button" id="use-example">Use example answers</button></div>
      <form class="q-list" id="survey" novalidate>${Q.map(qHTML).join('')}</form>
      <p class="answered" id="answered" aria-live="polite"></p>`;
    const f = $('#survey');
    f.addEventListener('change', e => {
      const t = e.target; if (!t.name) return;
      if (t.type === 'checkbox') {
        let cur = $$(`input[name="${t.name}"]:checked`, f).map(x => x.value);
        if (t.value === 'ok' && t.checked) { cur = ['ok']; $$(`input[name="${t.name}"]`, f).forEach(x => x.checked = x.value === 'ok'); }
        else if (t.checked) { cur = cur.filter(v => v !== 'ok'); const ok = $(`input[name="${t.name}"][value="ok"]`, f); if (ok) ok.checked = false; }
        if (cur.length) S.answers[t.name] = cur; else delete S.answers[t.name];
      } else S.answers[t.name] = t.value;
      Q.forEach(q => { if (q.showIf) { const fs = $('#q-' + q.id); const show = q.showIf(S.answers); fs.hidden = !show; if (!show) delete S.answers[q.id]; } });
      save(); updateAnswered(); renderStepper(); renderNav();
    });
    $('#use-example').onclick = () => { S.answers = JSON.parse(JSON.stringify(EXAMPLE)); save(); renderStep(false); toast('Example answers loaded'); };
    updateAnswered();
  }
  function qHTML(q) {
    const hidden = q.showIf && !q.showIf(S.answers);
    const checked = v => q.type === 'check' ? (S.answers[q.id] || []).includes(v) : S.answers[q.id] === v;
    return `<div class="q ${q.sub ? 'q-sub' : ''}" id="q-${q.id}" ${hidden ? 'hidden' : ''}><fieldset>
      <legend>${esc(q.legend)}</legend>${q.help ? `<p class="q-help">${esc(q.help)}</p>` : ''}
      <div class="options">${q.opts.map(([v, l]) => `<label class="option"><input type="${q.type === 'check' ? 'checkbox' : 'radio'}" name="${q.id}" value="${v}" ${checked(v) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
      </fieldset></div>`;
  }
  function updateAnswered() {
    const n = Q.filter(q => !q.sub && S.answers[q.id] != null).length, total = Q.filter(q => !q.sub).length;
    const el = $('#answered'); if (el) el.textContent = `${n} of ${total} answered.`;
  }

  function step3(p) {
    const rows = evaluate(); S.rows = rows;
    if (!rows.length) {
      p.innerHTML = `<p class="step-eyebrow">Step 3 of 4</p><h2>The gap</h2><div class="empty-state">${ICON.file}<h3>Nothing to compare yet</h3><p class="muted">Answer at least one question in step 2 to see how your service compares.</p><button class="btn btn-primary" type="button" id="go2">Go to step 2</button></div>`;
      $('#go2').onclick = () => { location.hash = '#/check/2'; };
      return;
    }
    const c = k => rows.filter(r => r.v === k).length;
    const sumTile = (k, l) => `<div class="sum ${k}"><div class="sum-n">${VERDICT[k][1]}${c(k)}</div><div class="sum-l">${l}</div></div>`;
    p.innerHTML = `<p class="step-eyebrow">Step 3 of 4</p><h2>The gap</h2>
      <p class="step-intro">What you reported, next to what the rules require. "No rule" means there is no binding standard to hold your provider to, which is itself worth raising.</p>
      <div class="summary">${sumTile('notmet', 'Not met')}${sumTile('check', 'Need checking')}${sumTile('norule', 'No rule exists')}${sumTile('met', 'Met')}</div>
      <div class="results">${rows.map(r => `<article class="result ${r.v}">
        <div class="result-head"><h3>${esc(r.title)}</h3>${verdictHTML(r.v)}</div>
        <div class="result-grid"><div><p class="result-k">What the rules require</p><p>${esc(r.owed)}</p></div><div><p class="result-k">What you reported</p><p>${esc(r.you)}</p></div></div>
        ${r.note ? `<div class="result-note">${esc(r.note)}</div>` : ''}</article>`).join('')}</div>`;
  }

  function step4(p) {
    const rows = S.rows || evaluate(); S.rows = rows;
    const issues = rows.filter(r => r.v !== 'met');
    const letter = buildLetter(issues);
    const contacts = contactsFor(rows);
    const to = (contacts.find(x => x.email) || {}).email || '';
    const subject = 'Water service complaint, ' + placeLabel();
    p.innerHTML = `<p class="step-eyebrow">Step 4 of 4</p><h2>Take action</h2>
      <p class="step-intro">${issues.length ? 'Your letter is written from your answers and cites the rules. Add your name and account number, edit anything you like, then send it or bring it to the office.' : 'Everything you reported meets the rules. You can still use the contacts below if something changes.'}</p>
      <div class="tabs" role="tablist" aria-label="Ways to act">
        <button class="tab" role="tab" id="tab-letter" aria-controls="pane-letter" aria-selected="true">Complaint letter</button>
        <button class="tab" role="tab" id="tab-contacts" aria-controls="pane-contacts" aria-selected="false" tabindex="-1">Who to contact</button>
        <button class="tab" role="tab" id="tab-script" aria-controls="pane-script" aria-selected="false" tabindex="-1">Phone script</button>
      </div>
      <div role="tabpanel" id="pane-letter" aria-labelledby="tab-letter">
        <div class="letter-tools">
          <button class="btn btn-primary btn-sm" type="button" id="copy-letter">${ICON.copy}Copy</button>
          <a class="btn btn-sm" id="mail-letter" href="mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(letter)}">${ICON.mail}Open in email</a>
          <button class="btn btn-sm" type="button" id="dl-letter">${ICON.download}Download</button>
          <button class="btn btn-sm" type="button" id="print-letter">${ICON.print}Print</button>
        </div>
        <label for="letter" class="sr-only">Complaint letter</label>
        <textarea id="letter" class="letter" spellcheck="true">${esc(letter)}</textarea>
        <div class="letter-meta"><span>Fill in the parts in [brackets].</span><span id="letter-count"></span></div>
      </div>
      <div role="tabpanel" id="pane-contacts" aria-labelledby="tab-contacts" hidden>
        <ol class="contacts">${contacts.map((c, i) => `<li class="contact"><span class="contact-n">${i + 1}</span><h4>${esc(c.name)}</h4><span class="when">${esc(c.when)}</span><p>${esc(c.how)}</p>${c.note ? `<p class="small">${esc(c.note)}</p>` : ''}
          ${c.links ? `<div class="contact-links">${c.links.map(l => `<a class="btn btn-sm" href="${esc(l.href)}" ${l.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${ICON[l.icon] || ''}${esc(l.label)}</a>`).join('')}</div>` : ''}</li>`).join('')}</ol>
      </div>
      <div role="tabpanel" id="pane-script" aria-labelledby="tab-script" hidden>${scriptHTML(issues)}</div>`;
    const ta = $('#letter');
    const sync = () => { $('#mail-letter').href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(ta.value)}`; $('#letter-count').textContent = ta.value.split(/\s+/).filter(Boolean).length + ' words'; };
    ta.addEventListener('input', sync); sync();
    $('#copy-letter').onclick = async () => { try { await navigator.clipboard.writeText(ta.value); toast('Letter copied to clipboard'); } catch { ta.select(); toast('Press Ctrl+C or Cmd+C to copy'); } };
    $('#dl-letter').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ta.value], { type: 'text/plain' })); a.download = 'water-complaint-letter.txt'; a.click(); URL.revokeObjectURL(a.href); toast('Letter downloaded'); };
    $('#print-letter').onclick = () => { let pl = $('.print-letter'); if (!pl) { pl = document.createElement('div'); pl.className = 'print-letter'; document.body.appendChild(pl); } pl.textContent = ta.value; window.print(); };
    const tabs = $$('[role="tab"]', p);
    const select = tab => { tabs.forEach(t => { const on = t === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; $('#' + t.getAttribute('aria-controls')).hidden = !on; }); tab.focus(); };
    tabs.forEach((t, i) => { t.onclick = () => select(t); t.onkeydown = e => { if (e.key === 'ArrowRight') select(tabs[(i + 1) % tabs.length]); if (e.key === 'ArrowLeft') select(tabs[(i - 1 + tabs.length) % tabs.length]); }; });
  }
  function buildLetter(issues) {
    const m = muni(), w = wd();
    const prov = S.ptype === 'wd' && w ? w.n : (S.ptype === 'mwss' ? '[Manila Water or Maynilad]' : D.ob.providers[S.ptype].name);
    const where = placeLabel();
    const cite = r => (r.id === 'complaint' && isMCWD()) ? ` (${D.mcwd.contacts.serviceRequestCite})` : (r.r && r.r.cite && r.r.status !== 'none' ? ` (${r.r.cite})` : '');
    const lines = issues.map(r => {
      const head = `- ${r.title}: ${r.you}.`;
      if (r.v === 'notmet') return `${head} ${(r.note || '').replace(/\.$/, '')}${cite(r)}.`;
      if (r.v === 'norule') return `${head} I understand there is no binding standard for this, so I am asking for your own service target.`;
      return `${head} ${(r.note || '').replace(/^Someone got sick: contact your city or municipal health office now\. /, '')}`.trim();
    });
    const asks = [...new Set(issues.map(r => r.ask).filter(Boolean))];
    const date = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    return `${date}

To: ${prov}
${S.ptype === 'wd' && isMCWD() ? D.mcwd.contacts.address + '\n' : ''}
Subject: Water service complaint, ${where}

Good day.

I am a customer at [your house number and street], ${where}. I am writing to report problems with the water service at my connection.

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
      out.push({ name: 'Mabalacat City Water District and its operator', when: 'Start here', how: `Email, call or visit. Office: ${c.address}. Ask for a reference number.`, note: c.charterNote, email: c.email,
        links: [{ href: 'mailto:' + c.email, label: c.email, icon: 'mail' }, { href: 'tel:' + c.landline.replace(/[^0-9+]/g, ''), label: c.landline, icon: 'phone' }, { href: 'tel:' + c.hotlines[0].replace(/[^0-9]/g, '').slice(0, 11), label: c.hotlines[0], icon: 'phone' }, { href: c.charter, label: "Citizen's Charter", icon: 'ext' }] });
    } else if (t === 'wd' && w) {
      out.push({ name: w.n, when: 'Start here', how: "Use the Public Assistance and Complaints Desk listed in the district's Citizen's Charter, usually on its website or posted at the office. Ask for a reference number." });
    } else if (t === 'mwss') {
      out.push({ name: 'Your concessionaire', when: 'Start here', how: 'Maynilad: call 1626. Manila Water: call 1627. Ask for a reference number.', links: [{ href: 'tel:1626', label: 'Maynilad 1626', icon: 'phone' }, { href: 'tel:1627', label: 'Manila Water 1627', icon: 'phone' }] });
      out.push({ name: 'MWSS Regulatory Office', when: 'If it is not resolved', how: 'The regulator of the two concessionaires handles unresolved complaints.' });
    } else if (t === 'private') {
      out.push({ name: 'Your water company', when: 'Start here', how: 'Write to its customer service and keep a copy.' });
      out.push({ name: 'National Water Resources Board (NWRB)', when: 'If it is not resolved', how: 'File a written, sworn complaint. NWRB must answer within 10 days and decide within 60.' });
    } else if (t === 'lgu') {
      out.push({ name: `${m.n} city or municipal hall`, when: 'Start here', how: "Ask for the office that runs the waterworks and its Citizen's Charter. Ask for a reference number." });
    } else {
      out.push({ name: 'Your waterworks association', when: 'Start here', how: 'Raise it with the officers in writing.' });
      out.push({ name: 'NWRB', when: 'If it is not resolved', how: 'If the association is registered with NWRB, you can file a complaint there.' });
    }
    if (t === 'wd' || t === 'lgu') {
      out.push({ name: "8888 Citizens' Complaint Center", when: "If nothing happens in the Citizen's Charter time", how: 'Call 8888, any time. The agency must act within 72 hours.', links: [{ href: 'tel:8888', label: 'Call 8888', icon: 'phone' }] });
      out.push({ name: 'Anti-Red Tape Authority (ARTA)', when: "If the office ignores its Citizen's Charter", how: 'File online or call 1-ARTA (12782).', links: [{ href: 'https://ecms.arta.gov.ph/', label: 'File with ARTA', icon: 'ext' }, { href: 'tel:12782', label: '1-ARTA', icon: 'phone' }] });
    }
    if (rows.some(r => r.id === 'quality' && r.v !== 'met')) out.push({ name: `${m.n.replace(/^City of /, '')} City or Municipal Health Office`, when: 'For color, smell, particles or illness', how: "Ask the sanitary inspector to test the water at your tap. Go right away if someone is sick." });
    if (t === 'wd' && rows.some(r => r.id === 'bill' && r.v !== 'met')) out.push({ name: 'Local Water Utilities Administration (LWUA)', when: 'For rate questions', how: 'LWUA reviews water district rates.', links: [{ href: 'https://lwua.gov.ph/', label: 'lwua.gov.ph', icon: 'ext' }] });
    return out;
  }
  function scriptHTML(issues) {
    const say = r => ({
      hours: `We only get water about ${lc(r.you).replace(/^all day.*/, '24 hours')} a day.`,
      pressure: `The water pressure is weak. ${r.you}.`,
      quality: `Our water has these problems: ${lc(r.you)}.`,
      outage: `Our longest stretch without water was ${lc(r.you)}.`,
      complaint: `I already reported a problem. ${r.you}.`,
      bill: `About our water rate: ${lc(r.you)}.`,
      connect: `I'm waiting for a new connection: ${lc(r.you)}.`
    }[r.id] || `${r.title}: ${r.you}.`);
    const top = issues.slice(0, 3);
    const rule = top.find(r => r.v === 'notmet' && r.note);
    const lines = [
      ['You', `Good day. I'm calling to report a water service problem in ${placeLabel()}. My account number is [account number].`],
      ...(top.length ? [['You', top.map(say).join(' ')]] : []),
      ...(rule ? [['You', rule.note]] : []),
      ['You', 'Can you give me a reference number, and tell me when someone will act on this?']
    ];
    return `<div class="script">${lines.map(([w, t]) => `<div class="line"><span class="who">${w}</span><p>${esc(t)}</p></div>`).join('')}</div>
      <p class="tip" style="margin-top:16px">${ICON.info}Write down the date, the name of the person you spoke to, and the reference number. You'll need them if you escalate.</p>`;
  }

  /* ---------- districts ---------- */
  const DS = { q: '', region: '', sort: 'name', page: 1, per: 25 };
  function initDistricts() {
    const regions = [...new Set(D.districts.map(d => d.r))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    $('#d-region').innerHTML = '<option value="">All regions</option>' + regions.map(r => `<option>${esc(r)}</option>`).join('');
    $('#d-search').addEventListener('input', debounce(e => { DS.q = e.target.value; DS.page = 1; renderDistricts(); }, 150));
    $('#d-region').onchange = e => { DS.region = e.target.value; DS.page = 1; renderDistricts(); };
    $('#d-sort').onchange = e => { DS.sort = e.target.value; DS.page = 1; renderDistricts(); };
    $('#d-table tbody').addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr && !e.target.closest('a')) location.hash = '#/district/' + tr.dataset.id; });
  }
  function newsFor(d) {
    const key = norm(d.n);
    return D.complaints.filter(c => norm(c.wd) === key).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }
  function renderDistricts() {
    const q = norm(DS.q);
    let rows = D.districts.filter(d => (!q || norm(d.n + ' ' + d.p).includes(q)) && (!DS.region || d.r === DS.region));
    const by = { name: (a, b) => a.n.localeCompare(b.n), conn: (a, b) => (b.conn || 0) - (a.conn || 0), cmp: (a, b) => (b.cmp || 0) - (a.cmp || 0), score: (a, b) => (a.score ?? 999) - (b.score ?? 999) }[DS.sort];
    rows = rows.slice().sort(by);
    const pages = Math.max(1, Math.ceil(rows.length / DS.per)); DS.page = Math.min(DS.page, pages);
    const slice = rows.slice((DS.page - 1) * DS.per, DS.page * DS.per);
    $('#d-count').textContent = `${rows.length.toLocaleString()} district${rows.length === 1 ? '' : 's'}`;
    $('#d-table tbody').innerHTML = slice.length ? slice.map(d => `<tr data-id="${d.id}"><td><a href="#/district/${d.id}">${esc(d.n)}</a></td><td>${esc(d.p)}</td><td class="num">${fmtN(d.conn)}</td><td class="num">${esc(d.coa || '—')}</td><td class="num">${fmtN(d.cmp || 0)}</td><td>${d.op ? `<span class="op-badge">${esc(d.op)}</span>` : ''}</td></tr>`).join('')
      : `<tr><td colspan="6"><div class="empty-state">${ICON.search}<p>No districts match. Try a shorter search or clear the region filter.</p></div></td></tr>`;
    $('#d-pager').innerHTML = pages > 1 ? `<button class="btn btn-sm" type="button" data-p="${DS.page - 1}" ${DS.page === 1 ? 'disabled' : ''}>${ICON.left}Previous</button><span>Page ${DS.page} of ${pages}</span><button class="btn btn-sm" type="button" data-p="${DS.page + 1}" ${DS.page === pages ? 'disabled' : ''}>Next${ICON.right}</button>` : '';
    $$('#d-pager [data-p]').forEach(b => b.onclick = () => { DS.page = +b.dataset.p; renderDistricts(); $('#d-table').scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }); });
  }
  async function renderDistrict(id) {
    const d = D.districts[D.dIndex[id]], el = $('#district-page');
    if (!d) { el.innerHTML = `<div class="empty-state"><h2>District not found</h2><p><a href="#/districts">Back to all districts</a></p></div>`; return; }
    await loadPlaces();
    const di = D.dIndex[id];
    const towns = D.places.munis.filter(m => m.wd === di);
    const news = newsFor(d);
    const isM = d.n === 'Mabalacat City Water District';
    el.innerHTML = `<p class="crumbs"><a href="#/districts">Water districts</a> / ${esc(d.p)}</p>
      <h1>${esc(d.n)}</h1>
      <p class="lede">${esc(d.p)}, ${esc(d.r)}.${d.op ? ` Operated by a private partner: ${esc(d.op)}.` : ''}</p>
      ${towns.length ? `<p><a class="btn btn-primary" href="#/check/1" id="check-town">Check your water in ${esc(towns[0].n)}${ICON.right}</a></p>` : ''}
      <div class="facts">
        <div class="fact"><div class="fact-k">Service connections (LWUA${d.lwuaAsOf ? ', ' + esc(d.lwuaAsOf.slice(0, 7)) : ''})</div><div class="fact-v">${fmtN(d.conn)}</div></div>
        <div class="fact"><div class="fact-k">LWUA category</div><div class="fact-v">${esc(d.cat || '—')}</div></div>
        <div class="fact"><div class="fact-k">COA audit reports on file</div><div class="fact-v">${esc(d.coa || '—')}</div></div>
        <div class="fact"><div class="fact-k">News-reported complaints</div><div class="fact-v">${news.length}</div></div>
      </div>
      <p class="muted small">Self-reports to: ${esc(d.selfrep || 'none found')}. Data coverage score: ${d.score ?? '—'} of 100 (how much of the public record exists for this district).</p>
      ${isM ? mcwdHTML() : ''}
      <h2>Complaints in the news</h2>
      ${news.length ? `<ul class="news">${news.map(c => `<li>${esc(c.sum)}<div class="meta">${esc(c.date)} · ${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.src)}</a>` : esc(c.src)}${c.area && c.area !== 'No' ? ' · ' + esc(c.area) : ''}</div>${c.types.length ? `<div class="type-tags">${c.types.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}</li>`).join('')}</ul>` : `<p class="muted">No news-reported complaints found for this district in 2016 to 2026. That may mean no coverage, not no problems.</p>`}`;
    const ct = $('#check-town');
    if (ct) ct.onclick = e => { e.preventDefault(); const m = towns[0]; S.muni = m.c; S.brgy = null; S.ptype = 'wd'; S.answers = {}; S.step = 1; S.lat = S.lon = null; save(); location.hash = '#/check/1'; };
  }
  function mcwdHTML() {
    const M = D.mcwd, k = M.kpi;
    const cell = (row, i) => { const a = row.a[i], t = row.t[i], miss = row.hi ? a < t : a > t, f = row.fmt === 'pct' ? fmtPct : fmtN; return `<td class="num ${miss ? 'miss' : ''}">${f(a)}${miss ? '<span class="sr-only"> (missed target)</span> ✕' : ''}</td><td class="num muted">${f(t)}</td>`; };
    const max = Math.max(...M.complaints.rows.map(r => r.total));
    return `<div class="two-col" style="margin-top:32px">
      <section class="panel"><h3>What the district reports</h3><p class="small muted">${esc(k.note)}</p>
        <div class="table-wrap"><table class="kpi"><thead><tr><th>Indicator</th>${k.years.map(y => `<th class="num">${y}</th><th class="num">Target</th>`).join('')}</tr></thead>
        <tbody>${k.rows.map(r => `<tr><td>${esc(r.k)}</td>${k.years.map((_, i) => cell(r, i)).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="cite" style="margin-top:8px">${esc(k.cite)}. ✕ marks a missed target.</p></section>
      <section class="panel"><h3>What households report</h3><p class="small muted">Valid complaints logged by the operator, by type.</p>
        <div class="bars">${M.complaints.rows.map(r => `<div class="bar-row"><span>${r.y}</span><div class="bar" style="width:${Math.round(r.total / max * 100)}%" role="img" aria-label="${r.y}: ${fmtN(r.total)} complaints, ${fmtPct(r.nowater)} no water, ${fmtPct(r.pressure)} low pressure, ${fmtPct(r.quality)} water quality"><span class="seg-nowater" style="width:${r.nowater * 100}%"></span><span class="seg-pressure" style="width:${r.pressure * 100}%"></span><span class="seg-quality" style="width:${r.quality * 100}%"></span></div><strong>${fmtN(r.total)}</strong></div>`).join('')}</div>
        <div class="key"><span><i class="seg-nowater"></i>No water</span><span><i class="seg-pressure"></i>Low pressure</span><span><i class="seg-quality"></i>Water quality</span></div>
        <p class="cite" style="margin-top:12px">${esc(M.complaints.cite)}. ${esc(M.complaints.note)}</p></section>
    </div>
    <h2>What the state auditor found</h2>
    <ul class="findings">${M.findings.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
    <p class="cite">${esc(M.findingsCite)}</p>`;
  }

  /* ---------- data page ---------- */
  function renderData() {
    const ds = [
      ['Service obligations', '165', 'codified obligations', 'Laws, regulations, standards and contracts that say what water providers owe households, each with its source and page.', 'data/obligations.json'],
      ['Water district crosswalk', fmtN(D.districts.length), 'water districts', 'Every district matched across LWUA, NWRB, COA, the complaints data and water-quality records, with a data coverage score.', 'data/districts.json'],
      ['Complaints in the news', fmtN(D.complaints.length), 'complaint events, 2016 to 2026', 'Publicly reported water-service complaints, coded by type and checked against the source article.', 'data/complaints.json'],
      ['COA audit reports', '~4,500', 'reports, 2014 to 2024', 'Annual audit reports on water districts from the Commission on Audit, indexed by district and year.', null],
      ['Mabalacat audit record', '11 years', '2014 to 2024', 'Every figure COA reported on Mabalacat City Water District, with page citations.', 'data/mcwd.json'],
      ['Places', '42,010', 'barangays in 1,642 cities and municipalities', 'The PSA Philippine Standard Geographic Code (3Q 2026), used to find your barangay and match it to a provider.', null]
    ];
    $('#datasets').innerHTML = ds.map(([h, n, u, p, f]) => `<article class="ds"><h3>${esc(h)}</h3><div class="ds-n">${esc(n)}</div><div class="ds-u">${esc(u)}</div><p>${esc(p)}</p>${f ? `<a class="btn btn-sm" href="${f}" download>${ICON.download}Download JSON</a>` : '<span class="small muted">Available on request while it is being verified.</span>'}</article>`).join('');
    const P = D.ob.providers, keys = Object.keys(P);
    $('#matrix').innerHTML = `<thead><tr><th scope="col">Service</th>${keys.map(k => `<th scope="col">${esc(P[k].name)}</th>`).join('')}</tr></thead><tbody>` +
      D.ob.dimensions.map(d => `<tr><th scope="row">${esc(d.title)}</th>${keys.map(k => { const r = d.rules._all || d.rules[k]; return `<td>${tagHTML(r.status)}<p>${esc(r.text)}</p></td>`; }).join('')}</tr>`).join('') + '</tbody>';
  }

  /* ---------- count-up ---------- */
  function countUp() {
    const els = $$('.stat-num[data-count]');
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return; io.unobserve(en.target);
      const el = en.target, end = +el.dataset.count, pre = el.dataset.prefix || '', t0 = performance.now();
      const tick = now => { const k = Math.min(1, (now - t0) / 900), v = Math.round(end * (1 - Math.pow(1 - k, 3))); el.textContent = pre + v.toLocaleString('en-US'); if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }), { threshold: .6 });
    els.forEach(e => io.observe(e));
  }

  /* ---------- chrome: theme, menu ---------- */
  const themeBtn = $('#theme-toggle');
  const isDark = () => document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const syncThemeBtn = () => { const d = isDark(); document.documentElement.dataset.theme = d ? 'dark' : 'light'; themeBtn.setAttribute('aria-label', d ? 'Switch to light theme' : 'Switch to dark theme'); };
  syncThemeBtn();
  themeBtn.onclick = () => { document.documentElement.dataset.theme = isDark() ? 'light' : 'dark'; store.set('tubig-theme', document.documentElement.dataset.theme); try { localStorage.setItem('tubig-theme', document.documentElement.dataset.theme); } catch { /* */ } syncThemeBtn(); };
  const menuBtn = $('#menu-toggle'), mnav = $('#mobile-nav');
  menuBtn.onclick = () => { const open = mnav.hidden; mnav.hidden = !open; menuBtn.setAttribute('aria-expanded', open); menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); };
  $$('a', mnav).forEach(a => a.addEventListener('click', () => { mnav.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); }));

  $('#start-over').onclick = () => {
    store.del('tubig-state');
    Object.assign(S, { muni: null, brgy: null, ptype: null, answers: {}, step: 1, lat: null, lon: null, savedAt: null });
    input.value = ''; clearBtn.hidden = true;
    location.hash = '#/'; toast('Cleared. Start with your barangay.');
  };

  /* ---------- router ---------- */
  const current = { view: null };
  let districtsReady = false;
  async function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [view = '', arg] = h.split('/');
    let v = view || 'home';
    if (!['home', 'check', 'districts', 'district', 'data', 'about'].includes(v)) v = 'home';
    if (v === 'check' && !S.muni) v = 'home';
    $$('.view').forEach(s => s.hidden = s.dataset.view !== v);
    const navKey = v === 'check' ? 'home' : v === 'district' ? 'districts' : v;
    $$('[data-route]').forEach(a => { if (a.dataset.route === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const changed = current.view !== v; current.view = v;
    document.title = { home: 'Tubig · Know what your water provider owes you', check: 'Check your water · Tubig', districts: 'Explore water districts · Tubig', district: 'Water district · Tubig', data: 'Data · Tubig', about: 'About · Tubig' }[v];
    if (v === 'home') { setTimeout(() => { homeMap.invalidateSize(); fitPH(); }, 60); renderResume(); }
    if (v === 'check') {
      await ready; await loadPlaces();
      if (!muni()) { location.hash = '#/'; return; }
      const n = Math.min(4, Math.max(1, +arg || S.step || 1));
      const prev = S.step; S.step = (n > 2 && !Object.keys(S.answers).length) ? 2 : n; save();
      renderPlaceSummary(); renderStep(changed || prev !== S.step);
      if (S.step !== n) history.replaceState(null, '', '#/check/' + S.step);
    }
    if (v === 'districts') { await ready; if (!districtsReady) { initDistricts(); districtsReady = true; } renderDistricts(); }
    if (v === 'district') { await ready; await renderDistrict(arg); }
    if (v === 'data') { await ready; renderData(); }
    if (changed && v !== 'check') window.scrollTo(0, 0);
    if (changed && v !== 'home') $('#main').focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', route);
  ready.catch(() => toast('Some data did not load. Refresh the page to try again.'));
  countUp();
  route();
})();
