import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { alphaArtBacklogSnapshot, alphaArtExposure } from "./alpha-art-priority";
import { getCardArt } from "./card-art";
import { getCard } from "./cards";
import { ALPHA_P1_ACTIVE_IDS, ALPHA_P1_ART_FORMAT, ALPHA_P1_ART_TARGETS, ALPHA_P1_BATCH_4_IDS, alphaP1ArtUrl } from "./alpha-p1-art";
const expected=["wood_bark_rupture","wood_claw","wood_martyr","wood_recall","wood_root_prison"] as const;
async function main(){
 const ids=[...ALPHA_P1_BATCH_4_IDS], targets=ALPHA_P1_ART_TARGETS.filter(t=>ids.includes(t.defId as any));
 assert.deepEqual(ids,[...expected]); assert.deepEqual(targets.map(t=>t.defId),[...expected]); assert.equal(targets.length,5);
 assert.ok(ids.every(id=>ALPHA_P1_ACTIVE_IDS.includes(id)));
 assert.deepEqual(alphaArtBacklogSnapshot(),{starterDecks:6,starterSlots:240,uniqueStarterCards:140,covered:71,missing:69,byPriority:{P0:0,P1:26,P2:43}});
 for(const t of targets){const e=alphaArtExposure(t.defId);assert.equal(e.priority,"covered");assert.equal(e.copies,2);assert.equal(e.deckCount,1);assert.equal(e.knownDedicatedArt,true);assert.equal(alphaP1ArtUrl(t.defId),t.assetPath);assert.equal(getCardArt(t.defId)?.url,t.assetPath);assert.equal(getCard(t.defId).art,t.assetPath);assert.ok(t.brief.length>=100);}
 execFileSync(process.execPath,["scripts/generate-alpha-p1-batch-4-art.mjs"],{cwd:process.cwd(),stdio:"inherit"});
 const tiles:Buffer[]=[];
 for(const t of targets){const disk=resolve(`public${t.assetPath}`),m=await sharp(disk).metadata();assert.equal(m.format,"webp");assert.equal(m.width,ALPHA_P1_ART_FORMAT.masterWidth);assert.equal(m.height,ALPHA_P1_ART_FORMAT.masterHeight);assert.equal(m.pages??1,1);const thumb=await sharp(disk).resize({width:270,height:338,fit:"cover"}).png().toBuffer();const label=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="62"><rect width="300" height="62" fill="#0a0b0f"/><text x="150" y="25" text-anchor="middle" fill="#f4f0df" font-size="15" font-family="sans-serif" font-weight="700">${t.defId}</text><text x="150" y="47" text-anchor="middle" fill="#aaa7a0" font-size="12" font-family="sans-serif">${t.region} · P1 master · Batch 4</text></svg>`);tiles.push(await sharp({create:{width:300,height:420,channels:4,background:"#0a0b0f"}}).composite([{input:thumb,left:15,top:10},{input:label,left:0,top:358}]).png().toBuffer());}
 const out=resolve("artifacts/alpha-visual/58-alpha-p1-batch-4-contact-sheet.png");await mkdir(dirname(out),{recursive:true});await sharp({create:{width:1500,height:420,channels:4,background:"#050608"}}).composite(tiles.map((input,i)=>({input,left:i*300,top:0}))).png().toFile(out);
 console.log("FORGED ALPHA P1 ART BATCH 4: 5/5 physical masters · 1536x1920 WebP · 71 covered / 69 backlog / 26 P1 pending / 43 P2 pending · contact sheet 58 PASS");
}
void main().catch(e=>{console.error("FORGED ALPHA P1 ART BATCH 4: FAIL",e);process.exitCode=1;});
