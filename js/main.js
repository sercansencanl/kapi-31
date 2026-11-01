import { World } from './scene.js';
import { DAYS, RULES, ECON } from './data.js';
import { makeDeck, makeTruck } from './trucks.js';
import * as home from './home.js';
import * as ui from './ui.js';
import { $, fmt } from './ui.js';
import { audio } from './audio.js';
import { settings, wait } from './feel.js';
import { iconURL } from './art.js';
import { upgradeRealism } from './realism.js';

// 3D dokular (tabela, konteyner yazıları) fontları kullanıyor: önce fontlar.
try {
  await Promise.race([
    Promise.all(['700 40px "Big Shoulders Stencil"', '700 40px "Barlow Condensed"', '600 40px "Barlow Condensed"',
      '500 40px "Barlow Condensed"', '400 20px "Courier Prime"', '700 20px "Courier Prime"'].map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 4000)),
  ]);
} catch { /* yedek fontla devam */ }

const world = new World($('world'), $('stage'));
// Gerçekçi gökyüzü ve dokular arka planda yüklenir; hazır olunca devreye girer.
upgradeRealism(world);

const S = {
  dayIdx: 0, idx: 0, deck: [], truck: null,
  phase: 'title',         // title | arriving | ready | deciding | result | screen
  view: 'booth',
  results: [],
  total: { budget: 0, emission: 0, food: 0, wallet: 0, right: 0, wrong: 0, hidden: 0, tax: 0, fraudPassed: 0, cleanRejected: 0 },
  today: null,
  home: home.newHome(),
  coachOn: true, coachIdx: -1,
};
const day = () => DAYS[S.dayIdx];
const newDayStats = () => ({ right: 0, wrong: 0, tax: 0, emission: 0, food: 0, hidden: 0, fraudPassed: 0, cleanRejected: 0 });

// ---------------- Rehber ----------------
// Her günün ilk kamyonunda o günün yeni mekaniğini anlatan kısa rehber.
const COACH = {
  1: [
    { target: '3d:papers', text: 'Sürücü <b>manifestoyu</b> vezneden uzattı. Okumak için kağıda tıkla ya da Q tuşuna bas. Yük ve miktar satırlarını aklında tut.', waitFor: 'read' },
    { target: '3d:led', text: '<b>Kantar</b> kasadaki yükün gerçek ağırlığını ölçer. Manifestodaki miktarla aynı mı?' },
    { target: '3d:inspect', text: 'Şimdi <b>kasayı aç</b> düğmesine bas. Konteynere tıklayabilir ya da E tuşuna da basabilirsin.', waitFor: 'inspect' },
    { target: '#note-card', view: 'rear', dim: false, text: 'Sandıkların üzerine gelip ne yazdığına bak. Sol üstteki kart manifestoda ne yazdığını hatırlatır: <b>aynı mı?</b> Bakınca <b>Kabine dön</b>.', waitFor: 'back' },
    { target: '3d:tablet', text: '<b>Tablet</b> el kitabın: bugünün kuralları ve emisyon faktörleri. Her gün yeni kural eklenir.' },
    { target: '3d:buttons', text: 'Her şey tutuyorsa <b>geçiş ver</b>, bir tutarsızlık varsa <b>geri çevir</b> düğmesine bas. Klavyede 1 ve 3.' },
  ],
  2: [
    { target: '3d:decl', text: 'Sarı kağıt <b>karbon beyanı</b>: firmanın kendi hesapladığı emisyon. Doğru olup olmadığını sen kontrol edeceksin.' },
    { target: '#book', text: '<b>Emisyon formunu</b> doldur: boşluklara tıkla, değeri seç. Çarpmayı form yapar. Ton için manifesto mu, kantar mı? Ürün için kağıt mı, kasa mı? Seçim senin.', waitFor: 'formDone' },
    { target: '3d:buttons', text: 'Toplam beyanla aynıysa <b>vergi kes</b>: SKDM ürünü beyan ettiği emisyon kadar vergi öder. Farklıysa ya da SKDM ürününün beyanı yoksa <b>geri çevir</b>. Gıda gibi kapsam dışı ürünler beyansız <b>geçer</b>.' },
  ],
  3: [
    { target: '#book', text: 'Forma <b>taşıma</b> satırı eklendi: (km ÷ 100) × araç faktörü. 20 tonun üstü <b>ağır yük</b>, faktör 1,5 katı. Araç için manifestoya değil kamyonun kendisine bak: egzoz dumanı dizel demek.' },
  ],
};
const seq = () => COACH[day().no] || [];
function coachShow(i) {
  S.coachIdx = i;
  const list = seq();
  if (i >= list.length || (day().no === 1 && !S.coachOn)) { S.coachIdx = -1; ui.coach(null); return; }
  const step = list[i];
  // Hedef şu anki görünümde değilse (ör. kasadayken konsol) vurgulama: kutu ortada, karartma yok.
  const here = (step.view || 'booth') === S.view;
  const is3d = step.target.startsWith('3d:');
  const rect = !here ? null : is3d ? world.rectOf(step.target.slice(3)) : document.querySelector(step.target)?.getBoundingClientRect() || null;
  ui.coach({ ...step, rect, count: `${i + 1} / ${list.length}` });
}
function coachEvent(name) {
  if (S.coachIdx >= 0 && seq()[S.coachIdx]?.waitFor === name) coachShow(S.coachIdx + 1);
}
$('coach-next').addEventListener('click', () => { audio.click(); coachShow(S.coachIdx + 1); });
$('coach-skip').addEventListener('click', () => { audio.click(); if (day().no === 1) S.coachOn = false; coachShow(99); });
window.addEventListener('resize', () => { if (S.coachIdx >= 0) coachShow(S.coachIdx); });

// ---------------- Ekranlar ----------------
function titleScreen() {
  ui.screen(`
    <p class="kicker">Antalya Limanı, 2031</p>
    <h1 class="title">Kapı 31</h1>
    <p class="lede">Karbon Sınır Yönetmeliği'nin ilk haftası. Avrupa'ya giden her kamyon senin kapından geçiyor. Belgeyi oku, kasayı aç, emisyonu hesapla. Kimin geçeceğine sen karar ver.</p>
    <div class="row">
      <button class="btn-primary" data-primary id="btn-start">Vardiyaya başla</button>
      <button class="btn-quiet" id="btn-about">Oyun hakkında</button>
      <button class="btn-quiet" id="btn-motion" aria-pressed="${!settings.motion}">${settings.motion ? 'Hareketi azalt' : 'Hareket azaltıldı'}</button>
    </div>
    <p class="fine">Ses için tarayıcı sekmesinin sesi açık olsun. Klavye: 1 2 3 karar, Q belgeler, E kasa, F el kitabı, Enter devam, M ses.</p>
  `, 'title-screen');
  $('btn-about').addEventListener('click', () => { audio.init(); audio.click(); aboutScreen(); });
  $('btn-start').addEventListener('click', async () => {
    audio.init(); audio.startAmbience(); audio.startMusic(); audio.click();
    ui.hideScreen();
    introScreen();
    await world.leaveTitle(4.5);
  });
  $('btn-motion').addEventListener('click', (e) => {
    settings.motion = !settings.motion;
    e.currentTarget.setAttribute('aria-pressed', String(!settings.motion));
    e.currentTarget.textContent = settings.motion ? 'Hareketi azalt' : 'Hareket azaltıldı';
  });
}

// Oyun hakkında: jüri ve yeni oyuncu için tek sayfalık tanıtım.
function aboutScreen() {
  ui.screen(`
    <article class="doc about">
      ${ui.letterhead('Bilgi notu')}
      <h2>Oyun hakkında</h2>
      <p class="about-lede"><b>Kapı 31</b>, iklimle mücadelede yeni bir yapı olan sınırda karbon düzenlemesini bir belge inceleme oyununa dönüştürüyor. 2031 yılında Antalya Limanı'nda karbon denetçisisin. Avrupa'ya giden her tırın emisyonu senin kapından geçiyor.</p>

      <h3>Nasıl oynanır</h3>
      <ol class="about-steps">
        <li><b>Oku.</b> Manifestoyu ve karbon beyanını incele. Kantar gerçek ağırlığı gösterir.</li>
        <li><b>Kontrol et.</b> Kasayı açıp yükü gör, emisyon formunda hesabı doğrula, kamyonun motoruna bak.</li>
        <li><b>Karar ver.</b> Geçiş ver, SKDM vergisi kes ya da geri çevir.</li>
      </ol>

      <h3>Neden önemli</h3>
      <p>AB'nin Sınırda Karbon Düzenleme Mekanizması (SKDM), demir-çelik, alüminyum, çimento ve gübre gibi ürünlerin üretim emisyonunu sınırda fiyatlandırıyor. Türkiye, AB'nin en büyük ticaret ortaklarından biri olarak doğrudan etkileniyor. Oyun, bu düzenlemenin mantığını ve sahtecilikle mücadelenin neden önemli olduğunu oynayarak anlatıyor.</p>
      <p>Kapıda geçirdiğin her ton emisyon ertesi gün şehri biraz daha ısıtır. Isınan hava faturaları artırır, ailen sıcakla baş etmek zorunda kalır. İklim krizinin bedelini en çok kimin ödediğini oyun içinde hissedersin.</p>

      <h3>Yapım</h3>
      <dl class="about-credits">
        <div><dt>Etkinlik</dt><dd>GameUP Türkiye İklim Oyun Hackathonu, 2026</dd></div>
        <div><dt>Ekip</dt><dd>GameUP Türkiye Hackathon, 29. Ekip</dd></div>
        <div><dt>Teknoloji</dt><dd>Three.js ve saf JavaScript. 3D modeller ve sesler kodla üretildi.</dd></div>
        <div><dt>Dokular</dt><dd>Gökyüzü (HDRI), asfalt, beton ve konteyner yüzeyleri: Poly Haven, CC0 lisansı.</dd></div>
      </dl>

      <p class="about-note">Oyundaki yönetmelik, kurumlar ve firmalar kurgudur. Emisyon faktörleri yuvarlatılmış, taşıma faktörleri oyun dengesi için abartılmıştır.</p>
      <button class="btn-primary" data-primary id="btn-about-back">Ana ekrana dön</button>
    </article>`, 'about-screen');
  const back = () => { audio.click(); document.removeEventListener('keydown', esc); titleScreen(); };
  const esc = (e) => { if (e.key === 'Escape') back(); };
  document.addEventListener('keydown', esc);
  $('btn-about-back').addEventListener('click', back);
}

// Giriş: iklim göçü hikâyesi ve atama mektubu.
function introScreen() {
  S.phase = 'screen';
  ui.screen(`
    <div class="intro">
      <p class="kicker">Antalya, Haziran 2031</p>
      <p class="intro-line" style="--i:0">Konya'ya üç yıldır doğru dürüst yağmur düşmedi. Tarla çatladı, kuyu kurudu.</p>
      <p class="intro-line" style="--i:1">Annen Hatice ve kardeşin Ege ile kıyıya, Antalya'ya taşındınız. Burada da termometre her yaz biraz daha yükseliyor.</p>
      <p class="intro-line" style="--i:2">Bu sabah kapının altından bir zarf atılmış.</p>
      <article class="letter doc" style="--i:3">
        ${ui.letterhead('Sayı: KSY-31/0614')}
        ${ui.stampHTML('Kabul', 'blue', 3.6, -8)}
        <p>Sayın aday,</p>
        <p>Karbon Sınır Yönetmeliği kapsamında açılan <b>karbon denetçisi</b> kadrosuna yaptığınız başvuru kabul edilmiştir.</p>
        <p>Görev yeriniz Antalya Limanı, <b>Kapı 31</b>'dir. Maaşınız günlük ödenir. Doğru kararlar için prim verilir, hatalı kararlar maaştan kesilir.</p>
        <p>Yarın sabah 08.00'de görevinizin başında olunuz.</p>
        <p class="letter-sign">Personel Müdürlüğü</p>
      </article>
      <p class="intro-line" style="--i:4">Evin kirası, faturalar, annenin ilaçları. Artık hepsi bu kapıya bağlı.</p>
      <button class="btn-primary intro-btn" data-primary id="btn-intro" style="--i:5">Göreve başla</button>
    </div>`, 'intro-screen');
  audio.paper();
  const intro = document.querySelector('.intro');
  intro.addEventListener('click', (e) => { if (e.target.id !== 'btn-intro') intro.classList.add('skip'); });
  $('btn-intro').addEventListener('click', () => { audio.click(); memoScreen(); });
}

function memoScreen() {
  const d = day();
  S.phase = 'screen';
  ui.screen(`
    <article class="memo doc">
      ${ui.letterhead(`Genelge 2031/${d.no}`)}
      ${ui.stampHTML('Yürürlükte', 'red', 0.55, -10)}
      <h2>Gün ${d.no}</h2>
      <p class="memo-weather">Antalya bugün ${S.home.temp}°C</p>
      <p>${d.genelge}</p>
      <ol class="memo-rules">${d.checks.map((c) => `<li>${ruleLine(c)}</li>`).join('')}</ol>
      <p class="memo-foot">Bugün ${d.deck.length} kamyon bekleniyor. Günlük maaş ${ECON.maasTaban} ₺. Doğru karar başına ${ECON.prim} ₺ prim, hatalı karar başına ${ECON.kesinti} ₺ kesinti.</p>
      <button class="btn-primary" data-primary id="btn-shift">Kapıyı aç</button>
    </article>`, 'memo-screen');
  audio.paper();
  $('btn-shift').addEventListener('click', () => { audio.click(); ui.hideScreen(); startDay(); });
}
const ruleLine = (c) => ({
  urun: 'Kasadaki ürün = manifestodaki ürün',
  kilo: 'Kantar = manifestodaki miktar',
  beyan: 'Beyan = senin hesabın',
  asiri: `Kantar ${RULES.yukSiniri} t üstündeyse geri çevir`,
  skdm: 'SKDM ürünü: beyan doğruysa vergi, yoksa geri çevir',
  arac: 'Kamyonun motoru = manifestodaki araç',
}[c]);

// Gün sonu: liman bülteni + ev defteri. Emisyon yarının sıcaklığını, sıcaklık faturaları belirler.
function dayEndScreen() {
  const d = day(), s = S.today, H = S.home;
  S.phase = 'screen';
  let head = `Yönetmeliğin ${d.no}. günü: Kapı 31'de yoğun mesai`;
  if (s.wrong === 0) head = 'Kapı 31\'de kusursuz vardiya: tek bir sahte sevkiyat geçmedi';
  else if (s.fraudPassed > 0) head = 'Sahte belgeli kamyonlar limandan geçti, AB denetçileri inceleme başlattı';
  else if (s.cleanRejected > 0) head = 'İhracatçılar tepkili: belgesi temiz sevkiyatlar kapıdan döndü';
  const last = S.dayIdx === DAYS.length - 1;

  const earned = home.income(s);
  const money = Math.max(0, H.savings + earned);
  const temp = home.nextTemp(H, s.emission);
  const list = home.bills(H, temp);
  const paid = new Set();
  let left = money;
  for (const b of list) if (b.tutar <= left) { paid.add(b.id); left -= b.tutar; } // varsayılan: sırayla öde
  const dT = temp - H.temp;

  ui.screen(`
    <div class="dayend">
      <article class="report doc">
        ${ui.stampHTML('Vardiya kapandı', s.wrong === 0 ? 'green' : 'red', 0.6, -7)}
        <p class="paper-name">Liman Bülteni<span>Gün ${d.no}, Haziran 2031</span></p>
        <h2>${head}</h2>
        <dl class="stats">
          <div><dt>Doğru karar</dt><dd>${s.right} / ${d.deck.length}</dd></div>
          <div><dt>Tahsil edilen vergi</dt><dd>${fmt(s.tax)} €</dd></div>
          <div><dt>Limandan geçen emisyon</dt><dd>${fmt(s.emission)} t</dd></div>
          <div><dt>Yakalanan gizli emisyon</dt><dd>${fmt(s.hidden)} t</dd></div>
        </dl>
        <div class="weather ${dT > 0 ? 'up' : ''}">
          <span class="w-temp">${temp}°C</span>
          <p>Yarın Antalya. ${dT > 0 ? `Bugünkü emisyonla hava ${dT} derece ısınıyor. Klima ve su pahalanıyor.` : 'Hava bugünkü gibi.'}</p>
        </div>
      </article>
      <article class="ledger">
        <h2>Ev defteri</h2>
        <table class="led-table">
          <tr><td>Birikim</td><td>${fmt(H.savings)} ₺</td></tr>
          <tr><td>Günlük maaş</td><td>${ECON.maasTaban} ₺</td></tr>
          <tr><td>Prim, ${s.right} doğru karar</td><td class="plus">+${s.right * ECON.prim} ₺</td></tr>
          ${s.wrong ? `<tr><td>Kesinti, ${s.wrong} hatalı karar</td><td class="minus">−${s.wrong * ECON.kesinti} ₺</td></tr>` : ''}
          <tr class="sum"><td>Elindeki para</td><td>${fmt(money)} ₺</td></tr>
        </table>
        <fieldset class="bills"><legend>Bu akşam ne ödeyeceksin?</legend>
          ${list.map((b) => `
            <label class="bill" data-bill="${b.id}">
              <input type="checkbox" value="${b.id}" ${paid.has(b.id) ? 'checked' : ''}>
              <span class="b-name">${b.ad}<small class="b-risk">${b.risk}</small></span>
              <span class="b-amt">${fmt(b.tutar)} ₺</span>
            </label>`).join('')}
        </fieldset>
        <p class="left">Kalan <b id="left">${fmt(left)} ₺</b></p>
        <ul class="family">${H.family.map((m) => { const st = home.statusText(m); return `<li><span>${m.ad}</span><b class="${st.cls}">${st.text}</b></li>`; }).join('')}</ul>
        <button class="btn-primary" data-primary id="btn-after">${last ? 'Uyu, haftanın sonucu' : 'Uyu'}</button>
      </article>
    </div>`, 'dayend-screen');
  audio.stamp();

  const sync = () => {
    const sum = list.filter((b) => paid.has(b.id)).reduce((a, b) => a + b.tutar, 0);
    const rest = money - sum;
    $('left').textContent = `${fmt(rest)} ₺`;
    document.querySelectorAll('.bill').forEach((el) => {
      const b = list.find((x) => x.id === el.dataset.bill), inp = el.querySelector('input');
      inp.disabled = !inp.checked && b.tutar > rest;
      el.classList.toggle('unpaid', !inp.checked);
    });
  };
  document.querySelectorAll('.bill input').forEach((inp) => inp.addEventListener('change', () => {
    audio.click();
    if (inp.checked) paid.add(inp.value); else paid.delete(inp.value);
    sync();
  }));
  sync();

  $('btn-after').addEventListener('click', () => {
    audio.click();
    home.resolveNight(H, list, paid, money, temp);
    S.total.wallet = 0;
    ui.setMeters(S.total, false);
    if (last) finalScreen();
    else { S.dayIdx++; memoScreen(); }
  });
}

function finalScreen() {
  const T = S.total, n = T.right + T.wrong, acc = n ? T.right / n : 0;
  const rank = acc >= 0.9 ? 'Baş denetçi' : acc >= 0.7 ? 'Kıdemli denetçi' : acc >= 0.5 ? 'Denetçi' : 'Stajyer denetçi';
  const H = S.home, sick = H.family.filter((m) => m.hasta);
  const homeLine = sick.length
    ? `${sick.map((m) => m.ad.split(' ')[1]).join(' ve ')} hasta yatıyor. ${H.debt ? `Ev sahibine ${H.debt} ₺ borcun var.` : ''}`
    : H.debt ? `Ailen iyi ama ev sahibine ${H.debt} ₺ borcun var.` : 'Ailen iyi, faturalar ödendi. Bu yaz idare edeceksiniz.';
  const grade = acc >= 0.9 ? ['Takdir', 'green'] : acc >= 0.7 ? ['Başarılı', 'blue'] : acc >= 0.5 ? ['Yeterli', 'amber'] : ['Uyarı', 'red'];
  ui.screen(`
    <article class="final doc">
      ${ui.letterhead('Personel sicil kaydı')}
      ${ui.stampHTML(grade[0], grade[1], 0.7, -11)}
      <p class="kicker">Haftanın sonucu</p>
      <h2>${rank}</h2>
      <p class="lede">${n} kamyonun ${T.right} tanesinde doğru karar verdin. Beyan dışı bırakılmış <b>${fmt(T.hidden)} t CO₂e</b> emisyonu kapıda yakaladın.</p>
      <p class="final-home">${homeLine} Antalya hafta sonunda ${H.temp}°C.</p>
      <dl class="stats">
        <div><dt>Liman bütçesi</dt><dd>${fmt(T.budget)} €</dd></div>
        <div><dt>Limandan geçen emisyon</dt><dd>${fmt(T.emission)} t</dd></div>
        <div><dt>Birikimin</dt><dd>${fmt(H.savings)} ₺</dd></div>
      </dl>
      <aside class="realworld">
        <h3>Gerçekte</h3>
        <p>AB'nin Sınırda Karbon Düzenleme Mekanizması (SKDM) 2026'dan beri demir-çelik, alüminyum, çimento, gübre, elektrik ve hidrojen ithalatına karbon maliyeti yansıtıyor. AB'nin en büyük ticaret ortaklarından biri olan Türkiye bu düzenlemeden doğrudan etkileniyor.</p>
        <p>Oyundaki yönetmelik ve gıda ürünleri kurgudur. Ürün faktörleri yaşam döngüsü ortalamalarından yuvarlatıldı. Taşıma faktörleri oyun dengesi için abartıldı; gerçek SKDM yalnızca üretim emisyonlarını kapsar, taşımayı değil. Gerçek sınır kapılarında tırların çoğu açılmaz, risk analizine göre seçilenler gümrük muayenesine alınır. Tek bir limanın emisyonu bir şehrin sıcaklığını ertesi gün değiştirmez; oyun, birikimli etkiyi birkaç güne sıkıştırıyor.</p>
      </aside>
      <button class="btn-primary" data-primary id="btn-again">Yeniden oyna</button>
    </article>`, 'final-screen');
  audio.stamp();
  $('btn-again').addEventListener('click', () => {
    audio.click();
    Object.assign(S, { dayIdx: 0, results: [], coachOn: false, home: home.newHome() });
    Object.keys(S.total).forEach((k) => { S.total[k] = 0; });
    ui.setMeters(S.total, false);
    memoScreen();
  });
}

// ---------------- Gün ve kamyon döngüsü ----------------
function startDay() {
  S.deck = makeDeck(day());
  S.idx = 0; S.results = []; S.today = newDayStats();
  S.total.wallet = ECON.maasTaban;
  ui.setMeters(S.total, false);
  $('hud').hidden = false; $('desk').hidden = false;
  window.dispatchEvent(new Event('resize'));
  ui.renderRules(day());
  ui.renderFactors(day());
  selectTab('rules');
  setControls(false);
  if (!world.rig.visible || world.rig.position.y < -0.05) world.deskShow(true, 0.8);
  nextTruck();
}

// Konsol düğmeleri (3D) ve erişilebilir HTML düğmeleri birlikte güncellenir.
function setControls(enabled) {
  ui.setDecisions(enabled, day());
  const st = {};
  for (const c of ['onay', 'vergi', 'ret']) st[c] = { enabled: enabled && day().choices.includes(c), locked: !day().choices.includes(c) };
  st.inspect = { enabled: enabled && S.view === 'booth' };
  world.setButtons(st);
  world.deskActive = enabled;
}

// Kasa görünümünde manifestoyu ezberlemek zorunda kalma: küçük hatırlatma kartı.
function showNoteCard(show) {
  const el = $('note-card');
  if (!show || !S.truck) { el.hidden = true; return; }
  const m = S.truck.manifest;
  el.innerHTML = `
    <h3>Manifestoda yazan</h3>
    <dl>
      <dt>Yük</dt><dd>${m.product.ad}</dd>
      <dt>Miktar</dt><dd>${m.tons} ton</dd>
      ${day().formula === 'tam' ? `<dt>Araç</dt><dd>${m.vehicle.ad}</dd>` : ''}
    </dl>
    <p>Kantar: ${S.truck.cargo.tons},0 t</p>`;
  el.hidden = false;
}

function openBook(open, tab) {
  $('book').hidden = !open;
  if (open && tab) selectTab(tab);
}

async function readPapers(force) {
  if (S.phase !== 'ready' || S.view !== 'booth') return;
  audio.paper();
  const up = force ?? !world.anyPaperUp();
  await Promise.all(['manifest', 'decl'].map((k) => world.togglePaper(k, up)));
  if (up) coachEvent('read');
}

async function onDesk(action) {
  if (S.phase !== 'ready') return;
  if (action.startsWith('paper:')) {
    audio.paper();
    const kind = action.slice(6);
    await world.togglePaper(kind);
    if (world.papers[kind]?.userData.up) coachEvent('read');
  } else if (action === 'tablet') {
    audio.click();
    openBook($('book').hidden, day().calc ? 'calc' : 'rules');
  } else if (action === 'inspect') {
    world.pressButton('inspect'); audio.click(); inspect();
  } else {
    decide(action);
  }
}

async function nextTruck() {
  S.phase = 'arriving';
  ui.hideReceipt();
  ui.setDay(day(), S.results, S.idx);
  ui.clearPapers();
  setControls(false);
  ui.setInspect(false, 'Kasayı aç');
  ui.setKantar('– –', 'idle');
  ui.formClear();
  world.resetLed();
  world.interactive = false;
  if (S.view !== 'booth') { S.view = 'booth'; world.moveCam('booth', 0.8); world.deskShow(true, 0.7); }

  S.truck = makeTruck(S.deck[S.idx], day());
  const eng = audio.engine();
  await world.spawnTruck(S.truck, (lvl) => eng.set(lvl));
  audio.brake();
  eng.set(0);
  S.engine = eng;

  ui.setKantar('…', 'busy');
  await world.weigh(S.truck.cargo.tons, (final) => {
    audio.kantarTick(final);
    if (final) ui.setKantar(`${String(S.truck.cargo.tons)},0 t`, 'done');
  });
  audio.paper();
  ui.showPapers(S.truck, day());
  await world.showPapers(S.truck, day());
  await wait(0.45);
  S.phase = 'ready';
  world.interactive = true;
  ui.setInspect(true, 'Kasayı aç');
  setControls(true);
  ui.formReset(S.truck, day());
  if (day().calc) openBook(true, 'calc');
  if (S.idx === 0) setTimeout(() => { if (S.phase === 'ready') coachShow(0); }, 450); // kağıtlar yerine otursun
}

async function inspect() {
  if (S.phase !== 'ready') return;
  if (S.inspecting) { S.inspectQueued = true; return; } // animasyon bitince uygula
  S.inspecting = true;
  world.setHover(null);
  try {
    if (S.view === 'booth') {
      S.view = 'rear';
      setControls(true);
      // Dönüş düğmesi ve not kartı animasyonu beklemeden görünsün
      $('btn-back').hidden = false;
      showNoteCard(true);
      ui.setInspect(true, 'Kabine dön');
      const opening = !world.truck?.opened;
      world.snapPapersDown();
      world.deskShow(false, 0.5);
      world.moveCam('rear', 1.1);
      if (opening && world.truck) { await wait(0.45); audio.doorOpen(); await world.openDoors(); }
      else await wait(1.1);
      coachEvent('inspect');
      if (S.coachIdx >= 0) coachShow(S.coachIdx);
    } else {
      S.view = 'booth';
      $('btn-back').hidden = true;
      showNoteCard(false);
      world.deskShow(true, 0.7);
      await world.moveCam('booth', 0.9);
      ui.setInspect(true, 'Kasaya bak');
      setControls(S.phase === 'ready');
      coachEvent('back');
      if (S.coachIdx >= 0) coachShow(S.coachIdx); // vurguyu yeni görünüme göre yenile
    }
  } catch (err) {
    console.error('Kasa görünümü hatası:', err);
  } finally {
    S.inspecting = false; // hata olsa bile kilit açılsın
    if (S.inspectQueued) { S.inspectQueued = false; if (S.phase === 'ready') inspect(); }
  }
}

async function decide(choice) {
  if (S.phase !== 'ready' || !day().choices.includes(choice)) return;
  S.phase = 'deciding';
  if (S.coachIdx >= 0) coachShow(99);
  world.pressButton(choice);
  world.interactive = false; world.setHover(null);
  setControls(false);
  openBook(false);
  $('btn-back').hidden = true;
  showNoteCard(false);
  await world.lowerPapers();
  ui.setInspect(false, S.view === 'rear' ? 'Kabine dön' : 'Kasayı aç');

  const t = S.truck, ok = choice === t.correct, T = S.total, D = S.today;
  const effects = [];
  if (choice !== 'ret') {
    T.emission += t.real; D.emission += t.real;
    effects.push({ text: `Limandan ${fmt(t.real)} t CO₂e geçti.` });
    if (t.cargo.product.gida) { T.food += t.cargo.tons; D.food += t.cargo.tons; effects.push({ text: `${t.cargo.tons} ton gıda ihraç edildi.` }); }
  }
  if (choice === 'vergi') {
    // SKDM: beyanlı kapsam ürünü, beyan edilen emisyonun tamamı için vergi öder.
    const tax = t.hasDecl && t.cargo.product.skdm ? t.declared * RULES.vergiBirim : 0;
    T.budget += tax; T.tax += tax; D.tax += tax;
    effects.push({ text: tax ? `${fmt(tax)} € SKDM vergisi tahsil edildi.` : 'Ürün SKDM kapsamında değil ya da beyanı yok: vergi alınamadı.', cls: tax ? 'plus' : '' });
  }
  if (ok) {
    T.right++; D.right++;
    if (t.correct === 'ret') { T.hidden += t.hidden; D.hidden += t.hidden; effects.push({ text: `${fmt(t.hidden)} t gizli emisyon yakalandı.`, cls: 'plus' }); }
    effects.push({ text: `Maaşına +${ECON.prim} ₺ prim.`, cls: 'plus' });
  } else {
    T.wrong++; D.wrong++;
    effects.push({ text: `Maaşından −${ECON.kesinti} ₺ kesinti.`, cls: 'minus' });
    if (t.correct === 'ret') D.fraudPassed++;
    if (t.fault === 'temiz' && choice === 'ret') D.cleanRejected++;
  }
  S.results[S.idx] = ok;
  T.wallet = home.income(D);

  // Geri bildirim katmanı: ses, flaş, hit-stop, sarsıntı, sayaç
  world.hitStop(ok ? 60 : 110);
  ui.flash(ok ? 'good' : 'bad');
  if (ok) audio.correct(); else { audio.wrong(); world.shake(0.5); }
  if (choice === 'vergi' && t.hasDecl) setTimeout(() => audio.cash(), 250);
  ui.setMeters(T);
  ui.setDay(day(), S.results, S.idx);

  if (S.view === 'rear') { S.view = 'booth'; world.moveCam('booth', 0.8); world.deskShow(true, 0.7); }
  if (world.truck?.opened) world.closeDoorsQuick();
  world.clearPapers();
  const eng = S.engine;
  eng.set(0.4);
  if (choice === 'ret') {
    const beeps = audio.reverseBeeps();
    await world.reverseOut((l) => eng.set(l));
    beeps.stop();
  } else {
    audio.barrier();
    await world.leaveThroughGate((l) => eng.set(l));
  }
  eng.stop();
  ui.clearPapers();
  ui.setKantar('– –', 'idle');
  world.resetLed();

  S.phase = 'result';
  ui.showReceipt({ ok, choice, t, effects, last: S.idx === S.deck.length - 1, day: day() });
  $('btn-next').addEventListener('click', advance);
}

function advance() {
  if (S.phase !== 'result') return;
  audio.click();
  ui.hideReceipt();
  S.idx++;
  if (S.idx < S.deck.length) nextTruck();
  else { $('desk').hidden = true; window.dispatchEvent(new Event('resize')); dayEndScreen(); }
}

// ---------------- Bağlantılar ----------------
const selectTab = ui.bindTabs();
ui.setStampSound(() => audio.stampHit());
ui.formClear();
ui.bindForm((ev) => {
  audio.click();
  if (ev === 'done') coachEvent('formDone');
});
document.querySelectorAll('.dec').forEach((b) => b.addEventListener('click', () => decide(b.dataset.choice)));
$('btn-inspect').addEventListener('click', () => { audio.click(); inspect(); });

world.on('containerClick', () => { if (S.view === 'booth') inspect(); });
world.on('desk', onDesk);
$('btn-back').addEventListener('click', () => { audio.click(); inspect(); });
$('book-close').addEventListener('click', () => { audio.click(); openBook(false); });
let lastCrate = null;
world.on('hover', (h, p) => {
  ui.tip(h, p);
  if (h?.type === 'crate' && h.obj !== lastCrate) audio.crateHover();
  lastCrate = h?.obj || null;
});

function syncSoundBtn() {
  const b = $('btn-sound');
  b.setAttribute('aria-pressed', String(audio.muted));
  b.setAttribute('aria-label', audio.muted ? 'Sesi aç' : 'Sesi kapat');
  b.classList.toggle('muted', audio.muted);
}
$('btn-sound').addEventListener('click', () => { audio.init(); audio.setMuted(!audio.muted); syncSoundBtn(); });
$('btn-help').addEventListener('click', () => { audio.click(); S.coachOn = true; if (S.phase === 'ready') coachShow(0); });
syncSoundBtn();

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'm') { audio.init(); audio.setMuted(!audio.muted); syncSoundBtn(); return; }
  if (S.phase === 'ready') {
    if (k === '1') decide('onay');
    else if (k === '2') decide('vergi');
    else if (k === '3') decide('ret');
    else if (k === 'e') { if (S.view === 'booth') world.pressButton('inspect'); inspect(); }
    else if (k === 'f') { if ($('book').hidden || !day().calc) openBook($('book').hidden, 'calc'); else openBook(false); }
    else if (k === 'q') readPapers();
    else if (k === 'escape') { world.lowerPapers(); openBook(false); }
  } else if (S.phase === 'result' && k === 'enter' && document.activeElement?.id !== 'btn-next') {
    advance();
  }
});

$('loading').hidden = true;
titleScreen();
