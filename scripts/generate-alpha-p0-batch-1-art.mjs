import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1536;
const HEIGHT = 1920;

const masters = [
  { defId: "ember_bolt", region: "emberhold", kind: "bolt", palette: ["#080708", "#32100b", "#8f2615", "#f15a24", "#ffd16f"] },
  { defId: "wood_webweaver", region: "ironwood", kind: "webweaver", palette: ["#071009", "#1b2d1a", "#4d6334", "#90ac54", "#f0ce78"] },
  { defId: "tide_guard", region: "tidecall", kind: "warden", palette: ["#04101b", "#0a2d43", "#08758a", "#23cbe7", "#e4fbff"] },
  { defId: "wood_growth", region: "ironwood", kind: "growth", palette: ["#071009", "#1b301a", "#526b34", "#9ab258", "#f2cf79"] },
  { defId: "wood_mend", region: "ironwood", kind: "mend", palette: ["#071009", "#20351e", "#58713a", "#a7bf62", "#f5d88b"] },
];

function defs(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${base}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="${hi}" stop-opacity=".82"/><stop offset=".28" stop-color="${accent}" stop-opacity=".42"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${hi}" stop-opacity=".75"/><stop offset=".22" stop-color="${deep}"/><stop offset=".7" stop-color="${mid}"/><stop offset="1" stop-color="${base}"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="36"/></filter>
  </defs>`;
}

function motes(c, count = 44) {
  const [, , , accent, hi] = c.palette;
  return Array.from({ length: count }, (_, i) => {
    const x = 52 + ((i * 229) % 1430);
    const y = 74 + ((i * 307) % 1720);
    const r = 2 + (i % 7);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 4 ? accent : hi}" opacity="${(0.11 + (i % 5) * 0.045).toFixed(2)}"/>`;
  }).join("");
}

function terrain(c, y = 1600) {
  const [base, mid, deep, accent] = c.palette;
  return `<path d="M0 ${y} C230 ${y - 110} 460 ${y + 28} 720 ${y - 38} C1000 ${y - 108} 1260 ${y + 18} 1536 ${y - 132} V1920 H0Z" fill="${mid}" opacity=".82"/>
    <path d="M0 ${y + 105} C310 ${y + 8} 540 ${y + 126} 815 ${y + 36} C1100 ${y - 45} 1320 ${y + 86} 1536 ${y + 5} V1920 H0Z" fill="${base}" opacity=".82"/>
    <path d="M70 ${y + 44} C370 ${y - 35} 590 ${y + 70} 855 ${y - 5} C1120 ${y - 75} 1310 ${y + 35} 1490 ${y - 34}" fill="none" stroke="${accent}" stroke-width="9" opacity=".14"/>
    <path d="M0 1810 C330 1710 620 1845 910 1760 C1190 1680 1370 1790 1536 1715 V1920 H0Z" fill="${deep}" opacity=".55"/>`;
}

function bolt(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="805" cy="875" rx="650" ry="760" fill="url(#halo)" opacity=".28"/>
    <path d="M0 1320 C250 1170 390 1270 575 1090 C760 910 960 1010 1130 790 C1280 596 1398 520 1536 430 V1920 H0Z" fill="${deep}" opacity=".45"/>
    <path d="M280 1500 L520 1040 L760 940 L1030 585" fill="none" stroke="${accent}" stroke-width="118" stroke-linecap="round" opacity=".25" filter="url(#soft)"/>
    <path d="M245 1540 L535 1055 L735 987 L1165 420" fill="none" stroke="${hi}" stroke-width="34" stroke-linecap="round" filter="url(#glow)"/>
    <path d="M560 1150 L688 1002 L648 906 L835 842 L790 742 L1010 620 L964 536 L1245 330" fill="none" stroke="${accent}" stroke-width="62" stroke-linejoin="round" filter="url(#glow)"/>
    <path d="M590 1140 L705 1017 L680 930 L852 858 L822 770 L1027 638 L996 566 L1264 350" fill="none" stroke="${hi}" stroke-width="22" stroke-linejoin="round"/>
    <path d="M420 1540 L520 1210 L650 1120 L735 1240 L680 1540Z" fill="url(#metal)" stroke="${accent}" stroke-width="18"/>
    <circle cx="624" cy="1075" r="94" fill="${base}" stroke="${hi}" stroke-width="13"/>
    <path d="M565 1060 L615 1015 L682 1050 L642 1092 L575 1100Z" fill="${accent}" opacity=".72"/>
    <path d="M690 1190 L905 1010" stroke="${hi}" stroke-width="30" stroke-linecap="round"/>
    <path d="M885 1020 L1036 928" stroke="${accent}" stroke-width="62" stroke-linecap="round" opacity=".75"/>
    ${Array.from({ length: 30 }, (_, i) => `<path d="M${120 + ((i * 173) % 1330)} ${420 + ((i * 227) % 1230)} l${i % 2 ? 24 : -22} ${45 + (i % 5) * 19}" stroke="${i % 3 ? accent : hi}" stroke-width="${4 + (i % 5)}" opacity=".34"/>`).join("")}
    ${terrain(c, 1600)}`;
}

function webweaver(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  const spokes = Array.from({ length: 14 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 14;
    const x = 768 + Math.cos(a) * 690;
    const y = 900 + Math.sin(a) * 760;
    return `<path d="M768 900 L${x.toFixed(1)} ${y.toFixed(1)}" stroke="${hi}" stroke-width="7" opacity=".18"/>`;
  }).join("");
  return `<ellipse cx="768" cy="910" rx="655" ry="770" fill="url(#halo)" opacity=".2"/>
    ${spokes}
    ${[170, 300, 435, 570].map((r) => `<ellipse cx="768" cy="900" rx="${r}" ry="${Math.round(r * 1.08)}" fill="none" stroke="${hi}" stroke-width="8" opacity=".13"/>`).join("")}
    <path d="M250 1920 C220 1510 330 1260 430 1030 C510 840 454 660 350 430" fill="none" stroke="${deep}" stroke-width="118" opacity=".95"/>
    <path d="M1286 1920 C1316 1510 1206 1260 1106 1030 C1026 840 1082 660 1186 430" fill="none" stroke="${deep}" stroke-width="118" opacity=".95"/>
    <ellipse cx="768" cy="1040" rx="245" ry="315" fill="${base}" stroke="${accent}" stroke-width="24"/>
    <ellipse cx="768" cy="765" rx="178" ry="162" fill="${deep}" stroke="${hi}" stroke-width="14"/>
    <path d="M604 920 L390 720 M932 920 L1146 720 M565 1050 L290 980 M971 1050 L1246 980 M585 1180 L330 1370 M951 1180 L1206 1370" fill="none" stroke="${deep}" stroke-width="62" stroke-linecap="round"/>
    <path d="M610 914 L400 705 M926 914 L1136 705 M570 1042 L292 960 M966 1042 L1244 960 M590 1172 L340 1360 M946 1172 L1196 1360" fill="none" stroke="${accent}" stroke-width="14" opacity=".72"/>
    <circle cx="702" cy="750" r="22" fill="${hi}" filter="url(#glow)"/><circle cx="834" cy="750" r="22" fill="${hi}" filter="url(#glow)"/>
    <path d="M690 832 L768 882 L846 832" fill="none" stroke="${accent}" stroke-width="16"/>
    <path d="M700 1110 C735 1165 801 1165 836 1110" fill="none" stroke="${hi}" stroke-width="12" opacity=".54"/>
    ${motes(c, 34)}
    ${terrain(c, 1620)}`;
}

function warden(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="768" cy="900" rx="640" ry="770" fill="url(#halo)" opacity=".3"/>
    <path d="M0 1460 C270 1335 445 1460 690 1360 C930 1265 1210 1390 1536 1190 V1920 H0Z" fill="${deep}" opacity=".52"/>
    <circle cx="768" cy="930" r="520" fill="none" stroke="${accent}" stroke-width="54" opacity=".2"/>
    <circle cx="768" cy="930" r="420" fill="none" stroke="${hi}" stroke-width="14" opacity=".28"/>
    <path d="M535 1510 L585 825 Q768 700 951 825 L1001 1510Z" fill="url(#metal)" stroke="${accent}" stroke-width="20"/>
    <path d="M650 760 L690 535 L768 430 L846 535 L886 760 L824 832 H712Z" fill="${deep}" stroke="${hi}" stroke-width="14"/>
    <path d="M688 650 L742 677 M848 650 L794 677" stroke="${accent}" stroke-width="22" filter="url(#glow)"/>
    <path d="M540 955 L310 1210 L470 1420 L620 1260Z" fill="${deep}" stroke="${hi}" stroke-width="14"/>
    <path d="M996 955 L1226 1210 L1066 1420 L916 1260Z" fill="${deep}" stroke="${hi}" stroke-width="14"/>
    <path d="M368 1170 Q530 1010 655 1090" fill="none" stroke="${accent}" stroke-width="40"/><path d="M1168 1170 Q1006 1010 881 1090" fill="none" stroke="${accent}" stroke-width="40"/>
    <path d="M630 930 H906 M612 1090 H924 M602 1250 H934" stroke="${hi}" stroke-width="10" opacity=".36"/>
    ${Array.from({ length: 14 }, (_, i) => `<ellipse cx="768" cy="930" rx="${170 + i * 30}" ry="${210 + i * 28}" fill="none" stroke="${i % 2 ? accent : hi}" stroke-width="4" opacity=".055" transform="rotate(${i * 13} 768 930)"/>`).join("")}
    ${motes(c, 28)}
    ${terrain(c, 1640)}`;
}

function growth(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  const roots = Array.from({ length: 12 }, (_, i) => {
    const x = 100 + i * 122;
    const bend = i % 2 ? 95 : -90;
    return `<path d="M${x} 1900 C${x + bend} 1570 ${x - bend} 1370 ${x + (i % 3 - 1) * 130} 1110 C${x + bend} 900 ${x - bend} 690 ${x + 30} 390" fill="none" stroke="${i % 3 ? deep : mid}" stroke-width="${42 + (i % 4) * 12}" stroke-linecap="round" opacity=".82"/>`;
  }).join("");
  return `<ellipse cx="768" cy="960" rx="680" ry="790" fill="url(#halo)" opacity=".18"/>
    ${roots}
    <path d="M260 1660 C420 1320 580 1280 768 1080 C956 1280 1116 1320 1276 1660 L1125 1920 H411Z" fill="${base}" opacity=".52"/>
    <path d="M768 1680 C650 1480 620 1310 672 1130 C710 1000 748 910 768 770 C788 910 826 1000 864 1130 C916 1310 886 1480 768 1680Z" fill="${deep}" stroke="${accent}" stroke-width="22"/>
    <path d="M768 790 V1570" stroke="${hi}" stroke-width="18" opacity=".65" filter="url(#glow)"/>
    ${[0,1,2,3,4,5].map((i) => `<path d="M${768 - i * 18} ${880 + i * 118} C${540 - i * 15} ${805 + i * 122} ${410 - i * 8} ${900 + i * 126} ${310 - i * 5} ${810 + i * 132} M${768 + i * 18} ${880 + i * 118} C${996 + i * 15} ${805 + i * 122} ${1126 + i * 8} ${900 + i * 126} ${1226 + i * 5} ${810 + i * 132}" fill="none" stroke="${i % 2 ? accent : hi}" stroke-width="${12 + i * 2}" opacity="${0.44 - i * .035}"/>`).join("")}
    ${Array.from({ length: 34 }, (_, i) => `<ellipse cx="${110 + ((i * 197) % 1320)}" cy="${350 + ((i * 251) % 1210)}" rx="${11 + i % 4 * 4}" ry="${25 + i % 5 * 5}" fill="${i % 3 ? accent : hi}" opacity=".28" transform="rotate(${(i * 37) % 180})"/>`).join("")}
    ${motes(c, 30)}
    ${terrain(c, 1670)}`;
}

function mend(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="768" cy="920" rx="650" ry="760" fill="url(#halo)" opacity=".23"/>
    <path d="M260 1750 C345 1390 480 1200 610 1060 C510 880 525 675 672 500 L768 680 L864 500 C1011 675 1026 880 926 1060 C1056 1200 1191 1390 1276 1750Z" fill="${deep}" stroke="${accent}" stroke-width="24"/>
    <path d="M622 1060 Q768 920 914 1060 L884 1330 Q768 1460 652 1330Z" fill="${base}" stroke="${hi}" stroke-width="12"/>
    <path d="M690 1130 L742 1160 M846 1130 L794 1160" stroke="${accent}" stroke-width="20" filter="url(#glow)"/>
    <path d="M768 1190 L710 1270 L768 1300 L826 1270Z" fill="${hi}" opacity=".48"/>
    <path d="M610 720 L708 875 L660 1010 L760 1090 L710 1230 L790 1320" fill="none" stroke="#25180d" stroke-width="42" stroke-linecap="round" opacity=".95"/>
    <path d="M614 720 L708 875 L663 1008 L760 1090 L714 1227 L790 1320" fill="none" stroke="${hi}" stroke-width="13" stroke-linecap="round" filter="url(#glow)"/>
    <path d="M925 780 C1070 930 1080 1130 1005 1305 M555 820 C430 1000 455 1225 545 1370" fill="none" stroke="${accent}" stroke-width="42" opacity=".46"/>
    ${Array.from({ length: 18 }, (_, i) => `<path d="M${330 + ((i * 173) % 900)} ${650 + ((i * 197) % 930)} q${i % 2 ? 70 : -70} ${70 + i % 5 * 18} ${i % 3 ? 20 : -20} ${145 + i % 4 * 28}" fill="none" stroke="${i % 4 ? accent : hi}" stroke-width="${6 + i % 4 * 2}" opacity=".24"/>`).join("")}
    ${Array.from({ length: 28 }, (_, i) => `<circle cx="${250 + ((i * 223) % 1030)}" cy="${410 + ((i * 277) % 1240)}" r="${3 + i % 6}" fill="${i % 3 ? accent : hi}" opacity=".34"/>`).join("")}
    ${terrain(c, 1640)}`;
}

function scene(c) {
  const renderer = { bolt, webweaver, warden, growth, mend }[c.kind];
  if (!renderer) throw new Error(`Unknown Alpha P0 Batch 1 renderer: ${c.kind}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${defs(c)}
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <rect x="70" y="70" width="1396" height="1780" rx="88" fill="none" stroke="${c.palette[4]}" stroke-width="4" opacity=".08"/>
    ${renderer(c)}
    ${motes(c, 22)}
    <path d="M118 168 C360 98 560 122 768 86 C980 122 1172 98 1418 168" fill="none" stroke="${c.palette[4]}" stroke-width="8" opacity=".08"/>
  </svg>`;
}

for (const master of masters) {
  const path = resolve(`public/art/cards/alpha-p0/${master.region}/${master.defId}.webp`);
  await mkdir(dirname(path), { recursive: true });
  await sharp(Buffer.from(scene(master)))
    .webp({ quality: 88, effort: 5, smartSubsample: true })
    .toFile(path);
}

console.log(`ALPHA P0 ART BATCH 1: generated ${masters.length} deterministic ${WIDTH}x${HEIGHT} WebP masters`);
