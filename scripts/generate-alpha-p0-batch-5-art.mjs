import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1536;
const HEIGHT = 1920;

const master = {
  defId: "wood_cub",
  region: "ironwood",
  palette: ["#06110d", "#173328", "#344734", "#d18a35", "#f3d77a"],
};

function motes() {
  const [, , , accent, hi] = master.palette;
  return Array.from({ length: 48 }, (_, i) => {
    const x = 50 + ((i * 239) % 1436);
    const y = 70 + ((i * 353) % 1720);
    const r = 2 + (i % 5);
    const opacity = (0.06 + (i % 5) * 0.035).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 4 ? accent : hi}" opacity="${opacity}"/>`;
  }).join("");
}

function svg() {
  const [base, mid, deep, accent, hi] = master.palette;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${base}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
      <radialGradient id="halo"><stop stop-color="${hi}" stop-opacity=".38"/><stop offset=".35" stop-color="${accent}" stop-opacity=".16"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>
      <linearGradient id="bark" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#655c3d"/><stop offset=".45" stop-color="#403f2d"/><stop offset="1" stop-color="#20281f"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="13" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="1536" height="1920" fill="url(#bg)"/>
    <ellipse cx="780" cy="930" rx="680" ry="790" fill="url(#halo)"/>

    <path d="M-120 350 C180 110 430 350 650 150 C900 -70 1170 175 1660 -40" fill="none" stroke="#17231b" stroke-width="180" stroke-linecap="round"/>
    <path d="M-110 610 C180 430 430 575 650 420 M1650 590 C1330 420 1120 565 880 405" fill="none" stroke="#2a3b2d" stroke-width="110" stroke-linecap="round"/>
    <path d="M90 260 C330 210 470 290 610 205 M1430 250 C1210 185 1040 265 900 190" fill="none" stroke="#506147" stroke-width="44" stroke-linecap="round" opacity=".58"/>

    <path d="M530 940 Q700 760 1010 805 Q1215 835 1285 1015 Q1260 1220 1065 1320 Q790 1380 575 1240 Q480 1110 530 940Z" fill="url(#bark)" stroke="${accent}" stroke-width="17"/>
    <path d="M665 855 L820 790 L910 915 L780 1010 L625 955Z" fill="#596147" stroke="#a46f31" stroke-width="12"/>
    <path d="M865 815 L1040 825 L1100 970 L940 1020 L820 930Z" fill="#4b543e" stroke="#9b6930" stroke-width="12"/>
    <path d="M1000 900 L1165 955 L1195 1110 L1045 1160 L930 1040Z" fill="#414a37" stroke="#8f622e" stroke-width="12"/>
    <path d="M690 1030 L845 970 L960 1080 L885 1220 L710 1200 L625 1110Z" fill="#4d553e" stroke="#98672f" stroke-width="11"/>

    <path d="M740 850 l35 60 l-28 46 l48 54 M970 855 l-25 70 l42 52 l-33 68 M1080 955 l-42 58 l34 48 l-28 72 M745 1050 l42 55 l-26 64" fill="none" stroke="#e2a346" stroke-width="12" stroke-linecap="round" filter="url(#glow)" opacity=".85"/>

    <path d="M350 760 L500 650 L675 700 L735 835 L670 990 L485 1040 L330 930 L300 820Z" fill="#333b2d" stroke="${accent}" stroke-width="18"/>
    <path d="M360 760 L500 670 L650 710 L610 810 L430 815Z" fill="#586047" stroke="#b47a34" stroke-width="12"/>
    <path d="M370 850 L610 845 L655 930 L565 995 L410 975 L345 920Z" fill="#232a22" stroke="#6d704f" stroke-width="11"/>
    <path d="M402 820 L468 806 L446 846 L390 850Z M545 807 L607 819 L619 848 L560 845Z" fill="${hi}" filter="url(#glow)"/>
    <path d="M470 912 L535 912 L520 947 L485 947Z" fill="#111814"/>

    <path d="M385 720 C315 610 310 505 350 420 M390 590 l-90 -65 M378 535 l95 -90 M590 700 C665 585 680 480 650 395 M655 565 l95 -70 M666 510 l-85 -85" fill="none" stroke="#6b7450" stroke-width="34" stroke-linecap="round"/>
    <path d="M385 720 C315 610 310 505 350 420 M590 700 C665 585 680 480 650 395" fill="none" stroke="${accent}" stroke-width="9" opacity=".65"/>

    <path d="M620 1190 L555 1450 L455 1590" fill="none" stroke="#293127" stroke-width="105" stroke-linecap="round"/>
    <path d="M820 1240 L790 1495 L700 1620" fill="none" stroke="#30382b" stroke-width="112" stroke-linecap="round"/>
    <path d="M1040 1190 L1100 1450 L1035 1600" fill="none" stroke="#293127" stroke-width="108" stroke-linecap="round"/>
    <path d="M1180 1125 L1280 1355 L1260 1515" fill="none" stroke="#242d25" stroke-width="100" stroke-linecap="round"/>
    <path d="M395 1595 L455 1560 L510 1595 M645 1625 L700 1590 L760 1620 M980 1605 L1035 1570 L1090 1600 M1205 1520 L1260 1490 L1320 1515" fill="none" stroke="#f0cf72" stroke-width="25" stroke-linecap="round"/>

    <path d="M1240 1030 Q1450 930 1455 690 Q1455 610 1490 555" fill="none" stroke="#3b4635" stroke-width="72" stroke-linecap="round"/>
    <path d="M1240 1030 Q1425 945 1445 770" fill="none" stroke="${accent}" stroke-width="11" opacity=".7"/>

    ${motes()}

    <path d="M0 1570 C250 1450 480 1630 740 1510 C1000 1390 1200 1580 1536 1440 V1920 H0Z" fill="#183126"/>
    <path d="M0 1730 C330 1630 590 1790 900 1690 C1180 1595 1380 1720 1536 1650 V1920 H0Z" fill="${base}"/>
    <path d="M40 1600 C350 1495 610 1650 900 1540 C1165 1440 1380 1540 1510 1490" fill="none" stroke="#77805d" stroke-width="12" opacity=".35"/>
    <path d="M-80 1770 C210 1650 400 1790 630 1700 C850 1615 1080 1710 1290 1645 C1400 1610 1500 1635 1600 1600" fill="none" stroke="#26392b" stroke-width="90" stroke-linecap="round"/>
  </svg>`;
}

async function main() {
  const output = resolve(`public/art/cards/alpha-p0/${master.region}/${master.defId}.webp`);
  await mkdir(dirname(output), { recursive: true });
  await sharp(Buffer.from(svg()))
    .resize(WIDTH, HEIGHT, { fit: "fill" })
    .webp({ quality: 88 })
    .toFile(output);
  console.log("ALPHA P0 ART BATCH 5: generated 1 deterministic 1536x1920 WebP master");
}

await main();
