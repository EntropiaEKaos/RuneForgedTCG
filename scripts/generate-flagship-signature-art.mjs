import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1536;
const HEIGHT = 1920;

const signatures = [
  { defId: "ember_ashguard", region: "emberhold", kind: "ashguard", palette: ["#070607", "#2a110d", "#8d2815", "#f45b2b", "#ffd072"] },
  { defId: "tide_cloudpiercer", region: "tidecall", kind: "cloudpiercer", palette: ["#03111d", "#08304a", "#0a7185", "#27cde8", "#e4fbff"] },
  { defId: "wood_canopy_bastion", region: "ironwood", kind: "canopy", palette: ["#071009", "#1b311b", "#526a34", "#91ad50", "#f0cf7a"] },
  { defId: "void_gloom_warden", region: "voidborn", kind: "warden", palette: ["#040207", "#160a26", "#44226f", "#963de1", "#efb5ff"] },
  { defId: "forest_dawn_alpha", region: "florestia", kind: "alpha", palette: ["#06110a", "#10371e", "#1e7040", "#5ab65e", "#f0cf79"] },
  { defId: "storm_static_adept", region: "tempestade", kind: "adept", palette: ["#040c19", "#0c2850", "#20609d", "#45adff", "#edf9ff"] },
];

function defs(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${base}"/><stop offset=".62" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="${hi}" stop-opacity=".78"/><stop offset=".25" stop-color="${accent}" stop-opacity=".38"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>
    <linearGradient id="armor" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${hi}" stop-opacity=".72"/><stop offset=".24" stop-color="${deep}"/><stop offset=".7" stop-color="${mid}"/><stop offset="1" stop-color="${base}"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="12" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="34"/></filter>
  </defs>`;
}

function atmosphere(c, count = 42) {
  const [, , , accent, hi] = c.palette;
  return Array.from({ length: count }, (_, i) => {
    const x = 48 + ((i * 227) % 1440);
    const y = 72 + ((i * 313) % 1640);
    const r = 2 + (i % 6);
    const opacity = 0.10 + (i % 5) * 0.045;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 4 ? accent : hi}" opacity="${opacity}"/>`;
  }).join("");
}

function ground(c, y = 1630) {
  const [, mid, deep, accent] = c.palette;
  return `<path d="M0 ${y} C260 ${y - 120} 480 ${y + 35} 760 ${y - 42} C1010 ${y - 110} 1260 ${y + 25} 1536 ${y - 145} V1920 H0Z" fill="${mid}" opacity=".72"/>
  <path d="M0 ${y + 80} C300 ${y - 10} 520 ${y + 115} 800 ${y + 26} C1100 ${y - 70} 1290 ${y + 72} 1536 ${y - 10}" fill="none" stroke="${accent}" stroke-width="10" opacity=".14"/>
  <path d="M0 1790 C340 1690 630 1835 920 1750 C1160 1680 1330 1770 1536 1690 V1920 H0Z" fill="${deep}" opacity=".64"/>`;
}

function ashguard(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="768" cy="880" rx="610" ry="720" fill="url(#halo)" opacity=".34"/>
    <path d="M150 1610 L210 590 L430 430 L480 1610 M1056 1610 L1106 430 L1326 590 L1386 1610" fill="${base}" stroke="${accent}" stroke-width="18" opacity=".92"/>
    <path d="M330 620 H1206 M290 720 H1246" stroke="${hi}" stroke-width="16" opacity=".22"/>
    <circle cx="768" cy="600" r="116" fill="url(#armor)" stroke="${hi}" stroke-width="10"/>
    <path d="M665 550 L768 420 L871 550 L828 625 H708Z" fill="${deep}" stroke="${accent}" stroke-width="11"/>
    <path d="M570 1470 L610 820 Q768 708 926 820 L966 1470Z" fill="url(#armor)" stroke="${accent}" stroke-width="20"/>
    <path d="M515 880 L350 1030 L420 1420 L600 1330Z" fill="${deep}" stroke="${hi}" stroke-width="14"/>
    <path d="M360 900 L530 970 L500 1450 L280 1360Z" fill="${mid}" stroke="${accent}" stroke-width="22"/>
    <path d="M405 1000 V1350 M335 1100 L485 1150 M330 1250 L480 1290" stroke="${hi}" stroke-width="12" opacity=".55"/>
    <path d="M945 850 L1130 1390" stroke="${hi}" stroke-width="26"/><path d="M1080 1260 L1195 1455 L1030 1445Z" fill="${accent}" stroke="${hi}" stroke-width="10"/>
    <path d="M650 880 H886 M625 1030 H911 M614 1180 H922" stroke="${hi}" stroke-width="14" opacity=".38"/>
    ${Array.from({ length: 26 }, (_, i) => `<path d="M${100 + ((i*233)%1350)} ${720 + ((i*177)%850)} l${i%2?18:-18} ${45+i%5*16}" stroke="${i%3?accent:hi}" stroke-width="${4+i%4}" opacity=".34"/>`).join("")}
    ${ground(c, 1600)}`;
}

function cloudpiercer(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="768" cy="850" rx="620" ry="740" fill="url(#halo)" opacity=".32"/>
    <path d="M0 1450 C290 1320 450 1480 700 1390 C940 1300 1220 1410 1536 1240 V1920 H0Z" fill="${base}" opacity=".72"/>
    ${[300,520,760,1000,1240].map((x,i)=>`<path d="M${x-180} ${1420-i*45} C${x} ${1300-i*55} ${x+160} ${1430-i*35} ${x+330} ${1300-i*50}" fill="none" stroke="${accent}" stroke-width="${26-i*2}" opacity="${.22+i*.035}"/>`).join("")}
    <path d="M768 260 C610 480 575 720 640 970 C682 1130 650 1360 520 1580 C700 1490 760 1370 768 1220 C776 1370 836 1490 1016 1580 C886 1360 854 1130 896 970 C961 720 926 480 768 260Z" fill="${deep}" stroke="${hi}" stroke-width="18"/>
    <path d="M768 390 C690 610 700 810 768 1010 C836 810 846 610 768 390Z" fill="${accent}" opacity=".42" filter="url(#glow)"/>
    <path d="M768 220 V1510" stroke="${hi}" stroke-width="22" opacity=".6"/>
    <path d="M768 210 L690 420 L768 370 L846 420Z" fill="${hi}" filter="url(#glow)"/>
    ${Array.from({ length: 18 }, (_, i) => `<ellipse cx="${170+((i*199)%1180)}" cy="${480+((i*251)%900)}" rx="${50+i%4*16}" ry="${16+i%3*8}" fill="none" stroke="${i%2?accent:hi}" stroke-width="7" opacity=".22"/>`).join("")}
    ${ground(c, 1650)}`;
}

function canopy(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="768" cy="920" rx="650" ry="760" fill="url(#halo)" opacity=".23"/>
    <path d="M0 490 C220 300 410 430 540 230 C700 410 850 270 1010 360 C1180 460 1330 320 1536 470 V0 H0Z" fill="${deep}" opacity=".7"/>
    <path d="M375 1440 C390 1060 510 760 768 610 C1026 760 1146 1060 1161 1440 L1030 1660 H506Z" fill="${mid}" stroke="${accent}" stroke-width="28"/>
    <path d="M520 1060 C460 820 540 600 700 490 L768 720 L836 490 C996 600 1076 820 1016 1060" fill="${deep}" stroke="${hi}" stroke-width="13"/>
    <path d="M520 1110 L330 1350 L540 1410 M1016 1110 L1206 1350 L996 1410" fill="none" stroke="${deep}" stroke-width="110" stroke-linecap="round"/>
    <path d="M610 890 Q768 760 926 890 L900 1180 Q768 1300 636 1180Z" fill="${base}" stroke="${hi}" stroke-width="12"/>
    <circle cx="700" cy="1010" r="20" fill="${accent}" filter="url(#glow)"/><circle cx="836" cy="1010" r="20" fill="${accent}" filter="url(#glow)"/>
    <path d="M768 1070 L700 1160 H836Z" fill="${hi}" opacity=".5"/>
    <path d="M612 670 C500 510 390 450 250 470 M924 670 C1036 510 1146 450 1286 470" fill="none" stroke="${accent}" stroke-width="30" stroke-linecap="round" opacity=".68"/>
    ${Array.from({ length: 32 }, (_, i) => `<circle cx="${70+((i*181)%1400)}" cy="${220+((i*269)%1420)}" r="${4+i%8}" fill="${i%4?accent:hi}" opacity=".25"/>`).join("")}
    ${ground(c, 1550)}`;
}

function warden(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="768" cy="850" rx="640" ry="760" fill="url(#halo)" opacity=".28"/>
    <circle cx="768" cy="650" r="430" fill="${accent}" opacity=".13" filter="url(#soft)"/><circle cx="768" cy="650" r="310" fill="${base}" stroke="${accent}" stroke-width="18" opacity=".96"/>
    <path d="M520 1550 L578 850 Q768 690 958 850 L1016 1550Z" fill="url(#armor)" stroke="${hi}" stroke-width="15"/>
    <path d="M650 720 L690 500 L768 400 L846 500 L886 720 L825 800 H711Z" fill="${deep}" stroke="${hi}" stroke-width="12"/>
    <path d="M690 610 L744 642 M846 610 L792 642" stroke="${accent}" stroke-width="18" filter="url(#glow)"/>
    <path d="M580 930 L410 1460 M956 930 L1126 1460" stroke="${hi}" stroke-width="24" opacity=".62"/>
    <path d="M768 860 V1450" stroke="${accent}" stroke-width="20" opacity=".36"/>
    <path d="M635 900 H901 M620 1050 H916 M608 1200 H928" stroke="${hi}" stroke-width="8" opacity=".34"/>
    ${Array.from({ length: 24 }, (_, i) => `<path d="M${120+((i*211)%1290)} ${380+((i*293)%1200)} q${i%2?75:-75} ${70+i%4*30} ${i%3?20:-20} ${160+i%5*25}" fill="none" stroke="${i%3?accent:hi}" stroke-width="${5+i%4}" opacity=".18"/>`).join("")}
    ${ground(c, 1610)}`;
}

function alpha(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="768" cy="900" rx="660" ry="760" fill="url(#halo)" opacity=".26"/>
    <circle cx="768" cy="360" r="190" fill="${hi}" opacity=".18" filter="url(#soft)"/>
    <path d="M470 1380 C500 1010 590 760 768 650 C946 760 1036 1010 1066 1380 L950 1610 H586Z" fill="${deep}" stroke="${accent}" stroke-width="22"/>
    <path d="M570 930 C500 710 575 520 705 440 L768 650 L831 440 C961 520 1036 710 966 930" fill="${mid}" stroke="${hi}" stroke-width="13"/>
    <path d="M595 820 Q768 690 941 820 L910 1110 Q768 1240 626 1110Z" fill="${base}" stroke="${hi}" stroke-width="11"/>
    <path d="M650 930 L710 955 M886 930 L826 955" stroke="${accent}" stroke-width="20" filter="url(#glow)"/>
    <path d="M768 1000 L704 1080 L768 1115 L832 1080Z" fill="${hi}" opacity=".5"/>
    <path d="M490 1180 L270 1500 M1046 1180 L1266 1500" stroke="${deep}" stroke-width="120" stroke-linecap="round"/>
    ${[280,420,1116,1256].map((x,i)=>`<g transform="translate(${x} ${1320+(i%2)*90}) scale(${i<2?.68:.68})"><path d="M0 -170 L100 -20 L72 130 L0 200 L-72 130 L-100 -20Z" fill="${mid}" stroke="${accent}" stroke-width="12"/><circle cx="-34" cy="0" r="14" fill="${hi}"/><circle cx="34" cy="0" r="14" fill="${hi}"/></g>`).join("")}
    ${Array.from({ length: 30 }, (_, i) => `<circle cx="${70+((i*223)%1400)}" cy="${300+((i*251)%1330)}" r="${3+i%7}" fill="${i%4?accent:hi}" opacity=".25"/>`).join("")}
    ${ground(c, 1600)}`;
}

function adept(c) {
  const [base, mid, deep, accent, hi] = c.palette;
  return `<ellipse cx="768" cy="860" rx="630" ry="740" fill="url(#halo)" opacity=".3"/>
    <path d="M0 1460 C280 1320 450 1460 720 1370 C980 1280 1240 1400 1536 1230 V1920 H0Z" fill="${base}" opacity=".68"/>
    <circle cx="768" cy="590" r="104" fill="url(#armor)" stroke="${hi}" stroke-width="10"/>
    <path d="M600 1470 L635 820 Q768 720 901 820 L936 1470Z" fill="url(#armor)" stroke="${accent}" stroke-width="16"/>
    <path d="M620 920 L420 1100 L260 850 M916 920 L1116 1100 L1276 850" fill="none" stroke="${hi}" stroke-width="44" stroke-linecap="round"/>
    <circle cx="244" cy="820" r="72" fill="${accent}" opacity=".32" filter="url(#glow)"/><circle cx="1292" cy="820" r="72" fill="${accent}" opacity=".32" filter="url(#glow)"/>
    <path d="M244 820 L390 650 L350 790 L520 560 M1292 820 L1146 650 L1186 790 L1016 560 M520 560 L650 730 M1016 560 L886 730" fill="none" stroke="${hi}" stroke-width="20" filter="url(#glow)"/>
    <path d="M700 850 H836 M682 1010 H854 M670 1170 H866" stroke="${accent}" stroke-width="12" opacity=".4"/>
    ${Array.from({ length: 24 }, (_, i) => `<path d="M${90+((i*241)%1370)} ${300+((i*229)%1260)} l${i%2?55:-55} ${90+i%4*24} l${i%2?-25:25} ${70+i%3*20}" fill="none" stroke="${i%3?accent:hi}" stroke-width="${5+i%4}" opacity=".2"/>`).join("")}
    ${ground(c, 1630)}`;
}

function scene(c) {
  const renderer = { ashguard, cloudpiercer, canopy, warden, alpha, adept }[c.kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${defs(c)}
    <rect width="1536" height="1920" fill="url(#bg)"/>
    ${atmosphere(c)}
    ${renderer(c)}
    <rect x="26" y="26" width="1484" height="1868" rx="52" fill="none" stroke="${c.palette[4]}" stroke-width="5" opacity=".08"/>
  </svg>`;
}

for (const signature of signatures) {
  const path = resolve(`public/art/cards/flagship/${signature.region}/${signature.defId}.webp`);
  await mkdir(dirname(path), { recursive: true });
  await sharp(Buffer.from(scene(signature)))
    .webp({ quality: 88, effort: 5, smartSubsample: true })
    .toFile(path);
}

console.log(`FLAGSHIP SIGNATURE ART: generated ${signatures.length} deterministic ${WIDTH}x${HEIGHT} WebP masters`);
