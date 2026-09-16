import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1536;
const HEIGHT = 1920;

const palettes = {
  emberhold: {
    base: "#100706", deep: "#28100d", mid: "#4b2118", accent: "#ca431e", bright: "#ff842d", metal: "#e5b45d", hot: "#fff0c5",
  },
  florestia: {
    base: "#06110d", deep: "#0c2a20", mid: "#164936", accent: "#2f8f62", bright: "#6fd8a1", metal: "#d3b65a", hot: "#eaffcf",
  },
};

const masters = [
  { defId: "ember_blade", region: "emberhold", kind: "blade" },
  { defId: "ember_phantom", region: "emberhold", kind: "phantom" },
  { defId: "forest_pack_shelter", region: "florestia", kind: "shelter" },
  { defId: "forest_summon_pack", region: "florestia", kind: "summon" },
  { defId: "forest_packrunner", region: "florestia", kind: "runner" },
];

function defs(p) {
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${p.base}"/><stop offset=".54" stop-color="${p.deep}"/><stop offset="1" stop-color="${p.mid}"/></linearGradient>
    <radialGradient id="halo"><stop stop-color="${p.hot}" stop-opacity=".50"/><stop offset=".28" stop-color="${p.bright}" stop-opacity=".24"/><stop offset="1" stop-color="${p.base}" stop-opacity="0"/></radialGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${p.hot}"/><stop offset=".26" stop-color="${p.metal}"/><stop offset=".62" stop-color="${p.accent}"/><stop offset="1" stop-color="${p.deep}"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="15" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="52"/></filter>
  </defs>`;
}

function motes(p, count = 50) {
  return Array.from({ length: count }, (_, i) => {
    const x = 42 + ((i * 251) % 1450);
    const y = 40 + ((i * 337) % 1780);
    const r = 2 + (i % 5);
    const opacity = (0.10 + (i % 5) * 0.05).toFixed(2);
    const fill = i % 4 ? p.bright : p.hot;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${opacity}"/>`;
  }).join("");
}

function emberFloor(p) {
  return `<path d="M0 1515 C290 1445 520 1590 770 1510 C1010 1435 1280 1560 1536 1475 V1920 H0Z" fill="${p.mid}"/>
    <path d="M0 1710 C300 1610 610 1780 930 1690 C1180 1620 1390 1730 1536 1660 V1920 H0Z" fill="${p.base}"/>
    <path d="M120 1600 L340 1495 L520 1625 L725 1505 L930 1615 L1145 1495 L1390 1605" fill="none" stroke="${p.accent}" stroke-width="10" opacity=".26"/>`;
}

function forestFloor(p) {
  return `<path d="M0 1510 C260 1415 510 1545 760 1490 C1030 1425 1270 1535 1536 1435 V1920 H0Z" fill="${p.mid}"/>
    <path d="M0 1690 C300 1595 615 1765 910 1665 C1210 1580 1380 1700 1536 1625 V1920 H0Z" fill="${p.base}"/>
    <path d="M110 1660 C280 1500 410 1530 570 1650 C745 1480 920 1500 1085 1650 C1245 1505 1360 1520 1465 1630" fill="none" stroke="${p.bright}" stroke-width="14" opacity=".12"/>`;
}

function blade(p) {
  return `<ellipse cx="780" cy="880" rx="630" ry="760" fill="url(#halo)" opacity=".36"/>
    <circle cx="720" cy="610" r="104" fill="${p.deep}" stroke="${p.metal}" stroke-width="11"/>
    <path d="M570 730 L855 710 L955 1240 L520 1240Z" fill="${p.mid}" stroke="${p.accent}" stroke-width="20"/>
    <path d="M560 845 L340 1065 M875 825 L1045 945" stroke="${p.deep}" stroke-width="76" stroke-linecap="round"/>
    <path d="M690 1205 L610 1510 M860 1195 L955 1500" stroke="${p.deep}" stroke-width="78" stroke-linecap="round"/>
    <path d="M310 1120 L1270 415" stroke="url(#edge)" stroke-width="42" stroke-linecap="round" filter="url(#glow)"/>
    <path d="M1175 485 L1320 345 L1275 535Z" fill="${p.hot}" stroke="${p.bright}" stroke-width="11" filter="url(#glow)"/>
    <path d="M605 885 L720 960 L825 870" fill="none" stroke="${p.metal}" stroke-width="16" opacity=".72"/>
    ${motes(p, 46)}${emberFloor(p)}`;
}

function phantom(p) {
  return `<ellipse cx="760" cy="900" rx="690" ry="760" fill="url(#halo)" opacity=".25"/>
    <g opacity=".20" transform="translate(-155 40)"><circle cx="760" cy="620" r="96" fill="${p.hot}"/><path d="M625 735 L900 735 L955 1230 L560 1230Z" fill="${p.bright}"/></g>
    <g opacity=".28" transform="translate(155 -20)"><circle cx="760" cy="620" r="96" fill="${p.accent}"/><path d="M625 735 L900 735 L955 1230 L560 1230Z" fill="${p.accent}"/></g>
    <circle cx="760" cy="610" r="102" fill="${p.deep}" stroke="${p.bright}" stroke-width="10"/>
    <path d="M620 730 L905 730 L965 1235 L555 1235Z" fill="${p.mid}" stroke="${p.accent}" stroke-width="18"/>
    <path d="M600 850 L370 1030 M920 840 L1165 1015" stroke="${p.deep}" stroke-width="68" stroke-linecap="round"/>
    <path d="M670 1205 L590 1505 M875 1205 L975 1495" stroke="${p.deep}" stroke-width="70" stroke-linecap="round"/>
    <path d="M350 1040 L525 880 M1170 1015 L1030 845" stroke="${p.hot}" stroke-width="24" opacity=".55" filter="url(#glow)"/>
    <path d="M210 780 C465 715 565 780 690 865 M865 795 C1050 720 1235 755 1395 875" fill="none" stroke="${p.bright}" stroke-width="18" opacity=".18"/>
    ${motes(p, 62)}${emberFloor(p)}`;
}

function shelter(p) {
  return `<ellipse cx="780" cy="900" rx="720" ry="780" fill="url(#halo)" opacity=".24"/>
    <path d="M205 1510 C245 1040 390 660 705 420 C640 805 690 1120 760 1510Z" fill="${p.deep}" stroke="${p.accent}" stroke-width="22"/>
    <path d="M1330 1510 C1275 1025 1125 655 820 430 C890 795 855 1120 790 1510Z" fill="${p.deep}" stroke="${p.accent}" stroke-width="22"/>
    <path d="M430 965 C610 765 940 750 1115 955 C1030 1145 940 1270 770 1330 C590 1260 500 1145 430 965Z" fill="${p.mid}" stroke="${p.metal}" stroke-width="15" opacity=".92"/>
    <ellipse cx="770" cy="1050" rx="310" ry="245" fill="${p.hot}" opacity=".10" filter="url(#soft)"/>
    <circle cx="640" cy="1110" r="58" fill="${p.deep}"/><circle cx="770" cy="1060" r="68" fill="${p.deep}"/><circle cx="905" cy="1120" r="54" fill="${p.deep}"/>
    <path d="M610 1070 L650 990 L690 1070 M735 1015 L775 925 L820 1015 M870 1080 L910 1010 L950 1080" fill="${p.deep}"/>
    ${motes(p, 70)}${forestFloor(p)}`;
}

function summon(p) {
  return `<ellipse cx="760" cy="865" rx="700" ry="760" fill="url(#halo)" opacity=".31"/>
    <circle cx="760" cy="590" r="100" fill="${p.deep}" stroke="${p.metal}" stroke-width="10"/>
    <path d="M620 715 L900 715 L960 1195 L560 1195Z" fill="${p.mid}" stroke="${p.accent}" stroke-width="18"/>
    <path d="M600 810 L390 1030 M920 805 L1135 1035" stroke="${p.deep}" stroke-width="70" stroke-linecap="round"/>
    <path d="M1135 1035 L1265 520" stroke="${p.metal}" stroke-width="26"/>
    <circle cx="1280" cy="480" r="78" fill="none" stroke="${p.hot}" stroke-width="18" filter="url(#glow)"/>
    <path d="M230 1280 C330 1125 465 1085 590 1190 C480 1240 395 1330 330 1450Z" fill="${p.deep}" stroke="${p.bright}" stroke-width="10" opacity=".95"/>
    <path d="M1280 1285 C1195 1120 1065 1080 940 1190 C1050 1245 1135 1340 1195 1450Z" fill="${p.deep}" stroke="${p.bright}" stroke-width="10" opacity=".95"/>
    <path d="M140 1060 C390 915 520 950 660 1050 M875 1010 C1050 900 1225 915 1430 1060" fill="none" stroke="${p.bright}" stroke-width="20" opacity=".25"/>
    ${motes(p, 74)}${forestFloor(p)}`;
}

function runner(p) {
  return `<ellipse cx="760" cy="930" rx="710" ry="720" fill="url(#halo)" opacity=".25"/>
    <g transform="rotate(-14 760 940)">
      <circle cx="750" cy="650" r="92" fill="${p.deep}" stroke="${p.bright}" stroke-width="10"/>
      <path d="M620 750 L865 720 L955 1115 L640 1180Z" fill="${p.mid}" stroke="${p.accent}" stroke-width="18"/>
      <path d="M640 850 L395 1010 M875 815 L1070 910" stroke="${p.deep}" stroke-width="68" stroke-linecap="round"/>
      <path d="M670 1140 L455 1415 M890 1105 L1105 1350" stroke="${p.deep}" stroke-width="74" stroke-linecap="round"/>
      <path d="M545 770 L600 650 L650 790 M835 735 L900 630 L920 785" fill="${p.deep}" stroke="${p.metal}" stroke-width="9"/>
    </g>
    <path d="M80 1210 C390 1120 555 1145 730 1040" fill="none" stroke="${p.bright}" stroke-width="18" opacity=".22"/>
    <path d="M45 1330 C340 1230 520 1260 690 1180" fill="none" stroke="${p.accent}" stroke-width="26" opacity=".18"/>
    ${motes(p, 66)}${forestFloor(p)}`;
}

function composition(kind, p) {
  if (kind === "blade") return blade(p);
  if (kind === "phantom") return phantom(p);
  if (kind === "shelter") return shelter(p);
  if (kind === "summon") return summon(p);
  if (kind === "runner") return runner(p);
  throw new Error(`Unknown Alpha P1 Batch 2 composition: ${kind}`);
}

function svg(master) {
  const p = palettes[master.region];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${defs(p)}
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <circle cx="190" cy="245" r="270" fill="${p.bright}" opacity=".055" filter="url(#soft)"/>
    <circle cx="1340" cy="400" r="300" fill="${p.accent}" opacity=".07" filter="url(#soft)"/>
    ${composition(master.kind, p)}
    <rect x="22" y="22" width="1492" height="1876" rx="52" fill="none" stroke="${p.metal}" stroke-width="5" opacity=".16"/>
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

console.log(`ALPHA P1 ART BATCH 2: generated ${masters.length} deterministic 1536x1920 WebP masters`);
