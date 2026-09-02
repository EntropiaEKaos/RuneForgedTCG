import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1536;
const HEIGHT = 1920;

const champions = [
  {
    defId: "ember_champion",
    region: "emberhold",
    kind: "pyra",
    palette: ["#09080a", "#3a0f08", "#ef4a1f", "#ffbb52", "#1c1110"],
    skin: "#9a5039",
    hair: "#5f170d",
    eye: "#ffd56a",
  },
  {
    defId: "tide_champion",
    region: "tidecall",
    kind: "nerida",
    palette: ["#06111d", "#0b3850", "#19b8d3", "#d9f8ff", "#0b2333"],
    skin: "#d7eef0",
    hair: "#e8fbff",
    eye: "#7ef5ff",
  },
  {
    defId: "wood_champion",
    region: "ironwood",
    kind: "bramblehart",
    palette: ["#08110b", "#21351c", "#6e8c35", "#d4a94f", "#182414"],
    skin: "#49351e",
    hair: "#1e2f18",
    eye: "#c9ff6a",
  },
  {
    defId: "void_champion",
    region: "voidborn",
    kind: "malakar",
    palette: ["#05040a", "#26133d", "#7d32d7", "#df9cff", "#0d0a18"],
    skin: "#8d80a2",
    hair: "#d7d0ee",
    eye: "#e7a1ff",
  },
  {
    defId: "forest_champion",
    region: "florestia",
    kind: "kaara",
    palette: ["#07120b", "#143d24", "#2d8b4e", "#d7be5b", "#0f2818"],
    skin: "#9d6042",
    hair: "#3a2317",
    eye: "#dcff7f",
  },
  {
    defId: "storm_champion",
    region: "tempestade",
    kind: "zael",
    palette: ["#06101c", "#0f2b5b", "#2c8fff", "#d8edff", "#101a33"],
    skin: "#6d7180",
    hair: "#e7f3ff",
    eye: "#d9fbff",
  },
];

function glow(color, opacity = 1) {
  return `<filter id="glow-${color.slice(1)}"><feGaussianBlur stdDeviation="18" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}

function runes(color) {
  return Array.from({ length: 14 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 14;
    const x = 768 + Math.cos(angle) * 520;
    const y = 960 + Math.sin(angle) * 520;
    const rot = (i * 360) / 14 + 90;
    return `<path d="M-18 22 L0 -24 L18 22 M-11 5 H11" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(.68)" fill="none" stroke="${color}" stroke-width="7" opacity=".18"/>`;
  }).join("");
}

function atmosphere(c) {
  const [base, mid, accent, hi] = c.palette;
  if (c.kind === "pyra") {
    return `<path d="M0 1420 C210 1220 280 1335 402 1170 C555 963 578 1088 713 910 C864 710 1022 815 1151 620 C1260 456 1422 451 1536 315 V1920 H0Z" fill="url(#heat)" opacity=".72"/>
    ${Array.from({ length: 24 }, (_, i) => `<circle cx="${(83 + i * 137) % 1500}" cy="${300 + ((i * 191) % 1400)}" r="${5 + (i % 4) * 3}" fill="${i % 2 ? hi : accent}" opacity="${0.22 + (i % 3) * 0.08}"/>`).join("")}`;
  }
  if (c.kind === "nerida") {
    return `<g opacity=".62" fill="none" stroke="${accent}"><path d="M-80 1380 C290 1110 520 1510 850 1250 C1120 1035 1300 1190 1620 910" stroke-width="38"/><path d="M-120 1510 C260 1260 510 1650 890 1400 C1190 1205 1390 1320 1650 1110" stroke-width="16" opacity=".55"/></g>
    <ellipse cx="768" cy="420" rx="550" ry="230" fill="none" stroke="${hi}" stroke-width="9" opacity=".18"/>`;
  }
  if (c.kind === "bramblehart") {
    return `<path d="M74 1920 C110 1510 290 1490 330 1180 C361 932 200 823 303 584 M1462 1920 C1420 1504 1260 1470 1221 1160 C1191 920 1347 824 1239 570" fill="none" stroke="${mid}" stroke-width="104" opacity=".7"/>
    <path d="M262 748 L116 540 L275 636 L242 385 L388 606 L440 330 L468 658 M1274 742 L1425 528 L1262 631 L1291 377 L1145 599 L1094 323 L1066 655" fill="none" stroke="${accent}" stroke-width="38" stroke-linecap="round" opacity=".8"/>`;
  }
  if (c.kind === "malakar") {
    return `<circle cx="768" cy="500" r="420" fill="none" stroke="${accent}" stroke-width="42" opacity=".25"/><circle cx="768" cy="500" r="330" fill="#020205" opacity=".88"/><path d="M0 1520 C310 1300 442 1544 730 1322 C1020 1098 1288 1370 1536 1110 V1920 H0Z" fill="${mid}" opacity=".36"/>`;
  }
  if (c.kind === "kaara") {
    return `<path d="M0 1640 C240 1400 286 1514 480 1330 C620 1197 720 1248 828 1132 C1004 944 1230 1110 1536 760 V1920 H0Z" fill="${mid}" opacity=".5"/>
    ${Array.from({ length: 20 }, (_, i) => `<circle cx="${(124 + i * 173) % 1480}" cy="${420 + ((i * 233) % 1180)}" r="${8 + (i % 4) * 4}" fill="${i % 2 ? hi : accent}" opacity=".25"/>`).join("")}`;
  }
  return `<path d="M60 590 L530 990 L362 1070 L775 1355 L612 1430 L1210 1880" fill="none" stroke="${hi}" stroke-width="52" opacity=".45" filter="url(#soft)"/><path d="M1480 310 L1030 720 L1190 792 L790 1120 L930 1190 L410 1610" fill="none" stroke="${accent}" stroke-width="28" opacity=".78"/>`;
}

function face(c) {
  if (c.kind === "bramblehart") {
    return `<g transform="translate(768 855)">
      <path d="M-220 -280 C-154 -385 150 -385 220 -280 L292 140 C252 345 130 468 0 490 C-130 468 -252 345 -292 140Z" fill="${c.skin}" stroke="${c.palette[3]}" stroke-width="18" opacity=".97"/>
      <path d="M-250 -245 C-117 -306 123 -306 250 -245 L179 -142 L84 -205 L0 -132 L-96 -205 L-177 -142Z" fill="${c.hair}" opacity=".95"/>
      <path d="M-194 28 L-58 -8 L-92 74 L-190 76Z M194 28 L58 -8 L92 74 L190 76Z" fill="${c.eye}" filter="url(#soft)"/>
      <path d="M-150 118 C-90 158 90 158 150 118 L104 304 L0 380 L-104 304Z" fill="#261d12" stroke="${c.palette[2]}" stroke-width="12"/>
      <path d="M0 128 L-38 220 L0 254 L38 220Z" fill="${c.palette[3]}" opacity=".8"/>
      <path d="M-70 500 L0 590 L70 500 L118 706 L0 820 L-118 706Z" fill="${c.palette[2]}" opacity=".9"/>
    </g>`;
  }

  const feminine = c.kind === "pyra" || c.kind === "nerida" || c.kind === "kaara";
  return `<g transform="translate(768 825)">
    <path d="M-190 -220 C-118 -336 118 -336 190 -220 C250 -110 228 118 176 245 C126 365 76 430 0 450 C-76 430 -126 365 -176 245 C-228 118 -250 -110 -190 -220Z" fill="${c.skin}" stroke="${c.palette[3]}" stroke-width="10"/>
    <path d="M-236 -205 C-174 -392 174 -392 236 -205 C190 -258 122 -272 64 -230 C8 -190 -56 -220 -112 -250 C-166 -280 -206 -260 -236 -205Z" fill="${c.hair}"/>
    ${feminine ? `<path d="M-210 -175 C-292 -20 -310 230 -238 490 C-180 375 -160 240 -162 86 M210 -175 C292 -20 310 230 238 490 C180 375 160 240 162 86" fill="none" stroke="${c.hair}" stroke-width="72" stroke-linecap="round"/>` : `<path d="M-202 -175 C-258 -70 -262 118 -210 266 M202 -175 C258 -70 262 118 210 266" fill="none" stroke="${c.hair}" stroke-width="62" stroke-linecap="round"/>`}
    <path d="M-118 18 L-38 -2 L-68 50 L-130 50Z M118 18 L38 -2 L68 50 L130 50Z" fill="${c.eye}" filter="url(#soft)"/>
    <path d="M0 54 L-18 146 L0 166 L18 146Z" fill="${c.palette[4]}" opacity=".55"/>
    <path d="M-58 230 Q0 258 58 230" fill="none" stroke="${c.palette[4]}" stroke-width="12" stroke-linecap="round" opacity=".75"/>
    <path d="M-300 502 L-136 382 L0 458 L136 382 L300 502 L372 910 L-372 910Z" fill="${c.palette[4]}" stroke="${c.palette[2]}" stroke-width="18"/>
    <path d="M-252 530 L-80 480 L0 604 L80 480 L252 530 L188 812 L0 900 L-188 812Z" fill="${c.palette[1]}" opacity=".9"/>
  </g>`;
}

function crown(c) {
  const hi = c.palette[3];
  const accent = c.palette[2];
  if (c.kind === "pyra") return `<path d="M538 660 L620 480 L688 596 L768 398 L846 594 L922 470 L998 660" fill="none" stroke="${hi}" stroke-width="28" stroke-linejoin="round"/><path d="M560 656 Q768 728 976 656" fill="none" stroke="${accent}" stroke-width="34"/>`;
  if (c.kind === "nerida") return `<path d="M526 662 L622 506 L680 582 L768 432 L856 582 L918 506 L1010 662" fill="none" stroke="${hi}" stroke-width="24"/><circle cx="768" cy="456" r="34" fill="${accent}" filter="url(#soft)"/>`;
  if (c.kind === "malakar") return `<path d="M548 668 L632 462 L700 558 L768 388 L836 558 L904 462 L988 668" fill="#07060d" stroke="${accent}" stroke-width="22"/><circle cx="768" cy="430" r="28" fill="${hi}" filter="url(#soft)"/>`;
  if (c.kind === "kaara") return `<path d="M566 655 L626 520 L702 592 L768 456 L834 592 L910 520 L970 655" fill="none" stroke="${hi}" stroke-width="20"/><path d="M604 620 Q768 536 932 620" fill="none" stroke="${accent}" stroke-width="18"/>`;
  if (c.kind === "zael") return `<path d="M554 660 L664 494 L720 588 L768 438 L816 588 L872 494 L982 660" fill="none" stroke="${hi}" stroke-width="24"/><path d="M470 724 Q768 582 1066 724" fill="none" stroke="${accent}" stroke-width="14" opacity=".7"/>`;
  return "";
}

function extra(c) {
  const [base, mid, accent, hi] = c.palette;
  if (c.kind === "pyra") return `<path d="M350 1360 C182 1214 164 946 272 742 C306 978 420 1000 496 1188 C554 1330 458 1426 350 1360Z M1186 1360 C1354 1214 1372 946 1264 742 C1230 978 1116 1000 1040 1188 C982 1330 1078 1426 1186 1360Z" fill="${accent}" opacity=".36"/>`;
  if (c.kind === "nerida") return `<g fill="none" stroke="${hi}" opacity=".45"><path d="M370 1300 C510 1190 540 1020 492 874" stroke-width="18"/><path d="M1166 1300 C1026 1190 996 1020 1044 874" stroke-width="18"/><circle cx="768" cy="1370" r="220" stroke-width="10"/></g>`;
  if (c.kind === "bramblehart") return `<path d="M420 1530 C506 1260 622 1190 768 1230 C914 1190 1030 1260 1116 1530 L978 1920 H558Z" fill="${mid}" stroke="${accent}" stroke-width="26"/><path d="M768 1320 L690 1510 L768 1638 L846 1510Z" fill="${hi}" filter="url(#soft)"/>`;
  if (c.kind === "malakar") return `<path d="M360 1490 C510 1296 618 1288 768 1360 C918 1288 1026 1296 1176 1490 L1062 1920 H474Z" fill="#07060d" stroke="${accent}" stroke-width="28"/><circle cx="768" cy="1510" r="62" fill="${hi}" filter="url(#soft)"/>`;
  if (c.kind === "kaara") return `<path d="M388 1500 C522 1322 642 1288 768 1350 C894 1288 1014 1322 1148 1500 L1036 1920 H500Z" fill="${mid}" stroke="${hi}" stroke-width="18"/><path d="M525 1452 L382 1340 L450 1580 M1011 1452 L1154 1340 L1086 1580" fill="none" stroke="${accent}" stroke-width="44" stroke-linecap="round"/>`;
  return `<path d="M388 1510 C512 1310 650 1268 768 1350 C886 1268 1024 1310 1148 1510 L1018 1920 H518Z" fill="${mid}" stroke="${accent}" stroke-width="24"/><path d="M370 1510 L172 1260 L420 1375 M1166 1510 L1364 1260 L1116 1375" fill="none" stroke="${hi}" stroke-width="32" opacity=".7"/>`;
}

function svgFor(c) {
  const [base, mid, accent, hi, deep] = c.palette;
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${base}"/><stop offset=".48" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
      <radialGradient id="halo"><stop offset="0" stop-color="${hi}" stop-opacity=".55"/><stop offset=".34" stop-color="${accent}" stop-opacity=".24"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>
      <linearGradient id="heat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0"/><stop offset="1" stop-color="${hi}" stop-opacity=".8"/></linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="10"/></filter>
      ${glow(accent)}
    </defs>
    <rect width="1536" height="1920" fill="url(#bg)"/>
    <ellipse cx="768" cy="780" rx="700" ry="760" fill="url(#halo)"/>
    ${runes(hi)}
    ${atmosphere(c)}
    <g opacity=".28" fill="none" stroke="${accent}" stroke-width="8"><circle cx="768" cy="960" r="610"/><circle cx="768" cy="960" r="560"/><circle cx="768" cy="960" r="505"/></g>
    ${extra(c)}
    ${face(c)}
    ${crown(c)}
    <rect x="0" y="0" width="1536" height="1920" fill="none" stroke="${hi}" stroke-width="20" opacity=".18"/>
    <path d="M0 1680 C420 1560 1116 1560 1536 1680 V1920 H0Z" fill="#000" opacity=".25"/>
  </svg>`;
}

for (const champion of champions) {
  const output = resolve(`public/art/cards/flagship/${champion.region}/${champion.defId}.webp`);
  await mkdir(dirname(output), { recursive: true });
  await sharp(Buffer.from(svgFor(champion)))
    .resize(WIDTH, HEIGHT, { fit: "cover" })
    .webp({ quality: 88, smartSubsample: true, effort: 5 })
    .toFile(output);
}

console.log(`FLAGSHIP CHAMPION ART: generated ${champions.length} deterministic 1536x1920 WebP masters`);
