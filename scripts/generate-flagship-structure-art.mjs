import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1536;
const HEIGHT = 1920;

const structures = [
  { defId: "rfalpha_ember_structure_forge_bastion", region: "emberhold", kind: "forge", palette: ["#070708", "#25100d", "#7d2112", "#ef5425", "#ffc267"] },
  { defId: "rfalpha_tide_structure_silent_beacon", region: "tidecall", kind: "beacon", palette: ["#03101b", "#082b3c", "#0b6274", "#24cbe7", "#dbfbff"] },
  { defId: "rfalpha_wood_structure_root_circle", region: "ironwood", kind: "roots", palette: ["#07100a", "#172718", "#304b25", "#7c9844", "#efc66e"] },
  { defId: "rfalpha_void_structure_hollow_obelisk", region: "voidborn", kind: "obelisk", palette: ["#030207", "#130b23", "#31145a", "#7a37db", "#e6a5ff"] },
  { defId: "rfalpha_forest_structure_ancestral_den", region: "florestia", kind: "den", palette: ["#06120a", "#10331b", "#176336", "#51a85a", "#e5c76b"] },
  { defId: "rfalpha_storm_structure_first_thunder", region: "tempestade", kind: "tower", palette: ["#040c19", "#0b2145", "#174a8a", "#3aa1ff", "#e6f6ff"] },
];

function defs(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${base}"/><stop offset=".58" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="${hi}" stop-opacity=".9"/><stop offset=".28" stop-color="${accent}" stop-opacity=".46"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>
    <linearGradient id="stone" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${deep}"/><stop offset=".45" stop-color="${mid}"/><stop offset="1" stop-color="${base}"/></linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
    <filter id="glowFx"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`;
}

function stars(c) {
  const [, , , accent, hi] = c.palette;
  return Array.from({ length: 34 }, (_, i) => {
    const x = 70 + ((i * 197) % 1390);
    const y = 105 + ((i * 307) % 920);
    const r = 2 + (i % 5);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 3 ? accent : hi}" opacity="${0.12 + (i % 4) * 0.05}"/>`;
  }).join("");
}

function runeRing(c, cy = 970, radius = 420) {
  const [, , , accent, hi] = c.palette;
  const marks = Array.from({ length: 16 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 16;
    const x = 768 + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    const rot = (i * 360) / 16 + 90;
    return `<path d="M-11 15 L0 -17 L11 15 M-7 3 H7" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})" fill="none" stroke="${hi}" stroke-width="5" opacity=".24"/>`;
  }).join("");
  return `<circle cx="768" cy="${cy}" r="${radius}" fill="none" stroke="${accent}" stroke-width="8" opacity=".18"/><circle cx="768" cy="${cy}" r="${radius - 44}" fill="none" stroke="${hi}" stroke-width="3" opacity=".12"/>${marks}`;
}

function forge(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `${runeRing(c, 1030, 470)}
  <ellipse cx="768" cy="1020" rx="600" ry="650" fill="url(#glow)" opacity=".38"/>
  <path d="M80 1760 L190 1430 L315 1370 L345 770 L505 650 L540 380 L670 535 L768 285 L866 535 L996 380 L1030 650 L1190 770 L1220 1370 L1345 1430 L1456 1760Z" fill="${base}" stroke="${accent}" stroke-width="18"/>
  <path d="M315 1370 L345 770 L505 650 L540 380 L670 535 L768 285 L866 535 L996 380 L1030 650 L1190 770 L1220 1370" fill="url(#stone)" opacity=".96"/>
  <path d="M618 1420 L618 950 Q768 785 918 950 L918 1420Z" fill="#050405" stroke="${hi}" stroke-width="15" opacity=".95"/>
  <path d="M664 1400 L664 1004 Q768 905 872 1004 L872 1400Z" fill="${accent}" opacity=".26" filter="url(#glowFx)"/>
  ${[430, 1106].map((x) => `<rect x="${x}" y="820" width="86" height="430" rx="12" fill="${mid}" stroke="${accent}" stroke-width="10"/><path d="M${x + 16} 1135 H${x + 70} M${x + 16} 1050 H${x + 70} M${x + 16} 965 H${x + 70}" stroke="${hi}" stroke-width="9" opacity=".7"/>`).join("")}
  <path d="M0 1630 C290 1510 490 1640 768 1550 C1030 1460 1265 1580 1536 1460 V1920 H0Z" fill="${mid}" opacity=".84"/>
  ${Array.from({ length: 18 }, (_, i) => `<circle cx="${100 + ((i * 239) % 1370)}" cy="${1050 + ((i * 173) % 720)}" r="${5 + i % 5}" fill="${i % 2 ? accent : hi}" opacity=".42"/>`).join("")}`;
}

function beacon(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `${runeRing(c, 850, 430)}
  <ellipse cx="768" cy="760" rx="620" ry="580" fill="url(#glow)" opacity=".36"/>
  <path d="M0 1510 C260 1430 420 1560 690 1490 C990 1410 1190 1538 1536 1420 V1920 H0Z" fill="${base}"/>
  <path d="M120 1510 C400 1450 610 1580 850 1514 C1110 1442 1300 1520 1536 1480" fill="none" stroke="${accent}" stroke-width="18" opacity=".48"/>
  <path d="M465 1510 L555 1310 L602 620 L686 455 L718 250 H818 L850 455 L934 620 L980 1310 L1070 1510Z" fill="url(#stone)" stroke="${accent}" stroke-width="13"/>
  <path d="M650 690 L768 540 L886 690 L846 1250 H690Z" fill="${base}" opacity=".8"/>
  <circle cx="768" cy="462" r="86" fill="${accent}" opacity=".4" filter="url(#glowFx)"/><circle cx="768" cy="462" r="38" fill="${hi}" filter="url(#glowFx)"/>
  <path d="M768 510 V1120" stroke="${hi}" stroke-width="12" opacity=".4"/>
  ${[1320, 1430, 1540, 1650].map((y, idx) => `<ellipse cx="768" cy="${y}" rx="${390 + idx * 115}" ry="${55 + idx * 14}" fill="none" stroke="${accent}" stroke-width="${10 - idx}" opacity="${0.38 - idx * 0.06}"/>`).join("")}`;
}

function roots(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="768" cy="980" rx="650" ry="760" fill="url(#glow)" opacity=".24"/>${runeRing(c, 1050, 490)}
  <path d="M55 1910 C120 1610 174 1430 334 1278 C450 1168 512 1000 498 760 C482 485 610 280 768 185 C926 280 1054 485 1038 760 C1024 1000 1086 1168 1202 1278 C1362 1430 1416 1610 1481 1910" fill="none" stroke="${mid}" stroke-width="170" stroke-linecap="round" opacity=".98"/>
  <path d="M116 1860 C270 1600 360 1500 540 1430 M1420 1860 C1266 1600 1176 1500 996 1430 M280 1920 C398 1640 520 1600 628 1490 M1256 1920 C1138 1640 1016 1600 908 1490" fill="none" stroke="${deep}" stroke-width="82" stroke-linecap="round"/>
  <path d="M468 800 C510 560 620 420 768 314 C916 420 1026 560 1068 800" fill="none" stroke="${accent}" stroke-width="34" opacity=".74"/>
  <circle cx="768" cy="1020" r="270" fill="${base}" stroke="${hi}" stroke-width="12" opacity=".9"/>
  <path d="M768 790 L850 1008 L1038 1090 L850 1172 L768 1390 L686 1172 L498 1090 L686 1008Z" fill="${accent}" opacity=".44" filter="url(#glowFx)"/>
  ${Array.from({ length: 28 }, (_, i) => `<circle cx="${80 + ((i * 181) % 1390)}" cy="${350 + ((i * 257) % 1320)}" r="${4 + i % 7}" fill="${i % 3 ? accent : hi}" opacity=".28"/>`).join("")}`;
}

function obelisk(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `${runeRing(c, 940, 500)}<circle cx="768" cy="650" r="430" fill="url(#glow)" opacity=".34"/><circle cx="768" cy="650" r="285" fill="${base}" stroke="${accent}" stroke-width="24" opacity=".98"/>
  <path d="M598 1640 L650 455 L768 245 L886 455 L938 1640Z" fill="url(#stone)" stroke="${accent}" stroke-width="15"/>
  <path d="M708 1430 L728 590 L768 485 L808 590 L828 1430Z" fill="#000" stroke="${hi}" stroke-width="9" opacity=".95"/>
  <path d="M768 500 L768 1430" stroke="${accent}" stroke-width="24" opacity=".18" filter="url(#glowFx)"/>
  <path d="M0 1590 C250 1470 510 1580 768 1520 C1020 1460 1290 1575 1536 1460 V1920 H0Z" fill="${mid}" opacity=".62"/>
  ${Array.from({ length: 16 }, (_, i) => `<path d="M${180 + ((i * 173) % 1220)} ${300 + ((i * 249) % 1080)} l${i % 2 ? 44 : -38} ${65 + i % 5 * 20}" stroke="${i % 3 ? accent : hi}" stroke-width="${4 + i % 4}" opacity=".22"/>`).join("")}`;
}

function den(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="768" cy="990" rx="650" ry="760" fill="url(#glow)" opacity=".22"/>${runeRing(c, 1050, 460)}
  <path d="M0 1920 V920 C180 720 310 730 390 540 C520 720 596 538 768 390 C940 538 1016 720 1146 540 C1226 730 1356 720 1536 920 V1920Z" fill="${mid}" opacity=".95"/>
  <path d="M250 1920 C300 1450 450 1160 768 870 C1086 1160 1236 1450 1286 1920Z" fill="${base}" stroke="${accent}" stroke-width="22"/>
  <path d="M410 1920 C440 1520 560 1315 768 1130 C976 1315 1096 1520 1126 1920Z" fill="#020604" opacity=".96"/>
  <path d="M768 920 L850 1015 L952 1030 L890 1110 L914 1210 L812 1180 L768 1270 L724 1180 L622 1210 L646 1110 L584 1030 L686 1015Z" fill="${hi}" opacity=".54" filter="url(#glowFx)"/>
  ${[385, 1151].map((x, idx) => `<g transform="translate(${x} 1260)"><path d="M0 260 V0" stroke="${deep}" stroke-width="54"/><path d="M-76 24 L0 -90 L76 24 L40 104 H-40Z" fill="${deep}" stroke="${hi}" stroke-width="10"/><circle cx="0" cy="40" r="18" fill="${accent}"/></g>`).join("")}
  ${Array.from({ length: 30 }, (_, i) => `<circle cx="${55 + ((i * 211) % 1430)}" cy="${310 + ((i * 229) % 1330)}" r="${3 + i % 6}" fill="${i % 3 ? accent : hi}" opacity=".3"/>`).join("")}`;
}

function tower(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `${runeRing(c, 900, 450)}<ellipse cx="768" cy="760" rx="640" ry="620" fill="url(#glow)" opacity=".24"/>
  <path d="M0 1450 C260 1300 480 1430 704 1340 C965 1235 1180 1365 1536 1190 V1920 H0Z" fill="#dcecff" opacity=".10"/>
  <path d="M520 1680 L590 1320 L625 635 L700 490 L730 225 H806 L836 490 L911 635 L946 1320 L1016 1680Z" fill="url(#stone)" stroke="${accent}" stroke-width="14"/>
  <path d="M674 1170 L690 705 L768 575 L846 705 L862 1170Z" fill="${base}" opacity=".76"/>
  <path d="M768 235 V35" stroke="${hi}" stroke-width="18"/><circle cx="768" cy="210" r="44" fill="${hi}" filter="url(#glowFx)"/>
  <path d="M768 35 L660 270 L750 250 L640 550 M768 35 L874 270 L790 250 L920 540 M768 210 L525 460 M768 210 L1012 448" fill="none" stroke="${hi}" stroke-width="19" opacity=".72" filter="url(#glowFx)"/>
  <path d="M80 1510 C380 1400 520 1540 768 1460 C1010 1380 1210 1490 1456 1375" fill="none" stroke="${accent}" stroke-width="24" opacity=".25"/>`;
}

function scene(c) {
  const renderer = { forge, beacon, roots, obelisk, den, tower }[c.kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${defs(c)}
    <rect width="1536" height="1920" fill="url(#sky)"/>
    ${stars(c)}
    ${renderer(c)}
    <rect x="26" y="26" width="1484" height="1868" rx="52" fill="none" stroke="${c.palette[4]}" stroke-width="5" opacity=".08"/>
  </svg>`;
}

for (const structure of structures) {
  const path = resolve(`public/art/cards/flagship/${structure.region}/${structure.defId}.webp`);
  await mkdir(dirname(path), { recursive: true });
  await sharp(Buffer.from(scene(structure)))
    .webp({ quality: 88, effort: 5, smartSubsample: true })
    .toFile(path);
}

console.log(`FLAGSHIP STRUCTURE ART: generated ${structures.length} deterministic ${WIDTH}x${HEIGHT} WebP masters`);
