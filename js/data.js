// Ürün faktörleri (t CO2e / ton ürün): yaşam döngüsü ve sektör ortalamalarından yuvarlatıldı.
// skdm: AB Sınırda Karbon Düzenleme Mekanizması kapsamındaki ürün grupları (demir-çelik, alüminyum, çimento, gübre).
export const PRODUCTS = [
  { id: 'sigir',     ad: 'Sığır eti', faktor: 60, gida: true,  skdm: false, renk: '#a63d32', kasa: 'frigo', maxIsi: 4 },
  { id: 'peynir',    ad: 'Peynir',    faktor: 20, gida: true,  skdm: false, renk: '#e0b43c', kasa: 'frigo', maxIsi: 4 },
  { id: 'pirinc',    ad: 'Pirinç',    faktor: 4,  gida: true,  skdm: false, renk: '#c9b98f', kasa: 'kuru' },
  { id: 'bugday',    ad: 'Buğday',    faktor: 1,  gida: true,  skdm: false, renk: '#c48a2c', kasa: 'kuru' },
  { id: 'aluminyum', ad: 'Alüminyum', faktor: 16, gida: false, skdm: true,  renk: '#8c9aa4', kasa: 'acik' },
  { id: 'gubre',     ad: 'Gübre',     faktor: 3,  gida: false, skdm: true,  renk: '#6f8f4e', kasa: 'kuru' },
  { id: 'celik',     ad: 'Çelik',     faktor: 2,  gida: false, skdm: true,  renk: '#4f5d68', kasa: 'acik' },
  { id: 'cimento',   ad: 'Çimento',   faktor: 1,  gida: false, skdm: true,  renk: '#a7a29a', kasa: 'kuru' },
];

// Taşıma faktörleri (t CO2e / 100 km), 20 tona kadar yük için. Oyun dengesi için abartıldı.
// Ağır yükte (20 t üstü) yakıt tüketimi artar: faktör 1,5 katına çıkar.
export const VEHICLES = {
  dizel:    { id: 'dizel',    ad: 'Dizel',      faktor: 2,   ipucu: 'Egzoz bacası ve siyah duman' },
  lng:      { id: 'lng',      ad: 'LNG',        faktor: 1,   ipucu: 'Şasi yanında açık mavi gaz tankları' },
  elektrik: { id: 'elektrik', ad: 'Elektrikli', faktor: 0.5, ipucu: 'Batarya kutuları, yeşil şerit, egzoz yok' },
};

export const ORIGINS = [
  { sehir: 'Konya',     plaka: '42', km: 400 },
  { sehir: 'İzmir',     plaka: '35', km: 400 },
  { sehir: 'Mersin',    plaka: '33', km: 600 },
  { sehir: 'Kayseri',   plaka: '38', km: 600 },
  { sehir: 'Bursa',     plaka: '16', km: 600 },
  { sehir: 'Gaziantep', plaka: '27', km: 800 },
  { sehir: 'Tekirdağ',  plaka: '59', km: 800 },
  { sehir: 'Samsun',    plaka: '55', km: 1000 },
];

export const FIRMS = [
  { ad: 'Toros Lojistik',   kod: 'TRSU', renk: '#2c6a8a', logo: 'tri' },
  { ad: 'Akdeniz Gıda',     kod: 'AKDU', renk: '#9a3a2c', logo: 'wave' },
  { ad: 'Anadolu Metal',    kod: 'ANMU', renk: '#56633f', logo: 'bars' },
  { ad: 'Kıyı Tarım',       kod: 'KYTU', renk: '#b9821f', logo: 'leaf' },
  { ad: 'Yeşilyol Nakliye', kod: 'YSLU', renk: '#2f7a58', logo: 'circle' },
  { ad: 'Efes Ticaret',     kod: 'EFSU', renk: '#584a8a', logo: 'diamond' },
];

export const DRIVERS = ['Hüseyin Kara', 'Ayşe Demir', 'Murat Öztürk', 'Elif Şahin', 'Kemal Aydın',
  'Zeynep Yıldız', 'Ramazan Çelik', 'Fatma Arslan', 'Serkan Polat', 'Derya Koç', 'Cem Erdoğan', 'Gül Kaya'];

export const RULES = {
  yukSiniri: 26,     // tır başına yasal net yük (t)
  agirEsik: 20,      // bu tonun üstü ağır yük sayılır
  agirKatsayi: 1.5,  // ağır yükte taşıma faktörü çarpanı
  vergiBirim: 80,    // SKDM: beyan edilen her t CO2e için €
};


export const SKDM_LIST = PRODUCTS.filter((p) => p.skdm).map((p) => p.ad).join(', ');

// Ev ekonomisi (₺, kurgusal). Limandan geçen emisyon ertesi günün sıcaklığını artırır;
// sıcaklık arttıkça elektrik (klima) ve su pahalılaşır.
export const ECON = {
  maasTaban: 120, prim: 30, kesinti: 40, baslangic: 30,
  kira: 90, gida: 60, su: 20, suDerece: 5, elektrikTaban: 25, elektrikDerece: 8, ilac: 60,
  baslangicSicaklik: 38, emisyonPerDerece: 1200, sicakEsik: 40,
};

export const FAMILY = [
  { id: 'anne', ad: 'Annen Hatice', kirilgan: true },  // sıcağa dayanıksız
  { id: 'kardes', ad: 'Kardeşin Ege', kirilgan: false },
];

export const CHECKS = {
  urun:  { ad: 'Ürün kontrolü',    metin: 'Kasadaki sandıklar manifestodaki ürünle aynı olmalı. Değilse geri çevir.' },
  kilo:  { ad: 'Ağırlık kontrolü', metin: 'Kantardaki net yük manifestodaki miktarla aynı olmalı. Değilse geri çevir.' },
  asiri: { ad: 'Yük sınırı',       metin: `Kantar ${RULES.yukSiniri} tonu aşıyorsa tır aşırı yüklü. Geri çevir.` },
  skdm:  { ad: 'SKDM kapsamı',     metin: `${SKDM_LIST} karbon beyanı taşımak zorunda. Beyan doğruysa vergi kes (her ton CO₂e için ${RULES.vergiBirim} €). Beyan yoksa geri çevir. Gıda gibi kapsam dışı ürünler beyansız geçer.` },
  beyan: { ad: 'Beyan kontrolü',   metin: 'Karbon beyanı, emisyon formunda bulduğun toplamla aynı olmalı. Değilse geri çevir.' },
  soguk: { ad: 'Soğuk zincir',     metin: 'Peynir ve et frigo kasada taşınır. Kasanın yanındaki termograf +4 °C üstündeyse soğuk zincir bozulmuştur. Geri çevir.' },
  arac:  { ad: 'Araç kontrolü',    metin: `Kamyonun motoru manifestodaki araç tipiyle aynı olmalı. Değilse geri çevir. ${RULES.agirEsik} tonun üstünde ağır yük faktörünü kullan.` },
};

export const DAYS = [
  {
    no: 1,
    deck: ['temiz', 'urun', 'soguk', 'kilo', 'temiz', 'asiri'],
    checks: ['urun', 'kilo', 'asiri', 'soguk'],
    choices: ['onay', 'ret'],
    formula: 'urun', calc: false,
    genelge: `Karbon Sınır Yönetmeliği bugün yürürlüğe giriyor. İlk gün sadece belgeyi yükle karşılaştıracaksın: kasada ne var, kantar ne diyor. Tır başına yasal yük sınırı ${RULES.yukSiniri} ton. Peynir ve et frigo kasada gelir; termograf +4 °C üstündeyse soğuk zincir bozulmuştur.`,
  },
  {
    no: 2,
    deck: ['skdm', 'temiz', 'beyan', 'beyansiz', 'kacak', 'skdm'],
    checks: ['urun', 'kilo', 'asiri', 'soguk', 'skdm', 'beyan'],
    choices: ['onay', 'vergi', 'ret'],
    formula: 'urun', calc: true,
    genelge: `SKDM kapsamındaki ürünler (${SKDM_LIST}) bugünden itibaren karbon beyanı taşıyor. Emisyon formunu doldur: ton × ürün faktörü. Beyan doğruysa vergi kes, yanlışsa ya da hiç yoksa geri çevir. Bazı firmalar çeliği gıda diye beyan ediyor olabilir, kasaya bak.`,
  },
  {
    no: 3,
    deck: ['skdm', 'arac', 'beyan', 'soguk', 'temiz', 'kilo', 'skdm'],
    checks: ['urun', 'kilo', 'asiri', 'soguk', 'skdm', 'beyan', 'arac'],
    choices: ['onay', 'vergi', 'ret'],
    formula: 'tam', calc: true,
    genelge: `Taşıma emisyonu da artık beyana giriyor: (km ÷ 100) × araç faktörü. ${RULES.agirEsik} tonun üstündeki ağır yüklerde araç faktörü ${String(RULES.agirKatsayi).replace('.', ',')} katına çıkar. Bazı firmalar dizel kamyonlarını elektrikli diye kaydettiriyor, kamyona bak.`,
  },
];

export const CHOICE_LABEL = { onay: 'Geçiş ver', vergi: 'Vergi kes', ret: 'Geri çevir' };
