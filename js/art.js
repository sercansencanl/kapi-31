import * as THREE from 'three';

// Tüm sprite ve dokular burada, Canvas 2D ile çiziliyor. Harici görsel yok.

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const UI_FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
const TYPE_FONT = '"Courier Prime", "Courier New", monospace';

// ---------- Ürün ikonları (tek kaynak: hem 3D etiketlerde hem arayüzde) ----------
export function drawIcon(g, key, cx, cy, s, ink, hole) {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = ink; g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
  const u = s / 100;
  switch (key) {
    case 'sigir': {
      g.beginPath();
      g.moveTo(-40 * u, -6 * u);
      g.bezierCurveTo(-42 * u, -34 * u, 2 * u, -40 * u, 26 * u, -26 * u);
      g.bezierCurveTo(46 * u, -14 * u, 44 * u, 18 * u, 22 * u, 30 * u);
      g.bezierCurveTo(-4 * u, 42 * u, -38 * u, 26 * u, -40 * u, -6 * u);
      g.fill();
      g.strokeStyle = hole; g.lineWidth = 5 * u;
      g.beginPath(); g.moveTo(-26 * u, -4 * u); g.bezierCurveTo(-18 * u, -22 * u, 10 * u, -24 * u, 24 * u, -10 * u); g.stroke();
      g.fillStyle = hole;
      g.beginPath(); g.arc(10 * u, 10 * u, 9 * u, 0, Math.PI * 2); g.fill();
      g.fillStyle = ink;
      g.beginPath(); g.arc(10 * u, 10 * u, 4 * u, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'peynir': {
      g.beginPath();
      g.moveTo(-42 * u, 28 * u); g.lineTo(42 * u, 28 * u); g.lineTo(42 * u, -6 * u); g.lineTo(-42 * u, 6 * u); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-42 * u, 6 * u); g.lineTo(42 * u, -6 * u); g.lineTo(18 * u, -30 * u); g.closePath(); g.fill();
      g.fillStyle = hole;
      [[-18, 16, 7], [8, 12, 5], [26, 18, 6], [-30, 20, 3], [14, -8, 4]].forEach(([x, y, r]) => {
        g.beginPath(); g.arc(x * u, y * u, r * u, 0, Math.PI * 2); g.fill();
      });
      g.fillRect(-42 * u, 4 * u, 84 * u, 2.5 * u);
      break;
    }
    case 'aluminyum': {
      const ingot = (x, y) => {
        x *= u; y *= u;
        g.beginPath();
        g.moveTo(x - 26 * u, y + 12 * u); g.lineTo(x + 26 * u, y + 12 * u);
        g.lineTo(x + 20 * u, y - 10 * u); g.lineTo(x - 20 * u, y - 10 * u); g.closePath(); g.fill();
        g.fillStyle = hole; g.fillRect(x - 14 * u, y - 6 * u, 28 * u, 3 * u); g.fillStyle = ink;
      };
      ingot(-26, 22); ingot(28, 22); ingot(1, -4);
      break;
    }
    case 'pirinc': {
      g.beginPath();
      g.moveTo(-14 * u, -26 * u);
      g.bezierCurveTo(-40 * u, -10 * u, -40 * u, 36 * u, -26 * u, 38 * u);
      g.lineTo(26 * u, 38 * u);
      g.bezierCurveTo(40 * u, 36 * u, 40 * u, -10 * u, 14 * u, -26 * u);
      g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-16 * u, -26 * u); g.lineTo(-22 * u, -42 * u); g.lineTo(0, -32 * u); g.lineTo(22 * u, -42 * u); g.lineTo(16 * u, -26 * u); g.fill();
      g.fillStyle = hole; g.fillRect(-18 * u, -28 * u, 36 * u, 5 * u);
      for (let i = 0; i < 7; i++) {
        g.save(); g.translate((-18 + (i % 4) * 12 + (i > 3 ? 6 : 0)) * u, (6 + (i > 3 ? 14 : 0)) * u); g.rotate(0.5 * (i % 2 ? 1 : -1));
        g.beginPath(); g.ellipse(0, 0, 4.5 * u, 2.2 * u, 0, 0, Math.PI * 2); g.fill(); g.restore();
      }
      break;
    }
    case 'celik': {
      g.beginPath(); g.ellipse(0, -2 * u, 38 * u, 34 * u, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = hole; g.beginPath(); g.ellipse(0, -2 * u, 14 * u, 13 * u, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = hole; g.lineWidth = 2.5 * u;
      [22, 30].forEach((r) => { g.beginPath(); g.ellipse(0, -2 * u, r * u, r * 0.9 * u, 0, 0, Math.PI * 2); g.stroke(); });
      g.fillStyle = ink; g.fillRect(-30 * u, 32 * u, 60 * u, 8 * u);
      break;
    }
    case 'bugday': {
      g.lineWidth = 5 * u;
      g.beginPath(); g.moveTo(0, 44 * u); g.lineTo(0, -40 * u); g.stroke();
      for (let i = 0; i < 4; i++) {
        const y = -30 * u + i * 16 * u;
        [-1, 1].forEach((sd) => {
          g.save(); g.translate(sd * 9 * u, y); g.rotate(sd * 0.55);
          g.beginPath(); g.ellipse(0, 0, 6 * u, 11 * u, 0, 0, Math.PI * 2); g.fill(); g.restore();
        });
      }
      g.beginPath(); g.ellipse(0, -44 * u, 5 * u, 10 * u, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'cimento': { // kağıt torba, dikişli üst
      g.beginPath(); g.roundRect(-36 * u, -30 * u, 72 * u, 70 * u, 6 * u); g.fill();
      g.fillStyle = hole;
      for (let i = 0; i < 6; i++) g.fillRect((-30 + i * 11) * u, -26 * u, 5 * u, 3 * u);
      g.fillRect(-22 * u, -2 * u, 44 * u, 26 * u);
      g.fillStyle = ink;
      g.beginPath(); g.moveTo(-14 * u, 18 * u); g.lineTo(0, 2 * u); g.lineTo(14 * u, 18 * u); g.closePath(); g.fill();
      break;
    }
    case 'gubre': { // çuval + yaprak
      g.beginPath();
      g.moveTo(-30 * u, -28 * u); g.lineTo(30 * u, -28 * u); g.lineTo(38 * u, 40 * u); g.lineTo(-38 * u, 40 * u); g.closePath(); g.fill();
      g.fillStyle = hole;
      g.beginPath(); g.moveTo(-14 * u, 26 * u); g.bezierCurveTo(-16 * u, -2 * u, 6 * u, -12 * u, 18 * u, -10 * u);
      g.bezierCurveTo(18 * u, 10 * u, 4 * u, 26 * u, -14 * u, 26 * u); g.fill();
      g.strokeStyle = ink; g.lineWidth = 3 * u;
      g.beginPath(); g.moveTo(-12 * u, 24 * u); g.lineTo(12 * u, -6 * u); g.stroke();
      break;
    }
    // Araç ipuçları
    case 'dizel': {
      g.fillRect(-8 * u, -10 * u, 16 * u, 54 * u);
      g.globalAlpha = 0.85;
      [[0, -24, 12], [12, -42, 15], [-6, -56, 11]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x * u, y * u, r * u, 0, Math.PI * 2); g.fill(); });
      break;
    }
    case 'lng': {
      g.beginPath(); g.roundRect(-40 * u, -18 * u, 80 * u, 36 * u, 18 * u); g.fill();
      g.fillStyle = hole; g.fillRect(-18 * u, -18 * u, 6 * u, 36 * u); g.fillRect(12 * u, -18 * u, 6 * u, 36 * u);
      break;
    }
    case 'elektrik': {
      g.beginPath();
      g.moveTo(8 * u, -44 * u); g.lineTo(-24 * u, 6 * u); g.lineTo(-2 * u, 6 * u);
      g.lineTo(-10 * u, 44 * u); g.lineTo(24 * u, -8 * u); g.lineTo(2 * u, -8 * u); g.closePath(); g.fill();
      break;
    }
  }
  g.restore();
}

const iconCache = new Map();
export function iconURL(key, ink = '#1d2830', hole = '#f6f3ea') {
  const id = `${key}|${ink}|${hole}`;
  if (!iconCache.has(id)) {
    const [c, g] = cv(128, 128);
    drawIcon(g, key, 64, 64, 112, ink, hole);
    iconCache.set(id, c.toDataURL());
  }
  return iconCache.get(id);
}

// ---------- Firma logoları ----------
export function drawLogo(g, shape, x, y, s, color) {
  g.save(); g.translate(x, y); g.fillStyle = color; g.strokeStyle = color;
  const r = s / 2;
  switch (shape) {
    case 'tri': g.beginPath(); g.moveTo(0, -r); g.lineTo(r, r * 0.8); g.lineTo(-r, r * 0.8); g.closePath(); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, -r * 0.2); g.lineTo(r * 0.45, r * 0.8); g.lineTo(-r * 0.45, r * 0.8); g.closePath(); g.fill(); break;
    case 'wave': g.lineWidth = s * 0.12; for (let i = 0; i < 3; i++) { g.beginPath(); for (let k = -r; k <= r; k += 2) g.lineTo(k, -r * 0.5 + i * r * 0.5 + Math.sin(k / r * Math.PI * 1.5) * r * 0.18); g.stroke(); } break;
    case 'bars': for (let i = 0; i < 4; i++) g.fillRect(-r + i * r * 0.55, r - (i + 1) * r * 0.48, r * 0.38, (i + 1) * r * 0.48); break;
    case 'leaf': g.beginPath(); g.moveTo(-r, r); g.bezierCurveTo(-r, -r * 0.4, r * 0.2, -r, r, -r); g.bezierCurveTo(r, r * 0.2, r * 0.2, r, -r, r); g.fill(); break;
    case 'circle': g.lineWidth = s * 0.16; g.beginPath(); g.arc(0, 0, r * 0.8, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, r * 0.3, 0, Math.PI * 2); g.fill(); break;
    case 'diamond': g.beginPath(); g.moveTo(0, -r); g.lineTo(r, 0); g.lineTo(0, r); g.lineTo(-r, 0); g.closePath(); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.fillRect(-r * 0.2, -r * 0.2, r * 0.4, r * 0.4); break;
  }
  g.restore();
}

// ---------- Konteyner dokuları ----------
function corrugate(g, w, h, base, vertical = true, step = 18) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const n = Math.ceil((vertical ? w : h) / step);
  for (let i = 0; i < n; i++) {
    const p = i * step;
    const grad = vertical ? g.createLinearGradient(p, 0, p + step, 0) : g.createLinearGradient(0, p, 0, p + step);
    grad.addColorStop(0, 'rgba(255,255,255,0.10)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.0)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.16)');
    grad.addColorStop(1, 'rgba(0,0,0,0.02)');
    g.fillStyle = grad;
    vertical ? g.fillRect(p, 0, step, h) : g.fillRect(0, p, w, step);
  }
  // kir ve yıpranma
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '60,40,20' : '255,255,255'},${Math.random() * 0.05})`;
    g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 40, Math.random() * 6);
  }
  const rust = g.createLinearGradient(0, h * 0.75, 0, h);
  rust.addColorStop(0, 'rgba(110,60,30,0)'); rust.addColorStop(1, 'rgba(110,60,30,0.22)');
  g.fillStyle = rust; g.fillRect(0, h * 0.75, w, h * 0.25);
}

export function containerSide(firm, code) {
  const [c, g] = cv(1536, 500);
  corrugate(g, 1536, 500, firm.renk);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 1536, 16); g.fillRect(0, 484, 1536, 16);
  drawLogo(g, firm.logo, 250, 250, 170, '#f7f4ec');
  g.fillStyle = '#f7f4ec';
  g.font = `700 150px ${UI_FONT}`; g.textBaseline = 'middle';
  g.fillText(firm.ad, 380, 260);
  g.font = `600 44px ${UI_FONT}`;
  g.fillText(code, 1180, 70);
  g.font = `500 30px ${UI_FONT}`;
  g.fillText('MAX GROSS 30.480 KG', 1180, 420);
  g.fillText('TARE 2.220 KG', 1180, 455);
  return tex(c);
}

export function containerDoor(firm, code, withCode) {
  const [c, g] = cv(256, 512);
  corrugate(g, 256, 512, firm.renk, false, 22);
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 504);
  if (withCode) {
    g.fillStyle = '#f7f4ec'; g.font = `700 34px ${UI_FONT}`;
    g.fillText(code.split(' ')[0], 30, 70);
    g.font = `600 28px ${UI_FONT}`;
    g.fillText(code.split(' ').slice(1).join(' '), 30, 104);
    g.fillStyle = '#f2d24a'; g.fillRect(30, 420, 90, 34);
    g.fillStyle = '#222'; g.font = `700 22px ${UI_FONT}`; g.fillText('22G1', 40, 445);
  }
  return tex(c);
}

let corr;
export function yardCorrugated() {
  if (corr) return corr;
  const [c, g] = cv(512, 128);
  corrugate(g, 512, 128, '#ffffff', true, 14);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 512, 5); g.fillRect(0, 123, 512, 5);
  corr = tex(c);
  return corr;
}

// ---------- Sandık ----------
let wood;
export function woodTexture() {
  if (wood) return wood;
  const [c, g] = cv(256, 256);
  g.fillStyle = '#b48552'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#a77846' : '#bb8d59'; g.fillRect(0, i * 64, 256, 62);
    g.fillStyle = 'rgba(60,35,15,0.5)'; g.fillRect(0, i * 64 + 62, 256, 2);
  }
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(80,50,20,${Math.random() * 0.25})`; g.lineWidth = 1;
    const y = Math.random() * 256; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + 4, 170, y - 4, 256, y + 2); g.stroke();
  }
  g.fillStyle = '#7a5530'; g.fillRect(0, 0, 18, 256); g.fillRect(238, 0, 18, 256);
  wood = tex(c);
  return wood;
}

const labelCache = new Map();
export function crateLabel(product) {
  if (labelCache.has(product.id)) return labelCache.get(product.id);
  const [c, g] = cv(256, 256);
  g.drawImage(woodTexture().image, 0, 0);
  g.fillStyle = '#f4efe2'; g.fillRect(40, 44, 176, 168);
  g.fillStyle = product.renk; g.fillRect(40, 44, 176, 30);
  drawIcon(g, product.id, 128, 128, 84, '#1d2830', '#f4efe2');
  g.fillStyle = '#1d2830'; g.font = `700 30px ${UI_FONT}`; g.textAlign = 'center';
  g.fillText(product.ad, 128, 200);
  // şablon boya izi
  g.fillStyle = 'rgba(30,20,10,0.55)'; g.font = `700 20px ${UI_FONT}`; g.fillText('1000 KG', 128, 236);
  const t = tex(c);
  labelCache.set(product.id, t);
  return t;
}

// ---------- Plaka ----------
export function plateTexture(text) {
  const [c, g] = cv(512, 112);
  g.fillStyle = '#f7f7f2'; g.fillRect(0, 0, 512, 112);
  g.fillStyle = '#1f47a8'; g.fillRect(0, 0, 64, 112);
  g.fillStyle = '#fff'; g.font = `700 34px ${UI_FONT}`; g.textAlign = 'center'; g.fillText('TR', 32, 92);
  g.fillStyle = '#111'; g.font = `700 78px ${UI_FONT}`; g.fillText(text, 288, 84);
  g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(3, 3, 506, 106);
  return tex(c);
}

// ---------- LED kantar ekranı ----------
export function makeLed() {
  const [c, g] = cv(768, 320);
  const t = tex(c);
  const set = (big, small, color = '#ffb43b') => {
    g.fillStyle = '#0d0f10'; g.fillRect(0, 0, 768, 320);
    g.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 0; y < 320; y += 6) g.fillRect(0, y, 768, 2);
    g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 24;
    g.textAlign = 'right'; g.font = `700 180px ${UI_FONT}`;
    g.fillText(big, 700, 220);
    g.shadowBlur = 0; g.textAlign = 'left'; g.font = `600 44px ${UI_FONT}`;
    g.fillStyle = 'rgba(255,180,59,0.7)';
    g.fillText(small, 40, 290);
    t.needsUpdate = true;
  };
  set('– –', 'Kantar boş');
  return { texture: t, set };
}

// ---------- Tabela ----------
export function signTexture() {
  const [c, g] = cv(1024, 256);
  g.fillStyle = '#1f3a4c'; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#f2c230'; g.fillRect(0, 226, 1024, 30);
  g.fillStyle = '#f7f4ec'; g.font = `700 150px "Big Shoulders Stencil", ${UI_FONT}`; g.textBaseline = 'middle';
  g.fillText('Kapı 31', 50, 118);
  g.font = `500 46px ${UI_FONT}`; g.fillStyle = '#b9cbd6';
  g.fillText('Karbon sınır denetimi', 600, 96);
  g.fillText('Antalya Limanı', 600, 150);
  return tex(c);
}

// ---------- 3D masa: belgeler, etiketler, tablet ----------
function paperBase(g, w, h, color) {
  g.fillStyle = color; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = `rgba(80,60,30,${Math.random() * 0.035})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}
const fmtN = (n) => Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 1 });

export function manifestTexture(t) {
  const W = 720, H = 960;
  const [c, g] = cv(W, H);
  paperBase(g, W, H, '#fbfaf4');
  g.fillStyle = '#2a2f33'; g.font = `700 46px ${UI_FONT}`; g.textBaseline = 'alphabetic';
  g.fillText('Taşıma manifestosu', 44, 82);
  g.font = `500 24px ${UI_FONT}`; g.fillStyle = '#6c6a5f'; g.textAlign = 'right';
  g.fillText(`Form KS-1, no ${t.serial}`, W - 44, 80);
  g.textAlign = 'left';
  g.fillStyle = '#2a2f33'; g.fillRect(44, 104, W - 88, 4);
  const rows = [
    ['Plaka', t.plate], ['Firma', t.firm.ad], ['Sürücü', t.driver],
    ['Çıkış', `${t.origin.sehir}, ${t.origin.km} km`], ['Araç', t.manifest.vehicle.ad],
    ['Yük', t.manifest.product.ad, true], ['Miktar', `${t.manifest.tons} ton`, true], ['Konteyner', t.code],
  ];
  rows.forEach(([k, v, hl], i) => {
    const y = 190 + i * 88;
    if (hl) { g.fillStyle = 'rgba(240,185,40,0.38)'; g.fillRect(220, y - 18, W - 264, 26); }
    g.fillStyle = '#7a7f84'; g.font = `500 32px ${UI_FONT}`; g.fillText(k, 44, y);
    g.fillStyle = '#22309a'; g.font = `700 38px ${TYPE_FONT}`; g.fillText(v, 220, y);
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(44, y + 26, W - 88, 2);
  });
  return tex(c);
}

export function declTexture(t) {
  const W = 720, H = 960;
  const [c, g] = cv(W, H);
  paperBase(g, W, H, '#f3dc77');
  g.fillStyle = '#5b4a0c'; g.font = `700 46px ${UI_FONT}`;
  g.fillText('Karbon beyanı', 44, 82);
  g.font = `500 24px ${UI_FONT}`; g.textAlign = 'right'; g.fillText('Yönetmelik madde 7', W - 44, 80); g.textAlign = 'left';
  g.fillRect(44, 104, W - 88, 4);
  g.fillStyle = '#22309a'; g.font = `700 40px ${TYPE_FONT}`; g.fillText(t.firm.ad, 44, 190);
  g.font = `400 30px ${TYPE_FONT}`; g.fillText(t.code, 44, 236);
  g.fillStyle = '#5b4a0c'; g.font = `500 34px ${UI_FONT}`; g.fillText('Sevkiyatın toplam emisyonu', 44, 380);
  g.fillStyle = '#22309a'; g.font = `700 190px ${TYPE_FONT}`; g.fillText(fmtN(t.declared), 40, 560);
  g.font = `700 40px ${TYPE_FONT}`; g.fillText('t CO₂e', 48, 620);
  g.fillStyle = '#8a7a3a'; g.fillRect(44, 820, 460, 3);
  g.fillStyle = '#22309a'; g.font = `italic 400 40px ${TYPE_FONT}`;
  const [first, ...rest] = t.driver.split(' ');
  g.fillText(`${first[0]}. ${rest.join(' ')}`, 54, 800);
  return tex(c);
}

export function labelTexture(text, sub, color = '#f2efe6', ink = '#1d2830') {
  const [c, g] = cv(512, 176);
  g.fillStyle = color; g.beginPath(); g.roundRect(4, 4, 504, 168, 18); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 6; g.stroke();
  g.fillStyle = ink; g.textAlign = 'center';
  g.font = `700 ${sub ? 72 : 84}px ${UI_FONT}`; g.fillText(text, 256, sub ? 92 : 116);
  if (sub) { g.font = `600 42px ${UI_FONT}`; g.globalAlpha = 0.75; g.fillText(sub, 256, 148); }
  return tex(c);
}

// ---------- Zemin ve çevre dokuları ----------
function speckle(g, w, h, n, alpha, light = 0.5) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < light ? `rgba(255,255,255,${Math.random() * alpha})` : `rgba(0,0,0,${Math.random() * alpha})`;
    const s = 1 + Math.random() * 2.5; g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}

// Asfalt şerit: agrega, yamalar, çatlaklar, yağ lekeleri ve teker izleri. Uzunluk boyunca tekrarlar.
export function asphaltTexture() {
  const W = 1024, H = 256;
  const [c, g] = cv(W, H);
  g.fillStyle = '#3d3f42'; g.fillRect(0, 0, W, H);
  speckle(g, W, H, 26000, 0.12, 0.45);
  // teker izleri: iki koyu, cilalı bant
  [0.3, 0.7].forEach((p) => {
    const y = p * H, grad = g.createLinearGradient(0, y - 30, 0, y + 30);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.5, 'rgba(0,0,0,0.22)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, y - 30, W, 60);
  });
  // yamalar
  for (let i = 0; i < 4; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '20,20,22' : '80,80,82'},0.25)`;
    g.fillRect(Math.random() * W, Math.random() * H, 60 + Math.random() * 140, 30 + Math.random() * 60);
  }
  // yağ lekeleri (orta hatta, kamyonların durduğu yerde yoğun)
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * W, y = H * (0.35 + Math.random() * 0.3), r = 6 + Math.random() * 26;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(10,8,6,0.45)'); rg.addColorStop(1, 'rgba(10,8,6,0)');
    g.fillStyle = rg; g.beginPath(); g.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2); g.fill();
  }
  // çatlaklar
  g.strokeStyle = 'rgba(15,15,16,0.55)'; g.lineWidth = 1.4;
  for (let i = 0; i < 10; i++) {
    let x = Math.random() * W, y = Math.random() * H;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (Math.random() - 0.3) * 22; y += (Math.random() - 0.5) * 16; g.lineTo(x, y); }
    g.stroke();
  }
  return tex(c, [20, 1]);
}

// Liman sahası: dökme beton plakalar, derz çizgileri, lekeler.
export function concreteTexture() {
  const S = 512;
  const [c, g] = cv(S, S);
  g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, S, S);
  speckle(g, S, S, 14000, 0.08, 0.5);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { // plaka ton farkı
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`;
    g.fillRect(i * 128, j * 128, 128, 128);
  }
  g.strokeStyle = 'rgba(60,55,48,0.45)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, S); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(S, i * 128); g.stroke(); }
  for (let i = 0; i < 6; i++) { // pas/su lekeleri
    const x = Math.random() * S, y = Math.random() * S, r = 20 + Math.random() * 50;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(90,70,45,0.18)'); rg.addColorStop(1, 'rgba(90,70,45,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return tex(c, [70, 70]);
}

// Beton bariyer: kir, alt kısımda koyulaşma, reflektörlü bant.
export function barrierTexture() {
  const [c, g] = cv(256, 128);
  g.fillStyle = '#b3ada2'; g.fillRect(0, 0, 256, 128);
  speckle(g, 256, 128, 3000, 0.1, 0.5);
  const gr = g.createLinearGradient(0, 70, 0, 128);
  gr.addColorStop(0, 'rgba(60,50,40,0)'); gr.addColorStop(1, 'rgba(60,50,40,0.4)');
  g.fillStyle = gr; g.fillRect(0, 70, 256, 58);
  for (let i = 0; i < 8; i++) { // akıntı izleri
    const x = Math.random() * 256; g.fillStyle = 'rgba(70,60,50,0.12)'; g.fillRect(x, 20, 3 + Math.random() * 4, 60 + Math.random() * 40);
  }
  // canvas y aşağı, UV v yukarı: bant tepeye yakın (v≈0.8) → canvas y≈25
  g.fillStyle = '#e9b320'; g.fillRect(0, 18, 256, 12);
  g.fillStyle = '#1b1b1b'; for (let x = -10; x < 270; x += 24) { g.beginPath(); g.moveTo(x, 30); g.lineTo(x + 10, 30); g.lineTo(x + 22, 18); g.lineTo(x + 12, 18); g.fill(); }
  return tex(c, [1, 1]);
}

// Kabin ön ızgarası: krom çerçeve, yatay lameller, ortada logo yuvası.
export function grilleTexture() {
  const [c, g] = cv(256, 256);
  g.fillStyle = '#16191c'; g.fillRect(0, 0, 256, 256);
  for (let y = 14; y < 250; y += 20) {
    const gr = g.createLinearGradient(0, y, 0, y + 12);
    gr.addColorStop(0, '#9aa3aa'); gr.addColorStop(0.5, '#e4e8eb'); gr.addColorStop(1, '#6d757c');
    g.fillStyle = gr; g.fillRect(14, y, 228, 10);
  }
  g.strokeStyle = '#cfd5da'; g.lineWidth = 12; g.strokeRect(6, 6, 244, 244);
  g.fillStyle = '#e4e8eb'; g.beginPath(); g.roundRect(98, 108, 60, 40, 8); g.fill();
  g.fillStyle = '#16191c'; g.font = `700 26px ${UI_FONT}`; g.textAlign = 'center'; g.fillText('K31', 128, 137);
  return tex(c);
}

// Kabin yan camı: karanlık iç mekân, koltuk, sürücü silüeti ve cam yansıması.
// Kamyon -X yönüne bakıyor; +Z yüzünde u ekseni +X'e gider, yani ön taraf görüntünün solunda.
let driverTex;
export function driverWindow() {
  if (driverTex) return driverTex;
  const [c, g] = cv(256, 192);
  const bg = g.createLinearGradient(0, 0, 0, 192);
  bg.addColorStop(0, '#2a3a44'); bg.addColorStop(1, '#0e1418');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 192);
  g.fillStyle = '#1a1d20'; g.beginPath(); g.roundRect(150, 40, 70, 160, 14); g.fill();      // koltuk sırtı
  g.fillStyle = '#23272b'; g.beginPath(); g.roundRect(158, 18, 52, 34, 10); g.fill();       // koltuk başlığı
  g.fillStyle = '#0b0d0f';
  g.beginPath(); g.ellipse(132, 70, 22, 27, 0, 0, Math.PI * 2); g.fill();                    // baş
  g.beginPath(); g.moveTo(84, 192); g.bezierCurveTo(88, 120, 108, 100, 132, 100);
  g.bezierCurveTo(160, 100, 178, 122, 182, 192); g.fill();                                   // omuzlar
  g.strokeStyle = '#0b0d0f'; g.lineWidth = 9;
  g.beginPath(); g.ellipse(52, 150, 34, 46, -0.25, -1.9, 1.2); g.stroke();                   // direksiyon
  const rf = g.createLinearGradient(0, 0, 256, 192);                                         // cam yansıması
  rf.addColorStop(0, 'rgba(255,255,255,0)'); rf.addColorStop(0.42, 'rgba(255,255,255,0)');
  rf.addColorStop(0.5, 'rgba(255,240,220,0.22)'); rf.addColorStop(0.6, 'rgba(255,255,255,0)');
  g.fillStyle = rf; g.fillRect(0, 0, 256, 192);
  driverTex = tex(c);
  return driverTex;
}

// Konsol yüzeyi: fırçalanmış, hafif aşınmış metal.
export function brushedMetal() {
  const [c, g] = cv(512, 512);
  g.fillStyle = '#5d6c76'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1400; i++) {
    const y = Math.random() * 512, l = 40 + Math.random() * 260, x = Math.random() * 512;
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + Math.random() * 0.05})`;
    g.fillRect(x, y, l, 1);
  }
  for (let i = 0; i < 40; i++) { // çizikler
    g.strokeStyle = `rgba(255,255,255,${Math.random() * 0.08})`; g.lineWidth = 1;
    g.beginPath(); const x = Math.random() * 512, y = Math.random() * 512; g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 30); g.stroke();
  }
  return tex(c, [3, 1]);
}

// Belgelerin altındaki deri sümen.
export function blotter() {
  const [c, g] = cv(512, 384);
  g.fillStyle = '#23302c'; g.fillRect(0, 0, 512, 384);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; g.fillRect(Math.random() * 512, Math.random() * 384, 2, 2); }
  g.fillStyle = '#5a3a24'; // köşe deri parçaları
  [[0, 0, 1, 1], [512, 0, -1, 1], [0, 384, 1, -1], [512, 384, -1, -1]].forEach(([x, y, sx, sy]) => {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + sx * 70, y); g.lineTo(x, y + sy * 70); g.closePath(); g.fill();
  });
  g.strokeStyle = 'rgba(240,230,200,0.35)'; g.setLineDash([6, 6]); g.lineWidth = 2; g.strokeRect(12, 12, 488, 360);
  return tex(c);
}

export function stickyNote(lines) {
  const [c, g] = cv(256, 256);
  g.fillStyle = '#f7d94c'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 0, 256, 34);
  g.fillStyle = '#26303a'; g.font = `italic 700 36px ${TYPE_FONT}`;
  lines.forEach((l, i) => g.fillText(l, 18, 82 + i * 52));
  return tex(c);
}

// Düğme kapağının üst yüzü: renk + simge.
export function capTexture(kind, color) {
  const [c, g] = cv(256, 256);
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  const rg = g.createRadialGradient(100, 90, 10, 128, 128, 140);
  rg.addColorStop(0, 'rgba(255,255,255,0.35)'); rg.addColorStop(1, 'rgba(0,0,0,0.15)');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.fillStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 22; g.lineCap = 'round'; g.lineJoin = 'round';
  g.translate(128, 128);
  g.rotate(-Math.PI / 2); // silindir kapağının UV'si dokuyu 90° çeviriyor, telafi
  g.beginPath();
  if (kind === 'onay') { g.moveTo(-50, 4); g.lineTo(-14, 40); g.lineTo(52, -34); g.stroke(); }
  else if (kind === 'ret') { g.moveTo(-42, -42); g.lineTo(42, 42); g.moveTo(42, -42); g.lineTo(-42, 42); g.stroke(); }
  else if (kind === 'vergi') { g.font = `700 150px ${UI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('€', 0, 8); }
  else { g.lineWidth = 16; g.strokeRect(-56, -40, 112, 80); g.moveTo(0, -40); g.lineTo(0, 40); g.stroke(); }
  return tex(c);
}

export function tabletTexture() {
  const [c, g] = cv(640, 448);
  const grad = g.createLinearGradient(0, 0, 0, 448);
  grad.addColorStop(0, '#1d3442'); grad.addColorStop(1, '#122029');
  g.fillStyle = grad; g.fillRect(0, 0, 640, 448);
  g.fillStyle = '#f0b928'; g.fillRect(0, 0, 640, 14);
  g.fillStyle = '#e9eef0'; g.font = `700 64px ${UI_FONT}`; g.fillText('El kitabı', 40, 110);
  g.font = `500 38px ${UI_FONT}`; g.fillStyle = '#a6b5bd';
  ['Kurallar', 'Faktörler', 'Emisyon formu'].forEach((s, i) => g.fillText(s, 40, 190 + i * 58));
  g.fillStyle = '#f0b928'; g.font = `600 34px ${UI_FONT}`; g.fillText('Dokun veya F', 40, 400);
  return tex(c);
}

export function hazardTexture() {
  const [c, g] = cv(128, 32);
  g.fillStyle = '#e9b320'; g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#1b1b1b';
  for (let x = -32; x < 160; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 48, 0); g.lineTo(x + 32, 0); g.fill(); }
  return tex(c, [12, 1]);
}

export function softDot() {
  const [c, g] = cv(64, 64);
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return tex(c);
}

export function sunGlow() {
  const [c, g] = cv(256, 256);
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,240,210,1)'); r.addColorStop(0.12, 'rgba(255,214,160,0.9)');
  r.addColorStop(0.4, 'rgba(255,190,130,0.25)'); r.addColorStop(1, 'rgba(255,190,130,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  return tex(c);
}
