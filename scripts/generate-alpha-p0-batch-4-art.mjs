import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1536;
const HEIGHT = 1920;

const masters = [
  { defId: "storm_lightning", region: "tempestade", kind: "lightning", palette: ["#050916", "#152748", "#324f87", "#78c9ff", "#f4f8ff"] },
  { defId: "storm_sky_sentinel", region: "tempestade", kind: "sentinel", palette: ["#060a17", "#172a4d", "#365886", "#78c7ff", "#f1d58a"] },
  { defId: "storm_strikecaller", region: "tempestade", kind: "strikecaller", palette: ["#050817", "#182748", "#4b4188", "#8f7cff", "#edf7ff"] },
  { defId: "tide_sprite", region: "tidecall", kind: "sprite", palette: ["#04131d", "#082c3c", "#0d6170", "#52d7e8", "#f2fbff"] },
  { defId: "void_drain", region: "voidborn", kind: "drain", palette: ["#080711", "#17132e", "#25215a", "#b03fd0", "#e5e4f4"] },
];

function defs({ palette }) {
  const [base, mid, deep, accent, hi] = palette;
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${base}"/><stop offset=".54" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
    <radialGradient id="halo"><stop stop-color="${hi}" stop-opacity=".72"/><stop offset=".28" stop-color="${accent}" stop-opacity=".28"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>
    <linearGradient id="lit" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${hi}"/><stop offset=".4" stop-color="${accent}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="52"/></filter>
  </defs>`;
}

function motes({ palette }, count = 42) {
  const [, , , accent, hi] = palette;
  return Array.from({ length: count }, (_, i) => {
    const x = 52 + ((i * 239) % 1430);
    const y = 60 + ((i * 353) % 1770);
    const r = 2 + (i % 6);
    const opacity = (0.08 + (i % 5) * 0.045).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 4 ? accent : hi}" opacity="${opacity}"/>`;
  }).join("");
}

function cloudFloor(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<g opacity=".97">
    <ellipse cx="190" cy="1600" rx="330" ry="190" fill="${mid}"/><ellipse cx="585" cy="1650" rx="390" ry="215" fill="${deep}"/><ellipse cx="1040" cy="1595" rx="440" ry="225" fill="${mid}"/><ellipse cx="1430" cy="1670" rx="350" ry="195" fill="${deep}"/>
    <path d="M0 1710 C330 1640 590 1778 900 1695 C1190 1620 1370 1715 1536 1665 V1920 H0Z" fill="${base}"/>
    <path d="M75 1575 C365 1515 640 1640 910 1565 C1175 1490 1375 1555 1490 1510" fill="none" stroke="${hi}" stroke-width="9" opacity=".2"/>
    <path d="M90 1480 C350 1410 605 1530 845 1450 C1110 1365 1320 1450 1475 1395" fill="none" stroke="${accent}" stroke-width="12" opacity=".17"/>
  </g>`;
}

function lightning(c) {
  const [, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="770" cy="900" rx="650" ry="760" fill="url(#halo)" opacity=".2"/>
    <path d="M130 410 C380 240 590 350 780 230 C1010 85 1260 270 1460 165" fill="none" stroke="${deep}" stroke-width="130" stroke-linecap="round" opacity=".82"/>
    <path d="M260 545 C495 405 645 500 805 420 C1020 310 1175 415 1375 320" fill="none" stroke="${mid}" stroke-width="82" stroke-linecap="round" opacity=".9"/>
    <path d="M810 300 L655 695 L770 665 L570 1110 L710 1060 L505 1490" fill="none" stroke="${hi}" stroke-width="42" stroke-linejoin="round" filter="url(#glow)"/>
    <path d="M800 310 L670 690 L790 660 L600 1100 L725 1050 L530 1470" fill="none" stroke="${accent}" stroke-width="18" stroke-linejoin="round"/>
    <ellipse cx="515" cy="1490" rx="250" ry="72" fill="${accent}" opacity=".16" filter="url(#soft)"/>
    <path d="M395 1480 Q515 1405 640 1480 Q520 1545 395 1480Z" fill="${deep}" stroke="${accent}" stroke-width="10"/>
    ${motes(c, 34)}${cloudFloor(c)}`;
}

function sentinel(c) {
  const [, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="795" cy="845" rx="650" ry="730" fill="url(#halo)" opacity=".23"/>
    <path d="M215 1170 L395 770 L650 870 L575 1285Z" fill="${deep}" stroke="${accent}" stroke-width="18" opacity=".9"/>
    <path d="M1315 1170 L1135 770 L880 870 L960 1285Z" fill="${deep}" stroke="${accent}" stroke-width="18" opacity=".9"/>
    <circle cx="770" cy="625" r="112" fill="${mid}" stroke="${hi}" stroke-width="12"/>
    <path d="M640 740 L900 740 L965 1235 L580 1235Z" fill="url(#lit)" stroke="${accent}" stroke-width="20"/>
    <path d="M620 850 L405 1070 M920 850 L1135 1070" stroke="${deep}" stroke-width="76" stroke-linecap="round"/>
    <path d="M680 1210 L610 1505 M860 1210 L935 1505" stroke="${deep}" stroke-width="78" stroke-linecap="round"/>
    <path d="M505 1560 H1040 L1190 1640 H350Z" fill="${mid}" stroke="${hi}" stroke-width="10" opacity=".78"/>
    <path d="M1110 400 L1110 1215" stroke="${hi}" stroke-width="26" stroke-linecap="round"/><path d="M1055 450 L1110 325 L1165 450Z" fill="${hi}" filter="url(#glow)"/>
    <path d="M210 520 l135 -150 l-10 110 l125 -80 M1310 510 l-135 -145 l15 110 l-120 -75" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round" filter="url(#glow)"/>
    ${motes(c, 38)}${cloudFloor(c)}`;
}

function strikecaller(c) {
  const [, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="770" cy="900" rx="670" ry="760" fill="url(#halo)" opacity=".24"/>
    <circle cx="770" cy="620" r="112" fill="${deep}" stroke="${hi}" stroke-width="12"/>
    <path d="M640 745 L900 745 L960 1225 L580 1225Z" fill="${mid}" stroke="${accent}" stroke-width="20"/>
    <path d="M640 860 L350 690 M900 860 L1190 690" stroke="${hi}" stroke-width="52" stroke-linecap="round"/>
    <path d="M675 1210 L585 1510 M865 1210 L960 1510" stroke="${deep}" stroke-width="74" stroke-linecap="round"/>
    <path d="M345 690 C230 525 170 420 125 275 M350 690 C240 760 170 875 120 1045 M1190 690 C1300 520 1360 410 1410 260 M1190 690 C1300 765 1365 875 1420 1050" fill="none" stroke="${accent}" stroke-width="25" stroke-linecap="round" filter="url(#glow)"/>
    <path d="M130 280 l95 55 l-72 48 l105 72 M120 1040 l110 -55 l-65 -65 l115 -50 M1410 265 l-95 55 l70 48 l-105 72 M1420 1045 l-110 -55 l65 -65 l-115 -50" fill="none" stroke="${hi}" stroke-width="15" stroke-linejoin="round"/>
    <ellipse cx="770" cy="955" rx="520" ry="300" fill="none" stroke="${accent}" stroke-width="12" opacity=".28"/>
    ${motes(c, 40)}${cloudFloor(c)}`;
}

function tideFloor(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<path d="M0 1540 C210 1420 410 1610 650 1490 C875 1380 1050 1540 1270 1465 C1390 1425 1470 1440 1536 1475 V1920 H0Z" fill="${mid}" opacity=".9"/>
    <path d="M0 1700 C330 1585 590 1770 900 1675 C1165 1590 1365 1710 1536 1650 V1920 H0Z" fill="${base}"/>
    <path d="M30 1540 C300 1440 530 1600 780 1510 C1040 1415 1265 1540 1500 1460" fill="none" stroke="${hi}" stroke-width="10" opacity=".24"/>
    <path d="M210 1600 q95 -145 190 0 M1080 1540 q90 -140 180 0" fill="none" stroke="${accent}" stroke-width="22" opacity=".42"/>
    <path d="M235 1570 q55 -115 110 0 M1130 1515 q55 -110 110 0" fill="none" stroke="${deep}" stroke-width="45" opacity=".8"/>`;
}

function sprite(c) {
  const [, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="770" cy="900" rx="650" ry="760" fill="url(#halo)" opacity=".27"/>
    <path d="M760 460 C610 610 560 770 625 920 C690 1070 620 1195 520 1320 C680 1280 750 1380 770 1480 C805 1375 890 1295 1030 1325 C920 1190 855 1070 920 915 C985 760 915 605 760 460Z" fill="url(#lit)" opacity=".85" stroke="${hi}" stroke-width="12"/>
    <circle cx="770" cy="700" r="120" fill="${deep}" stroke="${hi}" stroke-width="11" opacity=".85"/>
    <path d="M680 820 Q540 910 500 1090 M860 820 Q1005 915 1040 1090" fill="none" stroke="${accent}" stroke-width="48" stroke-linecap="round"/>
    <path d="M220 1080 C365 900 455 850 555 870 M1310 1080 C1160 900 1075 850 980 870" fill="none" stroke="${deep}" stroke-width="58" stroke-linecap="round" opacity=".8"/>
    ${Array.from({ length: 16 }, (_, i) => `<circle cx="${320 + ((i * 173) % 920)}" cy="${330 + ((i * 241) % 930)}" r="${12 + (i % 5) * 7}" fill="none" stroke="${i % 3 ? accent : hi}" stroke-width="7" opacity=".34"/>`).join("")}
    ${motes(c, 50)}${tideFloor(c)}`;
}

function voidFloor(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<path d="M0 1580 C300 1480 560 1665 850 1550 C1115 1450 1330 1600 1536 1510 V1920 H0Z" fill="${mid}" opacity=".88"/>
    <path d="M0 1730 C340 1640 600 1780 900 1700 C1180 1625 1370 1715 1536 1660 V1920 H0Z" fill="${base}"/>
    <path d="M160 1600 L310 1435 L455 1600 M1110 1580 L1260 1405 L1405 1580" fill="none" stroke="${deep}" stroke-width="42" opacity=".8"/>
    <path d="M170 1600 L310 1465 L450 1600 M1120 1580 L1260 1435 L1395 1580" fill="none" stroke="${hi}" stroke-width="7" opacity=".25"/>`;
}

function drain(c) {
  const [, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="790" cy="900" rx="680" ry="770" fill="url(#halo)" opacity=".24"/>
    <circle cx="800" cy="850" r="285" fill="${deep}" opacity=".72"/><circle cx="800" cy="850" r="215" fill="#05050a" stroke="${accent}" stroke-width="20"/><circle cx="800" cy="850" r="130" fill="${mid}" opacity=".38"/>
    <path d="M100 420 C365 340 470 610 650 710 M115 760 C350 720 470 815 620 845 M165 1110 C390 1150 495 1035 640 960 M1420 410 C1200 365 1110 600 955 710 M1435 790 C1210 760 1105 830 980 855 M1385 1160 C1190 1150 1075 1040 965 970" fill="none" stroke="${hi}" stroke-width="18" opacity=".58"/>
    <path d="M90 410 C360 315 470 590 660 720 M105 750 C350 695 470 805 635 850 M150 1120 C385 1175 505 1040 650 955 M1435 400 C1205 330 1100 585 940 720 M1450 780 C1215 730 1100 815 965 860 M1400 1170 C1185 1185 1060 1040 950 965" fill="none" stroke="${accent}" stroke-width="42" opacity=".4" filter="url(#glow)"/>
    <ellipse cx="800" cy="850" rx="430" ry="365" fill="none" stroke="${accent}" stroke-width="12" opacity=".3"/><ellipse cx="800" cy="850" rx="525" ry="455" fill="none" stroke="${hi}" stroke-width="6" opacity=".2"/>
    <path d="M760 600 l40 -110 l40 110 M760 1100 l40 110 l40 -110 M555 820 l-110 30 l110 35 M1040 820 l110 30 l-110 35" fill="none" stroke="${hi}" stroke-width="10" opacity=".5"/>
    ${motes(c, 46)}${voidFloor(c)}`;
}

const renderers = { lightning, sentinel, strikecaller, sprite, drain };

function svg(master) {
  const render = renderers[master.kind];
  if (!render) throw new Error(`Unknown Batch 4 renderer: ${master.kind}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${defs(master)}
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <rect x="54" y="54" width="1428" height="1812" rx="74" fill="none" stroke="${master.palette[4]}" stroke-width="6" opacity=".11"/>
    ${render(master)}
  </svg>`;
}

for (const master of masters) {
  const outputPath = resolve(`public/art/cards/alpha-p0/${master.region}/${master.defId}.webp`);
  await mkdir(dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(svg(master)))
    .resize(WIDTH, HEIGHT, { fit: "fill" })
    .webp({ quality: 88, effort: 5, smartSubsample: true })
    .toFile(outputPath);
}

console.log(`ALPHA P0 ART BATCH 4: generated ${masters.length} deterministic ${WIDTH}x${HEIGHT} WebP masters`);
