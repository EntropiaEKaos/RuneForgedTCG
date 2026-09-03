import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1536;
const HEIGHT = 1920;

const traps = [
  { defId: "rfalpha_ember_trap_ash_snare", region: "emberhold", kind: "ash", palette: ["#070506", "#2d0d09", "#8d2012", "#ff5227", "#ffd06a"] },
  { defId: "rfalpha_tide_trap_countercurrent", region: "tidecall", kind: "counter", palette: ["#03101a", "#082d40", "#0a6379", "#22c7e2", "#e1fbff"] },
  { defId: "rfalpha_wood_trap_emergency_bark", region: "ironwood", kind: "bark", palette: ["#071009", "#1c301b", "#49612f", "#8da84a", "#f2ce72"] },
  { defId: "rfalpha_void_trap_early_eclipse", region: "voidborn", kind: "eclipse", palette: ["#040207", "#170b2a", "#43206f", "#963de6", "#efb2ff"] },
  { defId: "rfalpha_forest_trap_pack_ambush", region: "florestia", kind: "ambush", palette: ["#061109", "#11371f", "#1b693b", "#4fb258", "#e6c96c"] },
  { defId: "rfalpha_storm_trap_crosswind", region: "tempestade", kind: "crosswind", palette: ["#040b18", "#0e2853", "#1d5f9d", "#42aaff", "#e9f8ff"] },
];

function defs(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${base}"/><stop offset=".56" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
    <radialGradient id="flash"><stop offset="0" stop-color="${hi}" stop-opacity=".96"/><stop offset=".24" stop-color="${accent}" stop-opacity=".68"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="30"/></filter>
  </defs>`;
}

function shards(c, count = 40) {
  const [, , , accent, hi] = c.palette;
  return Array.from({ length: count }, (_, i) => {
    const x = 50 + ((i * 233) % 1430);
    const y = 80 + ((i * 307) % 1710);
    const dx = 18 + (i % 6) * 9;
    const dy = 34 + (i % 5) * 17;
    return `<path d="M${x} ${y} l${i % 2 ? dx : -dx} ${dy}" stroke="${i % 3 ? accent : hi}" stroke-width="${3 + i % 5}" opacity="${0.11 + (i % 4) * 0.05}"/>`;
  }).join("");
}

function reactionSeal(c, cx = 768, cy = 980, radius = 350) {
  const [, , , accent, hi] = c.palette;
  const cuts = Array.from({ length: 12 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 12;
    const x1 = cx + Math.cos(a) * (radius - 35);
    const y1 = cy + Math.sin(a) * (radius - 35);
    const x2 = cx + Math.cos(a) * (radius + 65);
    const y2 = cy + Math.sin(a) * (radius + 65);
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${i % 2 ? hi : accent}" stroke-width="9" opacity=".34"/>`;
  }).join("");
  return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${accent}" stroke-width="13" opacity=".42"/><circle cx="${cx}" cy="${cy}" r="${radius - 62}" fill="none" stroke="${hi}" stroke-width="5" opacity=".18"/>${cuts}`;
}

function ash(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `${reactionSeal(c, 760, 1020, 370)}<ellipse cx="760" cy="1010" rx="610" ry="600" fill="url(#flash)" opacity=".26"/>
    <path d="M250 1470 L630 1140 L530 1040 L884 826 L824 710 L1290 430" fill="none" stroke="${hi}" stroke-width="36" stroke-linecap="round" opacity=".66" filter="url(#glow)"/>
    <path d="M240 1518 L640 1190 L590 1118 L926 920 L900 840 L1320 560" fill="none" stroke="${accent}" stroke-width="82" stroke-linecap="round" opacity=".22"/>
    <path d="M382 1640 C360 1430 500 1310 592 1234 C688 1155 708 1054 690 920 C814 1050 836 1175 784 1290 C728 1412 776 1538 888 1640Z" fill="${accent}" opacity=".34"/>
    <path d="M0 1660 C300 1510 520 1660 780 1570 C1035 1482 1260 1600 1536 1450 V1920 H0Z" fill="${mid}" opacity=".7"/>
    ${Array.from({ length: 28 }, (_, i) => `<circle cx="${90 + ((i * 211) % 1370)}" cy="${720 + ((i * 173) % 1000)}" r="${4 + i % 7}" fill="${i % 3 ? accent : hi}" opacity=".34"/>`).join("")}`;
}

function counter(c) {
  const [base, , deep, accent, hi] = c.palette;
  return `${reactionSeal(c, 768, 980, 365)}<ellipse cx="768" cy="965" rx="650" ry="590" fill="url(#flash)" opacity=".22"/>
    <path d="M-60 1260 C280 970 500 1180 760 940 C1000 720 1260 880 1600 560" fill="none" stroke="${accent}" stroke-width="96" opacity=".44"/>
    <path d="M1596 1340 C1260 1060 1038 1240 776 980 C548 756 290 890 -70 620" fill="none" stroke="${hi}" stroke-width="44" opacity=".56"/>
    <circle cx="768" cy="980" r="110" fill="${base}" stroke="${hi}" stroke-width="15"/><path d="M640 980 H896 M768 852 V1108" stroke="${accent}" stroke-width="22" opacity=".7"/>
    ${Array.from({ length: 15 }, (_, i) => `<ellipse cx="${220 + ((i * 151) % 1080)}" cy="${430 + ((i * 207) % 1120)}" rx="${32 + i % 4 * 10}" ry="${13 + i % 4 * 5}" fill="none" stroke="${i % 2 ? accent : hi}" stroke-width="5" opacity=".23"/>`).join("")}
    <path d="M0 1660 C280 1530 500 1620 730 1570 C1010 1508 1250 1600 1536 1490 V1920 H0Z" fill="${deep}" opacity=".35"/>`;
}

function bark(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `${reactionSeal(c, 760, 1030, 360)}<ellipse cx="760" cy="1010" rx="610" ry="620" fill="url(#flash)" opacity=".18"/>
    <path d="M768 340 C640 520 660 684 768 830 C876 684 896 520 768 340Z" fill="${deep}" stroke="${hi}" stroke-width="15"/>
    <path d="M768 620 C552 760 452 946 470 1210 C488 1460 608 1600 768 1695 C928 1600 1048 1460 1066 1210 C1084 946 984 760 768 620Z" fill="${mid}" stroke="${accent}" stroke-width="28"/>
    ${[-1,1].map((d) => `<path d="M768 770 C${768 + d*120} 910 ${768 + d*235} 980 ${768 + d*260} 1200 C${768 + d*270} 1360 ${768 + d*185} 1470 ${768 + d*80} 1550" fill="none" stroke="${deep}" stroke-width="72" stroke-linecap="round"/>`).join("")}
    <path d="M768 830 L850 1045 L1010 1110 L850 1185 L768 1420 L686 1185 L526 1110 L686 1045Z" fill="${hi}" opacity=".44" filter="url(#glow)"/>
    ${Array.from({ length: 24 }, (_, i) => `<path d="M${120 + ((i*197)%1300)} ${420 + ((i*251)%1250)} q${i%2?42:-42} ${55+i%5*13} ${i%3?18:-18} ${118+i%4*20}" fill="none" stroke="${i%3?accent:hi}" stroke-width="${4+i%5}" opacity=".22"/>`).join("")}`;
}

function eclipse(c) {
  const [base, , deep, accent, hi] = c.palette;
  return `${reactionSeal(c, 770, 985, 380)}<ellipse cx="770" cy="970" rx="620" ry="650" fill="url(#flash)" opacity=".2"/>
    <circle cx="770" cy="820" r="280" fill="${accent}" opacity=".28" filter="url(#soft)"/><circle cx="770" cy="820" r="220" fill="${hi}" opacity=".92"/><circle cx="860" cy="742" r="225" fill="${base}" opacity=".99"/>
    <path d="M130 1510 L585 1195 L540 1080 L930 905 L900 790 L1390 520" fill="none" stroke="${accent}" stroke-width="24" opacity=".64"/>
    <path d="M1360 1510 L970 1220 L1012 1110 L650 930 L682 830 L220 590" fill="none" stroke="${hi}" stroke-width="10" opacity=".38"/>
    ${Array.from({ length: 14 }, (_, i) => `<rect x="${300 + ((i*173)%930)}" y="${1060 + ((i*127)%590)}" width="${28+i%3*8}" height="${42+i%4*10}" transform="rotate(${(i-7)*8} ${320+((i*173)%930)} ${1080+((i*127)%590)})" fill="${i%2?accent:hi}" opacity=".18"/>`).join("")}
    <path d="M0 1700 C260 1570 540 1670 760 1600 C1030 1510 1270 1630 1536 1500 V1920 H0Z" fill="${deep}" opacity=".35"/>`;
}

function ambush(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `${reactionSeal(c, 768, 1020, 370)}<ellipse cx="768" cy="1000" rx="640" ry="620" fill="url(#flash)" opacity=".17"/>
    ${[-1,1].map((d) => `<path d="M768 1100 C${768+d*160} 970 ${768+d*310} 880 ${768+d*540} 810" fill="none" stroke="${mid}" stroke-width="118" stroke-linecap="round" opacity=".82"/>`).join("")}
    ${[-1,1].map((d) => `<path d="M768 1130 C${768+d*190} 1005 ${768+d*340} 930 ${768+d*590} 885" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round" opacity=".66"/>`).join("")}
    ${[390,570,768,966,1146].map((x, i) => `<g transform="translate(${x} ${1220 + (i%2)*95}) rotate(${(i-2)*14})"><path d="M0 -130 L78 -15 L54 120 L0 165 L-54 120 L-78 -15Z" fill="${deep}" stroke="${hi}" stroke-width="8"/><circle cx="-28" cy="5" r="12" fill="${accent}" filter="url(#glow)"/><circle cx="28" cy="5" r="12" fill="${accent}" filter="url(#glow)"/></g>`).join("")}
    <path d="M0 1740 C260 1500 400 1640 610 1510 C780 1405 942 1530 1110 1450 C1275 1370 1390 1430 1536 1330 V1920 H0Z" fill="${mid}" opacity=".62"/>
    ${Array.from({ length: 32 }, (_, i) => `<circle cx="${70 + ((i*229)%1390)}" cy="${360 + ((i*257)%1320)}" r="${3+i%7}" fill="${i%3?accent:hi}" opacity=".24"/>`).join("")}`;
}

function crosswind(c) {
  const [base, , deep, accent, hi] = c.palette;
  return `${reactionSeal(c, 770, 980, 360)}<ellipse cx="770" cy="960" rx="650" ry="600" fill="url(#flash)" opacity=".18"/>
    <path d="M-100 1430 C340 1090 565 1295 815 1030 C1040 792 1250 920 1640 600" fill="none" stroke="${hi}" stroke-width="66" opacity=".54"/>
    <path d="M1600 1460 C1250 1110 1040 1280 790 1020 C555 775 325 900 -100 560" fill="none" stroke="${accent}" stroke-width="42" opacity=".58"/>
    <path d="M250 390 L560 800 L500 825 L735 1060 M1280 370 L1005 750 L1068 780 L815 1048" fill="none" stroke="${hi}" stroke-width="22" opacity=".62" filter="url(#glow)"/>
    <circle cx="770" cy="1010" r="104" fill="${base}" stroke="${hi}" stroke-width="12"/><path d="M690 950 L850 1070 M850 950 L690 1070" stroke="${accent}" stroke-width="20"/>
    <path d="M0 1700 C300 1510 520 1660 760 1585 C1040 1495 1250 1600 1536 1430 V1920 H0Z" fill="${deep}" opacity=".32"/>`;
}

function scene(c) {
  const renderer = { ash, counter, bark, eclipse, ambush, crosswind }[c.kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${defs(c)}
    <rect width="1536" height="1920" fill="url(#bg)"/>
    ${shards(c)}
    ${renderer(c)}
    <rect x="26" y="26" width="1484" height="1868" rx="52" fill="none" stroke="${c.palette[4]}" stroke-width="5" opacity=".08"/>
  </svg>`;
}

for (const trap of traps) {
  const path = resolve(`public/art/cards/flagship/${trap.region}/${trap.defId}.webp`);
  await mkdir(dirname(path), { recursive: true });
  await sharp(Buffer.from(scene(trap)))
    .webp({ quality: 88, effort: 5, smartSubsample: true })
    .toFile(path);
}

console.log(`FLAGSHIP TRAP ART: generated ${traps.length} deterministic ${WIDTH}x${HEIGHT} WebP masters`);
