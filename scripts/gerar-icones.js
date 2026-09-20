/*
 * Gera os ícones do app (silhueta própria de urubu) sem dependências externas.
 * Uso: node scripts/gerar-icones.js
 * Saída: assets/images/icon.png, android-icon-foreground.png, android-icon-monochrome.png,
 *        splash-icon.png, logo.png, favicon.png e urubu.svg
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const VERMELHO = [200, 16, 46, 255];
const PRETO = [10, 10, 11, 255];
const BRANCO = [255, 255, 255, 255];
const TRANSPARENTE = [0, 0, 0, 0];

// --- Formas da silhueta (espaço unitário 0..1) -------------------------------------------------
// A silhueta é a união de elipses e polígonos. O olho é um "furo" (pintado com a cor do fundo).
const FORMAS = [
  { tipo: 'elipse', cx: 0.52, cy: 0.6, rx: 0.23, ry: 0.15 }, // corpo
  { tipo: 'elipse', cx: 0.6, cy: 0.52, rx: 0.22, ry: 0.13 }, // asa dobrada (dorso curvado)
  {
    tipo: 'poligono',
    pontos: [
      [0.66, 0.5],
      [0.84, 0.66],
      [0.8, 0.74],
      [0.6, 0.68],
    ],
  }, // ponta da asa
  {
    tipo: 'poligono',
    pontos: [
      [0.62, 0.66],
      [0.86, 0.78],
      [0.74, 0.82],
      [0.56, 0.74],
    ],
  }, // cauda
  {
    tipo: 'poligono',
    pontos: [
      [0.37, 0.56],
      [0.47, 0.54],
      [0.38, 0.33],
      [0.3, 0.34],
    ],
  }, // pescoço
  { tipo: 'elipse', cx: 0.335, cy: 0.305, rx: 0.062, ry: 0.058 }, // cabeça pequena (pelada)
  {
    tipo: 'poligono',
    pontos: [
      [0.29, 0.27],
      [0.19, 0.3],
      [0.22, 0.345],
      [0.3, 0.335],
    ],
  }, // bico
  {
    tipo: 'poligono',
    pontos: [
      [0.19, 0.3],
      [0.185, 0.385],
      [0.235, 0.34],
    ],
  }, // gancho do bico
  {
    tipo: 'poligono',
    pontos: [
      [0.44, 0.72],
      [0.47, 0.72],
      [0.47, 0.82],
      [0.44, 0.82],
    ],
  }, // perna 1
  {
    tipo: 'poligono',
    pontos: [
      [0.53, 0.72],
      [0.56, 0.72],
      [0.56, 0.82],
      [0.53, 0.82],
    ],
  }, // perna 2
  {
    tipo: 'poligono',
    pontos: [
      [0.28, 0.815],
      [0.74, 0.815],
      [0.74, 0.845],
      [0.28, 0.845],
    ],
  }, // poleiro
];
const OLHO = { cx: 0.335, cy: 0.292, r: 0.013 };

function dentroPoligono(x, y, pts) {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const cruza = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

function dentroSilhueta(u, v) {
  const dx = u - OLHO.cx;
  const dy = v - OLHO.cy;
  if (dx * dx + dy * dy <= OLHO.r * OLHO.r) return false;
  for (const f of FORMAS) {
    if (f.tipo === 'elipse') {
      const ex = (u - f.cx) / f.rx;
      const ey = (v - f.cy) / f.ry;
      if (ex * ex + ey * ey <= 1) return true;
    } else if (dentroPoligono(u, v, f.pontos)) return true;
  }
  return false;
}

/** Amostra a cor de um ponto (px, py) do ícone. */
function corDoPonto(px, py, tam, cfg) {
  const cx = tam / 2;
  const cy = tam / 2;
  const d = Math.hypot(px - cx, py - cy);
  let cor = cfg.fundo;
  if (cfg.circulo && d <= cfg.raioCirculo * tam) cor = cfg.corCirculo;
  // a silhueta ocupa um quadrado de lado (escala * tam) centralizado
  const lado = cfg.escala * tam;
  const u = (px - (cx - lado / 2)) / lado;
  const v = (py - (cy - lado / 2)) / lado;
  if (u >= 0 && u <= 1 && v >= 0 && v <= 1 && dentroSilhueta(u, v)) cor = cfg.corSilhueta;
  return cor;
}

function renderizar(tam, cfg, ss = 3) {
  const buf = Buffer.alloc(tam * tam * 4);
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = corDoPonto(x + (sx + 0.5) / ss, y + (sy + 0.5) / ss, tam, cfg);
          r += c[0] * c[3];
          g += c[1] * c[3];
          b += c[2] * c[3];
          a += c[3];
        }
      }
      const n = ss * ss;
      const i = (y * tam + x) * 4;
      if (a === 0) {
        buf[i] = 0;
        buf[i + 1] = 0;
        buf[i + 2] = 0;
        buf[i + 3] = 0;
      } else {
        buf[i] = Math.round(r / a);
        buf[i + 1] = Math.round(g / a);
        buf[i + 2] = Math.round(b / a);
        buf[i + 3] = Math.round(a / n);
      }
    }
  }
  return buf;
}

// --- Codificador PNG mínimo -------------------------------------------------------------------
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(tipo, dados) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length);
  const td = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(tam, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0);
  ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8; // profundidade de bits
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const linhas = Buffer.alloc((tam * 4 + 1) * tam);
  for (let y = 0; y < tam; y++) {
    linhas[y * (tam * 4 + 1)] = 0; // filtro "none"
    rgba.copy(linhas, y * (tam * 4 + 1) + 1, y * tam * 4, (y + 1) * tam * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(linhas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function svg() {
  const partes = FORMAS.map((f) =>
    f.tipo === 'elipse'
      ? '  <ellipse cx="' +
        f.cx * 100 +
        '" cy="' +
        f.cy * 100 +
        '" rx="' +
        f.rx * 100 +
        '" ry="' +
        f.ry * 100 +
        '" />'
      : '  <polygon points="' +
        f.pontos.map(([x, y]) => x * 100 + ',' + y * 100).join(' ') +
        '" />',
  );
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    '  <!-- Silhueta própria de urubu (mascote da torcida). Não é marca registrada. -->',
    '  <circle cx="50" cy="50" r="50" fill="#C8102E" />',
    '  <g fill="#FFFFFF" transform="translate(12 12) scale(0.76)">',
    ...partes,
    '  </g>',
    '  <circle cx="' +
      (12 + OLHO.cx * 76) +
      '" cy="' +
      (12 + OLHO.cy * 76) +
      '" r="' +
      OLHO.r * 76 +
      '" fill="#C8102E" />',
    '</svg>',
    '',
  ].join('\n');
}

const saida = path.join(__dirname, '..', 'assets', 'images');
fs.mkdirSync(saida, { recursive: true });

const arquivos = [
  [
    'icon.png',
    1024,
    {
      fundo: PRETO,
      circulo: true,
      raioCirculo: 0.44,
      corCirculo: VERMELHO,
      corSilhueta: BRANCO,
      escala: 0.66,
    },
  ],
  [
    'android-icon-foreground.png',
    1024,
    {
      fundo: TRANSPARENTE,
      circulo: true,
      raioCirculo: 0.33,
      corCirculo: VERMELHO,
      corSilhueta: BRANCO,
      escala: 0.5,
    },
  ],
  [
    'android-icon-monochrome.png',
    1024,
    {
      fundo: TRANSPARENTE,
      circulo: false,
      raioCirculo: 0,
      corCirculo: BRANCO,
      corSilhueta: BRANCO,
      escala: 0.5,
    },
  ],
  [
    'splash-icon.png',
    512,
    {
      fundo: TRANSPARENTE,
      circulo: true,
      raioCirculo: 0.5,
      corCirculo: VERMELHO,
      corSilhueta: BRANCO,
      escala: 0.76,
    },
  ],
  [
    'logo.png',
    512,
    {
      fundo: TRANSPARENTE,
      circulo: true,
      raioCirculo: 0.5,
      corCirculo: VERMELHO,
      corSilhueta: BRANCO,
      escala: 0.76,
    },
  ],
  [
    'favicon.png',
    64,
    {
      fundo: VERMELHO,
      circulo: false,
      raioCirculo: 0,
      corCirculo: VERMELHO,
      corSilhueta: BRANCO,
      escala: 0.8,
    },
  ],
];

for (const [nome, tam, cfg] of arquivos) {
  const t0 = Date.now();
  fs.writeFileSync(path.join(saida, nome), png(tam, renderizar(tam, cfg)));
  console.log('✔ ' + nome + ' (' + tam + 'px) em ' + (Date.now() - t0) + 'ms');
}
fs.writeFileSync(path.join(saida, 'urubu.svg'), svg());
console.log('✔ urubu.svg');
