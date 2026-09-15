import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1536;
const HEIGHT = 1920;

const master = {
  defId: "wood_cub",
  region: "ironwood",
  palette: ["#07110d", "#173328", "#38523a", "#d18a35", "#f3d77a"],
};

function motes() {
  const [, , , accent, hi] = master.palette;
  return Array.from({ length: 54 }, (_, i) => {
    const x = 54 + ((i * 233) % 1428);
    const y = 60 + ((i * 347) % 1768);
    const r = 2 + (i % 6);
    const opacity = (0.08 + (i % 5) * 0.045).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 4 ? accent : hi}" opacity="${opacity}"/>`;
  }).join("");
}

function svg() {
  const [base, mid, deep, accent, hi] = master.palette;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${base}"/><stop offset=".56" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
      <radialGradient id="halo"><stop stop-color="${hi}" stop-opacity=".68"/><stop offset=".32" stop-color="${accent}" stop-opacity=".24"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>
      <linearGradient id="bark" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7a6945"/><stop offset=".55" stop-color="#4d5036"/><stop offset="1" stop-color="#252d22"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="soft"><feGaussianBlur stdDeviation="48"/></filter>
    </defs>
    <rect width="1536" height="1920" fill="url(#bg)"/>
    <ellipse cx="770" cy="900" rx="680" ry="790" fill="url(#halo)" opacity=".24"/>

    <path d="M-110 390 C210 170 430 380 650 185 C865 -8 1120 220 1640 10" fill="none" stroke="#18251d" stroke-width="150" stroke-linecap="round"/>
    <path d="M-90 650 C220 470 430 620 640 455 M1620 640 C1310 455 1110 600 900 445" fill="none" stroke="#26382a" stroke-width="104" stroke-linecap="round"/>
    <path d="M120 355 C330 285 500 350 625 265 M1410 325 C1210 260 1040 330 915 245" fill="none" stroke="${deep}" stroke-width="52" stroke-linecap="round" opacity=".88"/>

    <ellipse cx="790" cy="1115" rx="355" ry="275" fill="url(#bark)" stroke="${accent}" stroke-width="19"/>
    <circle cx="540" cy="925" r="192" fill="url(#bark)" stroke="${hi}" stroke-width="13"/>
    <path d="M415 820 L455 650 L548 805 M572 808 L665 655 L698 840" fill="#293527" stroke="${accent}" stroke-width="16"/>
    <path d="M456 905 Q540 845 622 905" fill="none" stroke="#2a3728" stroke-width="34" stroke-linecap="round"/>
    <ellipse cx="482" cy="925" rx="18" ry="26" fill="${hi}" filter="url(#glow)"/><ellipse cx="592" cy="925" rx="18" ry="26" fill="${hi}" filter="url(#glow)"/>
    <path d="M520 995 Q548 1022 578 992" fill="none" stroke="${hi}" stroke-width="12" stroke-linecap="round"/>

    <path d="M420 855 L380 920 M665 850 L720 910 M520 790 L485 710 M610 790 L648 710" stroke="${accent}" stroke-width="13" stroke-linecap="round" filter="url(#glow)"/>
    <path d="M505 875 C520 825 535 790 548 750 M630 890 C645 842 655 808 670 770" fill="none" stroke="${hi}" stroke-width="6" opacity=".82"/>

    <path d="M650 1220 L510 1515 M850 1245 L965 1520 M1035 1180 L1190 1460" stroke="#30382b" stroke-width="82" stroke-linecap="round"/>
    <path d="M495 1515 L385 1575 M945 1528 L1055 1580 M1170 1468 L1270 1515" stroke="${hi}" stroke-width="27" stroke-linecap="round"/>
    <path d="M1085 1055 Q1320 935 1380 730" fill="none" stroke="#35412f" stroke-width="58" stroke-linecap="round"/>
    <path d="M1130 1015 Q1290 950 1335 830" fill="none" stroke="${accent}" stroke-width="11" opacity=".65"/>

    <path d="M0 1560 C255 1455 490 1610 735 1510 C980 1410 1200 1570 1536 1445 V1920 H0Z" fill="#183126" opacity=".96"/>
    <path d="M0 1725 C300 1630 575 1790 875 1690 C1175 1595 1385 1720 1536 1655 V1920 H0Z" fill="${base}"/>
    <path d="M60 1595 C350 1505 600 1640 875 1550 C1160 1458 1360 1555 1495 1495" fill="none" stroke="${hi}" stroke-width="9" opacity=".2"/>
    <path d="M155 1650 q75 -140 150 0 M355 1625 q82 -160 165 0 M1080 1590 q78 -145 158 0 M1285 1560 q68 -122 138 0" fill="none" stroke="${deep}" stroke-width="28" opacity=".78"/>

    ${motes()}
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
