import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1536;
const HEIGHT = 1920;

const masters = [
  { defId: "forest_canopy_warden", region: "florestia", kind: "canopy", palette: ["#06110f", "#12382f", "#187867", "#45c8a9", "#f0cf68"] },
  { defId: "forest_cub", region: "florestia", kind: "cub", palette: ["#07120e", "#173a2d", "#28775b", "#59c88a", "#efcf72"] },
  { defId: "storm_dashbolt", region: "tempestade", kind: "dashbolt", palette: ["#070b18", "#17294b", "#384b86", "#8b78ff", "#eef7ff"] },
  { defId: "storm_eye", region: "tempestade", kind: "eye", palette: ["#060b18", "#182b4c", "#344f87", "#8e7cff", "#f1d98a"] },
  { defId: "storm_herald", region: "tempestade", kind: "herald", palette: ["#060a16", "#152846", "#345385", "#78c8ff", "#f2d88b"] },
];

function defs({ palette }) {
  const [base, mid, deep, accent, hi] = palette;
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${base}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
    <radialGradient id="halo"><stop stop-color="${hi}" stop-opacity=".75"/><stop offset=".3" stop-color="${accent}" stop-opacity=".28"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>
    <linearGradient id="lit" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${hi}"/><stop offset=".35" stop-color="${accent}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="44"/></filter>
  </defs>`;
}

function motes({ palette }, count = 44) {
  const [, , , accent, hi] = palette;
  return Array.from({ length: count }, (_, i) => {
    const x = 48 + ((i * 227) % 1440);
    const y = 72 + ((i * 347) % 1760);
    const r = 2 + (i % 6);
    const fill = i % 4 ? accent : hi;
    const opacity = (0.09 + (i % 5) * 0.045).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${opacity}"/>`;
  }).join("");
}

function forestFloor(c) {
  const [base, mid, deep, accent] = c.palette;
  return `<path d="M0 1570 C230 1470 470 1580 710 1510 C930 1445 1190 1555 1536 1435 V1920 H0Z" fill="${mid}" opacity=".95"/>
    <path d="M0 1710 C290 1625 560 1770 875 1680 C1160 1600 1370 1715 1536 1650 V1920 H0Z" fill="${base}"/>
    <path d="M35 1625 C350 1515 640 1665 920 1560 C1195 1455 1390 1560 1500 1510" fill="none" stroke="${accent}" stroke-width="10" opacity=".24"/>
    <path d="M120 1660 q70 -120 140 0 M335 1640 q78 -155 155 0 M1080 1600 q75 -135 150 0 M1270 1580 q65 -110 130 0" fill="none" stroke="${deep}" stroke-width="26" opacity=".72"/>`;
}

function cloudFloor(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<g opacity=".96">
    <ellipse cx="230" cy="1610" rx="330" ry="185" fill="${mid}"/><ellipse cx="610" cy="1660" rx="390" ry="210" fill="${deep}"/><ellipse cx="1060" cy="1600" rx="440" ry="220" fill="${mid}"/><ellipse cx="1430" cy="1680" rx="330" ry="190" fill="${deep}"/>
    <path d="M0 1710 C330 1645 590 1775 905 1695 C1190 1620 1375 1715 1536 1670 V1920 H0Z" fill="${base}"/>
    <path d="M80 1595 C390 1530 655 1660 920 1570 C1175 1488 1375 1555 1490 1515" fill="none" stroke="${hi}" stroke-width="9" opacity=".18"/>
    <path d="M60 1490 C330 1425 570 1545 835 1460 C1080 1380 1330 1465 1480 1415" fill="none" stroke="${accent}" stroke-width="11" opacity=".16"/>
  </g>`;
}

function canopy(c) {
  const [, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="770" cy="860" rx="660" ry="760" fill="url(#halo)" opacity=".22"/>
    <path d="M-80 430 C240 220 450 420 650 245 C850 70 1110 265 1610 75" fill="none" stroke="${deep}" stroke-width="120" stroke-linecap="round"/>
    <path d="M110 690 C340 480 510 600 690 430 M1420 620 C1190 450 1040 575 865 420" fill="none" stroke="${mid}" stroke-width="80" stroke-linecap="round"/>
    <path d="M655 620 Q770 500 885 620 L980 1080 Q890 1360 770 1450 Q645 1360 555 1080Z" fill="${deep}" stroke="${accent}" stroke-width="20"/>
    <circle cx="770" cy="540" r="120" fill="${mid}" stroke="${hi}" stroke-width="13"/>
    <path d="M720 470 Q620 350 515 330 M820 470 Q915 350 1030 325 M690 490 Q610 410 545 445 M850 490 Q930 405 1005 445" fill="none" stroke="${hi}" stroke-width="18" stroke-linecap="round" opacity=".78"/>
    <path d="M610 835 L365 1080 M930 835 L1175 1080" stroke="${accent}" stroke-width="64" stroke-linecap="round"/>
    <path d="M650 1260 L515 1535 M890 1260 L1030 1535" stroke="${deep}" stroke-width="82" stroke-linecap="round"/>
    <path d="M500 1530 L390 1595 M1040 1530 L1155 1595" stroke="${hi}" stroke-width="28" stroke-linecap="round"/>
    ${motes(c, 52)}${forestFloor(c)}`;
}

function cub(c) {
  const [, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="790" cy="980" rx="650" ry="730" fill="url(#halo)" opacity=".2"/>
    <path d="M240 430 C390 305 555 355 690 255 M1290 410 C1140 300 1000 350 865 250" fill="none" stroke="${deep}" stroke-width="72" stroke-linecap="round" opacity=".8"/>
    <ellipse cx="790" cy="1080" rx="330" ry="245" fill="${deep}" stroke="${accent}" stroke-width="18"/>
    <circle cx="515" cy="930" r="178" fill="${mid}" stroke="${hi}" stroke-width="13"/>
    <path d="M405 810 L450 655 L535 790 M555 790 L640 655 L668 830" fill="${deep}" stroke="${accent}" stroke-width="15"/>
    <ellipse cx="455" cy="925" rx="18" ry="26" fill="${hi}"/><ellipse cx="565" cy="925" rx="18" ry="26" fill="${hi}"/>
    <path d="M500 982 Q525 1010 555 980" fill="none" stroke="${hi}" stroke-width="12" stroke-linecap="round"/>
    <path d="M670 1180 L520 1480 M870 1210 L980 1490 M1015 1135 L1190 1425" stroke="${deep}" stroke-width="70" stroke-linecap="round"/>
    <path d="M490 1490 L390 1550 M955 1498 L1055 1545 M1170 1435 L1265 1480" stroke="${hi}" stroke-width="25" stroke-linecap="round"/>
    <path d="M1095 1040 Q1320 950 1370 770" fill="none" stroke="${accent}" stroke-width="52" stroke-linecap="round"/>
    ${motes(c, 46)}${forestFloor(c)}`;
}

function dashbolt(c) {
  const [, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="820" cy="930" rx="680" ry="760" fill="url(#halo)" opacity=".24"/>
    <path d="M80 1370 L1460 410" stroke="${accent}" stroke-width="210" opacity=".13" filter="url(#soft)"/>
    ${Array.from({ length: 18 }, (_, i) => `<path d="M${-40 + i * 95} ${1450 - i * 46} l${360 + (i % 4) * 80} -${240 + (i % 3) * 45}" stroke="${i % 3 ? accent : hi}" stroke-width="${8 + (i % 5) * 3}" opacity=".28"/>`).join("")}
    <circle cx="850" cy="675" r="105" fill="${deep}" stroke="${hi}" stroke-width="12"/>
    <path d="M760 785 L930 855 L850 1160 L665 1090Z" fill="url(#lit)" stroke="${accent}" stroke-width="18"/>
    <path d="M770 840 L520 1000 M900 870 L1160 705" stroke="${hi}" stroke-width="48" stroke-linecap="round"/>
    <path d="M710 1090 L445 1385 M835 1140 L1110 1370" stroke="${deep}" stroke-width="70" stroke-linecap="round"/>
    <path d="M430 1395 L285 1450 M1120 1375 L1270 1435" stroke="${hi}" stroke-width="30" stroke-linecap="round"/>
    <path d="M530 1180 L420 1280 L500 1270 L405 1400" fill="none" stroke="${hi}" stroke-width="22" filter="url(#glow)"/>
    ${motes(c, 34)}${cloudFloor(c)}`;
}

function eye(c) {
  const [, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="768" cy="900" rx="690" ry="770" fill="url(#halo)" opacity=".2"/>
    <ellipse cx="768" cy="900" rx="590" ry="410" fill="none" stroke="${deep}" stroke-width="150" opacity=".42"/>
    <ellipse cx="768" cy="900" rx="500" ry="340" fill="none" stroke="${accent}" stroke-width="36" opacity=".35"/>
    <ellipse cx="768" cy="900" rx="405" ry="275" fill="none" stroke="${hi}" stroke-width="14" opacity=".5"/>
    <circle cx="768" cy="690" r="112" fill="${deep}" stroke="${hi}" stroke-width="12"/>
    <path d="M650 815 L885 815 L945 1250 L590 1250Z" fill="${mid}" stroke="${accent}" stroke-width="20"/>
    <path d="M650 900 L410 1040 M885 900 L1125 1040" stroke="${deep}" stroke-width="70" stroke-linecap="round"/>
    <path d="M660 1240 L560 1515 M875 1240 L980 1515" stroke="${deep}" stroke-width="70" stroke-linecap="round"/>
    <path d="M515 540 C360 450 300 325 260 215 M1020 545 C1175 460 1240 325 1290 210" fill="none" stroke="${accent}" stroke-width="20" opacity=".7"/>
    <path d="M575 610 C420 555 360 470 310 365 M965 610 C1115 555 1185 470 1235 360" fill="none" stroke="${hi}" stroke-width="10" opacity=".72" filter="url(#glow)"/>
    ${motes(c, 36)}${cloudFloor(c)}`;
}

function herald(c) {
  const [, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="790" cy="830" rx="650" ry="720" fill="url(#halo)" opacity=".24"/>
    <path d="M250 980 Q360 530 705 760 L610 1130Z" fill="${deep}" stroke="${accent}" stroke-width="18" opacity=".92"/>
    <path d="M1280 980 Q1170 530 825 760 L925 1130Z" fill="${deep}" stroke="${accent}" stroke-width="18" opacity=".92"/>
    <circle cx="770" cy="610" r="112" fill="${mid}" stroke="${hi}" stroke-width="12"/>
    <path d="M650 730 L890 730 L960 1230 L575 1230Z" fill="url(#lit)" stroke="${accent}" stroke-width="20"/>
    <path d="M610 845 L380 1070 M930 845 L1160 1070" stroke="${deep}" stroke-width="72" stroke-linecap="round"/>
    <path d="M700 1220 L620 1500 M840 1220 L920 1500" stroke="${deep}" stroke-width="72" stroke-linecap="round"/>
    <path d="M1035 410 L1035 1220" stroke="${hi}" stroke-width="28" stroke-linecap="round"/>
    <path d="M975 455 L1035 330 L1095 455Z" fill="${hi}" filter="url(#glow)"/>
    <path d="M180 510 l170 -180 l-20 130 l150 -105 l-85 175 l150 -25 M1360 515 l-170 -180 l20 130 l-150 -105 l85 175 l-150 -25" fill="none" stroke="${accent}" stroke-width="21" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
    <path d="M280 1510 L520 1330 L770 1430 L1010 1325 L1280 1510 V1710 H280Z" fill="${mid}" stroke="${hi}" stroke-width="10" opacity=".85"/>
    ${motes(c, 34)}${cloudFloor(c)}`;
}

const renderers = { canopy, cub, dashbolt, eye, herald };

function svg(master) {
  const render = renderers[master.kind];
  if (!render) throw new Error(`Unknown Alpha P0 Batch 3 renderer: ${master.kind}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${defs(master)}
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <rect x="54" y="54" width="1428" height="1812" rx="72" fill="none" stroke="${master.palette[4]}" stroke-width="5" opacity=".13"/>
    ${render(master)}
  </svg>`;
}

for (const master of masters) {
  const output = resolve(`public/art/cards/alpha-p0/${master.region}/${master.defId}.webp`);
  await mkdir(dirname(output), { recursive: true });
  await sharp(Buffer.from(svg(master)))
    .resize(WIDTH, HEIGHT)
    .webp({ quality: 88, effort: 5, smartSubsample: true })
    .toFile(output);
}

console.log(`ALPHA P0 ART BATCH 3: generated ${masters.length} deterministic ${WIDTH}x${HEIGHT} WebP masters`);
