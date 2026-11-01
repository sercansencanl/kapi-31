import { ECON, FAMILY } from './data.js';

export function newHome() {
  return {
    savings: ECON.baslangic,
    debt: 0,
    temp: ECON.baslangicSicaklik,
    family: FAMILY.map((m) => ({ ...m, ac: 0, hasta: false, last: 'iyi' })),
  };
}

export const income = (s) => ECON.maasTaban + s.right * ECON.prim - s.wrong * ECON.kesinti;

// Bugün limandan geçen emisyona göre yarının sıcaklığı.
export const nextTemp = (home, emission) => home.temp + Math.round(emission / ECON.emisyonPerDerece);

export function bills(home, temp) {
  const list = [
    { id: 'kira', ad: home.debt ? `Kira, ${home.debt} ₺ borç dahil` : 'Kira', tutar: ECON.kira + home.debt,
      risk: 'Ödenmezse borç birikir.' },
    { id: 'gida', ad: 'Gıda', tutar: ECON.gida, risk: 'Ödenmezse ailen aç kalır.' },
    { id: 'su', ad: temp > ECON.sicakEsik ? 'Su, kuraklık zammı' : 'Su', tutar: ECON.su + Math.max(0, temp - ECON.sicakEsik) * ECON.suDerece,
      risk: 'Ödenmezse ailen susuz kalır.' },
    { id: 'elektrik', ad: `Elektrik ve klima, ${temp}°C`, tutar: ECON.elektrikTaban + Math.max(0, temp - ECON.baslangicSicaklik) * ECON.elektrikDerece,
      risk: temp >= ECON.sicakEsik ? 'Ödenmezse annen sıcak çarpabilir.' : 'Ödenmezse ev ısınır.' },
  ];
  if (home.family.some((m) => m.hasta)) list.push({ id: 'ilac', ad: 'İlaç', tutar: ECON.ilac, risk: 'Ödenmezse hastalık sürer.' });
  return list;
}

export function statusText(m) {
  if (m.hasta) return { text: 'Hasta', cls: 'bad' };
  if (m.last === 'ac') return { text: 'Aç', cls: 'warn' };
  if (m.last === 'susuz') return { text: 'Susuz', cls: 'warn' };
  if (m.last === 'sicak') return { text: 'Sıcaktan bunalmış', cls: 'warn' };
  return { text: 'İyi', cls: 'ok' };
}

// Gece: ödemeler uygulanır, aile durumu güncellenir.
export function resolveNight(home, billList, paid, money, temp) {
  const spent = billList.filter((b) => paid.has(b.id)).reduce((a, b) => a + b.tutar, 0);
  home.savings = money - spent;
  home.debt = paid.has('kira') ? 0 : ECON.kira + home.debt;
  const hot = temp >= ECON.sicakEsik && !paid.has('elektrik');
  for (const m of home.family) {
    if (m.hasta && paid.has('ilac')) m.hasta = false;
    const noFood = !paid.has('gida'), noWater = !paid.has('su');
    if (noFood || noWater) m.ac++; else m.ac = 0;
    m.last = noFood ? 'ac' : noWater ? 'susuz' : hot ? 'sicak' : 'iyi';
    if (m.ac >= 2) m.hasta = true;
    if (hot && m.kirilgan) m.hasta = true;
  }
  home.temp = temp;
}
