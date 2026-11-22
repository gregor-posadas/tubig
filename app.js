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
    eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
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
  const S = Object.assign({ muni: null, brgy: null, ptype: null, answers: {}, lat: null, lon: null, exact: false, here: false }, store.get('tubig-state', {}));
  const save = () => store.set('tubig-state', { muni: S.muni, brgy: S.brgy, ptype: S.ptype, answers: S.answers, lat: S.lat, lon: S.lon, exact: S.exact, here: S.here, conc: S.conc, track: S.track, log: S.log });
  const muni = () => (S.muni && D.places) ? D.places.munis[D.muniByCode[S.muni]] : null;
  const wd = () => { const m = muni(); return m && m.wd != null ? D.districts[m.wd] : null; };
  const jvOp = () => (S.ptype === 'wd' && wd() && wd().op) ? wd().op : null;
  const isMCWD = () => S.ptype === 'wd' && wd() && wd().n === 'Mabalacat City Water District';
  const detectType = m => /metro manila/i.test(m.p) ? 'mwss' : (m.wd != null ? 'wd' : 'lgu');
  const placeLabel = () => { const m = muni(); return m ? (S.brgy ? bLabel(S.brgy) + ', ' : '') + `${m.n}, ${m.p}` : ''; };
  const providerName = () => { const w = wd(); if (S.ptype === 'wd' && w) return w.n; if (S.ptype === 'mwss') return 'Manila Water or Maynilad'; return D.ob.providers[S.ptype].name; };
  const CONC = { maynilad: ['manila', 'caloocan', 'las pinas', 'malabon', 'muntinlupa', 'navotas', 'paranaque', 'valenzuela', 'pasay'],
    manilawater: ['mandaluyong', 'marikina', 'pasig', 'pateros', 'san juan', 'taguig'] };
  const guessConc = () => { const m = muni(); if (!m) return null; const c = core(m.n); return Object.keys(CONC).find(k => CONC[k].includes(c)) || null; };
  const concFor = () => S.conc || guessConc() || 'maynilad';
  const tariffFor = () => {
    if (S.ptype === 'mwss') return (D.tariffs.mwss || {})[concFor()] || null;
    const w = wd(); if (S.ptype !== 'wd' || !w) return null;
    const t = D.tariffs.districts || {};
    return t[w.id] || null;
  };

  /* ---------- map ----------
     Vector map of the Philippines only: MapLibre GL draws our own PMTiles (land and coast, built-up areas, main roads,
     rivers and place names, built for BahaWatch from OpenStreetMap, Open Buildings and PSA/NAMRIA outlines), so nothing
     outside the country is drawn. Without WebGL, or if it fails to load, the Leaflet + OpenStreetMap map is used. */
  const PH = [[5.0, 117.0], [19.4, 126.6]];
  const pad = () => isDesk() ? { paddingTopLeft: [452, 80], paddingBottomRight: [40, 40] } : { paddingTopLeft: [20, 70], paddingBottomRight: [64, sheetPx() + 20] };
  const padBox = () => { const p = pad(); return { top: p.paddingTopLeft[1], left: p.paddingTopLeft[0], bottom: p.paddingBottomRight[1], right: p.paddingBottomRight[0] }; };
  const pinR = exact => exact ? 700 : 2500;
  const MAP = {
    want: { t: 'fit' }, impl: null,
    fit() { this.want = { t: 'fit' }; if (this.impl) this.impl.fit(); },
    pin(lat, lon, label, exact) { this.want = { t: 'pin', a: [lat, lon, label, exact] }; if (this.impl) this.impl.pin(lat, lon, label, exact); },
    area(...a) { this.want = { t: 'area', a }; if (this.impl) this.impl.area(...a); },
    clear() { this.want = { t: 'fit' }; if (this.impl) this.impl.clear(); },
    resize() { if (this.impl) this.impl.resize(); },
    retheme() { if (this.impl && this.impl.retheme) this.impl.retheme(); },
    use(impl) { this.impl = impl; window.__tubigMap = impl; if (this.want.t === 'pin') impl.pin(...this.want.a, true); else if (this.want.t === 'area') impl.area(...this.want.a, true); else impl.fit(true); }
  };
  /* Barangay and municipal outlines: PSGC 3Q 2026 boundaries (NAMRIA and PSA via OCHA COD-AB, CC BY-IGO), as compiled by
     faeldon/philippines-psgc-shapefiles; simplified with mapshaper and split into one file per city or municipality
     (data/bounds/<PSGC>.json). Each file holds its barangays (c = barangay PSGC) and the city's outline (c = 0). */
  const BOUNDS_ATTR = 'Boundaries: NAMRIA, PSA (PSGC 3Q 2026)';
  const bCache = {};
  const loadBounds = m => { const k = +m.c; if (!(k in bCache)) bCache[k] = fetch(`data/bounds/${k}.json`).then(r => r.ok ? r.json() : null).catch(() => null); return bCache[k]; };
  const G = {
    polys: g => !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [],
    bbox(g) { const a = [180, 90, -180, -90]; G.polys(g).forEach(p => p[0].forEach(([x, y]) => { if (x < a[0]) a[0] = x; if (y < a[1]) a[1] = y; if (x > a[2]) a[2] = x; if (y > a[3]) a[3] = y; })); return a; },
    inRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; },
    inside(x, y, g) { return G.polys(g).some(p => G.inRing(x, y, p[0]) && !p.slice(1).some(h => G.inRing(x, y, h))); },
    segD(x, y, [ax, ay], [bx, by], k) { const px = (x - ax) * k, py = y - ay, dx = (bx - ax) * k, dy = by - ay, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / L2)) : 0; return Math.hypot(px - t * dx, py - t * dy); },
    // A point well inside the shape (for the pin and labels): the grid point farthest from the edge of its largest part.
    label(g, n = 14) {
      const ps = G.polys(g); if (!ps.length) return null;
      let best = ps[0], ba = -1;
      ps.forEach(p => { const b = G.bbox({ type: 'Polygon', coordinates: p }), a = (b[2] - b[0]) * (b[3] - b[1]); if (a > ba) { ba = a; best = p; } });
      const pg = { type: 'Polygon', coordinates: best }, b = G.bbox(pg), k = Math.cos((b[1] + b[3]) / 2 * Math.PI / 180);
      let pt = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], bd = -1;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = b[0] + (b[2] - b[0]) * (i + .5) / n, y = b[1] + (b[3] - b[1]) * (j + .5) / n;
        if (!G.inside(x, y, pg)) continue;
        let d = Infinity; best.forEach(r => { for (let q = 1; q < r.length; q++) d = Math.min(d, G.segD(x, y, r[q - 1], r[q], k)); });
        if (d > bd) { bd = d; pt = [x, y]; }
      }
      return pt;
    }
  };
  const fitPH = () => MAP.fit();
  const showPin = (lat, lon, label, exact) => MAP.pin(lat, lon, label, exact);

  function vectorStyle(dark) {
    const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    const C = dark ? { water: '#18232c', land: '#1f1e1c', coast: '#c9c1b4', built: '#3a352f', river: '#4f8fb0', casing: '#1c1a18', road: '#4a4640', text: '#f3efe7', halo: '#1f1e1c', bldg: '#2d2a26', bldgLine: '#3b3732', street: '#d8d2c8' }
      : { water: '#d6e2e8', land: '#fbf9f4', coast: '#232120', built: '#ddd0b8', river: '#7fb8d6', casing: '#cdbfa6', road: '#ffffff', text: '#232120', halo: '#fbf9f4', bldg: '#ece5d8', bldgLine: '#dcd2c0', street: '#5b5650' };
    const Z = 12.5;   // from here in, streets and buildings come from OpenFreeMap (OpenStreetMap)
    const ofmRoad = (id, cls, cw, rw) => [
      { id: id + '-casing', type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: Z, filter: ['match', ['get', 'class'], cls, true, false], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.casing, 'line-width': cw } },
      { id, type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: Z, filter: ['match', ['get', 'class'], cls, true, false], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.road, 'line-width': rw } }];
    const w = (z0, w0, z1, w1) => ['interpolate', ['exponential', 1.5], ['zoom'], z0, w0, z1, w1];
    const roads = (id, cls, minz, cw, rw) => [
      { id: id + '-casing', type: 'line', source: 'base', 'source-layer': 'roads', minzoom: minz, filter: ['match', ['get', 'class'], cls, true, false], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.casing, 'line-width': cw } },
      { id, type: 'line', source: 'base', 'source-layer': 'roads', minzoom: minz, filter: ['match', ['get', 'class'], cls, true, false], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.road, 'line-width': rw } }];
    return {
      version: 8, glyphs: base + 'fonts/{fontstack}/{range}.pbf',
      sources: {
        land: { type: 'vector', url: 'pmtiles://' + base + 'tiles/ph-land.pmtiles', attribution: 'Coastline: PSA/NAMRIA via OCHA HDX' },
        base: { type: 'vector', url: 'pmtiles://' + base + 'tiles/ph-base.pmtiles', attribution: '© OpenStreetMap contributors · Open Buildings (Google, Microsoft, via VIDA)' },
        ofm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: 'OpenFreeMap © OpenMapTiles' }
      },
      layers: [
        { id: 'water', type: 'background', paint: { 'background-color': C.water } },
        { id: 'land', type: 'fill', source: 'land', 'source-layer': 'land', paint: { 'fill-color': C.land, 'fill-antialias': false } },
        { id: 'builtup', type: 'fill', source: 'base', 'source-layer': 'builtup', maxzoom: 12, paint: { 'fill-color': C.built, 'fill-antialias': false, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4, ['*', 0.33, ['get', 'd']], 9, ['*', 0.25, ['get', 'd']], 11.5, 0] } },
        { id: 'ofm-water', type: 'fill', source: 'ofm', 'source-layer': 'water', minzoom: Z, paint: { 'fill-color': C.water } },
        { id: 'ofm-waterway', type: 'line', source: 'ofm', 'source-layer': 'waterway', minzoom: Z, paint: { 'line-color': C.river, 'line-width': w(12, 0.8, 17, 3) } },
        { id: 'river', type: 'line', source: 'base', 'source-layer': 'rivers', minzoom: 9, maxzoom: Z, paint: { 'line-color': C.river, 'line-width': w(9, 0.6, 16, 3) } },
        { id: 'ofm-building', type: 'fill', source: 'ofm', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': C.bldg, 'fill-outline-color': C.bldgLine, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.6, 14, 1] } },
        ...roads('road-mid', ['secondary', 'tertiary', 'mid'], 9, w(9, 1.7, 18, 14), w(9, 0.5, 18, 12)).map(l => Object.assign(l, { maxzoom: Z })),
        ...roads('road-major', ['motorway', 'trunk', 'primary', 'major'], 5, w(5, 1.6, 18, 18), w(5, 0.5, 18, 16)).map(l => Object.assign(l, { maxzoom: Z })),
        ...ofmRoad('ofm-minor', ['minor', 'service', 'track'], w(12, 1.2, 18, 12), w(12, 0.4, 18, 10)),
        ...ofmRoad('ofm-mid', ['secondary', 'tertiary'], w(12, 2.2, 18, 16), w(12, 1.2, 18, 14)),
        ...ofmRoad('ofm-major', ['motorway', 'trunk', 'primary'], w(12, 3, 18, 20), w(12, 2, 18, 18)),
        { id: 'coast', type: 'line', source: 'land', 'source-layer': 'coast', layout: { 'line-join': 'round' }, paint: { 'line-color': C.coast, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 1, 16, 1.5] } },
        { id: 'street-label', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name', minzoom: 14.5, layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': 11.5 }, paint: { 'text-color': C.street, 'text-halo-color': C.halo, 'text-halo-width': 1.5 } },
        { id: 'place-label', type: 'symbol', source: 'base', 'source-layer': 'places', layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': ['match', ['get', 'place'], 'city', 13, 11.5], 'text-padding': 4 }, paint: { 'text-color': C.text, 'text-halo-color': C.halo, 'text-halo-width': 1.5 } }
      ]
    };
  }
  function circleRing(lat, lon, r) {
    const out = [], dLat = r / 110574, dLon = r / (111320 * Math.cos(lat * Math.PI / 180));
    for (let i = 0; i <= 48; i++) { const a = i / 48 * 2 * Math.PI; out.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]); }
    return out;
  }
  async function vectorImpl() {
    const c = document.createElement('canvas');
    if (!(c.getContext('webgl2') || c.getContext('webgl'))) throw new Error('no WebGL');
    const [m, pm] = await Promise.all([import('./vendor/maplibre/maplibre-gl.mjs'), import('./vendor/pmtiles/pmtiles.mjs')]);
    const lib = m.Map ? m : m.default;
    // A PMTiles archive read with HTTP range requests; a server that ignores Range (sends the whole file) still works:
    // the file is kept and sliced (approach from BahaWatch's basemap.js).
    class RangeSource {
      constructor(key) { this.key = key; this.whole = null; }
      getKey() { return this.key; }
      async getBytes(off, len, signal) {
        if (!this.whole) {
          const r = await fetch(this.key, { signal, headers: { range: `bytes=${off}-${off + len - 1}` } });
          if (r.status === 206) return { data: await r.arrayBuffer() };
          if (!r.ok) throw new Error('tiles: ' + r.status);
          this.whole = await r.arrayBuffer();
        }
        return { data: this.whole.slice(off, off + len) };
      }
    }
    const proto = new pm.Protocol(), arcs = new Map();
    proto.tiles = { get: k => { if (!arcs.has(k)) arcs.set(k, new pm.PMTiles(new RangeSource(k))); return arcs.get(k); }, set: (k, v) => arcs.set(k, v) };
    lib.addProtocol('pmtiles', proto.tile);
    const dark = () => document.documentElement.dataset.theme === 'dark';
    const map = new lib.Map({ container: 'map', style: vectorStyle(dark()), bounds: [[PH[0][1], PH[0][0]], [PH[1][1], PH[1][0]]], fitBoundsOptions: { padding: padBox() },
      minZoom: 3.5, maxZoom: 17.5, maxBounds: [[92, -32], [152, 38]], dragRotate: false, pitchWithRotate: false, touchPitch: false, attributionControl: { compact: true }, fadeDuration: RM ? 0 : 300 });
    if (map.touchZoomRotate) map.touchZoomRotate.disableRotation();
    if (map.keyboard) map.keyboard.disableRotation();
    map.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
    await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('map timeout')), 9000); map.once('load', () => { clearTimeout(t); res(); }); map.on('error', e => { if (e && e.sourceId === 'ofm') return; if (!map.isStyleLoaded()) { clearTimeout(t); rej(e.error || e); } }); });
    // ov: what is drawn for the chosen place: its outline (area), and the neighboring barangays and city outline (ctx)
    let ov = null, marker = null;
    const OC = () => dark() ? { line: '#9EB8DB', fill: '#9EB8DB', ctx: '#9EB8DB', text: '#d8d2c8', halo: '#1f1e1c' }
      : { line: '#1D4E89', fill: '#78A6E0', ctx: '#385F96', text: '#385F96', halo: '#fbf9f4' };
    const addOv = () => {
      if (!ov || map.getSource('pin')) return;
      const c = OC();
      if (ov.ctx) {
        map.addSource('ctx', { type: 'geojson', data: ov.ctx, attribution: BOUNDS_ATTR });
        map.addSource('ctx-pts', { type: 'geojson', data: ov.pts });
        map.addLayer({ id: 'ctx-line', type: 'line', source: 'ctx', filter: ['!=', ['get', 'c'], 0], paint: { 'line-color': c.ctx, 'line-opacity': .5, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, .6, 15, 1.3] } });
        map.addLayer({ id: 'ctx-muni', type: 'line', source: 'ctx', filter: ['==', ['get', 'c'], 0], layout: { 'line-join': 'round' }, paint: { 'line-color': c.ctx, 'line-opacity': .85, 'line-width': 1.8, 'line-dasharray': [3, 2] } });
        map.addLayer({ id: 'ctx-label', type: 'symbol', source: 'ctx-pts', minzoom: 12, layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Regular'], 'text-size': 11.5, 'text-padding': 6, 'text-max-width': 8 }, paint: { 'text-color': c.text, 'text-halo-color': c.halo, 'text-halo-width': 1.6 } });
      }
      map.addSource('pin', { type: 'geojson', data: ov.area, attribution: ov.ctx ? BOUNDS_ATTR : undefined });
      map.addLayer({ id: 'pin-fill', type: 'fill', source: 'pin', paint: { 'fill-color': c.fill, 'fill-opacity': .2 } });
      map.addLayer({ id: 'pin-line', type: 'line', source: 'pin', layout: { 'line-join': 'round' }, paint: { 'line-color': c.line, 'line-width': 2.5 } });
    };
    const removeOv = () => {
      ['ctx-label', 'ctx-muni', 'ctx-line', 'pin-line', 'pin-fill'].forEach(id => map.getLayer(id) && map.removeLayer(id));
      ['pin', 'ctx', 'ctx-pts'].forEach(id => map.getSource(id) && map.removeSource(id));
    };
    const setMarker = (lat, lon, label) => {
      if (marker) marker.remove();
      const el = document.createElement('div'); el.className = 'pin-mark'; el.innerHTML = `<span class="pin-tip">${esc(label)}</span><span class="pin-dot"></span>`;
      marker = new lib.Marker({ element: el, anchor: 'bottom', offset: [0, 9] }).setLngLat([lon, lat]).addTo(map);
    };
    return {
      fit(now) { map.fitBounds([[PH[0][1], PH[0][0]], [PH[1][1], PH[1][0]]], { padding: padBox(), duration: now || RM ? 0 : 800 }); },
      // Fallback when no boundary is on file: a circle around the geocoded point.
      pin(lat, lon, label, exact, now) {
        removeOv(); ov = { area: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circleRing(lat, lon, pinR(exact))] } } }; addOv();
        setMarker(lat, lon, label);
        const ring = circleRing(lat, lon, pinR(exact) * 1.25), xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
        map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: padBox(), maxZoom: 15, duration: now || RM ? 0 : 1400 });
      },
      area(f, ctx, pts, label, pt, now) {
        removeOv(); ov = { area: f, ctx, pts }; addOv();
        setMarker(pt[1], pt[0], label);
        const b = G.bbox(f.geometry);
        map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: padBox(), maxZoom: 15.5, duration: now || RM ? 0 : 1400 });
      },
      clear() { ov = null; removeOv(); if (marker) { marker.remove(); marker = null; } },
      resize() { map.resize(); },
      retheme() { map.once('style.load', addOv); map.setStyle(vectorStyle(dark()), { diff: false }); },
      project(lat, lon) { return map.project([lon, lat]); },
      map
    };
  }
  function leafletImpl() {
    document.documentElement.classList.add('map-raster');
    const map = L.map('map', { zoomControl: false, minZoom: 4, maxBounds: [[-32.0, 92.0], [38.0, 152.0]], maxBoundsViscosity: 1 });
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, noWrap: true, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    const PH_HOLES = [[[4.58, 120.32], [4.4, 119.9], [4.58, 119.48], [5.0, 119.3], [5.42, 119.48], [5.6, 119.9], [5.42, 120.32], [5.0, 120.5], [4.58, 120.32]], [[8.87, 118.82], [7.83, 117.29], [7.91, 116.87], [8.26, 116.63], [8.68, 116.72], [9.38, 117.21], [10.69, 118.53], [11.8, 119.17], [11.9, 119.36], [11.84, 119.8], [11.49, 120.05], [10.67, 120.23], [10.28, 120.17], [8.87, 118.82]], [[17.79, 119.87], [18.69, 120.2], [19.01, 120.5], [19.05, 121.32], [18.86, 121.85], [19.03, 122.28], [18.85, 122.66], [18.41, 122.85], [17.83, 122.77], [17.33, 123.01], [16.93, 123.04], [15.92, 122.68], [15.58, 122.15], [15.15, 122.07], [14.8, 122.17], [14.84, 122.92], [14.28, 124.17], [13.93, 124.48], [13.48, 124.46], [13.1, 124.72], [13.02, 125.48], [12.3, 126.04], [10.95, 126.32], [10.57, 126.06], [10.5, 125.8], [10.18, 125.79], [9.6, 126.68], [7.25, 127.08], [5.89, 126.59], [5.74, 126.14], [5.29, 125.87], [5.05, 125.55], [5.09, 125.15], [5.79, 123.81], [6.88, 123.4], [6.89, 122.99], [6.46, 122.42], [6.36, 121.97], [6.46, 121.76], [6.92, 121.44], [7.42, 121.42], [8.27, 121.81], [8.73, 122.52], [9.51, 121.87], [9.91, 121.87], [10.2, 121.51], [11.68, 121.37], [11.85, 120.84], [13.34, 119.79], [13.74, 119.84], [14.09, 120.1], [14.61, 119.65], [15.23, 119.4], [16.34, 119.33], [16.73, 119.47], [16.9, 119.79], [17.79, 119.87]], [[20.07, 122.43], [19.85, 121.9], [20.07, 121.37], [20.6, 121.15], [21.13, 121.37], [21.35, 121.9], [21.13, 122.43], [20.6, 122.65], [20.07, 122.43]]];
    L.polygon([[[89, -179], [89, 179], [-89, 179], [-89, -179]], ...PH_HOLES], { className: 'ph-mask', interactive: false, stroke: false, fillOpacity: 1 }).addTo(map);
    let layer = null;
    return {
      fit() { map.fitBounds(PH, pad()); },
      pin(lat, lon, label, exact) {
        if (layer) map.removeLayer(layer);
        const r = pinR(exact);
        layer = L.layerGroup([L.circle([lat, lon], { radius: r, color: '#1D4E89', weight: 2, fillColor: '#78A6E0', fillOpacity: .18 }),
          L.circleMarker([lat, lon], { radius: 9, color: '#fff', weight: 3, fillColor: '#CF5921', fillOpacity: 1 }).bindTooltip(esc(label), { permanent: true, direction: 'top', offset: [0, -10], className: 'pin-tip' })]).addTo(map);
        map.flyToBounds(L.latLng(lat, lon).toBounds(r * 3.2), Object.assign({ duration: RM ? 0 : 1.2, maxZoom: 15 }, pad()));
      },
      area(f, ctx, pts, label, pt) {
        if (layer) map.removeLayer(layer);
        const shape = L.geoJSON(f, { interactive: false, style: { color: '#1D4E89', weight: 2.5, fillColor: '#78A6E0', fillOpacity: .2 } });
        layer = L.layerGroup([
          L.geoJSON(ctx, { interactive: false, attribution: BOUNDS_ATTR, style: x => x.properties.c === 0 ? { color: '#385F96', weight: 1.8, dashArray: '5 4', fill: false } : { color: '#385F96', weight: 1, opacity: .5, fill: false } }),
          shape,
          L.circleMarker([pt[1], pt[0]], { radius: 9, color: '#fff', weight: 3, fillColor: '#CF5921', fillOpacity: 1 }).bindTooltip(esc(label), { permanent: true, direction: 'top', offset: [0, -10], className: 'pin-tip' })]).addTo(map);
        map.flyToBounds(shape.getBounds(), Object.assign({ duration: RM ? 0 : 1.2, maxZoom: 15.5 }, pad()));
      },
      clear() { if (layer) { map.removeLayer(layer); layer = null; } },
      resize() { map.invalidateSize(); },
      project(lat, lon) { return map.latLngToContainerPoint([lat, lon]); },
      map
    };
  }
  vectorImpl().then(impl => MAP.use(impl)).catch(err => { console.warn('Vector map unavailable, using OpenStreetMap tiles:', err && err.message); document.getElementById('map').innerHTML = ''; MAP.use(leafletImpl()); });
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
  const findArea = (fc, brgy) => fc && fc.features.find(x => brgy ? x.properties.c && norm(x.properties.n) === norm(brgy) : x.properties.c === 0);
  async function placeOnMap(force) {
    const m = muni(); if (!m) return;
    // The real outline when we have it: the barangay (with its neighbors and the city line for context), or the city.
    const fc = await loadBounds(m);
    if (muni() !== m) return;
    const f = findArea(fc, S.brgy);
    if (f) {
      const key = m.c + '|' + (S.brgy || '') + (S.here ? '|' + S.lat + ',' + S.lon : '');
      if (pinnedFor === key && !force) return;
      pinnedFor = key;
      const pt = S.here && S.lat != null ? [S.lon, S.lat] : G.label(f.geometry, 16);
      if (!S.here) { S.lat = pt[1]; S.lon = pt[0]; S.exact = !!S.brgy; save(); }
      const others = fc.features.filter(x => x !== f);
      const pts = { type: 'FeatureCollection', features: others.filter(x => x.properties.c).map(x => ({ type: 'Feature', properties: { n: x.properties.n }, geometry: { type: 'Point', coordinates: G.label(x.geometry, 8) } })) };
      MAP.area(f, { type: 'FeatureCollection', features: others }, pts, S.brgy ? bLabel(S.brgy) : m.n, pt);
      return;
    }
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
    { id: 'hours', type: 'one', title: 'How many hours a day do you have water?', help: 'Think of a typical day lately.', how: 'hours',
      opts: [['24', 'All day'], ['18', '18 to 23 hours'], ['12', '12 to 17 hours'], ['7', '7 to 11 hours'], ['1', '1 to 6 hours'], ['0', 'No water at all']] },
    { id: 'floors', type: 'one', title: 'How many floors does your home have?', help: 'Low pressure shows first on upper floors.',
      opts: [['1', 'One floor'], ['2', 'Two floors'], ['3', 'Three or more']] },
    // Bands from the 1-liter bucket test: under 7 s is at least ~9 L/min (a UK utility's low-flow line); over 30 s is under 2 L/min.
    { id: 'pressure', type: 'one', showIf: a => a.floors === '1', title: 'How strong is the flow?', help: 'Time how long a 1-liter bottle takes to fill at the tap nearest the meter.', how: 'pressure',
      opts: [['strong', 'Strong', 'Fills in under 7 seconds'], ['weak', 'Weak, but it flows', '7 to 30 seconds'], ['trickle', 'A trickle', 'Over 30 seconds'], ['none', 'Nothing comes out']] },
    { id: 'pressure', type: 'one', showIf: a => a.floors !== '1', title: 'How strong is the flow?', help: 'Time how long a 1-liter bottle takes to fill, downstairs and upstairs.', how: 'pressure',
      opts: [['strong', 'Strong, even upstairs', 'Under 7 seconds on every floor'], ['ground', 'OK on the ground floor only', 'Slow or nothing upstairs'], ['trickle', 'A trickle', 'Over 30 seconds, even downstairs'], ['none', 'Nothing comes out']] },
    { id: 'quality', type: 'many', title: 'Anything wrong with the water?', help: 'Choose all that apply.', how: 'quality',
      opts: [['color', 'Brown or yellow color'], ['cloudy', 'Cloudy', 'Still cloudy after 3 minutes in a glass'], ['particles', 'Sand, rust or bits'], ['smell', 'Bad smell'], ['taste', 'Bad taste'], ['sick', 'Someone got sick'], ['ok', 'Nothing wrong']] },
    { id: 'outage', type: 'one', title: 'Longest time without water in the last 3 months?',
      opts: [['none', 'Never ran out'], ['lt1', 'Less than a day'], ['1', '1 to 3 days'], ['4', '4 to 14 days'], ['15', '15 days or more']] },
    { id: 'charged', type: 'one', showIf: a => a.outage === '15', title: 'Were you still billed the minimum charge for that time?',
      opts: [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']] },
    { id: 'complaint', type: 'one', title: 'Have you reported a problem before?',
      opts: [['not', 'Not yet'], ['acted', 'Yes, and they fixed it quickly'], ['slow', 'Yes, no action after 3 days'], ['never', 'Yes, no action at all']] },
    { id: 'connect', type: 'one', title: 'Waiting for a new connection?',
      opts: [['no', 'No'], ['short', 'Yes, under a month'], ['long', 'Yes, over a month']] }
  ];
  const LABEL = {}; Q.forEach(q => LABEL[q.id] = Object.assign(LABEL[q.id] || {}, Object.fromEntries(q.opts.map(([v, l]) => [v, l]))));
  const activeQ = () => Q.filter(q => !q.showIf || q.showIf(S.answers));
  const EXAMPLE = { hours: '7', floors: '2', pressure: 'trickle', quality: ['color', 'particles'], outage: '1', complaint: 'slow', connect: 'no' };

  function evaluate() {
    const a = S.answers, t = S.ptype, out = [];
    const push = (id, you, v, note, ask, auto) => { const d = dim(id), r = ruleFor(d); out.push({ id, title: d.title, owed: r.text, short: shortRule(id), r, you, v, note, ask, auto }); };
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
      else if (a.pressure === 'ground' || a.pressure === 'weak') push('pressure', you, 'check', `${r.psi} psi lifts water about ${Math.round(r.psi * 0.703 * 10) / 10} m, roughly a second-floor tap. A gauge reading would settle it.`, 'Measure the pressure at my connection and tell me the result.');
      else push('pressure', you, 'notmet', `The rule is at least ${r.psi} psi.`, `Restore at least ${r.psi} psi at my connection.`);
    }
    if (a.quality && a.quality.length) {
      const signs = a.quality.filter(v => v !== 'ok');
      const you = a.quality.includes('ok') ? 'Nothing wrong' : signs.map((v, i) => i ? lc(LABEL.quality[v]) : LABEL.quality[v]).join(', ');
      if (!signs.length) push('quality', you, 'met');
      else push('quality', you, 'check', (signs.includes('sick') ? 'Someone got sick: go to your health office now. ' : '') + 'This can mean the water fails national limits. Only a lab test can confirm it.', 'Test the water at my tap and give me the results, along with the latest water-quality test results for my barangay.');
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
    // Rates: looked up, not asked. LWUA's record of the district's latest approved rate (and, for Mabalacat, the
    // state auditor's finding on the 2022 increase).
    const tf = tariffFor();
    if (isMCWD()) {
      push('bill', 'Rates raised in 2022 without LWUA approval', 'check', "The state auditor found the 2022 increase was approved by NWRB but not by LWUA, which reviews water district rates. LWUA's record still shows the 2009 rate.", "Explain the legal basis of the rates I am charged, given the state auditor's finding that the 2022 increase was not approved by LWUA, and send me the current approved rate schedule.", true);
      out[out.length - 1].short = 'Increases need LWUA review';
    } else if (t === 'wd' && tf && tf.effective) {
      const eff = parseD(tf.effective), months = (today() - eff) / (30.44 * 864e5);
      if (months <= 12) push('bill', `Rates changed ${fmtDate(tf.effective)}`, 'check', 'Every water district rate increase needs a public hearing first. Ask for the notice and date.', 'Send me the date and notice of the public hearing held before the latest rate increase.', true);
      if (months <= 12) out[out.length - 1].short = 'Public hearing before any increase';
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
    const resume = S.muni && muni() ? (S.track ? `<div class="resume"><div><b>Complaint sent ${esc(daysAgo(S.track.sent))}</b>${esc(placeLabel())}</div><a class="btn btn-sm btn-primary" href="#/track">Track</a></div>`
      : `<div class="resume"><div><b>${esc(placeLabel())}</b>${Object.keys(S.answers).length ? 'Your answers are saved.' : 'Pick up where you left off.'}</div><button class="btn btn-sm btn-primary" id="resume-go">Open</button></div>`) : '';
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
          <li><span class="hi">${I.list}</span><div><b>Answer a few quick questions</b><span>Hours, pressure, quality, outages, bills.</span></div></li>
          <li><span class="hi">${I.flask}</span><div><b>Document it</b><span>Check it isn't your pipes, then keep a water log. <a href="#/guide">See how</a></span></div></li>
          <li><span class="hi">${I.mail}</span><div><b>Send a complaint</b><span>A ready letter, script and contacts.</span></div></li>
        </ul>
        <p class="privacy">${I.lock}No sign-up. Your answers stay on your device.</p>
      </div>`, '', 'peek');
    MAP.clear(); pinnedFor = null;
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
    S.muni = m.c; S.brgy = e.b; S.ptype = detectType(m); S.lat = S.lon = null; S.here = false; save();
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
        // The barangay whose official boundary contains you; failing that, the one OpenStreetMap names.
        const fc = await loadBounds(m), inB = fc && fc.features.find(x => x.properties.c && G.inside(lon, lat, x.geometry));
        const list = D.places.brgys[m.c] || [];
        const b = (inB && list.find(([n]) => norm(n) === norm(inB.properties.n))) || list.find(([n]) => names.includes(norm(n)));
        await choose({ mi, b: b ? b[0] : null });
        S.lat = lat; S.lon = lon; S.exact = true; S.here = true; save(); placeOnMap(true);
      } catch { toast("Couldn't match your location. Type your barangay."); }
    }, () => toast('Location not shared. Type your barangay.'), { timeout: 12000 });
  }
  $('#locate-fab').onclick = locate;

  /* OWED */
  function placeHead() {
    const w = wd(), P = D.ob.providers;
    return `<div class="place"><span class="pi">${I.drop}</span><div><h2>${esc(providerName())}</h2><p>${esc(placeLabel())}</p>
      ${S.ptype === 'wd' && w && w.op ? `<span class="op-chip">Run by ${esc(w.op)}</span>` : ''}
      ${(() => { const sure = detectType(muni()) !== 'lgu', sel = `<label for="ptype" class="sr-only">Provider type</label><select id="ptype">${Object.entries(P).map(([k, v]) => `<option value="${k}" ${k === S.ptype ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>`;
        return sure ? `<div class="change-type"><button type="button" class="link-btn" id="wrong-prov">Not your provider?</button><span id="ptype-wrap" hidden>${sel}</span></div>` : `<div class="change-type"><span>Who supplies your water?</span>${sel}</div>`; })()}</div></div>`;
  }
  function viewOwed() {
    const m = muni(), dims = D.ob.dimensions;
    const key = ['hours', 'pressure', 'quality', 'bill', 'complaint', 'outage'];
    const fact = id => { const d = dim(id), r = ruleFor(d); return `<button class="fact ${r.status === 'none' ? 'none' : ''}" data-open="${id}" type="button"><span class="fk">${I[DIM_ICON[id]]}${esc(d.title)}</span><span class="fv">${esc(shortRule(id))}</span></button>`; };
    const row = d => { const r = ruleFor(d); return `<details class="rule" id="r-${d.id}"><summary><span class="ricon ${r.status}">${ST_ICON[r.status]}</span><span><b>${esc(d.title)}${r.status === 'unconfirmed' ? '<span class="tag-mini">text not yet confirmed</span>' : ''}</b><span class="rsum">${esc(shortRule(d.id) || (r.status === 'none' ? 'No rule' : 'Required'))}</span></span>${I.chev}</summary>
      <div class="rbody"><p>${esc(r.text)}</p>${r.status === 'none' && d.target ? `<p>For comparison: ${esc(d.target.text)} (a target, not a requirement)</p>` : ''}
      ${d.id === 'bill' && S.ptype === 'wd' ? `<p><a href="#/bill">Check your bill against the tariff</a></p>` : ''}
      ${d.id === 'complaint' && isMCWD() ? `<p>Mabalacat's Citizen's Charter: ${esc(D.mcwd.contacts.serviceRequest)} <a href="${esc(D.mcwd.contacts.charter)}" target="_blank" rel="noopener">Read the charter (PDF, p. 30)</a></p>` : ''}
      ${r.cite ? `<p class="src">Source: ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.cite)}</a>` : esc(r.cite)}</p>` : ''}</div></details>`; };
    const noHrs = ruleFor(dim('hours')).status === 'none';
    render(`<button class="back" id="back">${I.left}Search</button>
      ${placeHead()}
      ${S.ptype === 'lgu' && detectType(m) === 'lgu' ? `<div class="callout">${I.info}<p>No water district found for ${esc(m.n)}. Pick the provider type that serves you.</p></div>` : ''}
      <p class="section-label">What you're owed</p>
      <div class="facts">${key.map(fact).join('')}</div>
      ${noHrs ? `<div class="callout">${I.alert}<p><b>No minimum hours or pressure.</b> No national rule sets them for ${S.ptype === 'wd' ? 'water districts' : 'your provider type'}. ${jvOp() ? `Your district's contract with ${esc(jvOp().replace(/ \(.*\)$/, ''))} may promise them, and only the district can enforce it. Tubig asks for that report.` : 'Tubig asks your provider for its own target.'}</p></div>` : ''}
      <a class="track-cta" href="#/guide">${I.list}<span><b>Document the problem</b> Check it isn't your pipes, then keep records</span>${I.chev}</a>
      <p class="section-label">All rules</p>
      <div class="rules">${dims.map(row).join('')}</div>`,
      `<button class="btn" id="to-bill">${I.bill}Check bill</button><button class="btn btn-primary" id="to-report">Report a problem</button>`, 'half');
    $('#back').onclick = () => go('#/');
    $('#ptype').onchange = e => { S.ptype = e.target.value; save(); viewOwed(); toast('Rules updated'); };
    const wp = $('#wrong-prov'); if (wp) wp.onclick = () => { wp.hidden = true; $('#ptype-wrap').hidden = false; $('#ptype').focus(); };
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
      ${howHTML(q.how)}
      <div class="choices" role="${q.type === 'many' ? 'group' : 'radiogroup'}" aria-labelledby="q-title">
      ${q.opts.map(([v, l, h]) => `<button type="button" class="choice ${q.type === 'many' ? 'multi' : ''}" data-v="${v}" role="${q.type === 'many' ? 'checkbox' : 'radio'}" aria-checked="${sel(v)}"><span class="cmark">${I.check}</span><span class="ctext">${esc(l)}${h ? `<small>${esc(h)}</small>` : ''}</span></button>`).join('')}
      </div>
      ${n === 1 ? `<button class="btn btn-quiet skip-q" id="example">Just exploring? Use example answers</button>` : ''}`,
      `<button class="btn" id="skip">Skip</button><button class="btn btn-primary" id="next" ${q.type === 'many' && !(S.answers[q.id] || []).length ? 'disabled' : ''}>${isLast ? 'See results' : 'Next'}</button>`, 'full');
    const next = () => { const qs2 = activeQ(); const i = qs2.indexOf(q); if (i >= qs2.length - 1) go('#/gap'); else go('#/report/' + (i + 2)); };
    $('#back').onclick = () => n === 1 ? go('#/owed') : go('#/report/' + (n - 1));
    $('#skip').onclick = () => { delete S.answers[q.id]; save(); next(); };
    $('#next').onclick = next;
    const hb = $('#how'); if (hb) hb.onclick = () => { const open = hb.getAttribute('aria-expanded') !== 'true'; hb.setAttribute('aria-expanded', open); $('#how-panel').hidden = !open; };
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
        S.answers[q.id] = v; if (q.id === 'outage' && v !== '15') delete S.answers.charged; if (q.id === 'floors') { if (v === '1' && S.answers.pressure === 'ground') delete S.answers.pressure; if (v !== '1' && S.answers.pressure === 'weak') delete S.answers.pressure; } save();
        $$('.choice').forEach(c => c.setAttribute('aria-checked', c.dataset.v === v));
        setTimeout(next, RM ? 0 : 220);
      }
    });
  }


  /* "You're not the only one": what others have reported about the same problems */
  const TYPE_FOR = { hours: ['No water', 'Intermittent supply'], outage: ['No water', 'Intermittent supply'], pressure: ['Low pressure'],
    quality: ['Dirty or colored', 'Smell or taste', 'Health / illness'], complaint: ['Slow or no response'], bill: ['High bill or rate', 'Meter or billing error'], connect: ['Connection delay'] };
  const pctN = (n, tot) => `${Math.round(n / tot * 100)}% (${fmtN(n)})`;
  function othersHTML(rows) {
    const m = muni(), w = wd(), mine = new Set(rows.filter(r => r.v !== 'met').flatMap(r => TYPE_FOR[r.id] || []));
    const bars = (items, tot) => `<ul class="obars">${items.map(([label, n, hit]) => `<li class="${hit ? 'hit' : ''}"><span class="ol">${esc(label)}${hit ? '<span class="sr-only"> (your problem)</span>' : ''}</span><span class="otrack" aria-hidden="true"><span style="width:${Math.max(2, Math.round(n / tot * 100))}%"></span></span><span class="ov">${pctN(n, tot)}</span></li>`).join('')}</ul>`;
    let main = '', src = '';
    if (isMCWD()) {
      const r = D.mcwd.complaints.rows.find(x => x.y === 2024), tot = r.total;
      const it = [['No water', Math.round(r.nowater * tot), mine.has('No water') || mine.has('Intermittent supply')], ['Low pressure', Math.round(r.pressure * tot), mine.has('Low pressure')], ['Water quality', Math.round(r.quality * tot), mine.has('Dirty or colored') || mine.has('Smell or taste') || mine.has('Health / illness')]];
      main = `<p class="o-big">${fmtN(tot)} complaints</p><p class="o-sub">logged by your district's operator in 2024</p>${bars(it, tot)}`;
      src = 'Source: Commission on Audit, 2024 audit of Mabalacat City Water District.';
    } else {
      let pool = D.complaints.filter(c => w && S.ptype === 'wd' ? norm(c.wd) === norm(w.n) : (norm(c.m) === norm(m.n) && norm(c.p) === norm(m.p)));
      let where = S.ptype === 'wd' && w ? w.n : m.n;
      if (pool.length < 3) { pool = D.complaints.filter(c => norm(c.p) === norm(m.p)); where = m.p; }
      if (pool.length < 3) { pool = D.complaints; where = 'the Philippines'; }
      const tot = pool.length, cnt = {};
      pool.forEach(c => (c.types || []).forEach(t => { cnt[t] = (cnt[t] || 0) + 1; }));
      const it = Object.entries(cnt).sort((a, b) => (mine.has(b[0]) - mine.has(a[0])) || b[1] - a[1]).slice(0, 5).map(([t, n]) => [t, n, mine.has(t)]);
      main = `<p class="o-big">${fmtN(tot)} news report${tot > 1 ? 's' : ''}</p><p class="o-sub">of water complaints in ${esc(where)} since 2016</p>${bars(it, tot)}`;
      src = 'Share of news reports that mention each problem; one report can mention several. Source: author’s dataset of news-reported complaints, 2016 to 2026.';
    }
    const near = S.brgy ? D.complaints.filter(c => norm(c.m) === norm(m.n) && norm(c.area).includes(norm(S.brgy))).sort((a, b) => (b.date || '').localeCompare(a.date || '')) : [];
    const nearHTML = near.length ? `<div class="o-near"><p><b>${near.length} news report${near.length > 1 ? 's' : ''} name ${esc(bLabel(S.brgy))}.</b> ${esc(near[0].sum)}</p><p class="o-meta">${esc(near[0].date)} · ${near[0].url ? `<a href="${esc(near[0].url)}" target="_blank" rel="noopener">${esc(near[0].src)}</a>` : esc(near[0].src)}</p></div>` : '';
    const pw = S.ptype === 'wd' && w && /primewater|hiraya/i.test(w.op || '') ? `<p class="o-line">87% (61 of 70) of water districts partnered with PrimeWater told a Senate committee in December 2025 that they were dissatisfied with its service.</p>` : '';
    return `<section class="others" aria-labelledby="o-h"><h3 id="o-h">You're not the only one</h3>${main}${nearHTML}${pw}
      <p class="o-src">${src} Highlighted: the problems you reported. Tubig doesn't collect reports yet; in a pilot, anonymous counts from your barangay would appear here.</p></section>`;
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
      ${othersHTML(rows)}
      <a class="track-cta" href="#/guide">${I.list}<span><b>Optional: check it isn't your pipes</b> A 2-minute check before you send</span>${I.chev}</a>
      <ul class="findings">${rows.map(r => `<li class="finding"><div class="f-top"><span class="f-name">${esc(r.title)}</span><span class="status ${r.v}"><span class="dot ${r.v}"></span>${VLAB[r.v]}</span></div>
        <div class="f-compare"><div><p class="k">${r.auto ? 'Public record' : 'You said'}</p><p class="v">${esc(r.you)}</p></div><div><p class="k">The rule</p><p class="v">${esc(r.short || 'No rule')}</p></div></div>
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
      <div role="tabpanel">${body}</div>
      <a class="track-cta" href="#/track">${I.clock}<span><b>Sent it or called?</b> Track when they have to answer</span>${I.chev}</a>
      <a class="track-cta" href="#/log">${I.flask}<span><b>Keep records while you wait</b> A water log helps if you need to escalate</span>${I.chev}</a>
      <a class="track-cta" href="#/petition">${I.list}<span><b>Neighbors have it too?</b> Make a joint complaint for your barangay or council</span>${I.chev}</a>`, foot, 'full');
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
${logParagraph()}
I respectfully ask that you:
${asks.map((a, i) => `${i + 1}. ${a}`).join('\n')}${asks.length ? '\n' : ''}${asks.length + 1}. Send me a written reply with a reference number for this complaint.
${S.ptype === 'wd' && asks.some(a => /^Send me the /.test(a)) ? '\nAs a government-owned corporation, the district is covered by Executive Order No. 2, s. 2016 on Freedom of Information. Please treat my requests for documents as FOI requests.\n' : ''}
Thank you. I look forward to your response.

[Your name]
Account number: [from your water bill]
Contact: [phone or email]`;
  }
  function contactsFor(rows) {
    const t = S.ptype, m = muni(), w = wd(), out = [];
    const tel = h => ({ href: 'tel:' + h.replace(/ \(.*\)/, '').replace(/[^0-9+]/g, ''), label: h.replace(/ \(.*\)/, ''), icon: 'phone' });
    if (isMCWD()) {
      const c = D.mcwd.contacts;
      out.push({ name: `${c.operatorName} (operator)`, when: 'No water, leaks, low pressure', how: 'Call the 24/7 hotline for repairs. Ask for a reference number.', note: c.operatorNote,
        links: c.hotlines.slice(0, 2).map(tel) });
      out.push({ name: 'Mabalacat City Water District', when: 'Written complaint', how: `Email the letter or bring it to ${c.address}. The district answers for its operator.`, note: c.charterNote, email: c.email,
        links: [{ href: 'mailto:' + c.email, label: 'Email', icon: 'mail' }, tel(c.landline)] });
    } else if (t === 'wd' && w) out.push({ name: w.n, when: 'Start here', how: "Use the complaints desk in the district's Citizen's Charter (website or office). Ask for a reference number." });
    else if (t === 'mwss') { out.push({ name: 'Your concessionaire', when: 'Start here', how: 'Maynilad 1626 or Manila Water 1627. Ask for a reference number.', links: [{ href: 'tel:1626', label: 'Maynilad 1626', icon: 'phone' }, { href: 'tel:1627', label: 'Manila Water 1627', icon: 'phone' }] }); out.push({ name: 'MWSS Regulatory Office', when: 'If not resolved', how: 'Handles unresolved complaints about the concessionaires.' }); }
    else if (t === 'private') { out.push({ name: 'Your water company', when: 'Start here', how: 'Write to customer service and keep a copy.' }); out.push({ name: 'National Water Resources Board', when: 'If not resolved', how: 'File a written, sworn complaint. Answer due in 10 days.' }); }
    else if (t === 'lgu') out.push({ name: `${m.n} hall`, when: 'Start here', how: "Ask for the waterworks office and its Citizen's Charter." });
    else { out.push({ name: 'Your waterworks association', when: 'Start here', how: 'Raise it with the officers in writing.' }); out.push({ name: 'NWRB', when: 'If not resolved', how: 'If the association is registered with NWRB.' }); }
    if (t === 'wd' || t === 'lgu') {
      out.push({ name: "8888 Citizens' Complaint Center", when: 'No action in time', how: 'Call 8888, any time. Agencies must act within 72 hours.', links: [{ href: 'tel:8888', label: 'Call 8888', icon: 'phone' }] });
      out.push({ name: 'Anti-Red Tape Authority', when: 'Charter ignored', how: 'File online or call 1-ARTA (12782).', links: [{ href: 'https://ecms.arta.gov.ph/', label: 'File online', icon: 'ext' }] });
    }
    if (t === 'wd') out.push({ name: 'Freedom of Information', when: 'Documents ignored', how: 'Water districts are covered by FOI. Request test results, rate-hearing notices or joint venture reports online; agencies must reply within 15 working days.', links: [{ href: isMCWD() ? D.mcwd.contacts.foi : 'https://www.foi.gov.ph/', label: 'foi.gov.ph', icon: 'ext' }] });
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


  /* TRACK: deadlines after a complaint is sent (stored only on this device) */
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const isoD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const addWorkDays = (d, n) => { const x = new Date(d); while (n > 0) { x.setDate(x.getDate() + 1); if (x.getDay() % 6) n--; } return x; };
  const shortD = d => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  function daysAgo(iso) { const n = Math.round((today() - parseD(iso)) / 864e5); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`; }
  function trackSteps(t) {
    const sent = parseD(t.sent), steps = [];
    const p = S.ptype;
    steps.push({ id: 'ref', title: 'Get a reference number', rule: 'Ask for it when you send or call. It proves when you complained.', due: sent, done: !!t.ref });
    steps.push({ id: 'log', title: 'Keep a water log while you wait', rule: 'Note hours, flow and color each day. If you escalate, the log is your evidence.', due: sent, noDue: true });
    if (p === 'wd' || p === 'lgu') {
      const mc = isMCWD();
      steps.push({ id: 'act', title: mc ? 'Repair or action on your request' : 'Action on your request',
        rule: mc ? "Within 24 hours for service requests; 2 to 3 working days for maintenance (MCWD Citizen's Charter)." : "Your provider's Citizen's Charter sets the time. Under the Ease of Doing Business Act, simple requests take up to 3 working days.",
        due: mc ? addDays(sent, 1) : addWorkDays(sent, 3),
        next: { label: 'Call 8888', href: 'tel:8888', text: 'If nothing happened, call 8888. The agency must act within 72 hours of your 8888 complaint.' } });
      if (p === 'wd') steps.push({ id: 'foi', title: 'Documents you asked for', rule: 'Under Freedom of Information, the district must reply within 15 working days.', due: addWorkDays(sent, 15),
        next: { label: 'File on foi.gov.ph', href: isMCWD() ? D.mcwd.contacts.foi : 'https://www.foi.gov.ph/', text: 'If you got no reply, file the same request on foi.gov.ph so it is logged.' } });
      steps.push({ id: 'reply', title: 'Written reply to your complaint', rule: 'Ask for one in writing. If the deadlines above pass, report the delay to the Anti-Red Tape Authority.', due: addWorkDays(sent, mc ? 3 : 7),
        next: { label: 'File with ARTA', href: 'https://ecms.arta.gov.ph/', text: 'The Anti-Red Tape Authority handles agencies that ignore their Citizen’s Charter.' } });
    } else if (p === 'mwss') {
      steps.push({ id: 'act', title: 'Service restored', rule: 'Unplanned interruptions must be fixed within 6 hours (concession service obligations).', due: sent,
        next: { label: 'MWSS Regulatory Office', href: 'https://mwss.gov.ph/', text: 'If the concessionaire does not resolve it, raise it with the MWSS Regulatory Office.' } });
      steps.push({ id: 'reply', title: 'Reply to your complaint', rule: 'Complaints must be acted on "with dispatch". If a week passes, escalate.', due: addDays(sent, 7),
        next: { label: 'MWSS Regulatory Office', href: 'https://mwss.gov.ph/', text: 'Bring your reference number and dates.' } });
    } else {
      steps.push({ id: 'reply', title: 'Answer to your complaint', rule: p === 'private' ? 'NWRB rules give the company 10 days to answer a written, sworn complaint filed with NWRB.' : 'No national deadline applies to this provider type.', due: addDays(sent, 10),
        next: p === 'private' ? { label: 'NWRB', href: 'https://nwrb.gov.ph/', text: 'File a written, sworn complaint with the National Water Resources Board.' } : null });
    }
    const nLog = (S.log || []).filter(e => e.date >= t.sent).length;
    return steps.map(s => Object.assign(s, { done: s.id === 'ref' ? !!t.ref : s.id === 'log' ? nLog >= 3 : !!(t.done || {})[s.id], late: !s.noDue && s.id !== 'ref' && !(t.done || {})[s.id] && today() > s.due, logged: nLog }));
  }
  function viewTrack() {
    const t = S.track;
    if (!t) {
      render(`<button class="back" id="back">${I.left}Complaint</button>
        <h2 class="h-title">Track your complaint</h2><p class="h-sub">Tubig counts the days and tells you when to escalate. This stays on your phone.</p>
        <div class="field"><label for="t-sent">Date you sent or called</label><input id="t-sent" class="select" type="date" value="${isoD(today())}" max="${isoD(today())}"></div>
        <div class="field"><label for="t-via">How</label><select id="t-via" class="select"><option>Email</option><option>Phone call</option><option>In person</option><option>Facebook message</option></select></div>
        <div class="field"><label for="t-ref">Reference number (if you got one)</label><input id="t-ref" class="select" type="text" autocomplete="off"></div>`,
        `<button class="btn btn-primary" id="t-start">Start tracking</button>`, 'full');
      $('#back').onclick = () => go('#/act');
      $('#t-start').onclick = () => { S.track = { sent: $('#t-sent').value || isoD(today()), via: $('#t-via').value, ref: $('#t-ref').value.trim(), done: {} }; save(); toast('Tracking started'); viewTrack(); };
      return;
    }
    const steps = trackSteps(t), late = steps.find(s => s.late && s.next);
    const day = Math.max(0, Math.round((today() - parseD(t.sent)) / 864e5));
    render(`<button class="back" id="back">${I.left}Complaint</button>
      <h2 class="h-title">Day ${day} since you complained</h2>
      <p class="h-sub">${esc(t.via)} to ${esc(providerName())}, ${esc(shortD(parseD(t.sent)))}${t.ref ? ` · Ref. ${esc(t.ref)}` : ''}</p>
      ${late ? `<div class="callout">${I.alert}<p><b>${esc(late.title)} is overdue.</b> ${esc(late.next.text)}</p></div>` : ''}
      <ol class="timeline">${steps.map(s => `<li class="${s.done ? 'done' : s.late ? 'late' : ''}"><span class="tl-dot" aria-hidden="true">${s.done ? I.check : ''}</span><div>
        <div class="tl-top"><b>${esc(s.title)}</b><span class="tl-due">${s.id === 'log' ? `${s.logged} day${s.logged === 1 ? '' : 's'} logged` : s.done ? 'Done' : s.late ? 'Overdue' : s.id === 'ref' ? 'To do' : 'Due ' + esc(shortD(s.due))}</span></div>
        <p>${esc(s.rule)}</p>
        <div class="tl-act">${s.id === 'log' ? `<a class="btn btn-sm" href="#/log">Open the log</a>` : s.id === 'ref' ? (s.done ? '' : `<label class="sr-only" for="t-ref2">Reference number</label><input id="t-ref2" class="select tl-in" placeholder="Reference number"><button class="btn btn-sm" id="t-ref-save">Save</button>`)
          : `<button class="btn btn-sm" data-done="${s.id}">${s.done ? 'Undo' : 'They did it'}</button>${s.late && s.next ? `<a class="btn btn-sm btn-primary" href="${esc(s.next.href)}" ${s.next.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(s.next.label)}</a>` : ''}`}</div></div></li>`).join('')}</ol>
      <p class="src-line">Deadlines count from the day you complained. Working days skip weekends but not holidays.</p>`,
      `<button class="btn" id="t-reset">Start over</button><a class="btn btn-primary" href="#/act">${I.mail}Complaint</a>`, 'full');
    $('#back').onclick = () => go('#/act');
    $$('[data-done]').forEach(b => b.onclick = () => { t.done = t.done || {}; t.done[b.dataset.done] = !t.done[b.dataset.done]; save(); viewTrack(); });
    const rs = $('#t-ref-save'); if (rs) rs.onclick = () => { t.ref = $('#t-ref2').value.trim(); save(); viewTrack(); };
    $('#t-reset').onclick = () => { S.track = null; save(); viewTrack(); };
  }


  /* GUIDE: how to document a problem so it holds up */
  const GUIDE = [
    { id: 'pipes', icon: 'tool', title: "Is it your pipes or theirs?", steps: [
      'Use the tap closest to your water meter for every check. It is usually outside, before any tank, pump or filter. If the water is fine there but not inside, the problem is likely your pipes, tank or pump.',
      'Ask two or three neighbors on your street. If they have the same problem at the same times, it is the supply.',
      'Check every tap. If only one tap is affected, the problem is that tap or its pipe.',
      'Run the cold tap for 1 to 2 minutes. If dirty water clears, it was sitting in your pipes. If it stays dirty, report it.',
      'Do a leak test before blaming a high bill: close every tap and your tank’s inlet, write down the meter reading, use no water for 30 minutes, then read it again. If the meter moved, there is a leak on your side.'
    ], src: 'Portland Water Bureau, discolored water troubleshooting; utility meter leak-test guides' },
    { id: 'hours', icon: 'clock', title: 'No water or only a few hours', steps: [
      'Keep a log for at least 7 days, so it covers weekdays and the weekend.',
      'Each day, write the time the water comes and the time it stops, at the tap nearest the meter.',
      'Take a photo of the meter when water starts and when it stops. The photo time is your record.',
      'Save any advisory from your provider (screenshot of the post or text) with its date.'
    ], src: 'Tubig method: a 7-day supply diary with time-stamped photos' },
    { id: 'pressure', icon: 'gauge', title: 'Weak flow', steps: [
      'Bucket test: turn off every other tap, open the tap nearest the meter fully, and time how many seconds a 1-liter container takes to fill.',
      'Liters per minute = 60 ÷ seconds. Twelve seconds means 5 L/min. A UK water company treats under 9 L/min as low.',
      'Repeat at the same times each day, for example 7 AM and 7 PM, when demand is highest.',
      'For a pressure reading, a screw-on tap pressure gauge from a hardware store shows psi. Utilities under MWSS and NWRB must supply at least 7 to 8 psi.'
    ], src: 'Yorkshire Water flow test; MWSS and NWRB service obligations' },
    { id: 'quality', icon: 'flask', title: 'Dirty, cloudy or smelly water', steps: [
      'Fill a clear glass and photograph it against white paper in daylight, twice: the first water out, and after running the tap 2 minutes.',
      'Cloudy water that clears from the bottom up within 3 minutes is only air. Particles or color that stay are worth reporting.',
      'Write down the color, any smell (chlorine, rotten egg, sewage) and which taps are affected.',
      'Chlorine test strips or drops (from pool or aquarium shops) show free chlorine. The WHO recommends at least 0.2 mg/L at the tap; a zero reading in piped water is worth reporting.',
      'Do not drink water that is discolored or smells of sewage. Boil water or use another source until it is fixed.'
    ], src: 'Portland Water Bureau; WHO Guidelines for Drinking-water Quality' },
    { id: 'lab', icon: 'list', title: 'Proof of contamination', steps: [
      'Only a test by a DOH-accredited laboratory counts as proof that water fails the national standard (PNSDW 2017).',
      'Ask the lab for a sterile bottle and its instructions. Usually: remove any filter or aerator, run the tap nearest the meter for 2 to 3 minutes, fill without touching the inside, and deliver it cool the same day.',
      'You can also ask your city or municipal health office to have the sanitary inspector test it.'
    ], src: 'DOH Administrative Order 2017-0010 (PNSDW 2017), Sec. VI.2' },
    { id: 'bill', icon: 'bill', title: 'Bills and meter readings', steps: [
      'Photograph your meter on the same day each month. Compare the reading with the consumption on your bill.',
      'Use Check bill to compare the amount with the approved rate.',
      'Keep every bill and receipt.'
    ], src: 'Tubig method' },
    { id: 'health', icon: 'alert', title: 'If someone got sick', steps: [
      'Go to your barangay health station or rural health unit first, and tell them about the water.',
      'Ask them to record it. Health offices track water-borne illness by barangay.'
    ], src: 'DOH' }
  ];
  const illStrip = id => (window.TUBIG_ILL || {})[id] ? `<div class="ill-strip">${window.TUBIG_ILL[id].map((p, j) => `<figure class="ill-panel"><span class="ill-n" aria-hidden="true">${j + 1}</span>${p.svg}<figcaption>${esc(p.cap)}</figcaption></figure>`).join('')}</div>` : '';
  // "How to check" on a question: the guide's pictures and first steps for that problem, shown in place.
  function howHTML(id) {
    const g = id && GUIDE.find(x => x.id === id); if (!g) return '';
    return `<button type="button" class="how-btn" id="how" aria-expanded="false" aria-controls="how-panel"><span class="how-i">${I.eye}</span>How to check</button>
      <div class="how-panel" id="how-panel" hidden>${illStrip(id)}<ol class="gsteps">${g.steps.slice(0, 2).map(t => `<li>${esc(t)}</li>`).join('')}</ol><a class="how-more" href="#/guide">Full guide to documenting it</a></div>`;
  }
  function viewGuide() {
    render(`<button class="back" id="back">${I.left}Back</button>
      <h2 class="h-title">Document the problem</h2>
      <p class="h-sub">Good records get faster action. They also show the problem is the supply, not your pipes.</p>
      <a class="track-cta" href="#/log">${I.list}<span><b>Keep a water log</b> ${S.log && S.log.length ? `${S.log.length} day${S.log.length > 1 ? 's' : ''} logged` : 'Takes a minute a day'}</span>${I.chev}</a>
      <div class="rules guide">${GUIDE.map((g, i) => `<details class="rule" ${i === 0 ? 'open' : ''}><summary><span class="ricon binding">${I[g.icon]}</span><span><b>${esc(g.title)}</b></span>${I.chev}</summary>
        <div class="rbody">${illStrip(g.id)}<ol class="gsteps">${g.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol><p class="src">Source: ${esc(g.src)}</p></div></details>`).join('')}</div>
      <p class="src-line">Write the date, time and place on everything. Keep the original photos.</p>`,
      `<a class="btn" href="#/log">${I.list}Water log</a><button class="btn btn-primary" id="to-report">Report a problem</button>`, 'full');
    $('#back').onclick = () => history.length > 1 ? history.back() : go(muni() ? '#/owed' : '#/');
    $('#to-report').onclick = () => go('#/report/1');
  }

  /* LOG: a simple daily water diary kept on the device */
  const COLORS = [['clear', 'Clear'], ['cloudy', 'Cloudy'], ['brown', 'Brown or yellow'], ['particles', 'Sand or bits']];
  const hoursBetween = (a, b) => { if (!a || !b) return null; const [h1, m1] = a.split(':').map(Number), [h2, m2] = b.split(':').map(Number); let d = (h2 * 60 + m2) - (h1 * 60 + m1); if (d < 0) d += 1440; return d / 60; };
  function logSummary() {
    const L = (S.log || []).slice().sort((a, b) => a.date.localeCompare(b.date)); if (!L.length) return null;
    const hrs = L.map(e => e.none ? 0 : hoursBetween(e.from, e.to)).filter(h => h != null);
    const flows = L.map(e => e.secs > 0 ? 60 / e.secs : null).filter(v => v != null);
    const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    return { n: L.length, first: L[0].date, last: L[L.length - 1].date, hrs: avg(hrs), noWater: L.filter(e => e.none).length, flow: avg(flows), dirty: L.filter(e => e.color && e.color !== 'clear').length, smell: L.filter(e => e.smell).length };
  }
  function viewLog() {
    S.log = S.log || [];
    const sm = logSummary(), r1 = v => Math.round(v * 10) / 10;
    render(`<button class="back" id="back">${I.left}Guide</button>
      <h2 class="h-title">Water log</h2>
      <p class="h-sub">One entry a day, at the tap nearest your meter. It stays on this device and goes into your complaint.</p>
      ${sm ? `<div class="facts log-sum"><div class="fact"><span class="fk">Days logged</span><span class="fv">${sm.n}</span></div><div class="fact"><span class="fk">Water per day</span><span class="fv">${sm.hrs == null ? '—' : r1(sm.hrs) + ' h avg'}</span></div><div class="fact"><span class="fk">Flow</span><span class="fv">${sm.flow == null ? '—' : r1(sm.flow) + ' L/min avg'}</span></div><div class="fact"><span class="fk">Dirty or smelly</span><span class="fv">${sm.dirty + sm.smell ? `${Math.max(sm.dirty, sm.smell)} of ${sm.n} days` : 'None'}</span></div></div>` : ''}
      <form id="log-form" class="log-form">
        <div class="field"><label for="l-date">Date</label><input id="l-date" class="select" type="date" value="${isoD(today())}" max="${isoD(today())}" required></div>
        <div class="field row2"><div><label for="l-from">Water came at</label><input id="l-from" class="select" type="time"></div><div><label for="l-to">Stopped at</label><input id="l-to" class="select" type="time"></div></div>
        <label class="chk"><input id="l-none" type="checkbox"> No water at all today</label>
        <div class="field"><label for="l-secs">Seconds to fill 1 liter (optional)</label><input id="l-secs" class="select" type="number" inputmode="decimal" min="1" step="0.5"></div>
        <div class="field"><label for="l-color">Water looked</label><select id="l-color" class="select">${COLORS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
        <label class="chk"><input id="l-smell" type="checkbox"> Bad smell or taste</label>
        <div class="field"><label for="l-note">Note (optional)</label><input id="l-note" class="select" type="text" placeholder="e.g. photo 7:02 AM, neighbor same"></div>
      </form>
      ${S.log.length ? `<p class="section-label">Entries</p><ul class="log-list">${S.log.slice().sort((a, b) => b.date.localeCompare(a.date)).map(e => `<li><b>${esc(shortD(parseD(e.date)))}</b><span>${e.none ? 'No water' : e.from && e.to ? `${esc(e.from)} to ${esc(e.to)} (${r1(hoursBetween(e.from, e.to))} h)` : 'Hours not noted'}${e.secs ? ` · ${r1(60 / e.secs)} L/min` : ''} · ${esc((COLORS.find(c => c[0] === e.color) || [, ''])[1])}${e.smell ? ' · smell' : ''}${e.note ? ` · ${esc(e.note)}` : ''}</span><button class="btn btn-quiet icon-only" data-del="${esc(e.date)}" aria-label="Delete ${esc(e.date)}">${I.x}</button></li>`).join('')}</ul>
        <div class="tool-row"><button class="btn btn-sm" id="l-csv">${I.down}Download (CSV)</button></div>` : ''}`,
      `<button class="btn btn-primary" id="l-save">Save today's entry</button>`, 'full');
    $('#back').onclick = () => go('#/guide');
    $('#l-none').onchange = e => { $('#l-from').disabled = $('#l-to').disabled = e.target.checked; };
    $('#l-save').onclick = () => {
      const e = { date: $('#l-date').value || isoD(today()), from: $('#l-from').value, to: $('#l-to').value, none: $('#l-none').checked, secs: parseFloat($('#l-secs').value) || null, color: $('#l-color').value, smell: $('#l-smell').checked, note: $('#l-note').value.trim() };
      S.log = S.log.filter(x => x.date !== e.date).concat(e); save(); toast('Entry saved'); viewLog();
    };
    $$('[data-del]').forEach(b => b.onclick = () => { S.log = S.log.filter(x => x.date !== b.dataset.del); save(); viewLog(); });
    const csv = $('#l-csv'); if (csv) csv.onclick = () => {
      const rows = [['date', 'water_from', 'water_to', 'no_water', 'hours', 'seconds_per_liter', 'liters_per_minute', 'color', 'smell', 'note']].concat(S.log.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => [e.date, e.from, e.to, e.none ? 'yes' : 'no', e.none ? 0 : (hoursBetween(e.from, e.to) ?? ''), e.secs ?? '', e.secs ? r1(60 / e.secs) : '', e.color, e.smell ? 'yes' : 'no', e.note]));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'water-log.csv'; a.click(); toast('Log downloaded');
    };
  }
  function logParagraph() {
    const sm = logSummary(); if (!sm || sm.n < 2) return '';
    const r1 = v => Math.round(v * 10) / 10, parts = [];
    if (sm.hrs != null) parts.push(`water was available ${r1(sm.hrs)} hours a day on average${sm.noWater ? `, with no water at all on ${sm.noWater} day${sm.noWater > 1 ? 's' : ''}` : ''}`);
    if (sm.flow != null) parts.push(`flow at the tap nearest my meter averaged ${r1(sm.flow)} liters per minute`);
    if (sm.dirty) parts.push(`the water was discolored on ${sm.dirty} of ${sm.n} days`);
    if (sm.smell) parts.push(`it smelled or tasted bad on ${sm.smell} day${sm.smell > 1 ? 's' : ''}`);
    return parts.length ? `\nI kept a daily log for ${sm.n} days (${sm.first} to ${sm.last}): ${parts.join('; ')}. I can share the full log and photos.\n` : '';
  }

  /* PETITION: a joint complaint neighbors can sign and bring to the barangay, council or district */
  const PET_TO = {
    barangay: { name: 'Punong Barangay and Sangguniang Barangay', ask: ['Pass a resolution asking the water provider to restore adequate service in our barangay and report back by a set date.', 'Refer this petition to the city or municipal council.'] },
    council: { name: 'city or municipal council', ask: ['Hold a hearing on water service in our barangay, with the water district and its operator present.', 'Ask the provider to report hours of supply, pressure and water-quality results for our barangay.'] },
    board: { name: 'Board of Directors of the water district', ask: ['Act on these problems and tell us the date service will be restored.', 'Release the operator’s performance report and the action the board has taken where targets were missed.'] },
    mayor: { name: 'Office of the Mayor', ask: ['Convene the water provider, the barangay and the health office to fix the supply in our barangay.', 'Report the result to the residents who signed.'] }
  };
  let petTo = 'barangay';
  function petitionText() {
    const rows = (S.rows || evaluate()).filter(r => r.v !== 'met' && ['hours', 'pressure', 'quality', 'outage', 'connect'].includes(r.id)), sm = logSummary();
    const m = muni(), to = Object.assign({}, PET_TO[petTo]);
    if (petTo === 'council') to.name = /city/i.test(m.n) ? `Sangguniang Panlungsod of ${m.n.replace(/^City of /, '')}` : `Sangguniang Bayan of ${m.n}`;
    if (petTo === 'mayor') to.name = `Office of the Mayor, ${m.n}`;
    const probs = rows.length ? rows.map(r => `- ${r.title}: ${r.you}${r.v === 'notmet' ? ` (the rule: ${r.short})` : ''}`).join('\n') : '- [Describe the problem]';
    const ctx = isMCWD() ? `\nThe Commission on Audit reports that the district's operator logged ${fmtN(1490)} complaints in 2024: 40% (603) about no water and 43% (645) about low pressure.\n` : '';
    return `${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}

To: ${to.name}
${placeLabel()}

Subject: Joint complaint on water service in ${placeLabel()}

We, the undersigned residents of ${placeLabel()}, report the following problems with the water service from ${providerName()}:

${probs}
${ctx}${sm && sm.n >= 2 ? `\nOne household kept a daily log for ${sm.n} days${sm.hrs != null ? `: water ${Math.round(sm.hrs * 10) / 10} hours a day on average` : ''}. Signatories can provide photos and records.\n` : ''}
We respectfully ask that you:
${to.ask.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Contact person: [name, phone]

Signatures are attached.`;
  }
  function viewPetition() {
    render(`<button class="back" id="back">${I.left}Complaint</button>
      <h2 class="h-title">Complain together</h2>
      <p class="h-sub">One letter signed by many households is harder to ignore. Print it, collect signatures, and bring it in.</p>
      <div class="field"><label for="p-to">Send to</label><select id="p-to" class="select">${Object.entries({ barangay: 'Barangay captain and council', council: 'City or municipal council', board: 'Water district board', mayor: 'Mayor' }).map(([k, v]) => `<option value="${k}" ${k === petTo ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
      <label for="p-text" class="sr-only">Joint complaint</label><textarea id="p-text" class="letter" spellcheck="true">${esc(petitionText())}</textarea>
      <p class="src-line">Printing adds a signature sheet with spaces for 20 households: name, address or purok, problems and signature. Only collect what people agree to share.</p>`,
      `<button class="btn" id="p-copy">${I.copy}Copy</button><button class="btn btn-primary" id="p-print">${I.print}Print to sign</button>`, 'full');
    $('#back').onclick = () => go('#/act');
    $('#p-to').onchange = e => { petTo = e.target.value; $('#p-text').value = petitionText(); };
    $('#p-copy').onclick = async () => { try { await navigator.clipboard.writeText($('#p-text').value); toast('Copied'); } catch { $('#p-text').select(); } };
    $('#p-print').onclick = () => {
      const pl = $('#print-letter');
      pl.innerHTML = `<div class="pl-text">${esc($('#p-text').value)}</div><div class="pl-sheet"><h2>Signature sheet: ${esc(placeLabel())}</h2><table><thead><tr><th>#</th><th>Name</th><th>Address or purok</th><th>Problems</th><th>Since when</th><th>Signature</th></tr></thead><tbody>${Array.from({ length: 20 }, (_, i) => `<tr><td>${i + 1}</td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}</tbody></table></div>`;
      window.print(); setTimeout(() => { pl.innerHTML = ''; }, 1000);
    };
  }

  /* BILL */
  function computeBill(tf, cum) {
    if (!tf || tf.min == null) return null;
    if (cum <= 10) return { total: tf.min };
    if (!tf.blocks || !tf.blocks.length) return { total: null };
    let total = tf.base10 != null ? tf.base10 : tf.min, used = cum - 10, from = 11;
    for (const b of tf.blocks) {
      if (used <= 0) break;
      const span = b.to == null ? used : Math.min(used, b.to - Math.max(b.from, from) + 1);
      if (span <= 0) continue;
      total += span * b.rate; used -= span; from += span;
    }
    return { total: used > 0 ? null : Math.round(total * 100) / 100 };
  }
  function viewBill() {
    const tf = tariffFor(), w = wd(), mw = S.ptype === 'mwss';
    const concSel = mw ? `<div class="field"><label for="conc">Your water company</label><select id="conc" class="select">${Object.entries(D.tariffs.mwss || {}).map(([k, v]) => `<option value="${k}" ${k === concFor() ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select><p class="hint">${guessConc() && !S.conc ? 'Based on your city. ' : ''}Check the logo on your bill.</p></div>` : '';
    const table = tf ? `<div class="tariff"><table><thead><tr><th>Water used</th><th class="num">Charge</th></tr></thead><tbody>
      <tr><td>${tf.base10 != null ? 'Up to 10 m³ (minimum)' : 'First 10 m³ (minimum)'}</td><td class="num">${peso(tf.min)}</td></tr>
      ${tf.base10 != null ? `<tr><td>First 10 m³, if you use more</td><td class="num">${peso(tf.base10)}</td></tr>` : ''}
      ${(tf.blocks || []).map(b => `<tr><td>${b.to == null ? `${b.from} m³ and up` : `${b.from} to ${b.to} m³`}</td><td class="num">${peso(b.rate)} per m³</td></tr>`).join('')}</tbody></table></div>
      <p class="src-line">Residential, ½-inch meter, basic charge. ${mw ? esc(tf.note) : `Latest rate LWUA has on record${tf.effective ? `, approved ${esc(fmtDate(tf.effective))}` : ''}.`} Source: ${tf.url ? `<a href="${esc(tf.url)}" target="_blank" rel="noopener">${esc(tf.source)}</a>` : esc(tf.source || '')}.</p>
      ${mw ? '' : tf.note ? `<div class="callout info">${I.info}<p>${esc(tf.note)}</p></div>` : jvOp() ? `<div class="callout info">${I.info}<p>Your district is run with ${esc(jvOp().replace(/ \(.*\)$/, ''))}. Rates under a joint venture may be newer than what LWUA has posted. Ask the district for its current approved schedule.</p></div>` : ''}` : '';
    render(`<button class="back" id="back">${I.left}Rules</button>
      <h2 class="h-title">Check your bill</h2>
      <p class="h-sub">${esc(S.ptype === 'wd' && w ? w.n : providerName())}</p>
      ${concSel}${tf ? table : `<div class="callout info">${I.info}<p>We don't have this provider's approved tariff yet. ${S.ptype === 'wd' ? 'Water district rates are approved by LWUA; ask your district for its schedule.' : ''}</p></div>`}
      ${tf ? `<div class="field"><label for="cum">Water used this month</label><div class="input-wrap"><input id="cum" type="number" inputmode="decimal" min="0" step="1" placeholder="e.g. 18"><span class="unit">m³</span></div><p class="hint">On your bill as "consumption" or "cu.m."</p></div>
      <div class="field"><label for="amt">Amount billed (optional)</label><div class="input-wrap prefix"><span class="pre">₱</span><input id="amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="e.g. 520.00"></div><p class="hint">This month's water charge, without unpaid balances.</p></div>
      <div id="bill-out" aria-live="polite"></div>` : ''}`,
      `<button class="btn btn-primary" id="to-report">Report a problem</button>`, 'full');
    $('#back').onclick = () => go('#/owed');
    $('#to-report').onclick = () => go('#/report/1');
    const cs = $('#conc'); if (cs) cs.onchange = e => { S.conc = e.target.value; save(); viewBill(); };
    if (!tf) return;
    const out = $('#bill-out'), cum = $('#cum'), amt = $('#amt');
    const upd = () => {
      const c = parseFloat(cum.value), a = parseFloat(amt.value);
      if (!(c >= 0)) { out.innerHTML = ''; return; }
      const r = computeBill(tf, c);
      if (!r || r.total == null) { out.innerHTML = `<div class="bill-result"><p>We only have the minimum charge for this district (${peso(tf.min)} for the first 10 m³). Rates above 10 m³ aren't in our data yet.</p></div>`; return; }
      const basic = r.total, exp = mw ? Math.round(((basic * (1 + tf.env) + tf.msc) * (1 + tf.tax)) * 100) / 100 : basic;
      if (!(a > 0)) { out.innerHTML = `<div class="bill-result ok"><span class="br-big">${mw ? 'about ' : ''}${peso(exp)}</span><p>${mw ? `What ${c} m³ should cost: ${peso(basic)} basic charge plus the environmental charge, meter charge and taxes. Currency adjustments change each quarter.` : `What ${c} m³ should cost at this rate, before arrears or other fees.`}</p></div>`; return; }
      const diff = a - exp, tol = mw ? Math.max(10, exp * .06) : Math.max(5, exp * .03), over = diff > tol, under = diff < -tol;
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
        <details><summary>Can't I just call my water provider?</summary><p>Yes, and that is the first step Tubig points you to. Every water district has a complaints desk and a Citizen's Charter, and the 8888 hotline and ARTA are there if nothing happens. What Tubig adds is the rule your provider has to meet, the right office to contact first and next, and a written complaint with a reference number, so there is a record if you need to escalate.</p></details>
        <details><summary>Will Tubig count reports from my barangay?</summary><p>Not yet. This prototype keeps everything on your device. A pilot, after ethics review, would let residents add an anonymous report (barangay, problem, date, no names), so councils and barangay halls can see how many households report the same problem. Until then, use Complain together to collect signatures on paper.</p></details>
        <details><summary>Is my information stored?</summary><p>No accounts, nothing sent to us. Answers stay in your browser. Barangay outlines load from this site. If an outline is missing, the place you pick goes to OpenStreetMap to find it on the map.</p></details>
        <details><summary>Why is there no minimum for hours or pressure?</summary><p>No national rule requires water districts to supply water 24 hours a day, at a set pressure, or in a set amount per person. Utilities regulated by NWRB and those run by local governments have minimums (18 hours a day and 8 psi under NWRB Res. 14-0921); water districts do not. LWUA and the Commission on Audit track hours of supply as a performance indicator, but each district sets its own target. Districts must meet national drinking-water quality standards and act on complaints within their Citizen's Charter times and 72 hours for 8888 complaints.</p></details>
        <details><summary>What if a private company runs my water district?</summary><p>Joint venture contracts reviewed so far promise 24-hour supply within 2 to 5 years and 10 psi within 4 to 5 years. These are contract terms, not regulations: only the water district's board can enforce them, by forfeiting the operator's performance bond or ending the contract. The contracts are usually not public, so ask your district for its annual joint venture compliance report. Your complaint goes to the water district, which answers for its partner.</p></details>
        <details><summary>Will this change?</summary><p>A bill creating a Water Regulatory Commission with power to set minimum service standards passed the House in December 2025 and is pending in the Senate. Until then, the gaps Tubig shows are gaps in the rules, not only in service.</p></details>
        <details><summary>Is this legal advice?</summary><p>No. Rules are summarized from an inventory of 240 obligations. Always check the linked source.</p></details>
        <details><summary>Are the contacts current?</summary><p>They come from official websites and Citizen's Charters and can change. Call to confirm.</p></details></div>
      <p class="count" style="margin-top:32px">Data are preliminary and under human verification. Map © OpenStreetMap contributors. Barangay and city boundaries: NAMRIA and PSA via OCHA (CC BY-IGO), PSGC 3Q 2026, compiled by <a href="https://github.com/faeldon/philippines-psgc-shapefiles">faeldon/philippines-psgc-shapefiles</a>. <a href="https://github.com/gregor-posadas/tubig">Source code</a></p>`;
  }

  /* ---------- menu, theme ---------- */
  const menuBtn = $('#menu-btn'), menu = $('#menu');
  menuBtn.onclick = e => { e.stopPropagation(); const open = menu.hidden; menu.hidden = !open; menuBtn.setAttribute('aria-expanded', open); };
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); } });
  $$('a', menu).forEach(a => a.addEventListener('click', () => { menu.hidden = true; }));
  const themeBtn = $('#theme-btn');
  const syncTheme = () => { themeBtn.textContent = document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode'; };
  themeBtn.onclick = () => { const d = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = d; try { localStorage.setItem('tubig-theme', d); } catch { /* */ } syncTheme(); menu.hidden = true; MAP.retheme(); };
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
    setTimeout(() => MAP.resize(), 30);
    document.title = 'Tubig · Check your water service';
    if (['owed', 'report', 'gap', 'act', 'bill', 'track', 'guide', 'log', 'petition'].includes(v)) {
      await loadPlaces();
      if (!muni() && !['guide', 'log'].includes(v)) { go('#/'); return; }
      ({ owed: viewOwed, report: () => viewReport(+arg || 1), gap: viewGap, act: viewAct, bill: viewBill, track: viewTrack, guide: viewGuide, log: viewLog, petition: viewPetition })[v]();
      if (muni()) placeOnMap();
    } else viewSearch();
    if (v) $('#panel').focus({ preventScroll: true });
  }
  addEventListener('hashchange', route);
  setSheet('peek');
  route();
})();
