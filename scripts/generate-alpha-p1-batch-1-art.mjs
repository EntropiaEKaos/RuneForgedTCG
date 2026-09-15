import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1536;
const HEIGHT = 1920;
const palette = {
  base: "#120807",
  coal: "#26100d",
  basalt: "#3a1b16",
  ember: "#c63f1d",
  furnace: "#ff7a24",
  gold: "#e7b258",
  hot: "#fff0c2",
};

const masters = [
  { defId: "ember_duelist", region: "emberhold", kind: "duelist" },
  { defId: "ember_raider", region: "emberhold", kind: "raider" },
  { defId: "ember_herald", region: "emberhold", kind: "herald" },
  { defId: "ember_whelp", region: "emberhold", kind: "whelp" },
  { defId: "ember_zealot", region: "emberhold", kind: "zealot" },
];

function defs() {
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette.base}"/><stop offset=".55" stop-color="${palette.coal}"/><stop offset="1" stop-color="${palette.basalt}"/></linearGradient>
    <radialGradient id="halo"><stop stop-color="${palette.hot}" stop-opacity=".52"/><stop offset=".25" stop-color="${palette.furnace}" stop-opacity=".26"/><stop offset="1" stop-color="${palette.base}" stop-opacity="0"/></radialGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette.hot}"/><stop offset=".24" stop-color="${palette.gold}"/><stop offset=".55" stop-color="${palette.ember}"/><stop offset="1" stop-color="${palette.coal}"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="15" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="48"/></filter>
  </defs>`;
}

function sparks(count = 48) {
  return Array.from({ length: count }, (_, i) => {
    const x = 45 + ((i * 227) % 1445);
    const y = 55 + ((i * 347) % 1745);
    const r = 2 + (i % 5);
    const opacity = (0.11 + (i % 5) * 0.055).toFixed(2);
    const fill = i % 4 ? palette.furnace : palette.hot;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${opacity}"/>`;
  }).join("");
}

function basaltFloor() {
  return `<g>
    <path d="M0 1535 C280 1450 505 1600 760 1515 C1030 1425 1270 1570 1536 1475 V1920 H0Z" fill="${palette.basalt}"/>
    <path d="M0 1700 C310 1615 600 1775 900 1685 C1185 1600 1380 1720 1536 1660 V1920 H0Z" fill="${palette.base}"/>
    <path d="M130 1600 L330 1490 L520 1620 L720 1505 L930 1620 L1130 1490 L1380 1605" fill="none" stroke="${palette.ember}" stroke-width="10" opacity=".28"/>
    <path d="M220 1730 L360 1630 M640 1775 L760 1650 M1080 1750 L1200 1620" stroke="${palette.furnace}" stroke-width="8" opacity=".2"/>
  </g>`;
}

function duelist() {
  return `<ellipse cx="770" cy="900" rx="620" ry="760" fill="url(#halo)" opacity=".42"/>
    <circle cx="770" cy="610" r="105" fill="${palette.coal}" stroke="${palette.gold}" stroke-width="11"/>
    <path d="M640 730 L895 730 L945 1215 L590 1215Z" fill="${palette.basalt}" stroke="${palette.ember}" stroke-width="19"/>
    <path d="M635 825 L410 1065 M900 830 L1120 1035" stroke="${palette.coal}" stroke-width="68" stroke-linecap="round"/>
    <path d="M420 1050 L1125 465" stroke="url(#steel)" stroke-width="31" stroke-linecap="round" filter="url(#glow)"/>
    <path d="M1120 1035 L420 475" stroke="url(#steel)" stroke-width="31" stroke-linecap="round" filter="url(#glow)"/>
    <path d="M650 1200 L570 1510 M870 1200 L960 1510" stroke="${palette.coal}" stroke-width="70" stroke-linecap="round"/>
    <ellipse cx="770" cy="1510" rx="340" ry="68" fill="${palette.ember}" opacity=".12" filter="url(#soft)"/>
    <circle cx="520" cy="1170" r="92" fill="none" stroke="${palette.gold}" stroke-width="8" opacity=".28"/>
    ${sparks(42)}${basaltFloor()}`;
}

function raider() {
  return `<ellipse cx="760" cy="930" rx="700" ry="720" fill="url(#halo)" opacity=".28"/>
    <g transform="rotate(-18 760 920)">
      <circle cx="735" cy="650" r="96" fill="${palette.coal}" stroke="${palette.furnace}" stroke-width="11"/>
      <path d="M610 755 L850 720 L980 1120 L650 1190Z" fill="${palette.basalt}" stroke="${palette.ember}" stroke-width="20"/>
      <path d="M645 860 L360 1030 M875 825 L1080 945" stroke="${palette.coal}" stroke-width="72" stroke-linecap="round"/>
      <path d="M670 1160 L500 1450 M895 1115 L1055 1380" stroke="${palette.coal}" stroke-width="78" stroke-linecap="round"/>
      <path d="M255 1110 L1320 505" stroke="${palette.gold}" stroke-width="28" stroke-linecap="round"/>
      <path d="M1260 460 L1425 440 L1320 575Z" fill="${palette.hot}" stroke="${palette.furnace}" stroke-width="12" filter="url(#glow)"/>
    </g>
    <path d="M110 1220 C410 1135 600 1185 820 1085" fill="none" stroke="${palette.furnace}" stroke-width="20" opacity=".22"/>
    <path d="M55 1310 C330 1235 500 1270 700 1190" fill="none" stroke="${palette.ember}" stroke-width="32" opacity=".18"/>
    ${sparks(56)}${basaltFloor()}`;
}

function herald() {
  return `<ellipse cx="760" cy="870" rx="590" ry="760" fill="url(#halo)" opacity=".34"/>
    <path d="M1060 295 L1060 1510" stroke="${palette.gold}" stroke-width="26" stroke-linecap="round"/>
    <path d="M1075 345 C1270 390 1395 500 1420 690 C1270 630 1175 625 1068 650Z" fill="${palette.ember}" stroke="${palette.gold}" stroke-width="14"/>
    <path d="M1110 420 L1310 545 L1110 585Z" fill="${palette.furnace}" opacity=".78"/>
    <circle cx="660" cy="610" r="105" fill="${palette.coal}" stroke="${palette.gold}" stroke-width="11"/>
    <path d="M530 735 L790 735 L860 1225 L470 1225Z" fill="${palette.basalt}" stroke="${palette.ember}" stroke-width="19"/>
    <path d="M520 850 L345 1030 M800 845 L1015 915" stroke="${palette.coal}" stroke-width="70" stroke-linecap="round"/>
    <path d="M555 1200 L490 1510 M760 1200 L830 1510" stroke="${palette.coal}" stroke-width="74" stroke-linecap="round"/>
    <path d="M320 1015 C250 900 270 790 395 740" fill="none" stroke="${palette.gold}" stroke-width="29"/>
    <path d="M295 815 Q205 745 160 825 Q225 900 320 875" fill="${palette.furnace}" stroke="${palette.hot}" stroke-width="9" filter="url(#glow)"/>
    ${sparks(38)}${basaltFloor()}`;
}

function whelp() {
  return `<ellipse cx="760" cy="1020" rx="670" ry="650" fill="url(#halo)" opacity=".32"/>
    <path d="M430 1040 C500 825 690 745 900 820 C1040 870 1125 995 1160 1120 C1010 1160 880 1180 710 1165 C590 1155 500 1110 430 1040Z" fill="${palette.basalt}" stroke="${palette.furnace}" stroke-width="20"/>
    <path d="M890 825 C1025 675 1175 660 1275 760 C1170 815 1115 890 1090 985Z" fill="${palette.coal}" stroke="${palette.ember}" stroke-width="18"/>
    <path d="M1135 735 L1195 565 L1240 735 M1030 735 L1050 590 L1100 755" fill="${palette.coal}" stroke="${palette.gold}" stroke-width="12"/>
    <circle cx="1190" cy="785" r="18" fill="${palette.hot}" filter="url(#glow)"/>
    <path d="M455 1025 C280 995 180 1095 130 1230 C280 1185 380 1190 515 1235" fill="none" stroke="${palette.coal}" stroke-width="66" stroke-linecap="round"/>
    <path d="M580 1130 L500 1430 M760 1155 L720 1455 M965 1130 L1015 1420" stroke="${palette.coal}" stroke-width="72" stroke-linecap="round"/>
    <path d="M1160 840 C1290 845 1365 890 1425 960" fill="none" stroke="${palette.furnace}" stroke-width="24" opacity=".4" filter="url(#glow)"/>
    <path d="M640 900 L700 790 L750 910 L820 790 L880 925" fill="none" stroke="${palette.gold}" stroke-width="16" opacity=".62"/>
    ${sparks(46)}${basaltFloor()}`;
}

function zealot() {
  return `<ellipse cx="770" cy="900" rx="640" ry="760" fill="url(#halo)" opacity=".38"/>
    <circle cx="770" cy="595" r="110" fill="${palette.coal}" stroke="${palette.hot}" stroke-width="12"/>
    <path d="M610 725 L925 725 L1010 1240 L535 1240Z" fill="${palette.basalt}" stroke="${palette.gold}" stroke-width="20"/>
    <path d="M585 800 L430 685 L500 910Z M950 800 L1105 685 L1035 910Z" fill="${palette.ember}" stroke="${palette.furnace}" stroke-width="15"/>
    <path d="M535 830 L320 1080 M995 830 L1205 1085" stroke="${palette.coal}" stroke-width="82" stroke-linecap="round"/>
    <path d="M630 1210 L565 1515 M900 1210 L970 1515" stroke="${palette.coal}" stroke-width="82" stroke-linecap="round"/>
    <path d="M1195 1090 L1240 470" stroke="${palette.gold}" stroke-width="36" stroke-linecap="round"/>
    <path d="M1195 515 L1240 390 L1285 515 L1240 610Z" fill="${palette.hot}" stroke="${palette.furnace}" stroke-width="12" filter="url(#glow)"/>
    <path d="M650 885 L770 1010 L890 885 M690 1050 L770 1130 L850 1050" fill="none" stroke="${palette.furnace}" stroke-width="19" opacity=".8" filter="url(#glow)"/>
    <path d="M710 530 L735 650 M830 530 L805 650" stroke="${palette.ember}" stroke-width="13" opacity=".75"/>
    ${sparks(44)}${basaltFloor()}`;
}

function composition(kind) {
  if (kind === "duelist") return duelist();
  if (kind === "raider") return raider();
  if (kind === "herald") return herald();
  if (kind === "whelp") return whelp();
  if (kind === "zealot") return zealot();
  throw new Error(`Unknown Alpha P1 composition: ${kind}`);
}

function svg(master) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${defs()}
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <circle cx="190" cy="250" r="260" fill="${palette.furnace}" opacity=".06" filter="url(#soft)"/>
    <circle cx="1340" cy="380" r="300" fill="${palette.ember}" opacity=".08" filter="url(#soft)"/>
    ${composition(master.kind)}
    <rect x="22" y="22" width="1492" height="1876" rx="52" fill="none" stroke="${palette.gold}" stroke-width="5" opacity=".16"/>
  </svg>`;
}

for (const master of masters) {
  const output = resolve(`public/art/cards/alpha-p1/${master.region}/${master.defId}.webp`);
  await mkdir(dirname(output), { recursive: true });
  await sharp(Buffer.from(svg(master)))
    .resize(WIDTH, HEIGHT, { fit: "fill" })
    .webp({ quality: 88 })
    .toFile(output);
}

console.log(`ALPHA P1 ART BATCH 1: generated ${masters.length} deterministic 1536x1920 WebP masters`);
