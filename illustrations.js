/* Tubig instruction drawings: one idea per panel, uniform 2px line, one orange mark for "do this here",
   light blue for water. Strokes use currentColor so they follow light and dark mode. */
(() => {
  const W = '#9EB8DB', A = '#CF5921', S = 'var(--ill-fill, #EEF2F6)';
  const svg = (label, body) => `<svg viewBox="0 0 120 96" role="img" aria-label="${label}" class="ill"><title>${label}</title><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  // parts
  const tap = (x, y) => `<path d="M${x - 10} ${y}h16a4 4 0 0 1 4 4v5"/><path d="M${x - 2} ${y}v-6M${x - 7} ${y - 6}h10"/>`;          // wall tap, spout end at (x+10, y+9)
  const stream = (x, y, h) => `<path d="M${x} ${y}v${h}" stroke="${W}" stroke-width="3"/>`;
  const meter = (x, y) => `<rect x="${x}" y="${y}" width="22" height="16" rx="3" fill="${S}"/><circle cx="${x + 11}" cy="${y + 8}" r="4.5"/><path d="M${x + 11} ${y + 8}l2.5-2"/>`;
  const clock = (x, y, r, a = 0) => `<circle cx="${x}" cy="${y}" r="${r}"/><path d="M${x} ${y}v${-r * .6}M${x} ${y}l${r * .45 * Math.cos(a)} ${r * .45 * Math.sin(a)}"/>`;
  const glass = (x, y, fill, lvl = 14) => `<path d="M${x} ${y}l3 26h12l3-26z"/><path d="M${x + 1.6} ${y + 26 - lvl - 0}h14.8l-1.6 ${lvl}h-11.6z" fill="${fill}" stroke="none"/>`;
  const house = (x, y, w = 34, h = 26) => `<path d="M${x} ${y + h}v-${h * .6}l${w / 2} -${h * .4}l${w / 2} ${h * .4}v${h * .6}z"/><rect x="${x + w / 2 - 4}" y="${y + h - 10}" width="8" height="10"/>`;
  const ring = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" stroke="${A}" stroke-width="2.4" stroke-dasharray="3 3"/>`;
  const arrow = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${A}" stroke-width="2.4"/><path d="M${x2} ${y2}l-5 -1.5M${x2} ${y2}l-1.5 -5" stroke="${A}" stroke-width="2.4" transform="rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI - 45} ${x2} ${y2})"/>`;
  const txt = (x, y, t, size = 9, anchor = 'middle', color = 'currentColor', weight = 600) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${color}" stroke="none" font-family="IBM Plex Sans, sans-serif">${t}</text>`;
  const phone = (x, y) => `<rect x="${x}" y="${y}" width="16" height="26" rx="3" fill="${S}"/><circle cx="${x + 8}" cy="${y + 13}" r="4"/><path d="M${x + 6} ${y + 3}h4"/>`;

  const P = {
    pipes: [
      { cap: 'Use the tap nearest the meter, before any tank or pump', svg: svg('Water meter at the street, then the first tap, then the house with its tank',
        `<path d="M6 80h108"/>${meter(10, 58)}<path d="M32 66h44"/>${tap(48, 66)}${stream(58, 77, 10)}${ring(54, 70, 11)}${house(78, 40)}<rect x="86" y="30" width="18" height="10" rx="2" fill="${S}"/><path d="M95 40v6M76 66h2"/>`) },
      { cap: 'Ask two or three neighbors', svg: svg('Two houses side by side, both with the same problem',
        `<path d="M6 80h108"/>${house(10, 48)}${house(76, 48)}<path d="M50 40c0-8 20-8 20 0s-6 8-10 8l-4 5v-5c-4 0-6-3-6-8z" stroke="${A}" stroke-width="2.2"/>${txt(60, 44, '?', 11, 'middle', A, 700)}` ) },
      { cap: 'Run the cold tap 1 to 2 minutes', svg: svg('Tap running into a sink while a clock shows two minutes',
        `${tap(30, 24)}${stream(40, 35, 26)}<path d="M18 62h44l-4 12h-36z" fill="${S}"/>${clock(88, 42, 16, -0.6)}<path d="M88 26v-4" />${txt(88, 74, '1–2 min', 9)}`) },
      { cap: 'Leak test: no water used for 30 minutes', svg: svg('Meter reading before and after thirty minutes; if the number moved there is a leak',
        `${meter(8, 30)}${txt(19, 60, '0123.4', 8)}<path d="M38 38h12" stroke="${A}" stroke-width="2.4"/><path d="M46 34l4 4-4 4" stroke="${A}" stroke-width="2.4"/>${clock(66, 38, 11, 0)}${txt(66, 60, '30 min', 8)}<path d="M82 38h8" stroke="${A}" stroke-width="2.4"/>${meter(92, 30)}${txt(103, 60, '0123.4', 8)}${txt(60, 84, 'moved? leak on your side', 8, 'middle', 'currentColor', 500)}`) }
    ],
    hours: [
      { cap: 'Note when water comes and stops, for 7 days', svg: svg('A week chart with a bar for the hours of water each day',
        `<path d="M8 72h104"/>${txt(112, 18, '24 h', 8, 'end', 'currentColor', 500)}<path d="M8 22h104" stroke-dasharray="2 4"/>${[4, 3, 7, 2, 5, 0, 3].map((h, i) => (h ? `<rect x="${12 + i * 14}" y="${72 - h * 2.1}" width="9" height="${h * 2.1}" rx="1.5" fill="${W}" stroke="none"/>` : `<path d="M${13 + i * 14} 68l7 0" stroke="${A}" stroke-width="2.4"/>`) + txt(16.5 + i * 14, 84, 'MTWTFSS'[i], 8, 'middle', 'currentColor', 500)).join('')}`) },
      { cap: 'Photograph the meter when it starts and stops', svg: svg('A phone taking a photo of the water meter',
        `${meter(18, 44)}${phone(76, 34)}<path d="M74 47l-28 0" stroke="${A}" stroke-width="2.4" stroke-dasharray="3 3"/>${txt(60, 84, '07:02 · 09:15', 9)}`) }
    ],
    pressure: [
      { cap: 'Close every other tap', svg: svg('Two taps closed with crosses, one tap left open',
        `${tap(24, 30)}<path d="M28 46l8 8M36 46l-8 8" stroke="${A}" stroke-width="2.4"/>${tap(64, 30)}<path d="M68 46l8 8M76 46l-8 8" stroke="${A}" stroke-width="2.4"/>${tap(100, 30)}${stream(110, 41, 24)}`) },
      { cap: 'Time how long 1 liter takes to fill', svg: svg('Tap filling a one-liter jug while a stopwatch counts twelve seconds',
        `${tap(24, 18)}${stream(34, 29, 20)}<path d="M22 50h26v28a4 4 0 0 1-4 4h-18a4 4 0 0 1-4-4z"/><path d="M23 66h24v12a3 3 0 0 1-3 3h-18a3 3 0 0 1-3-3z" fill="${W}" stroke="none"/>${txt(35, 62, '1 L', 8)}${clock(86, 50, 16, 0.3)}<path d="M86 34v-4M82 30h8"/>${txt(86, 82, '12 s', 10, 'middle', A, 700)}`) },
      { cap: '60 ÷ seconds = liters per minute', svg: svg('Sixty divided by twelve seconds equals five liters per minute',
        `<rect x="14" y="26" width="92" height="44" rx="6" fill="${S}"/>${txt(60, 46, '60 ÷ 12', 13, 'middle', 'currentColor', 600)}${txt(60, 63, '= 5 L/min', 13, 'middle', A, 700)}${txt(60, 86, 'under 9 L/min is low', 8, 'middle', 'currentColor', 500)}`) }
    ],
    quality: [
      { cap: 'Glass against white paper, in daylight', svg: svg('A glass of water in front of a white sheet, photographed with a phone',
        `<rect x="22" y="14" width="40" height="56" fill="#fff"/>${glass(33, 40, '#C9A46A', 16)}${phone(84, 30)}<path d="M82 43h-18" stroke="${A}" stroke-width="2.4" stroke-dasharray="3 3"/>`) },
      { cap: 'First water, then after 2 minutes', svg: svg('Two glasses: the first water is brown, the water after two minutes is clearer',
        `${glass(18, 30, '#B7894D', 18)}${txt(27, 72, '1st', 9)}<path d="M48 44h18" stroke="${A}" stroke-width="2.4"/><path d="M62 40l4 4-4 4" stroke="${A}" stroke-width="2.4"/>${glass(78, 30, '#DCC9A5', 18)}${txt(87, 72, '2 min', 9)}`) },
      { cap: 'Chlorine strip: at least 0.2 mg/L', svg: svg('A chlorine test strip compared with a color chart; zero is a problem',
        `${glass(16, 36, W, 16)}<rect x="30" y="14" width="6" height="40" rx="1" fill="#fff"/><rect x="30" y="44" width="6" height="8" fill="#E8D6E8" stroke="none"/>${[0, 1, 2, 3].map(i => `<rect x="${56 + i * 14}" y="36" width="11" height="11" rx="2" fill="${['#F3EEF3', '#EBD9EB', '#DDB8DD', '#C98FC9'][i]}"/>${txt(61.5 + i * 14, 60, ['0', '.2', '.5', '1'][i], 8, 'middle', i === 0 ? A : 'currentColor', i === 0 ? 700 : 500)}`).join('')}${txt(84, 76, 'mg/L', 8, 'middle', 'currentColor', 500)}`) }
    ],
    lab: [
      { cap: 'Remove any filter, run the tap 2 to 3 minutes', svg: svg('Filter removed from the tap, water running, clock shows three minutes',
        `${tap(30, 22)}${stream(40, 33, 26)}<rect x="56" y="16" width="10" height="10" rx="2"/><path d="M54 14l14 14" stroke="${A}" stroke-width="2.4"/>${clock(90, 44, 14, 0.9)}${txt(90, 74, '2–3 min', 9)}`) },
      { cap: 'Fill the lab bottle without touching inside', svg: svg('A sterile bottle filled under the tap, cap held aside',
        `${tap(30, 16)}${stream(40, 27, 14)}<path d="M33 44h14v6l4 6v20a4 4 0 0 1-4 4h-14a4 4 0 0 1-4-4v-20l4-6z" fill="${S}"/><rect x="72" y="40" width="16" height="9" rx="2"/><path d="M76 49v4" stroke="${A}" stroke-width="2.4"/>${txt(80, 70, 'cap up', 8, 'middle', 'currentColor', 500)}`) },
      { cap: 'Keep it cool, deliver the same day', svg: svg('A cool box with the bottle inside and a sun crossed out',
        `<rect x="18" y="38" width="48" height="34" rx="4" fill="${S}"/><path d="M18 48h48M36 38v-6h12v6"/>${txt(42, 64, 'cool', 9)}<circle cx="92" cy="40" r="8"/><path d="M92 26v-4M92 58v-4M78 40h-4M110 40h-4"/><path d="M80 28l24 24" stroke="${A}" stroke-width="2.4"/>${txt(92, 76, 'same day', 8, 'middle', 'currentColor', 500)}`) }
    ],
    bill: [
      { cap: 'Same day each month: photo of the meter', svg: svg('A calendar with the same day circled and a photo of the meter',
        `<rect x="12" y="22" width="44" height="44" rx="4" fill="${S}"/><path d="M12 32h44M22 18v8M46 18v8"/>${ring(34, 48, 7)}${txt(34, 51, '15', 8)}${meter(70, 34)}${phone(96, 28)}`) },
      { cap: 'Compare with the reading on your bill', svg: svg('The meter reading matches the reading printed on the bill',
        `${meter(14, 34)}${txt(25, 64, '0123', 9)}${txt(60, 48, '=', 14, 'middle', A, 700)}<path d="M74 18h34v56l-5-3-6 3-6-3-6 3-6-3-5 3z" fill="#fff"/><path d="M80 30h22M80 38h22"/>${txt(91, 56, '0123', 9)}`) }
    ],
    health: [
      { cap: 'Go to your barangay health station', svg: svg('A health station with a cross sign',
        `<path d="M14 80h92"/><rect x="30" y="34" width="60" height="46" fill="${S}"/><path d="M26 36l34-18 34 18"/><path d="M60 46v16M52 54h16" stroke="${A}" stroke-width="3"/><rect x="54" y="66" width="12" height="14"/>`) }
    ]
  };
  window.TUBIG_ILL = P;
})();
