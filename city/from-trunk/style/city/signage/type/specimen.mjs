// SIGNAGE · TYPE · the specimen sheet: every face at both cap heights (7 px: the shopfront band · 11 px: a taller board), on the board
// colours it is meant for, one voxel = one bevelled square. No browser: the masks are pure, the PNG is written here.
//   node style/city/signage/type/specimen.mjs [out.png]      (default style/city/shots/lettering/specimen.png)
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../../..');
register(pathToFileURL(path.join(ROOT, 'sim2/node-hooks.mjs')).href);
const { mask, FACES } = await import(pathToFileURL(path.join(HERE, 'index.js')).href);
const OUT = process.argv[2] || path.join(HERE, '../../shots/lettering/specimen.png');

const BOARD = { pixel: [0x2f5bff, 0xf7f7f2], deli: [0x14a83b, 0xf7f7f2], wide: [0x17171b, 0xf7f7f2], slab: [0xffe23a, 0x17171b], black: [0x7a1020, 0xffe3a0],
  varsity: [0xe8232a, 0xf7f7f2], bubble: [0xff7ab6, 0xffffff], script: [0xfff0d0, 0xc2185b], neon: [0x17171b, 0xff4fa3], stencil: [0x8a8f3a, 0x17171b] };
const SAMPLE = { pixel: "SAL'S PIZZA", deli: 'EL PRIMO DELI 24', wide: 'KICKS LAB', slab: 'CHECKS CASHED', black: 'FINE LIQUORS', varsity: 'SOLE PLAYERS',
  bubble: '99¢ DREAM', script: 'SWEET CRUMB', neon: 'OPEN LATE', stencil: 'ARMY SURPLUS' };
const W = 1800, S = 4, rowsOut = [];
const shade = (c, f) => [16, 8, 0].map(s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))));
let H = 0; const ops = [];
const put = (face, str, big, x, y, board, ink) => { const M = mask(face, str, { big, seed: 1, raw: FACES[face].title }); ops.push({ M, x, y, board, ink, face }); return (M.h + 3) * S; };
for (const f of Object.keys(FACES)) {
  const [board, ink] = BOARD[f], F = FACES[f], band = { band: true, y: H, h: 0, board }; ops.push(band);
  let y = H + 12; y += put(f, F.title ? F.name : F.name.toUpperCase().replace('×', 'X'), true, 24, y, board, ink);
  y += put('pixel', (F.uses + (F.note ? ' · ' + F.note : '')).replace(/,/g, ' ·').toUpperCase().replace(/[^A-Z0-9 .,'&¢$·\-]/g, ''), false, 24, y, board, ink) + 6;
  let yl = y, yr = y;
  const T = F.title, L7 = T ? ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', "0123456789 &.'-$¢#/!+·", 'Sweet Crumb'] : ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', "0123456789 &.'-$¢#/!+·", SAMPLE[f]];
  for (const s2 of L7) yl += put(f, s2, false, 24, yl, board, ink) + 4;
  for (const s2 of T ? ['ABCDEFGHIJKLM', 'abcdefghijklm', 'Sweet Crumb'] : ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', SAMPLE[f]]) yr += put(f, s2, true, 980, yr, board, ink);
  band.h = Math.max(yl, yr) + 8 - H; H += band.h + 8;
}
const img = new Uint8Array(W * H * 3).fill(236);
const px = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const k = (y * W + x) * 3; img[k] = c[0]; img[k + 1] = c[1]; img[k + 2] = c[2]; };
const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
const rgb = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
for (const o of ops) if (o.band) rect(8, o.y, W - 16, o.h, rgb(o.board));
for (const o of ops) { if (o.band) continue; const { M, x, y, ink, board } = o, lumB = (((board >> 16) & 255) * .3 + ((board >> 8) & 255) * .59 + (board & 255) * .11) / 255;
  const fxc = o.face === 'neon' ? shade(ink, .4) : lumB < .25 ? shade(ink, .45) : shade(board, .55);
  for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) { const on = M.at(i, j), fx = M.fx && M.fx(i, j); if (!on && !fx) continue;
    const c = on ? rgb(ink) : fxc, X = x + i * S, Y = y + j * S; rect(X, Y, S, S, c); rect(X, Y + S - 1, S, 1, c.map(v => v * .75 | 0)); rect(X + S - 1, Y, 1, S, c.map(v => v * .82 | 0)); } }
// PNG
const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('specimen', OUT, W + '×' + H);
