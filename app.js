/* Tubig prototype. Everything runs in the browser; nothing the user enters is stored or sent,
   except the chosen place name, which goes to OpenStreetMap Nominatim to find it on the map. */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const bLabel = b => /^barangay/i.test(b) ? b : 'Barangay ' + b;
  const fmtN = n => Number(n).toLocaleString('en-US');
  const fmtPct = n => (Math.round(n * 1000) / 10).toString().replace(/\.0$/, '') + '%';

  const D = {};
  const S = { muni: null, brgy: null, ptype: null, wd: null, answers: {} };
  const PH_BOUNDS = [[4.4, 116.6], [21.3, 127.0]];

  // Fallback coordinates for the demo city, so the map works even if the geocoder is slow.
  const KNOWN = { 'mabalacat city|pampanga': [15.2236, 120.5711] };

  /* ---------------- map ---------------- */
  const map = L.map('map', { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
  const fitPH = () => map.fitBounds(PH_BOUNDS, { paddingTopLeft: [innerWidth > 720 ? Math.min(520, innerWidth * 0.42) : 0, 0] });
  fitPH();
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  let pin = null, ring = null;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function placePin(lat, lon, zoom, label) {
    if (pin) map.removeLayer(pin);
    if (ring) map.removeLayer(ring);
    ring = L.circle([lat, lon], { radius: zoom >= 14 ? 600 : 2500, color: '#385F96', weight: 2, fillColor: '#9EB8DB', fillOpacity: .25 }).addTo(map);
    pin = L.circleMarker([lat, lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#CF5921', fillOpacity: 1 }).addTo(map).bindTooltip(label, { direction: 'top', offset: [0, -8] });
    const off = innerWidth > 720 ? Math.min(520, innerWidth * 0.42) / 2 : 0;
    const target = map.unproject(map.project([lat, lon], zoom).subtract([off, 0]), zoom);
    if (reduceMotion) map.setView(target, zoom); else map.flyTo(target, zoom, { duration: 1.6 });
  }
  async function geocode(m, b) {
    const qs = [b ? `${b}, ${m.n}, ${m.p}, Philippines` : null, `${m.n}, ${m.p}, Philippines`].filter(Boolean);
    for (const q of qs) {
      try {
        const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=' + encodeURIComponent(q), { headers: { 'Accept': 'application/json' } });
        const j = await r.json();
        if (j && j[0]) return { lat: +j[0].lat, lon: +j[0].lon, exact: q === qs[0] && !!b };
      } catch (e) { /* fall through */ }
    }
    const k = KNOWN[norm(m.n) + '|' + norm(m.p)];
    return k ? { lat: k[0], lon: k[1], exact: false } : null;
  }

  /* ---------------- data ---------------- */
  const load = f => fetch('data/' + f).then(r => r.json());
  const ready = Promise.all([load('obligations.json'), load('districts.json'), load('complaints.json'), load('mcwd.json')])
    .then(([o, d, c, m]) => { D.ob = o; D.districts = d; D.complaints = c; D.mcwd = m; });
  let placesP = null;
  function loadPlaces() {
    if (!placesP) placesP = load('places.json').then(p => {
      D.places = p;
      const idx = [];
      p.munis.forEach((m, i) => {
        idx.push({ t: norm(m.n + ' ' + m.p), name: m.n, sub: m.p, mi: i, b: null, pop: m.pop || 0, rank: 0 });
        (p.brgys[m.c] || []).forEach(([bn, pop]) => idx.push({ t: norm(bn), full: norm(bn + ' ' + m.n + ' ' + m.p), name: bn, sub: `${m.n}, ${m.p}`, mi: i, b: bn, pop: pop || 0, rank: 1 }));
      });
      D.index = idx;
    });
    return placesP;
  }

  /* ---------------- search combobox ---------------- */
  const input = $('#place'), list = $('#place-list');
  let results = [], active = -1;
  function search(q) {
    const n = norm(q);
    if (n.length < 2) return [];
    const toks = n.split(' ');
    const out = [];
    for (const e of D.index) {
      const hay = e.full || e.t;
      if (!toks.every(t => hay.includes(t))) continue;
      const starts = (e.t === n || n.startsWith(e.t + ' ')) ? -1 : (e.t.startsWith(toks[0]) ? 0 : 1);
      out.push([starts, e.rank, -e.pop, e]);
      if (out.length > 4000) break;
    }
    out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    return out.slice(0, 8).map(x => x[3]);
  }
  function renderList() {
    if (!results.length) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
    list.innerHTML = results.map((e, i) => `<li role="option" id="opt-${i}" aria-selected="${i === active}" data-i="${i}">${esc(e.b && !/^barangay/i.test(e.name) ? 'Barangay ' + e.name : e.name)}<small>${esc(e.sub)}</small></li>`).join('');
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-activedescendant', active >= 0 ? 'opt-' + active : '');
  }
  input.addEventListener('focus', loadPlaces, { once: true });
  input.addEventListener('input', async () => { await loadPlaces(); results = search(input.value); active = results.length ? 0 : -1; renderList(); });
  input.addEventListener('keydown', e => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, results.length - 1); renderList(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); renderList(); e.preventDefault(); }
    else if (e.key === 'Enter' && active >= 0) { choose(results[active]); e.preventDefault(); }
    else if (e.key === 'Escape') { results = []; renderList(); }
  });
  list.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); choose(results[+li.dataset.i]); } });
  input.addEventListener('blur', () => setTimeout(() => { results = []; renderList(); }, 150));

  async function choose(e) {
    await ready;
    const m = D.places.munis[e.mi];
    S.muni = m; S.brgy = e.b; S.answers = {};
    input.value = e.b ? `${e.b}, ${m.n}, ${m.p}` : `${m.n}, ${m.p}`;
    results = []; renderList();
    detectProvider();
    renderAll();
    $('#flow').hidden = false;
    const g = await geocode(m, e.b);
    if (g) placePin(g.lat, g.lon, g.exact ? 14 : 12, e.b ? bLabel(e.b) : m.n);
  }
  $('#try-example').addEventListener('click', async () => {
    await loadPlaces();
    const e = D.index.find(x => x.b === 'Dau' && x.sub.startsWith('Mabalacat'));
    if (e) { await choose(e); }
  });

  /* ---------------- provider ---------------- */
  function detectProvider() {
    const m = S.muni;
    S.wd = (m.wd != null) ? D.districts[m.wd] : null;
    if (/metro manila/i.test(m.p)) S.ptype = 'mwss';
    else if (S.wd) S.ptype = 'wd';
    else S.ptype = 'lgu';
    S.detected = S.ptype;
  }
  const isMCWD = () => S.ptype === 'wd' && S.wd && S.wd.n === 'Mabalacat City Water District';

  function renderProvider() {
    const m = S.muni, P = D.ob.providers, t = S.ptype;
    let who, what, note = '';
    if (t === 'wd' && S.wd) {
      who = S.wd.n;
      what = P.wd.plain + (S.wd.op ? ` Day-to-day service is run by a private partner, ${S.wd.op}, under a joint venture.` : '');
    } else if (t === 'mwss') {
      who = 'Manila Water or Maynilad';
      what = P.mwss.plain + ' Which one depends on your side of Metro Manila.';
    } else {
      who = P[t].name;
      what = P[t].plain;
      if (S.detected !== 'wd' && S.detected !== 'mwss') note = `We didn't find a water district for ${esc(m.n)} in our list of 554 districts. Your water may come from the city or municipal government, a community association, or a private company. Pick the one that serves you.`;
    }
    $('#provider-strip').innerHTML = `
      <div>
        <p class="where">${S.brgy ? esc(bLabel(S.brgy)) + ', ' : ''}${esc(m.n)}, ${esc(m.p)}</p>
        <p class="who">${esc(who)}</p>
        <p class="what">${esc(what)}</p>
      </div>
      <div class="ptype">
        <label for="ptype">Provider type</label>
        <select id="ptype">${Object.entries(P).map(([k, v]) => `<option value="${k}" ${k === t ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
      </div>
      ${note ? `<p class="note">${note}</p>` : ''}`;
    $('#ptype').addEventListener('change', ev => { S.ptype = ev.target.value; renderAll(true); });
  }

  /* ---------------- obligations ---------------- */
  const TAG = { binding: ['tag-binding', 'Binding rule'], unconfirmed: ['tag-unconfirmed', 'Binding, text not yet confirmed'], none: ['tag-none', 'No rule found'], target: ['tag-none', 'Target only'] };
  const ruleFor = d => d.rules._all || d.rules[S.ptype];
  function citeHTML(r) {
    if (!r.cite) return '';
    return `<span class="cite">Source: ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.cite)}</a>` : esc(r.cite)}${r.ids ? ` (inventory ${esc(r.ids)})` : ''}</span>`;
  }
  function renderOwed() {
    const P = D.ob.providers[S.ptype];
    $('#owed-intro').textContent = `These are the rules found for a ${P.name.toLowerCase()}. They come from laws, regulations, national standards and contracts collected in an inventory of 165 obligations.`;
    const row = d => {
      const r = ruleFor(d), [cls, lab] = TAG[r.status];
      return `<div class="owed"><div><h4>${esc(d.title)}</h4>${d.question ? `<p class="q">${esc(d.question)}</p>` : ''}<span class="tag ${cls}">${lab}</span></div>
        <div><p class="rule ${r.status}">${esc(r.text)}</p>${citeHTML(r)}
        ${r.status === 'none' && d.target ? `<p class="target">${esc(d.target.text)} Not binding. <span class="cite"><a href="${esc(d.target.url)}" target="_blank" rel="noopener">${esc(d.target.cite)}</a></span></p>` : ''}
        ${d.id === 'complaint' && isMCWD() ? `<p class="target">Mabalacat's Citizen's Charter: ${esc(D.mcwd.contacts.serviceRequest)} <span class="cite"><a href="${esc(D.mcwd.contacts.charter)}" target="_blank" rel="noopener">${esc(D.mcwd.contacts.serviceRequestCite)}</a></span></p>` : ''}
        </div></div>`;
    };
    $('#owed-check').innerHTML = D.ob.dimensions.filter(d => d.group === 'check').map(row).join('');
    $('#owed-behind').innerHTML = D.ob.dimensions.filter(d => d.group === 'behind').map(row).join('');
  }

  /* ---------------- survey ---------------- */
  const Q = [
    { id: 'hours', type: 'radio', legend: 'On a typical day in the past few weeks, about how many hours did water come out of your tap?',
      opts: [['24', 'All day (24 hours)'], ['18', '18 to 23 hours'], ['12', '12 to 17 hours'], ['7', '7 to 11 hours'], ['1', '1 to 6 hours'], ['0', 'No water at all']] },
    { id: 'pressure', type: 'radio', legend: 'How strong is the flow when water comes?',
      opts: [['strong', 'Strong: reaches upstairs taps and the shower'], ['ground', 'Usable, but only on the ground floor'], ['trickle', 'A trickle: we fill buckets'], ['none', 'No flow']] },
    { id: 'quality', type: 'check', legend: 'Have you noticed any of these in your water? Choose all that apply.',
      opts: [['color', 'Brown, yellow or other color'], ['cloudy', 'Cloudy'], ['particles', 'Sand, rust or particles'], ['smell', 'A smell (rust, chlorine, sewage)'], ['taste', 'A bad taste'], ['sick', 'Someone got sick after drinking it'], ['ok', 'None of these']] },
    { id: 'outage', type: 'radio', legend: 'In the past 3 months, what was the longest stretch with no water at all?',
      opts: [['none', 'No interruptions'], ['lt1', 'Less than a day'], ['1', '1 to 3 days'], ['4', '4 to 14 days'], ['15', '15 days or more']] },
    { id: 'charged', type: 'radio', showIf: () => S.answers.outage === '15', legend: 'During that stretch, were you still charged the minimum charge, or warned you would be disconnected?',
      opts: [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']] },
    { id: 'complaint', type: 'radio', legend: 'Have you already reported a problem to your provider?',
      opts: [['not', 'Not yet'], ['acted', 'Yes, and they acted within 3 days'], ['slow', 'Yes, but nothing happened for 3 days or more'], ['never', 'Yes, and nothing has happened at all']] },
    { id: 'bill', type: 'radio', legend: 'Has your water rate gone up in the past year?',
      opts: [['no', 'No'], ['hearing', 'Yes, after a public hearing'], ['nohearing', "Yes, and I never heard of a hearing"], ['unsure', 'Not sure']] },
    { id: 'connect', type: 'radio', legend: 'Are you waiting for a new water connection?',
      opts: [['no', 'No'], ['short', 'Yes, for less than a month'], ['long', 'Yes, for more than a month']] }
  ];
  function renderSurvey() {
    const f = $('#survey');
    f.innerHTML = Q.map(q => `<fieldset id="fs-${q.id}" ${q.showIf && !q.showIf() ? 'hidden' : ''}><legend>${esc(q.legend)}</legend><div class="opts">
      ${q.opts.map(([v, l]) => `<label class="opt"><input type="${q.type === 'check' ? 'checkbox' : 'radio'}" name="${q.id}" value="${v}" ${isChecked(q, v) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}
      </div></fieldset>`).join('') + `<div class="form-actions"><button type="submit" class="btn primary">Compare with what I'm owed</button><button type="reset" class="btn">Clear answers</button></div>`;
  }
  const isChecked = (q, v) => q.type === 'check' ? (S.answers[q.id] || []).includes(v) : S.answers[q.id] === v;
  $('#survey').addEventListener('change', e => {
    const t = e.target; if (!t.name) return;
    if (t.type === 'checkbox') {
      let cur = $$(`input[name="${t.name}"]:checked`).map(x => x.value);
      if (t.value === 'ok' && t.checked) { cur = ['ok']; $$(`input[name="${t.name}"]`).forEach(x => x.checked = x.value === 'ok'); }
      else if (t.checked) { cur = cur.filter(v => v !== 'ok'); $(`input[name="${t.name}"][value="ok"]`).checked = false; }
      S.answers[t.name] = cur;
    } else S.answers[t.name] = t.value;
    Q.forEach(q => { if (q.showIf) $('#fs-' + q.id).hidden = !q.showIf(); });
  });
  $('#survey').addEventListener('submit', e => { e.preventDefault(); evaluateAndShow(true); });
  $('#survey').addEventListener('reset', () => { S.answers = {}; setTimeout(renderSurvey); $('#step-gap').hidden = true; $('#step-act').hidden = true; });
  $('#example-answers').addEventListener('click', () => {
    S.answers = { hours: '7', pressure: 'trickle', quality: ['color', 'particles'], outage: '1', complaint: 'slow', bill: 'unsure', connect: 'no' };
    renderSurvey(); evaluateAndShow(true);
  });

  /* ---------------- evaluation ---------------- */
  const LABEL = {}; Q.forEach(q => LABEL[q.id] = Object.fromEntries(q.opts));
  function evaluate() {
    const a = S.answers, t = S.ptype, out = [];
    const dim = id => D.ob.dimensions.find(d => d.id === id);
    const push = (id, you, v, note, ask) => { const d = dim(id), r = ruleFor(d); out.push({ id, title: d.title, owed: r.text, r, you, v, note, ask }); };

    // hours
    if (a.hours != null) {
      const h = +a.hours, r = ruleFor(dim('hours')), you = LABEL.hours[a.hours];
      if (r.min == null) push('hours', you, 'norule', `There is no minimum to measure against. ${dim('hours').target.text.replace(/\.$/, '')} (not binding).`, `Tell me the district's own target for hours of supply in my barangay, and when it will be met.`);
      else if (h >= r.min) push('hours', you, 'met');
      else push('hours', you, 'notmet', `You get less than the ${r.min} hours a day required.`, `Restore at least ${r.min} hours of supply a day, as required.`);
    }
    // pressure
    if (a.pressure) {
      const r = ruleFor(dim('pressure')), you = LABEL.pressure[a.pressure];
      if (r.psi == null) push('pressure', you, a.pressure === 'strong' ? 'met' : 'norule', a.pressure === 'strong' ? '' : `There is no minimum to measure against. ${dim('pressure').target.text.replace(/\.$/, '')} (not binding).`, a.pressure === 'strong' ? '' : 'Measure the pressure at my connection and tell me the result.');
      else if (a.pressure === 'strong') push('pressure', you, 'met');
      else if (a.pressure === 'ground') push('pressure', you, 'check', `${r.psi} psi lifts water about ${Math.round(r.psi * 0.703 * 10) / 10} meters, roughly to a second-floor tap. A gauge reading would settle it.`, 'Measure the pressure at my connection and tell me the result.');
      else push('pressure', you, 'notmet', `A trickle or no flow is well below ${r.psi} psi.`, `Restore at least ${r.psi} psi at my connection.`);
    }
    // quality
    if (a.quality && a.quality.length) {
      const signs = a.quality.filter(v => v !== 'ok');
      const you = a.quality.includes('ok') ? 'No problems noticed' : signs.map(v => LABEL.quality[v]).join('; ');
      if (!signs.length) push('quality', you, 'met', 'Regular lab testing is still the provider\'s job (see "behind the scenes").');
      else push('quality', you, 'check', (signs.includes('sick') ? 'Someone got sick: contact your City or Municipal Health Office now. ' : '') + 'These signs can mean the water fails national limits on color, turbidity, taste or odor. Only a lab test can confirm it.', 'Test the water at my tap at a DOH-accredited laboratory and give me the results.');
    }
    // outage
    if (a.outage) {
      const you = LABEL.outage[a.outage];
      if (t === 'wd') {
        if (a.outage === '15') {
          if (a.charged === 'yes') push('outage', you + '; still charged or threatened with disconnection', 'notmet', 'After 15 or more days without water, the district may not charge the minimum charge or disconnect you.', 'Remove the minimum charge for the period without water, and confirm I will not be disconnected.');
          else push('outage', you, a.charged === 'no' ? 'met' : 'check', a.charged === 'no' ? 'You were not charged or threatened, as the rule requires.' : 'Check your bill: the minimum charge should not apply after 15 days without water.', 'Confirm that no minimum charge will apply for the period without water.');
        } else if (a.outage === 'none' || a.outage === 'lt1') push('outage', you, 'met');
        else push('outage', you, 'check', isMCWD() ? `The 15-day rule doesn't apply yet. Compare with the Citizen's Charter: ${D.mcwd.contacts.serviceRequest}` : "The 15-day rule doesn't apply yet. Compare with the repair times in your district's Citizen's Charter.", 'Explain the cause of the interruption and when full service will be restored.');
      } else if (t === 'mwss') {
        if (a.outage === 'none') push('outage', you, 'met');
        else if (a.outage === 'lt1') push('outage', you, 'check', 'Unplanned interruptions must be fixed within 6 hours.', 'Explain the interruption and confirm it was restored within 6 hours.');
        else push('outage', you, 'notmet', 'Unplanned interruptions must be fixed within 6 hours' + (a.outage === '15' ? ', and failures over 15 days qualify for a bill rebate.' : '.'), a.outage === '15' ? 'Credit the rebate owed for a failure lasting over 15 days.' : 'Explain why service was not restored within 6 hours.');
      } else push('outage', you, a.outage === 'none' ? 'met' : 'norule', a.outage === 'none' ? '' : 'No rule on how fast service must come back was found for this provider type.', 'Explain the cause of the interruption and when service will be restored.');
    }
    // complaint
    if (a.complaint && a.complaint !== 'not') {
      const you = LABEL.complaint[a.complaint];
      if (a.complaint === 'acted') push('complaint', you, 'met');
      else if (isMCWD()) push('complaint', you, 'notmet', `Mabalacat's Citizen's Charter promises action on service requests within 24 hours.`, 'Give me a reference number and act on my earlier report.');
      else if (t === 'wd' || t === 'lgu') push('complaint', you, a.complaint === 'never' ? 'notmet' : 'check', "Your provider's Citizen's Charter sets how fast it must act; complaints through 8888 must be acted on within 72 hours.", 'Give me a reference number and act on my earlier report.');
      else push('complaint', you, 'check', ruleFor(dim('complaint')).text, 'Give me a reference number and act on my earlier report.');
    }
    // bill
    if (a.bill && a.bill !== 'no') {
      const you = LABEL.bill[a.bill], r = ruleFor(dim('bill'));
      if (r.status === 'none') push('bill', you, 'norule');
      else if (a.bill === 'hearing') push('bill', you, 'met');
      else push('bill', you, 'check', t === 'wd' ? 'Every rate increase needs a public hearing first. You can ask for the hearing notice and date.' : r.text, t === 'wd' ? 'Send me the date and notice of the public hearing held before the latest rate increase.' : 'Explain the basis for the latest rate increase.');
    }
    // connection
    if (a.connect && a.connect !== 'no') {
      const you = LABEL.connect[a.connect], r = ruleFor(dim('connect'));
      if (r.status === 'none') push('connect', you, 'norule');
      else if (a.connect === 'short') push('connect', you, 'check', 'The limit is 3, 7 or 20 working days depending on the application.');
      else push('connect', you, 'notmet', 'Even the longest limit, 20 working days, has passed.', 'Act on my connection application or give written reasons for the delay.');
    }
    return out;
  }

  const ICON = {
    met: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#385F96"/><path d="M4.5 8.2l2.3 2.3 4.7-4.7" stroke="#fff" stroke-width="2" fill="none"/></svg>',
    notmet: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="#fff" stroke-width="2.6"/></svg>',
    check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5L15 14H1z" fill="none" stroke="#5C4800" stroke-width="1.8"/><path d="M8 6v4" stroke="#5C4800" stroke-width="1.8"/><circle cx="8" cy="12" r="1" fill="#5C4800"/></svg>',
    norule: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h12" stroke="#3E4850" stroke-width="2.4"/></svg>'
  };
  const VLABEL = { met: 'Met', notmet: 'Not met', check: 'Needs checking', norule: 'No rule' };

  function evaluateAndShow(scroll) {
    const rows = evaluate();
    S.rows = rows;
    const gap = $('#step-gap'), act = $('#step-act');
    if (!rows.length) { gap.hidden = false; $('#gap-summary').textContent = 'Answer at least one question above to see the comparison.'; $('#ledger').innerHTML = ''; act.hidden = true; if (scroll) gap.scrollIntoView(); return; }
    const c = k => rows.filter(r => r.v === k).length;
    $('#gap-summary').innerHTML = `Here is what you reported next to what the rules require.
      <span class="tally">${['notmet', 'check', 'norule', 'met'].filter(k => c(k)).map(k => `<span class="v v-${k}">${ICON[k]}${c(k)} ${VLABEL[k].toLowerCase()}</span>`).join('')}</span>`;
    $('#ledger').innerHTML = `<div class="ledger-head" aria-hidden="true"><div>Service</div><div>What the rules require</div><div>Result</div><div>What you reported</div></div>` +
      rows.map(r => `<div class="lrow ${r.v}"><div class="dim">${esc(r.title)}</div><div class="owed-c">${esc(r.owed)}</div>
        <div class="verdict"><span class="v v-${r.v}">${ICON[r.v]}${VLABEL[r.v]}</span></div><div class="you-c">${esc(r.you)}</div>
        ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}</div>`).join('');
    gap.hidden = false;
    renderAction(rows);
    act.hidden = !rows.some(r => r.v !== 'met');
    if (scroll) gap.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  /* ---------------- action ---------------- */
  function contactsFor() {
    const t = S.ptype, m = S.muni, out = [];
    if (isMCWD()) {
      const c = D.mcwd.contacts;
      out.push({ name: 'Mabalacat City Water District and its operator', how: `Email ${c.email}. Call ${c.landline}, or the hotlines ${c.hotlines.join(' or ')}. Office: ${c.address}.`, when: 'Start here. Ask for a reference number.', note: c.charterNote, email: c.email });
    } else if (t === 'wd' && S.wd) {
      out.push({ name: S.wd.n, how: `Use the Public Assistance and Complaints Desk listed in the district's Citizen's Charter (usually on its website or posted at the office).`, when: 'Start here. Ask for a reference number.' });
    } else if (t === 'mwss') {
      out.push({ name: 'Your concessionaire', how: 'Maynilad: call 1626. Manila Water: call 1627.', when: 'Start here. Ask for a reference number.' });
      out.push({ name: 'MWSS Regulatory Office', how: 'Escalate unresolved complaints to the regulator of the concessionaires.', when: 'If the concessionaire does not resolve it.' });
    } else if (t === 'private') {
      out.push({ name: 'Your water company', how: 'Write to its customer service and keep a copy.', when: 'Start here.' });
      out.push({ name: 'National Water Resources Board (NWRB)', how: 'File a written, sworn complaint. NWRB must answer within 10 days and decide within 60.', when: 'If the company does not resolve it.' });
    } else if (t === 'lgu') {
      out.push({ name: `${m.n} city or municipal hall`, how: 'Ask for the office that runs the waterworks and its Citizen\'s Charter.', when: 'Start here. Ask for a reference number.' });
    } else {
      out.push({ name: 'Your waterworks association', how: 'Raise it with the officers in writing.', when: 'Start here.' });
      out.push({ name: 'NWRB', how: 'If the association is registered with NWRB, you can file a complaint there.', when: 'If it is not resolved.' });
    }
    if (t === 'wd' || t === 'lgu') {
      out.push({ name: '8888 Citizens\' Complaint Center', how: 'Call 8888 (24 hours). The agency must act within 72 hours.', when: 'If nothing happens within the Citizen\'s Charter time.' });
      out.push({ name: 'Anti-Red Tape Authority (ARTA)', how: 'File at ecms.arta.gov.ph or call 1-ARTA (12782).', when: 'If the office ignores its Citizen\'s Charter.' });
    }
    if ((S.rows || []).some(r => r.id === 'quality' && r.v !== 'met')) out.push({ name: `${m.n} Health Office`, how: 'Ask the sanitary inspector to test the water at your tap. LGU health offices run their own water-quality checks.', when: 'For color, smell, particles or illness. Go right away if someone is sick.' });
    if (t === 'wd' && (S.rows || []).some(r => r.id === 'bill' && r.v !== 'met')) out.push({ name: 'Local Water Utilities Administration (LWUA)', how: 'LWUA reviews water district rates. See lwua.gov.ph.', when: 'For rate questions the district does not answer.' });
    return out;
  }
  function renderAction(rows) {
    const issues = rows.filter(r => r.v !== 'met');
    const m = S.muni, prov = S.ptype === 'wd' && S.wd ? S.wd.n : (S.ptype === 'mwss' ? 'your concessionaire' : D.ob.providers[S.ptype].name);
    const where = (S.brgy ? bLabel(S.brgy) + ', ' : '') + `${m.n}, ${m.p}`;
    const cite = r => r.r && r.r.cite && r.r.status !== 'none' ? ` (${r.r.cite})` : '';
    const lines = issues.map(r => {
      const head = `- ${r.title}: ${r.you}.`;
      if (r.v === 'notmet') return `${head} ${r.note ? r.note.replace(/\.$/, '') : 'This does not meet ' + lc(r.owed).replace(/\.$/, '')}${cite(r)}.`;
      if (r.v === 'norule') return `${head} I understand there is no binding standard for this, so I am asking for your own service target.`;
      return `${head} ${r.note ? r.note.replace(/^Someone got sick: contact your City or Municipal Health Office now\. /, '') : ''}`.trim();
    });
    const asks = [...new Set(issues.map(r => r.ask).filter(Boolean))].map((a, i) => `${i + 1}. ${a}`);
    const letter = `To: ${prov}

Subject: Water service complaint, ${where}

Good day.

I am a customer at [your address], ${where}. I am writing to report problems with the water service at my connection:

${lines.join('\n')}

I respectfully ask that you:
${asks.join('\n')}
${asks.length + 1}. Send me a written reply with a reference number for this complaint.

Thank you, and I look forward to your response.

[Your name]
Account number: [account number from your bill]
Contact: [phone or email]`;
    $('#letter').value = letter;
    const contacts = contactsFor();
    const to = contacts.find(c => c.email)?.email || '';
    $('#mailto').href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent('Water service complaint, ' + where)}&body=${encodeURIComponent(letter)}`;
    $('#routes').innerHTML = contacts.map(c => `<li><strong>${esc(c.name)}</strong>${esc(c.how)}<div class="when">${esc(c.when)}${c.note ? ' ' + esc(c.note) : ''}</div></li>`).join('');
    const top = issues.filter(r => r.v === 'notmet').concat(issues.filter(r => r.v !== 'notmet')).slice(0, 2);
    $('#script').innerHTML = `
      <p><span class="who-says">You:</span> Good day. I'm calling to report a water service problem in ${esc(where)}. My account number is [account number].</p>
      <p><span class="who-says">You:</span> ${top.map(r => esc(say(r))).join(' ')}</p>
      ${top.some(r => r.v === 'notmet' && r.note) ? `<p><span class="who-says">You:</span> ${top.filter(r => r.v === 'notmet' && r.note).map(r => esc(r.note)).join(' ')}</p>` : ''}
      <p><span class="who-says">You:</span> Can you give me a reference number, and tell me when someone will act on this?</p>
      <p class="small">Write down the date, the name of the person you spoke to, and the reference number.</p>`;
  }
  const say = r => ({
    hours: `We only get water about ${lc(r.you).replace(/^all day.*/, '24 hours')} a day.`,
    pressure: `The flow is weak: ${lc(r.you)}.`,
    quality: `Our water has these problems: ${lc(r.you)}.`,
    outage: `Our longest stretch without water was ${lc(r.you)}.`,
    complaint: `I already reported a problem: ${lc(r.you)}.`,
    bill: `About our rate: ${lc(r.you)}.`,
    connect: `About my new connection: ${lc(r.you)}.`
  }[r.id] || `${r.title}: ${r.you}.`);
  const lc = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  $('#copy-letter').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#letter').value); $('#copy-status').textContent = 'Letter copied.'; }
    catch { $('#letter').select(); $('#copy-status').textContent = 'Press Ctrl+C or Cmd+C to copy.'; }
  });
  $('#letter').addEventListener('input', () => {
    const a = $('#mailto'); a.href = a.href.replace(/body=[^&]*$/, 'body=' + encodeURIComponent($('#letter').value));
  });

  /* ---------------- record ---------------- */
  function renderRecord() {
    const el = $('#record'), m = S.muni;
    const mk = s => norm(s).replace(/\bcity of\b|\bcity\b/g, '').trim();
    const news = D.complaints.filter(c => mk(c.m) === mk(m.n) && norm(c.p).startsWith(norm(m.p).split(' ')[0])).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    let html = '';
    if (S.ptype === 'wd' && S.wd) {
      const w = S.wd;
      html += `<p class="step-intro">What public records say about ${esc(w.n)}. The audits measure the district; the complaints measure what households get.</p>
      <div class="facts">
        <div class="fact"><div class="k">Service connections (LWUA${w.lwuaAsOf ? ', ' + esc(w.lwuaAsOf.slice(0, 7)) : ''})</div><div class="val">${w.conn ? fmtN(w.conn) : 'Not reported'}</div></div>
        <div class="fact"><div class="k">Years with a COA audit report on file</div><div class="val">${esc(w.coa || 'None')}</div></div>
        <div class="fact"><div class="k">Reports to the regulators</div><div class="val" style="font-size:1.05rem">${esc(w.selfrep || 'Not found')}</div></div>
        <div class="fact"><div class="k">News-reported complaints found</div><div class="val">${news.length}</div></div>
      </div>`;
    } else {
      html += `<p class="step-intro">${news.length ? 'News-reported complaints about water service in ' + esc(m.n) + ':' : 'No audit records are linked to this provider type yet.'}</p>`;
    }
    if (isMCWD()) html += mcwdHTML();
    if (news.length) {
      html += `<h3>Complaints in the news, ${esc(m.n)}</h3><ul class="news">${news.slice(0, 6).map(c => `<li>${esc(c.sum)}<div class="meta">${esc(c.date)} · ${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.src)}</a>` : esc(c.src)}${c.area && c.area !== 'No' ? ' · ' + esc(c.area) : ''}</div></li>`).join('')}</ul>`;
      if (news.length > 6) html += `<p class="small">${news.length - 6} more in the complaints dataset.</p>`;
    }
    el.innerHTML = html;
  }
  function mcwdHTML() {
    const M = D.mcwd, k = M.kpi;
    const cell = (row, i) => {
      const a = row.a[i], t = row.t[i], miss = row.hi ? a < t : a > t;
      const f = row.fmt === 'pct' ? fmtPct : fmtN;
      return `<td class="${miss ? 'miss' : ''}">${f(a)}<span class="sr">${miss ? ' (missed target)' : ''}</span></td><td>${f(t)}</td>`;
    };
    return `<div class="two-col">
      <div>
        <h3>What the district reports: 100% water quality, every year</h3>
        <p class="small">${esc(k.note)}</p>
        <div class="table-wrap"><table class="kpi"><thead><tr><th>Indicator</th>${k.years.map(y => `<th>${y}</th><th>Target</th>`).join('')}</tr></thead>
        <tbody>${k.rows.map(r => `<tr><td>${esc(r.k)}</td>${k.years.map((_, i) => cell(r, i)).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="cite">${esc(k.cite)}. ✕ marks a missed target.</p>
      </div>
      <div>
        <h3>Households: complaints keep rising</h3>
        <div class="bars">${M.complaints.rows.map(r => `<div class="bar-row"><span>${r.y}</span><div class="bar" style="width:${Math.round(r.total / 1490 * 100)}%" role="img" aria-label="${r.y}: ${fmtN(r.total)} complaints; ${fmtPct(r.nowater)} no water, ${fmtPct(r.pressure)} low pressure, ${fmtPct(r.quality)} quality">
          <span class="seg-nowater" style="width:${r.nowater * 100}%"></span><span class="seg-pressure" style="width:${r.pressure * 100}%"></span><span class="seg-quality" style="width:${r.quality * 100}%"></span></div><strong>${fmtN(r.total)}</strong></div>`).join('')}</div>
        <div class="key"><span><i class="seg-nowater"></i>No water</span><span><i class="seg-pressure"></i>Low pressure</span><span><i class="seg-quality"></i>Water quality</span></div>
        <p class="cite">${esc(M.complaints.cite)}. ${esc(M.complaints.note)}</p>
      </div>
    </div>
    <h3>What the state auditor found</h3>
    <ul class="findings">${M.findings.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
    <p class="cite">${esc(M.findingsCite)}</p>`;
  }

  /* ---------------- data page ---------------- */
  function renderData() {
    const ds = [
      ['Service obligations', '165', 'codified obligations', 'Laws, regulations, standards and contracts that say what water providers owe households, with the text and page they come from.'],
      ['Water district crosswalk', fmtN(D.districts.length), 'water districts', 'Every district matched across LWUA, NWRB, COA, the complaints data and water-quality records, with a data coverage score.'],
      ['COA audit reports', '~4,500', 'reports, 2014 to 2024', 'Annual audit reports on water districts from the Commission on Audit, indexed by district and year.'],
      ['Complaints in the news', fmtN(D.complaints.length), 'complaint events', 'Publicly reported water-service complaints from news and official sources, 2016 to 2026, coded by type and checked against the source.'],
      ['Mabalacat audit record', '2014-2024', 'one district, 11 years', 'Every number COA reported on Mabalacat City Water District, with page citations: targets, complaints, losses and governance findings.'],
      ['Places', fmtN(D.places ? D.places.munis.length : 1642), 'cities and municipalities', 'The PSA Philippine Standard Geographic Code (3Q 2026), used to find your barangay and match it to a provider.']
    ];
    $('#datasets').innerHTML = ds.map(([h, n, u, p]) => `<div class="ds"><h3>${esc(h)}</h3><div class="count">${esc(n)}</div><p class="small">${esc(u)}</p><p>${esc(p)}</p></div>`).join('');
    const P = D.ob.providers, keys = Object.keys(P);
    $('#matrix').innerHTML = `<thead><tr><th>Service</th>${keys.map(k => `<th>${esc(P[k].name)}</th>`).join('')}</tr></thead><tbody>` +
      D.ob.dimensions.map(d => `<tr><th scope="row">${esc(d.title)}</th>${keys.map(k => { const r = d.rules._all || d.rules[k]; const [c, l] = TAG[r.status]; return `<td><span class="tag ${c}">${l}</span><br>${esc(r.status === 'none' ? r.text : r.text)}</td>`; }).join('')}</tr>`).join('') + '</tbody>';
  }

  /* ---------------- views ---------------- */
  function renderAll(keepAnswers) {
    renderProvider(); renderOwed(); renderSurvey(); renderRecord();
    if (keepAnswers && Object.keys(S.answers).length) evaluateAndShow(false);
    else { $('#step-gap').hidden = true; $('#step-act').hidden = true; }
  }
  function route() {
    const v = (location.hash.replace('#', '') || 'check');
    const view = ['check', 'data', 'about'].includes(v) ? v : 'check';
    $$('.view').forEach(s => s.hidden = s.dataset.view !== view);
    $$('.topbar nav a').forEach(a => { if (a.dataset.nav === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (view === 'data') ready.then(() => loadPlaces()).then(renderData);
    if (view === 'check') setTimeout(() => map.invalidateSize(), 50);
  }
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (['check', 'data', 'about', ''].includes(h)) route(); });
  route();
})();
