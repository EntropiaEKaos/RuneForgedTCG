import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1536;
const HEIGHT = 1920;

const rituals = [
  { defId: "rfalpha_ember_ritual_red_rite", region: "emberhold", kind: "ember", palette: ["#070506", "#34100b", "#9f2914", "#ff5a24", "#ffd067"] },
  { defId: "rfalpha_tide_ritual_memory_tide", region: "tidecall", kind: "tide", palette: ["#03101a", "#0a3043", "#087188", "#26d3ea", "#e4fdff"] },
  { defId: "rfalpha_wood_ritual_ancient_roots", region: "ironwood", kind: "wood", palette: ["#071009", "#21331d", "#4d6730", "#9db54e", "#f0cf72"] },
  { defId: "rfalpha_void_ritual_emptiness", region: "voidborn", kind: "void", palette: ["#040207", "#180c2b", "#47217c", "#9b46f0", "#f0b6ff"] },
  { defId: "rfalpha_forest_ritual_green_moon", region: "florestia", kind: "forest", palette: ["#061109", "#123821", "#1c7040", "#58bd62", "#e7cf71"] },
  { defId: "rfalpha_storm_ritual_eye_of_storm", region: "tempestade", kind: "storm", palette: ["#040b18", "#102957", "#1e62a9", "#49afff", "#eaf9ff"] },
];

function defs(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${base}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
    <radialGradient id="mana"><stop offset="0" stop-color="${hi}" stop-opacity=".98"/><stop offset=".3" stop-color="${accent}" stop-opacity=".72"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="28"/></filter>
  </defs>`;
}

function particles(c, count = 34) {
  const [, , , accent, hi] = c.palette;
  return Array.from({ length: count }, (_, i) => {
    const x = 60 + ((i * 211) % 1420);
    const y = 120 + ((i * 337) % 1600);
    const r = 3 + (i % 6);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 3 ? accent : hi}" opacity="${0.12 + (i % 4) * 0.05}"/>`;
  }).join("");
}

function ritualRing(c, cy = 1050, radius = 430) {
  const [, , , accent, hi] = c.palette;
  const glyphs = Array.from({ length: 18 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 18;
    const x = 768 + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    const rot = (i * 360) / 18 + 90;
    return `<path d="M-12 18 L0 -20 L12 18 M-8 4 H8" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)})" fill="none" stroke="${hi}" stroke-width="5" opacity=".34"/>`;
  }).join("");
  return `<circle cx="768" cy="${cy}" r="${radius}" fill="none" stroke="${accent}" stroke-width="11" opacity=".34"/><circle cx="768" cy="${cy}" r="${radius - 58}" fill="none" stroke="${hi}" stroke-width="4" opacity=".2"/>${glyphs}`;
}

function ember(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `${ritualRing(c, 1110, 455)}
    <ellipse cx="768" cy="1060" rx="610" ry="650" fill="url(#mana)" opacity=".3"/>
    <path d="M420 1570 C350 1380 470 1260 548 1120 C630 972 582 850 690 702 C730 646 752 574 768 490 C784 574 806 646 846 702 C954 850 906 972 988 1120 C1066 1260 1186 1380 1116 1570Z" fill="${accent}" opacity=".2" filter="url(#soft)"/>
    <path d="M566 1470 C526 1320 632 1196 654 1075 C680 930 646 832 768 670 C890 832 856 930 882 1075 C904 1196 1010 1320 970 1470Z" fill="${mid}" stroke="${hi}" stroke-width="15"/>
    <path d="M690 1325 C700 1190 740 1120 768 980 C796 1120 836 1190 846 1325Z" fill="${accent}" opacity=".72" filter="url(#glow)"/>
    <circle cx="768" cy="890" r="82" fill="${hi}" opacity=".9" filter="url(#glow)"/>
    ${Array.from({ length: 18 }, (_, i) => `<path d="M${110 + ((i * 239) % 1310)} ${1760 - ((i * 83) % 760)} q${i % 2 ? 34 : -28} -70 ${i % 3 ? 12 : -18} -140" fill="none" stroke="${i % 2 ? accent : hi}" stroke-width="${6 + i % 4}" opacity=".35"/>`).join("")}`;
}

function tide(c) {
  const [base, , deep, accent, hi] = c.palette;
  return `${ritualRing(c, 1035, 445)}
    <ellipse cx="768" cy="930" rx="590" ry="600" fill="url(#mana)" opacity=".24"/>
    <circle cx="768" cy="830" r="118" fill="${deep}" stroke="${hi}" stroke-width="14" opacity=".95"/>
    <circle cx="768" cy="830" r="66" fill="${accent}" opacity=".8" filter="url(#glow)"/>
    ${[0,1,2,3].map((i) => `<path d="M${60 - i * 30} ${1300 + i * 105} C330 ${1110 + i * 90} 530 ${1430 + i * 55} 768 ${1280 + i * 76} C1010 ${1110 + i * 78} 1240 ${1370 + i * 62} ${1540 + i * 20} ${1175 + i * 88}" fill="none" stroke="${i % 2 ? hi : accent}" stroke-width="${28 - i * 5}" opacity="${0.48 - i * 0.07}"/>`).join("")}
    <path d="M768 955 C650 1085 648 1222 768 1328 C888 1222 886 1085 768 955Z" fill="${accent}" opacity=".34"/>
    ${Array.from({ length: 12 }, (_, i) => `<ellipse cx="${280 + ((i * 173) % 980)}" cy="${410 + ((i * 149) % 980)}" rx="${34 + i % 3 * 12}" ry="${14 + i % 3 * 6}" fill="none" stroke="${hi}" stroke-width="5" opacity=".2"/>`).join("")}
    <rect x="588" y="1540" width="360" height="170" rx="22" fill="${base}" stroke="${accent}" stroke-width="8" opacity=".78"/><path d="M650 1592 H886 M650 1642 H840" stroke="${hi}" stroke-width="8" opacity=".5"/>`;
}

function wood(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `${ritualRing(c, 1080, 455)}
    <ellipse cx="768" cy="1010" rx="610" ry="650" fill="url(#mana)" opacity=".21"/>
    ${[-1,1].map((dir) => `<path d="M768 1480 C${768 + dir * 70} 1320 ${768 + dir * 260} 1270 ${768 + dir * 350} 1100 C${768 + dir * 420} 968 ${768 + dir * 390} 790 ${768 + dir * 470} 630" fill="none" stroke="${mid}" stroke-width="72" stroke-linecap="round" opacity=".9"/>`).join("")}
    ${[-1,1].map((dir) => `<path d="M768 1490 C${768 + dir * 80} 1328 ${768 + dir * 240} 1278 ${768 + dir * 330} 1110" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round" opacity=".7" filter="url(#glow)"/>`).join("")}
    <path d="M768 535 C650 690 664 850 768 980 C872 850 886 690 768 535Z" fill="${deep}" stroke="${hi}" stroke-width="13"/>
    <path d="M768 610 C710 716 724 805 768 865 C812 805 826 716 768 610Z" fill="${accent}" opacity=".72" filter="url(#glow)"/>
    <circle cx="768" cy="1120" r="210" fill="${base}" stroke="${hi}" stroke-width="10" opacity=".92"/>
    <path d="M768 940 L830 1068 L970 1120 L830 1172 L768 1300 L706 1172 L566 1120 L706 1068Z" fill="${accent}" opacity=".48"/>
    ${Array.from({ length: 26 }, (_, i) => `<circle cx="${130 + ((i * 197) % 1280)}" cy="${430 + ((i * 241) % 1280)}" r="${4 + i % 6}" fill="${i % 3 ? accent : hi}" opacity=".26"/>`).join("")}`;
}

function voidRitual(c) {
  const [base, , deep, accent, hi] = c.palette;
  return `${ritualRing(c, 1040, 465)}
    <ellipse cx="768" cy="970" rx="620" ry="660" fill="url(#mana)" opacity=".24"/>
    <circle cx="768" cy="900" r="270" fill="${base}" stroke="${accent}" stroke-width="22" opacity=".98"/>
    <circle cx="768" cy="900" r="158" fill="#000" stroke="${hi}" stroke-width="8" opacity=".98"/>
    ${Array.from({ length: 12 }, (_, i) => { const x = 150 + ((i * 247) % 1240); const y = 350 + ((i * 173) % 1050); return `<path d="M${x} ${y} C${x + (x < 768 ? 180 : -180)} ${y + 90} ${x < 768 ? 610 : 926} ${820 + i * 10} 768 900" fill="none" stroke="${i % 2 ? accent : hi}" stroke-width="${7 + i % 4}" opacity=".36"/>`; }).join("")}
    <path d="M610 1450 L674 1240 L768 1170 L862 1240 L926 1450 L842 1630 H694Z" fill="${deep}" stroke="${accent}" stroke-width="12" opacity=".88"/>
    ${Array.from({ length: 9 }, (_, i) => `<rect x="${500 + i * 64}" y="${1510 - (i % 3) * 55}" width="32" height="46" transform="rotate(${(i - 4) * 9} ${516 + i * 64} ${1533 - (i % 3) * 55})" fill="${hi}" opacity=".18"/>`).join("")}`;
}

function forest(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `${ritualRing(c, 1110, 450)}
    <ellipse cx="768" cy="1040" rx="620" ry="660" fill="url(#mana)" opacity=".2"/>
    <circle cx="768" cy="545" r="205" fill="${accent}" opacity=".24" filter="url(#glow)"/>
    <circle cx="768" cy="545" r="154" fill="${hi}" opacity=".88"/>
    <circle cx="835" cy="495" r="154" fill="${base}" opacity=".94"/>
    ${[420,600,768,936,1116].map((x, i) => `<g transform="translate(${x} ${1350 + (i % 2) * 45})"><circle r="74" fill="${deep}" stroke="${hi}" stroke-width="8" opacity=".9"/><circle cy="-54" r="28" fill="${accent}"/><circle cx="-46" cy="-34" r="19" fill="${accent}"/><circle cx="46" cy="-34" r="19" fill="${accent}"/></g>`).join("")}
    <path d="M180 1710 C340 1500 488 1640 620 1510 C742 1390 820 1390 940 1515 C1080 1660 1236 1495 1360 1690" fill="none" stroke="${mid}" stroke-width="82" stroke-linecap="round" opacity=".72"/>
    ${Array.from({ length: 32 }, (_, i) => `<circle cx="${75 + ((i * 223) % 1390)}" cy="${280 + ((i * 271) % 1400)}" r="${3 + i % 7}" fill="${i % 3 ? accent : hi}" opacity=".3"/>`).join("")}`;
}

function storm(c) {
  const [base, , deep, accent, hi] = c.palette;
  return `${ritualRing(c, 1010, 455)}
    <ellipse cx="768" cy="930" rx="640" ry="650" fill="url(#mana)" opacity=".22"/>
    ${[0,1,2].map((i) => `<ellipse cx="768" cy="930" rx="${520 - i * 120}" ry="${360 - i * 80}" fill="none" stroke="${i % 2 ? hi : accent}" stroke-width="${34 - i * 8}" opacity="${0.22 + i * 0.08}" transform="rotate(${i * 22 - 18} 768 930)"/>`).join("")}
    <circle cx="768" cy="930" r="118" fill="${base}" stroke="${hi}" stroke-width="12" opacity=".96"/>
    <circle cx="768" cy="930" r="58" fill="${accent}" opacity=".66" filter="url(#glow)"/>
    <path d="M345 380 L585 715 L520 740 L718 945 M1190 330 L956 690 L1026 714 L818 935 M250 1190 L535 1080 M1286 1180 L1002 1075" fill="none" stroke="${hi}" stroke-width="25" opacity=".64" filter="url(#glow)"/>
    <path d="M0 1630 C260 1490 480 1620 720 1535 C1010 1430 1250 1580 1536 1410 V1920 H0Z" fill="${deep}" opacity=".42"/>`;
}

function scene(c) {
  const renderer = { ember, tide, wood, void: voidRitual, forest, storm }[c.kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${defs(c)}
    <rect width="1536" height="1920" fill="url(#bg)"/>
    ${particles(c)}
    ${renderer(c)}
    <rect x="26" y="26" width="1484" height="1868" rx="52" fill="none" stroke="${c.palette[4]}" stroke-width="5" opacity=".08"/>
  </svg>`;
}

for (const ritual of rituals) {
  const path = resolve(`public/art/cards/flagship/${ritual.region}/${ritual.defId}.webp`);
  await mkdir(dirname(path), { recursive: true });
  await sharp(Buffer.from(scene(ritual)))
    .webp({ quality: 88, effort: 5, smartSubsample: true })
    .toFile(path);
}

console.log(`FLAGSHIP RITUAL ART: generated ${rituals.length} deterministic ${WIDTH}x${HEIGHT} WebP masters`);
