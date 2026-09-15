import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1536;
const HEIGHT = 1920;

const masters = [
  { defId: "ember_sprinter", region: "emberhold", kind: "runner", palette: ["#070708", "#2d0f0b", "#852814", "#f05b24", "#ffd478"] },
  { defId: "wood_ward", region: "ironwood", kind: "barkskin", palette: ["#071009", "#1b2e1a", "#4c6435", "#93ad56", "#f1cf79"] },
  { defId: "ember_face", region: "emberhold", kind: "meteor", palette: ["#080708", "#35110a", "#912814", "#ff6425", "#ffe08a"] },
  { defId: "ember_drake", region: "emberhold", kind: "drake", palette: ["#070708", "#30100b", "#7e2415", "#e95524", "#ffd06c"] },
  { defId: "ember_stun", region: "emberhold", kind: "stun", palette: ["#070708", "#32100b", "#872514", "#f05a24", "#ffd779"] },
];

function defs({ palette }) {
  const [base, mid, deep, accent, hi] = palette;
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${base}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
    <radialGradient id="halo"><stop stop-color="${hi}" stop-opacity=".8"/><stop offset=".25" stop-color="${accent}" stop-opacity=".36"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${hi}"/><stop offset=".25" stop-color="${accent}"/><stop offset=".62" stop-color="${deep}"/><stop offset="1" stop-color="${base}"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="42"/></filter>
  </defs>`;
}

function motes({ palette }, count = 42) {
  const [, , , accent, hi] = palette;
  return Array.from({ length: count }, (_, i) => {
    const x = 56 + ((i * 211) % 1420);
    const y = 68 + ((i * 313) % 1740);
    const r = 2 + (i % 6);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 4 ? accent : hi}" opacity="${(0.1 + (i % 5) * .045).toFixed(2)}"/>`;
  }).join("");
}

function ground({ palette }, y = 1610) {
  const [base, mid, deep, accent] = palette;
  return `<path d="M0 ${y} C280 ${y - 110} 520 ${y + 48} 790 ${y - 30} C1060 ${y - 105} 1280 ${y + 32} 1536 ${y - 120} V1920 H0Z" fill="${mid}" opacity=".88"/>
    <path d="M0 ${y + 115} C320 ${y + 22} 575 ${y + 140} 860 ${y + 42} C1120 ${y - 42} 1340 ${y + 80} 1536 ${y + 5} V1920 H0Z" fill="${base}" opacity=".9"/>
    <path d="M45 ${y + 65} C320 ${y - 5} 600 ${y + 98} 850 ${y + 10} C1120 ${y - 56} 1320 ${y + 45} 1490 ${y - 25}" fill="none" stroke="${accent}" stroke-width="9" opacity=".16"/>
    <path d="M0 1810 C310 1715 610 1840 910 1760 C1195 1685 1390 1800 1536 1720 V1920 H0Z" fill="${deep}" opacity=".52"/>`;
}

function runner(c) {
  const [base, , deep, accent, hi] = c.palette;
  return `<ellipse cx="805" cy="980" rx="650" ry="780" fill="url(#halo)" opacity=".22"/>
    <path d="M0 1120 L1536 610" stroke="${deep}" stroke-width="210" opacity=".28"/>
    ${Array.from({ length: 22 }, (_, i) => `<path d="M${35 + i * 69} ${430 + (i % 7) * 165} l${250 + (i % 5) * 55} -${80 + (i % 4) * 38}" stroke="${i % 3 ? accent : hi}" stroke-width="${6 + i % 5}" opacity=".26"/>`).join("")}
    <circle cx="850" cy="690" r="108" fill="${deep}" stroke="${hi}" stroke-width="13"/>
    <path d="M770 805 L955 900 L870 1205 L665 1110Z" fill="url(#metal)" stroke="${accent}" stroke-width="20"/>
    <path d="M790 875 L555 1045" stroke="${hi}" stroke-width="54" stroke-linecap="round"/><path d="M922 925 L1150 785" stroke="${accent}" stroke-width="58" stroke-linecap="round"/>
    <path d="M720 1110 L440 1450" stroke="${accent}" stroke-width="76" stroke-linecap="round"/><path d="M855 1165 L1125 1430" stroke="${hi}" stroke-width="70" stroke-linecap="round"/>
    <path d="M505 1465 L325 1530 M1130 1435 L1320 1510" stroke="${hi}" stroke-width="34" stroke-linecap="round"/>
    <path d="M724 708 L820 660 L930 706" fill="none" stroke="${accent}" stroke-width="18"/>
    <path d="M230 1325 C470 1190 555 1040 690 905" fill="none" stroke="${accent}" stroke-width="62" opacity=".2" filter="url(#soft)"/>
    ${motes(c, 36)}${ground(c, 1640)}`;
}

function barkskin(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  const plates = [
    [768,520,165,120],[610,760,190,135],[925,760,190,135],[768,980,240,155],[590,1195,205,145],[946,1195,205,145],[768,1415,245,160],
  ];
  return `<ellipse cx="768" cy="960" rx="650" ry="790" fill="url(#halo)" opacity=".18"/>
    <path d="M265 1920 C250 1520 350 1230 430 1030 C515 820 485 590 385 350" fill="none" stroke="${deep}" stroke-width="125"/>
    <path d="M1270 1920 C1285 1520 1185 1230 1105 1030 C1020 820 1050 590 1150 350" fill="none" stroke="${deep}" stroke-width="125"/>
    <path d="M640 1520 L590 900 Q768 690 946 900 L896 1520Z" fill="${base}" stroke="${accent}" stroke-width="20"/>
    <circle cx="768" cy="650" r="128" fill="${mid}" stroke="${hi}" stroke-width="13"/>
    ${plates.map(([x,y,rx,ry], i) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${i % 2 ? deep : mid}" stroke="${i % 3 ? accent : hi}" stroke-width="${12 + (i % 3) * 3}" opacity=".9"/>`).join("")}
    <path d="M768 520 C720 760 824 880 756 1100 C704 1270 780 1420 760 1550" fill="none" stroke="${hi}" stroke-width="16" opacity=".66" filter="url(#glow)"/>
    <path d="M515 905 L350 1220 M1020 905 L1185 1220" stroke="${deep}" stroke-width="92" stroke-linecap="round"/><path d="M520 900 L365 1210 M1015 900 L1170 1210" stroke="${accent}" stroke-width="16"/>
    ${motes(c, 32)}${ground(c, 1645)}`;
}

function meteor(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="900" cy="710" rx="600" ry="650" fill="url(#halo)" opacity=".36"/>
    <path d="M1380 190 L920 760" stroke="${accent}" stroke-width="220" stroke-linecap="round" opacity=".18" filter="url(#soft)"/>
    <path d="M1430 120 L930 760" stroke="${hi}" stroke-width="54" stroke-linecap="round" filter="url(#glow)"/>
    <path d="M1365 190 L910 785" stroke="${accent}" stroke-width="96" stroke-linecap="round" opacity=".8"/>
    <circle cx="875" cy="825" r="190" fill="${deep}" stroke="${hi}" stroke-width="18"/>
    <path d="M780 735 L915 690 L1002 815 L955 940 L808 965 L735 850Z" fill="url(#metal)"/>
    <path d="M300 1560 Q650 1050 885 1030 Q1120 1050 1370 1550" fill="${mid}" opacity=".48"/>
    ${Array.from({ length: 18 }, (_, i) => { const a=(Math.PI*2*i)/18; const x1=875+Math.cos(a)*230; const y1=1040+Math.sin(a)*160; const x2=875+Math.cos(a)*620; const y2=1110+Math.sin(a)*520; return `<path d="M${x1.toFixed(0)} ${y1.toFixed(0)} L${x2.toFixed(0)} ${y2.toFixed(0)}" stroke="${i%3?accent:hi}" stroke-width="${7+i%5}" opacity=".42"/>`; }).join("")}
    <ellipse cx="875" cy="1090" rx="390" ry="118" fill="none" stroke="${accent}" stroke-width="34" opacity=".55" filter="url(#glow)"/>
    ${motes(c, 44)}${ground(c, 1580)}`;
}

function drake(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="780" cy="870" rx="660" ry="760" fill="url(#halo)" opacity=".2"/>
    <path d="M160 1060 Q340 580 720 820 Q520 1040 360 1330Z" fill="${deep}" stroke="${accent}" stroke-width="22"/>
    <path d="M1376 1060 Q1196 580 816 820 Q1016 1040 1176 1330Z" fill="${deep}" stroke="${accent}" stroke-width="22"/>
    <path d="M420 900 Q768 570 1115 910 Q1015 1260 768 1435 Q515 1260 420 900Z" fill="url(#metal)" stroke="${hi}" stroke-width="16"/>
    <path d="M735 560 Q780 390 900 350 L860 520 L1035 495 L900 625Z" fill="${deep}" stroke="${accent}" stroke-width="18"/>
    <circle cx="890" cy="500" r="18" fill="${hi}" filter="url(#glow)"/>
    <path d="M630 880 Q770 770 915 875" fill="none" stroke="${hi}" stroke-width="19" opacity=".68"/>
    <path d="M540 1020 L360 1185 M995 1020 L1175 1185" stroke="${accent}" stroke-width="68" stroke-linecap="round"/>
    <path d="M725 1410 Q590 1540 420 1590 M810 1410 Q945 1540 1115 1590" fill="none" stroke="${deep}" stroke-width="52"/>
    <path d="M0 1510 L310 1360 L515 1490 L760 1330 L1010 1480 L1280 1340 L1536 1465 V1920 H0Z" fill="${base}" opacity=".9"/>
    <path d="M0 1510 L310 1360 L515 1490 L760 1330 L1010 1480 L1280 1340 L1536 1465" fill="none" stroke="${accent}" stroke-width="12" opacity=".3"/>
    ${motes(c, 38)}${ground(c, 1660)}`;
}

function stun(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="770" cy="930" rx="650" ry="760" fill="url(#halo)" opacity=".26"/>
    <circle cx="770" cy="930" r="450" fill="none" stroke="${accent}" stroke-width="72" opacity=".14"/>
    <circle cx="770" cy="930" r="335" fill="none" stroke="${hi}" stroke-width="20" opacity=".24"/>
    <path d="M690 720 L850 720 L930 980 L840 1370 H690 L610 980Z" fill="${deep}" stroke="${accent}" stroke-width="18"/>
    <circle cx="770" cy="585" r="115" fill="${mid}" stroke="${hi}" stroke-width="12"/>
    <path d="M590 900 L390 1120 M950 900 L1150 1120" stroke="${deep}" stroke-width="70" stroke-linecap="round"/>
    <path d="M575 1270 L440 1515 M965 1270 L1100 1515" stroke="${deep}" stroke-width="76" stroke-linecap="round"/>
    <path d="M235 710 C430 510 560 610 650 790 C735 960 865 1010 1010 845 C1120 720 1240 650 1370 755" fill="none" stroke="${accent}" stroke-width="86" opacity=".24" filter="url(#soft)"/>
    <path d="M210 710 C410 500 555 615 650 790 C735 950 860 1000 1010 845 C1125 720 1245 650 1395 760" fill="none" stroke="${hi}" stroke-width="28" stroke-linecap="round" filter="url(#glow)"/>
    <path d="M260 905 C470 760 565 845 650 955 C745 1080 870 1110 1005 980 C1130 860 1260 835 1390 930" fill="none" stroke="${accent}" stroke-width="34"/>
    ${Array.from({ length: 20 }, (_, i) => `<path d="M${140 + ((i*191)%1260)} ${350 + ((i*277)%1080)} l${i%2?55:-50} ${30+(i%5)*20}" stroke="${i%3?accent:hi}" stroke-width="${5+i%4}" opacity=".35"/>`).join("")}
    ${motes(c, 28)}${ground(c, 1640)}`;
}

const painters = { runner, barkskin, meteor, drake, stun };

function render(master) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${defs(master)}
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <rect x="70" y="70" width="1396" height="1780" rx="58" fill="none" stroke="${master.palette[4]}" stroke-width="5" opacity=".08"/>
    ${painters[master.kind](master)}
  </svg>`;
}

for (const master of masters) {
  const out = resolve(`public/art/cards/alpha-p0/${master.region}/${master.defId}.webp`);
  await mkdir(dirname(out), { recursive: true });
  await sharp(Buffer.from(render(master)))
    .resize(WIDTH, HEIGHT)
    .webp({ quality: 88, effort: 6 })
    .toFile(out);
}

console.log(`ALPHA P0 ART BATCH 2: generated ${masters.length} deterministic ${WIDTH}x${HEIGHT} WebP masters`);
