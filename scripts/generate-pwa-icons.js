import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsDir = path.resolve(__dirname, '../public/images/icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Criar ícone SVG vetorial de alta definição com as cores oficiais TKE (Purple/Magenta + Gradiente Laranja)
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0A0B10" />
      <stop offset="50%" stop-color="#141622" />
      <stop offset="100%" stop-color="#1C1E2E" />
    </linearGradient>
    <linearGradient id="tkeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF5500" />
      <stop offset="45%" stop-color="#D80064" />
      <stop offset="100%" stop-color="#6200EA" />
    </linearGradient>
    <linearGradient id="sheetGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F1F5F9" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#6200EA" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Fundo Arredondado PWA -->
  <rect width="512" height="512" rx="108" fill="url(#bgGrad)" />
  <rect x="16" y="16" width="480" height="480" rx="94" fill="none" stroke="url(#tkeGrad)" stroke-width="4" stroke-opacity="0.4" />

  <!-- Emblema Central em Gradiente TKE -->
  <g filter="url(#shadow)" transform="translate(96, 96)">
    <rect width="320" height="320" rx="64" fill="url(#tkeGrad)" />
    
    <!-- Ícone de Planilha / Orçamento Corporativo -->
    <path d="M70 50 L190 50 L250 110 L250 270 L70 270 Z" fill="url(#sheetGrad)" />
    <path d="M190 50 L190 110 L250 110 Z" fill="#CBD5E1" />
    
    <!-- Linhas da Grade de Orçamento -->
    <rect x="95" y="130" width="130" height="14" rx="4" fill="#6200EA" />
    <rect x="95" y="160" width="60" height="12" rx="3" fill="#D80064" />
    <rect x="165" y="160" width="60" height="12" rx="3" fill="#10B981" />
    <rect x="95" y="185" width="60" height="12" rx="3" fill="#64748B" />
    <rect x="165" y="185" width="60" height="12" rx="3" fill="#64748B" />
    <rect x="95" y="210" width="60" height="12" rx="3" fill="#64748B" />
    <rect x="165" y="210" width="60" height="12" rx="3" fill="#64748B" />
    <rect x="95" y="235" width="130" height="12" rx="3" fill="#FF5500" />
    
    <!-- Símbolo de Verificação GEOR -->
    <circle cx="230" cy="250" r="32" fill="#10B981" />
    <path d="M218 250 L226 258 L244 240" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
  </g>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgIcon);
console.log('✅ [PWA Icon] icon.svg criado com sucesso.');

// Helper para gerar um arquivo PNG válido sem dependências externas pesadas (RGB/RGBA puro comprimido com zlib)
function createRawPng(width, height, isMaskable = false) {
  // Cria cabeçalho PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // Bit depth: 8
  ihdr.writeUInt8(6, 9); // Color type: 6 (RGBA)
  ihdr.writeUInt8(0, 10); // Compression
  ihdr.writeUInt8(0, 11); // Filter
  ihdr.writeUInt8(0, 12); // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Gera dados de pixels (RGBA) com gradiente e badge TKE
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  const cx = width / 2;
  const cy = height / 2;
  const outerR = (width / 2) * (isMaskable ? 0.95 : 0.85);
  const innerR = outerR * 0.7;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Gradiente TKE Purple (#6200EA) -> Magenta (#D80064) -> Orange (#FF5500)
      const gradRatio = Math.min(1, Math.max(0, (x + y) / (width + height)));
      
      let r, g, b, a;

      if (dist <= innerR) {
        // Centro (Emblema)
        r = Math.round(98 + (255 - 98) * (1 - gradRatio));
        g = Math.round(0 + 85 * (1 - gradRatio));
        b = Math.round(234 * gradRatio);
        a = 255;

        // Desenhar detalhe central branco (ícone planilha)
        const nx = (x - cx) / innerR;
        const ny = (y - cy) / innerR;
        if (Math.abs(nx) < 0.45 && Math.abs(ny) < 0.45) {
          r = 255;
          g = 255;
          b = 255;
          a = 255;
        }
        if (Math.abs(nx) < 0.35 && ny > -0.2 && ny < 0.35 && (Math.floor(y / 4) % 3 !== 0)) {
          r = 98;
          g = 0;
          b = 234;
          a = 255;
        }
      } else if (dist <= outerR) {
        // Fundo circular / rounded do ícone
        r = Math.round(10 + 20 * gradRatio);
        g = Math.round(11 + 22 * gradRatio);
        b = Math.round(16 + 32 * gradRatio);
        a = 255;
      } else {
        // Fora do raio
        if (isMaskable) {
          r = 10;
          g = 11;
          b = 16;
          a = 255;
        } else {
          r = 0;
          g = 0;
          b = 0;
          a = 0;
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const crc = calculateCrc(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// CRC32 Table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function calculateCrc(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Gerar todos os formatos exigidos pelo padrão PWA e Apple iOS
const iconSizes = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-192.png', size: 192, maskable: true },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: true },
  { name: 'favicon-32x32.png', size: 32, maskable: false }
];

for (const item of iconSizes) {
  const pngBuffer = createRawPng(item.size, item.size, item.maskable);
  fs.writeFileSync(path.join(iconsDir, item.name), pngBuffer);
  console.log(`✅ [PWA Icon] ${item.name} (${item.size}x${item.size}) gerado com sucesso.`);
}
