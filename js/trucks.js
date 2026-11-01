import { PRODUCTS, VEHICLES, ORIGINS, FIRMS, DRIVERS, RULES } from './data.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const VLIST = Object.values(VEHICLES);
const SKDM = PRODUCTS.filter((p) => p.skdm);
const FOOD = PRODUCTS.filter((p) => !p.skdm);
const COLD = PRODUCTS.filter((p) => p.kasa === 'frigo');
const r1 = (a, b) => Math.round((a + Math.random() * (b - a)) * 10) / 10;

// Ağır yükte (20 t üstü) taşıma faktörü artar.
export const vehFactor = (v, tons) => v.faktor * (tons > RULES.agirEsik ? RULES.agirKatsayi : 1);

// formula: 'urun' sadece ürün emisyonu, 'tam' taşımayı da ekler.
export const emission = (p, tons, km, v, formula = 'tam') =>
  p.faktor * tons + (formula === 'tam' ? (km / 100) * vehFactor(v, tons) : 0);

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// İlk kamyon her gün kolay gelir (yeni kuralı rahat öğrenmek için), gerisi karışık.
export function makeDeck(day) {
  const [first, ...rest] = day.deck;
  return [first, ...shuffle(rest)];
}

function plate(origin) {
  const L = 'ABCDEFGHJKLMNPRSTUVYZ';
  return `${origin.plaka} ${Array.from({ length: randInt(2, 3) }, () => pick(L)).join('')} ${randInt(100, 999)}`;
}

// Bir kamyon üretir. Doğru karar ve açıklaması kamyonun içinde taşınır.
// day.no >= 2 ise SKDM ürünleri karbon beyanı taşır (beyansiz hariç).
export function makeTruck(fault, day) {
  const formula = day.formula, skdmDay = day.no >= 2;
  const E = (p, tons, km, v) => emission(p, tons, km, v, formula);
  const needsSkdm = ['skdm', 'beyan', 'beyansiz'].includes(fault) || (fault === 'arac');
  const product = fault === 'soguk' ? pick(COLD)
    : fault === 'kacak' ? pick(SKDM)
    : needsSkdm ? pick(SKDM)
      : fault === 'temiz' && skdmDay ? pick(FOOD)
        : pick(PRODUCTS);
  const tons = fault === 'asiri' ? randInt(27, 31) : randInt(14, 24);
  const origin = pick(ORIGINS);
  const vehicle = fault === 'arac' ? VEHICLES.dizel : pick(VLIST);
  const firm = pick(FIRMS);

  const t = {
    fault, firm, origin, vehicle, formula,
    plate: plate(origin),
    driver: pick(DRIVERS),
    code: `${firm.kod} ${randInt(100000, 999999)} ${randInt(0, 9)}`,
    serial: String(randInt(1000, 9999)),
    manifest: { product, tons, vehicle },
    cargo: { product, tons },
  };

  switch (fault) {
    case 'temiz':
      t.correct = product.skdm && skdmDay ? 'vergi' : 'onay';
      t.reason = product.skdm && skdmDay ? 'Belgeler tutarlı, ürün SKDM kapsamında: beyan edilen emisyon kadar vergi.' : 'Belgeler, kasa ve kantar tutarlı.';
      break;
    case 'skdm':
      t.correct = 'vergi';
      t.reason = `${product.ad} SKDM kapsamında ve beyan doğru. Beyan edilen emisyon kadar vergi kesilir.`;
      break;
    case 'urun': {
      const cheaper = PRODUCTS.filter((p) => p.faktor < product.faktor);
      const other = pick(cheaper.length ? cheaper : PRODUCTS.filter((p) => p.id !== product.id));
      t.manifest = { ...t.manifest, product: other };
      t.reason = `Manifestoda ${other.ad} yazıyor, kasadan ${product.ad} çıktı.`;
      t.correct = 'ret';
      break;
    }
    case 'kacak': { // SKDM ürünü gıda diye beyan edilmiş: vergiden kaçış
      const fake = pick(FOOD);
      t.manifest = { ...t.manifest, product: fake };
      t.reason = `Manifestoda ${fake.ad} yazıyor ama kasada ${product.ad} var. SKDM vergisinden kaçmak için yanlış beyan.`;
      t.correct = 'ret';
      break;
    }
    case 'kilo': {
      const extra = randInt(2, 4);
      t.cargo = { product, tons: tons + extra };
      t.reason = `Manifestoda ${tons} ton yazıyor, kantar ${tons + extra} ton gösterdi.`;
      t.correct = 'ret';
      break;
    }
    case 'asiri':
      t.reason = `Kantar ${tons} ton gösteriyor, yasal sınır ${RULES.yukSiniri} ton. Aşırı yük hem yolu yıpratır hem yakıt tüketimini artırır.`;
      t.correct = 'ret';
      break;
    case 'beyansiz':
      t.reason = `${product.ad} SKDM kapsamında ama karbon beyanı yok.`;
      t.correct = 'ret';
      break;
    case 'soguk':
      t.correct = 'ret';
      break;
    case 'arac':
      t.manifest = { ...t.manifest, vehicle: Math.random() < 0.6 ? VEHICLES.elektrik : VEHICLES.lng };
      t.reason = `Manifestoda ${t.manifest.vehicle.ad} yazıyor ama kamyonda egzoz bacası ve duman var: dizel.`;
      t.correct = 'ret';
      break;
    default: // beyan
      break;
  }

  // Soğuk zincir: frigo kasada termograf okuması
  if (product.kasa === 'frigo') {
    const max = product.maxIsi ?? 4;
    t.temp = fault === 'soguk' ? r1(max + 4, max + 10) : r1(0.5, max - 0.2);
    if (fault === 'soguk') t.reason = `Termograf +${String(t.temp).replace('.', ',')} °C gösteriyor, ${product.ad} en çok +${max} °C'de taşınmalı. Soğuk zincir bozulmuş.`;
  }

  // Beyan belgelere göre hesaplanmış görünür (sahte beyan hariç). Sadece SKDM ürünlerinde var.
  t.hasDecl = skdmDay && t.manifest.product.skdm && fault !== 'beyansiz';
  t.declared = E(t.manifest.product, t.manifest.tons, origin.km, t.manifest.vehicle);
  t.real = E(t.cargo.product, t.cargo.tons, origin.km, vehicle);
  if (fault === 'beyan') {
    const lie = Math.round(t.real * (0.45 + Math.random() * 0.25));
    t.declared = lie;
    t.correct = 'ret';
    t.reason = `Beyan ${lie} t, ama doğru hesap ${t.real} t. Sahte beyan.`;
  }
  // Gizli emisyon: SKDM ürününde kağıda geçmeyen kısım (vergiden kaçırılmak istenen).
  t.hidden = skdmDay && t.cargo.product.skdm ? Math.max(0, t.real - (t.hasDecl ? t.declared : 0)) : 0;
  return t;
}
