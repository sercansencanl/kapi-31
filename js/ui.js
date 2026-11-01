import { PRODUCTS, VEHICLES, RULES, CHECKS, CHOICE_LABEL } from './data.js';
import { iconURL } from './art.js';
import { vehFactor } from './trucks.js';
import { tween, Ease } from './feel.js';

export const $ = (id) => document.getElementById(id);
export const fmt = (n) => Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
const num = (n) => String(n).replace('.', ',');

// ---------- HUD ----------
const shown = { budget: 0, emission: 0, wallet: 0 };
export function setMeters(total, animate = true) {
  [['wallet', 'm-wallet', ' ₺'], ['emission', 'm-emission', ' t'], ['budget', 'm-budget', ' €']].forEach(([k, id, unit]) => {
    const from = shown[k], to = total[k], el = $(id);
    if (from === to) { el.textContent = fmt(to) + unit; return; }
    shown[k] = to;
    const dd = el.closest('div');
    dd.classList.remove('pop-up', 'pop-down'); void dd.offsetWidth;
    dd.classList.add(to > from ? 'pop-up' : 'pop-down');
    if (!animate) { el.textContent = fmt(to) + unit; return; }
    tween(0.7, (k2) => { el.textContent = fmt(Math.round(from + (to - from) * k2)) + unit; }, Ease.outCubic);
  });
}

export function setDay(day, results, idx) {
  $('hud-day').textContent = `Gün ${day.no}`;
  $('hud-trucks').innerHTML = day.deck.map((_, i) => {
    const r = results[i];
    const cls = r === undefined ? (i === idx ? 'now' : '') : r ? 'ok' : 'bad';
    const lbl = r === undefined ? (i === idx ? 'şu anki kamyon' : 'bekliyor') : r ? 'doğru' : 'hatalı';
    return `<li class="${cls}" aria-label="Kamyon ${i + 1}: ${lbl}"></li>`;
  }).join('');
}

// ---------- Belgeler ----------
export function clearPapers() {
  ['manifest', 'decl'].forEach((id) => { const el = $(id); el.classList.remove('in'); el.classList.add('out'); });
}

export function showPapers(t, day) {
  const m = $('manifest'), d = $('decl');
  m.innerHTML = `
    <header><h3>Taşıma manifestosu</h3><span>Form KS-1, no ${t.serial}</span></header>
    <dl>
      <dt>Plaka</dt><dd>${t.plate}</dd>
      <dt>Firma</dt><dd>${t.firm.ad}</dd>
      <dt>Sürücü</dt><dd>${t.driver}</dd>
      <dt>Çıkış</dt><dd>${t.origin.sehir}, ${t.origin.km} km</dd>
      <dt>Araç</dt><dd>${t.manifest.vehicle.ad}</dd>
      <dt>Yük</dt><dd class="hl">${t.manifest.product.ad}</dd>
      <dt>Miktar</dt><dd class="hl">${t.manifest.tons} ton</dd>
      <dt>Konteyner</dt><dd>${t.code}</dd>
    </dl>`;
  if (t.hasDecl) {
    d.className = 'paper decl';
    d.innerHTML = `
      <header><h3>Karbon beyanı</h3><span>Yönetmelik madde 7</span></header>
      <p class="d-firm">${t.firm.ad}<br><small>${t.code}</small></p>
      <p class="d-lbl">Sevkiyatın toplam emisyonu</p>
      <p class="d-val">${fmt(t.declared)}<small>t CO₂e</small></p>
      <p class="d-sign">${t.driver.split(' ')[0][0]}. ${t.driver.split(' ').slice(1).join(' ')}</p>`;
  } else {
    d.className = 'paper decl slot';
    d.innerHTML = `<p>${day.no >= 2 ? 'Bu sevkiyatta karbon beyanı yok.' : 'Karbon beyanı 2. günden itibaren zorunlu.'}</p>`;
  }
  requestAnimationFrame(() => {
    m.classList.remove('out'); d.classList.remove('out');
    m.classList.add('in'); setTimeout(() => d.classList.add('in'), 140);
  });
}

// ---------- El kitabı ----------
export function renderRules(day) {
  const prevChecks = new Set(day.no > 1 ? ['urun', 'kilo', 'asiri', ...(day.no > 2 ? ['skdm', 'beyan'] : [])] : []);
  $('tab-rules').innerHTML = `<ol class="rules">${day.checks.map((c) => `
      <li><strong>${CHECKS[c].ad}${prevChecks.has(c) ? '' : ' <em class="new">yeni</em>'}</strong>${CHECKS[c].metin}</li>`).join('')}
      <li><strong>Hepsi temizse</strong>Geçiş ver.</li></ol>`;
}

export function renderFactors(day) {
  const full = day.formula === 'tam';
  const formula = !day.calc ? 'Emisyon hesabı 2. günden itibaren başlar.'
    : full ? 'Emisyon = ton × ürün faktörü + (km ÷ 100) × araç faktörü' : 'Emisyon = ton × ürün faktörü';
  const heavy = (v) => num(v.faktor * RULES.agirKatsayi);
  $('tab-factors').innerHTML = `
    <p class="formula">${formula}</p>
    <table class="ftable"><caption>Ürün, t CO₂e / ton</caption>
      ${PRODUCTS.map((p) => `<tr><td><img src="${iconURL(p.id, '#d9e2e7', '#26343d')}" alt="">${p.ad}${p.skdm ? '<em class="skdm-tag">SKDM</em>' : ''}</td><td>${p.faktor}</td></tr>`).join('')}
    </table>
    <table class="ftable vtable ${full ? '' : 'later'}"><caption>Araç, t CO₂e / 100 km${full ? '' : ', 3. günden itibaren'}</caption>
      <tr class="vhead"><td></td><td>${RULES.agirEsik} t'ye kadar</td><td>${RULES.agirEsik} t üstü</td></tr>
      ${Object.values(VEHICLES).map((v) => `<tr><td><img src="${iconURL(v.id, '#d9e2e7', '#26343d')}" alt="">${v.ad}<small>${v.ipucu}</small></td><td>${num(v.faktor)}</td><td>${heavy(v)}</td></tr>`).join('')}
    </table>
    <p class="limit">Yük sınırı ${RULES.yukSiniri} t. SKDM vergisi: beyan edilen her ton CO₂e için ${RULES.vergiBirim} €.</p>`;
}

// ---------- Emisyon formu ----------
// Oyuncu çarpma yapmaz; her boşluk için doğru kaynağı seçer. Beceri: doğru değeri seçmek.
let F = null;
const SLOT_ORDER = ['ton', 'prod', 'km', 'veh'];

function slotOptions(slot) {
  const t = F.t;
  switch (slot) {
    case 'ton': return [
      { label: 'Manifesto', v: t.manifest.tons, show: `${t.manifest.tons} ton` },
      { label: 'Kantar', v: t.cargo.tons, show: `${t.cargo.tons} ton` }];
    case 'prod': return PRODUCTS.map((p) => ({ label: p.ad, v: p, show: String(p.faktor), icon: p.id }));
    case 'km': return [{ label: `Manifesto, ${t.origin.sehir}`, v: t.origin.km, show: `${t.origin.km} km` }];
    case 'veh': return Object.values(VEHICLES).flatMap((v) => [
      { label: v.ad, v: { ad: v.ad, faktor: v.faktor }, show: num(v.faktor), icon: v.id },
      { label: `${v.ad}, ağır yük`, v: { ad: `${v.ad}, ağır`, faktor: v.faktor * RULES.agirKatsayi }, show: num(v.faktor * RULES.agirKatsayi), icon: v.id },
    ]);
  }
  return [];
}
function slotText(slot) {
  const v = F.vals[slot];
  if (v == null) return null;
  if (slot === 'prod') return `<b>${v.faktor}</b> ${v.ad}`;
  if (slot === 'veh') return `<b>${num(v.faktor)}</b> ${v.ad}`;
  return slot === 'ton' ? `<b>${v}</b> ton` : `<b>${v}</b> km`;
}
const activeSlots = () => (F.day.formula === 'tam' ? SLOT_ORDER : SLOT_ORDER.slice(0, 2));

function renderForm(focusOpt) {
  const el = $('eform');
  if (!F) { el.innerHTML = '<p class="ef-empty">Kamyon bekleniyor.</p>'; return; }
  if (!F.day.calc) { el.innerHTML = '<p class="ef-empty">Emisyon formu 2. günden itibaren kullanılır. Bugün sadece belgeyi yükle karşılaştır.</p>'; return; }
  const full = F.day.formula === 'tam';
  const { ton, prod, km, veh } = F.vals;
  const p1 = ton != null && prod ? ton * prod.faktor : null;
  const p2 = full ? (km != null && veh ? (km / 100) * veh.faktor : null) : 0;
  const total = p1 != null && p2 != null ? p1 + p2 : null;
  const slot = (k, ph) => `<button class="ef-slot ${F.vals[k] != null ? 'filled' : ''} ${F.open === k ? 'open' : ''}" data-slot="${k}" aria-expanded="${F.open === k}">${slotText(k) ?? ph}</button>`;
  const opts = (keys) => (keys.includes(F.open) ? `<div class="ef-opts" role="group" aria-label="Değer seç">${slotOptions(F.open).map((o, i) =>
    `<button class="ef-opt" data-opt="${i}">${o.icon ? `<img src="${iconURL(o.icon, '#d9e2e7', '#26343d')}" alt="">` : ''}<span>${o.label}</span><b>${o.show}</b></button>`).join('')}</div>` : '');
  el.innerHTML = `
    <div class="ef-row"><span class="ef-lbl">Ürün</span>${slot('ton', 'ton seç')}<span class="ef-op">×</span>${slot('prod', 'ürün seç')}<output class="ef-sub">${p1 != null ? fmt(p1) : '–'}</output></div>
    ${opts(['ton', 'prod'])}
    ${full ? `<div class="ef-row"><span class="ef-lbl">Taşıma</span>${slot('km', 'km seç')}<span class="ef-op">÷ 100 ×</span>${slot('veh', 'araç seç')}<output class="ef-sub">${p2 != null ? fmt(p2) : '–'}</output></div>
    ${opts(['km', 'veh'])}` : ''}
    <div class="ef-total ${total != null ? 'done' : ''}"><span>Toplam</span><output aria-live="polite">${total != null ? fmt(total) : '–'}<small>t CO₂e</small></output></div>
    <p class="ef-hint">${total != null ? `Beyandaki değerle karşılaştır. ${RULES.agirEsik} t üstü ağır yüktür.` : 'Boşluğa tıkla, değeri seç.'}</p>`;
  if (focusOpt) el.querySelector('.ef-opt')?.focus({ preventScroll: true });
}

export function formReset(t, day) { F = { t, day, vals: {}, open: null }; if (day.calc) F.open = 'ton'; renderForm(); }
export function formClear() { F = null; renderForm(); }

export function bindForm(onPick) {
  $('eform').addEventListener('click', (e) => {
    if (!F) return;
    const s = e.target.closest('[data-slot]'), o = e.target.closest('[data-opt]');
    if (s) {
      F.open = F.open === s.dataset.slot ? null : s.dataset.slot;
      renderForm(true);
      onPick?.('open');
    } else if (o && F.open) {
      F.vals[F.open] = slotOptions(F.open)[+o.dataset.opt].v;
      F.open = activeSlots().find((k) => F.vals[k] == null) || null; // sıradaki boşluğa geç
      renderForm(!!F.open);
      onPick?.(F.open ? 'fill' : 'done');
    }
  });
}

export function bindTabs() {
  const tabs = [...document.querySelectorAll('[role=tab]')];
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      $(`tab-${t.dataset.tab}`).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        n.focus(); select(n);
      }
    });
  });
  return (name) => select(tabs.find((t) => t.dataset.tab === name));
}

// ---------- Karar ve kantar ----------
export function setDecisions(enabled, day) {
  document.querySelectorAll('.dec').forEach((b) => {
    const locked = !day.choices.includes(b.dataset.choice);
    b.disabled = !enabled || locked;
    b.classList.toggle('locked', locked);
    b.querySelector('.lock')?.remove();
    if (locked) b.insertAdjacentHTML('beforeend', '<span class="lock">2. günden itibaren</span>');
  });
}

export function setKantar(text, state = '') {
  const el = $('kantar-val');
  el.textContent = text;
  el.dataset.state = state;
}

export function setInspect(enabled, label) {
  $('btn-inspect').disabled = !enabled;
  $('inspect-label').textContent = label;
}

// ---------- Fiş ----------
export function showReceipt({ ok, choice, t, effects, last, day }) {
  const r = $('receipt');
  const prodPart = `${t.cargo.tons} × ${t.cargo.product.faktor}`;
  const calc = !day.calc ? ''
    : `<p class="r-calc">${t.formula === 'tam' ? `${prodPart} + (${t.origin.km} ÷ 100) × ${num(vehFactor(t.vehicle, t.cargo.tons))}` : prodPart} = <b>${fmt(t.real)} t CO₂e</b></p>`;
  r.innerHTML = `
    <p class="r-head ${ok ? 'ok' : 'bad'}">${ok ? 'Doğru karar' : 'Hatalı karar'}</p>
    <p class="r-sub">Kararın: ${CHOICE_LABEL[choice]}.${ok ? '' : ` Doğrusu: ${CHOICE_LABEL[t.correct]}.`}</p>
    <p class="r-reason">${t.reason}</p>
    ${calc}
    <ul class="r-fx">${effects.map((e) => `<li class="${e.cls || ''}">${e.text}</li>`).join('')}</ul>
    <button class="btn-next" id="btn-next">${last ? 'Vardiyayı bitir' : 'Sonraki kamyon'} <kbd>Enter</kbd></button>`;
  r.hidden = false;
  r.classList.remove('show'); void r.offsetWidth; r.classList.add('show');
  setTimeout(() => $('btn-next').focus({ preventScroll: true }), 50);
}
export function hideReceipt() { $('receipt').hidden = true; }

export function flash(kind) {
  const f = $('flash');
  f.className = 'flash'; void f.offsetWidth; f.classList.add(kind);
}

// ---------- Tam ekranlar ----------
export function screen(html, cls = '') {
  const s = $('screen');
  $('screen-inner').innerHTML = html;
  $('screen-inner').className = `screen-inner ${cls}`;
  s.hidden = false;
  s.classList.remove('show'); void s.offsetWidth; s.classList.add('show');
  const btn = s.querySelector('[data-primary]');
  setTimeout(() => btn?.focus({ preventScroll: true }), 60);
}
export function hideScreen() { $('screen').hidden = true; }

// ---------- 3D ipucu ----------
export function tip(h, p) {
  const el = $('tip3d');
  if (!h || !p || (h.type === 'desk' && !h.tip)) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = h.type === 'desk' ? `<span>${h.tip}</span>` : h.type === 'crate'
    ? `<img src="${iconURL(h.product.id, '#1d2830', '#f6f3ea')}" alt=""><span>${h.product.ad}<small>1 sandık = 1 ton</small></span>`
    : '<span>Kasayı aç<small>tıkla veya E</small></span>';
  // Sahnenin dışına taşmasın
  const host = el.parentElement, tw = el.offsetWidth, th = el.offsetHeight;
  let x = p.x + 16, y = p.y + 12;
  if (x + tw > host.clientWidth - 8) x = p.x - tw - 12;
  if (y + th > host.clientHeight - 8) y = p.y - th - 12;
  el.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
}

// ---------- Rehber ----------
export function coach(step) {
  const box = $('coach'), hole = $('coach-hole'), dim = $('coach-dim');
  if (!step) { box.hidden = true; hole.hidden = true; dim.hidden = true; return; }
  const tr = step.rect || document.querySelector(step.target)?.getBoundingClientRect();
  if (tr) {
    const x1 = tr.left - 6, y1 = tr.top - 6, x2 = tr.right + 6, y2 = tr.bottom + 6;
    hole.hidden = false; dim.hidden = false;
    Object.assign(hole.style, { left: x1 + 'px', top: y1 + 'px', width: x2 - x1 + 'px', height: y2 - y1 + 'px' });
    dim.style.clipPath = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px)`;
  }
  $('coach-text').innerHTML = step.text;
  $('coach-count').textContent = step.count;
  $('coach-next').hidden = !!step.waitFor;
  box.hidden = false;
  const r = tr;
  const bw = Math.min(340, window.innerWidth - 32);
  box.style.width = bw + 'px';
  if (r) {
    const bh = box.offsetHeight;
    let top = r.top - bh - 14;
    if (top < 12) top = Math.min(r.bottom + 14, window.innerHeight - bh - 12);
    let left = r.left + r.width / 2 - bw / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - bw - 16));
    box.style.top = top + 'px'; box.style.left = left + 'px';
  }
}
