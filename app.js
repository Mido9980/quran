(function () {
'use strict';
const Q = window.QURAN || [];
const I18 = window.I18N || {};
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const LS = { last:'q_last', saved:'q_saved', th:'q_theme', fs:'q_fs', font:'q_font', lang:'q_lang' };

let LANG = localStorage.getItem(LS.lang) || 'ar';
let TH = localStorage.getItem(LS.th) || 'light';
let FS = +(localStorage.getItem(LS.fs) || 30);
let FONT = localStorage.getItem(LS.font) || 'amiri';
let SAVED = JSON.parse(localStorage.getItem(LS.saved) || '[]');
let curSurah = null, curAyah = null, picked = null, TAB = 'surah';

const t = k => (I18[LANG] && I18[LANG][k]) || (I18.ar && I18.ar[k]) || k;

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const AR_NUM = n => String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
const num = n => LANG === 'ar' || LANG === 'ur' ? AR_NUM(n) : String(n);
function toast(m, ms = 1900) {
  const el = $('#toast'); el.textContent = m; el.classList.add('on');
  clearTimeout(el._h); el._h = setTimeout(() => el.classList.remove('on'), ms);
}

function norm(s) {
  return String(s)
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\u0621-\u064A\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

const BASM = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
(function stripBasmala() {
  Q.forEach(s => {
    if (s.n === 1 || s.n === 9) return;
    const a = s.ayahs[0];
    if (a && a[1].startsWith(BASM)) a[1] = a[1].slice(BASM.length).trim();
  });
})();

/* ---------- language ---------- */
function applyLang() {
  const meta = I18[LANG] || I18.ar;
  document.documentElement.lang = LANG;
  document.documentElement.dir = meta.dir;
  localStorage.setItem(LS.lang, LANG);
  document.querySelectorAll('[data-i]').forEach(el => { el.textContent = t(el.dataset.i); });
  document.querySelectorAll('[data-i-ph]').forEach(el => { el.placeholder = t(el.dataset.iPh); });
  buildLangList();
  buildList(); renderLast();
  if (curSurah) renderSurah(curSurah, false);
  applyFont();
}

function buildLangList() {
  const langs = Object.keys(I18);
  const html = langs.map(k => `<button class="langrow ${k === LANG ? 'on' : ''}" data-l="${k}">
      <span class="fl">${I18[k].flag || ''}</span> ${I18[k].name}
      ${k === LANG ? '<span class="tick">✓</span>' : ''}</button>`).join('');
  $('#langList').innerHTML = html;
  $$('#langList .langrow').forEach(b => b.onclick = () => {
    LANG = b.dataset.l; applyLang(); $('#langSheet').classList.remove('on');
  });
  const home = $('#langChipsHome');
  if (home) {
    home.innerHTML = langs.map(k => `<button class="${k === LANG ? 'on' : ''}" data-l2="${k}">${I18[k].flag || ''} ${I18[k].name}</button>`).join('');
    home.querySelectorAll('[data-l2]').forEach(b => b.onclick = () => { LANG = b.dataset.l2; applyLang(); });
  }
}

/* ---------- theme / font ---------- */
function applyTheme() {
  document.documentElement.setAttribute('data-th', TH);
  localStorage.setItem(LS.th, TH);
  $$('#themeChips button').forEach(b => b.classList.toggle('on', b.dataset.th === TH));
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.setAttribute('content', TH === 'dark' ? '#0d1512' : '#0B3A34');
}
function applyFont() {
  $$('.aya, .srow b, .readhead h2, .sample, .bism').forEach(el => {
    el.style.fontFamily = FONT === 'amiri' ? 'Amiri, serif' : 'inherit';
  });
  $$('.aya').forEach(el => { el.style.fontSize = FS + 'px'; });
  $$('#fontChips button').forEach(b => b.classList.toggle('on', b.dataset.f === FONT));
  localStorage.setItem(LS.fs, FS); localStorage.setItem(LS.font, FONT);
  const fv = $('#fsVal'); if (fv) fv.textContent = FS;
  const sm = $('#fsSample');
  if (sm) { sm.style.fontSize = (FS * .85) + 'px'; sm.style.fontFamily = FONT === 'amiri' ? 'Amiri, serif' : 'inherit'; }
}

/* ---------- navigation ---------- */
function go(page) {
  $$('.page').forEach(p => p.classList.remove('on'));
  const el = $('#pg' + page); if (el) el.classList.add('on');
  const bb = $('#backBtn'); if (bb) bb.hidden = (page === 'Home');
  const brand = $('#brandBox'); if (brand) brand.style.visibility = (page === 'Home') ? 'visible' : 'hidden';
  window.scrollTo(0, 0);
  if (page === 'Home') { buildList(); renderLast(); }
  if (page === 'Search') setTimeout(() => { const q = $('#q2'); if (q) q.focus(); }, 60);
}
window.go = go;

/* ---------- lists ---------- */
function buildList() {
  const box = $('#listBox'); if (!box) return;
  if (TAB === 'surah') {
    box.innerHTML = Q.map(s => `<div class="srow" data-s="${s.n}">
      <div class="snum">${num(s.n)}</div>
      <div class="mid"><b>${esc(s.name)}</b>
        <i>${s.type === 'Medinan' ? t('medinan') : t('meccan')} · ${num(s.count)} ${t('ayahs')}</i></div>
      <span class="mut">›</span></div>`).join('');
    box.querySelectorAll('.srow').forEach(r => r.onclick = () => openSurah(+r.dataset.s));
  } else if (TAB === 'juz') {
    const starts = {};
    Q.forEach(s => s.ayahs.forEach(a => { if (!starts[a[2]]) starts[a[2]] = { s: s.n, name: s.name, a: a[0] }; }));
    box.innerHTML = Object.keys(starts).map(Number).sort((x, y) => x - y).map(j => {
      const st = starts[j];
      return `<div class="srow" data-s="${st.s}" data-a="${st.a}">
        <div class="snum">${num(j)}</div>
        <div class="mid"><b>${t('juz')} ${num(j)}</b>
          <i>${t('starts_from')} ${esc(st.name)} · ${t('ayah')} ${num(st.a)}</i></div>
        <span class="mut">›</span></div>`;
    }).join('');
    box.querySelectorAll('.srow').forEach(r => r.onclick = () => openSurah(+r.dataset.s, +r.dataset.a));
  } else {
    if (!SAVED.length) {
      box.innerHTML = `<div class="card center mut">${t('no_saved')}<br><span class="tiny">${t('no_saved_h')}</span></div>`;
      return;
    }
    box.innerHTML = SAVED.slice().reverse().map(x => {
      const s = Q[x.s - 1]; const a = s && s.ayahs.find(y => y[0] === x.a);
      return `<div class="res" data-s="${x.s}" data-a="${x.a}">
        <div class="rh">${esc(s ? s.name : '')} · ${t('ayah')} ${num(x.a)}</div>
        <div class="rt" dir="rtl">${a ? esc(a[1].slice(0, 120)) + (a[1].length > 120 ? '…' : '') : ''}</div></div>`;
    }).join('');
    box.querySelectorAll('.res').forEach(r => r.onclick = () => openSurah(+r.dataset.s, +r.dataset.a));
  }
}

/* ---------- last read ---------- */
function saveLast(s, a, sc) {
  localStorage.setItem(LS.last, JSON.stringify({ s, a, sc: Math.round(sc || 0), t: Date.now() }));
}
function renderLast() {
  const raw = localStorage.getItem(LS.last); const el = $('#lastRead');
  if (!el) return;
  if (!raw) { el.hidden = true; return; }
  let d; try { d = JSON.parse(raw); } catch { el.hidden = true; return; }
  const s = Q[d.s - 1]; if (!s) { el.hidden = true; return; }
  el.hidden = false;
  const cap = el.querySelector('.lr-cap'); if (cap) cap.textContent = t('last_read');
  $('#lrName').textContent = t('surah') + ' ' + s.name;
  $('#lrAyah').textContent = t('ayah') + ' ' + num(d.a);
  el.onclick = () => openSurah(d.s, d.a);
}

/* ---------- reader ---------- */
function renderSurah(n, scroll) {
  const s = Q[n - 1]; if (!s) return;
  const showBism = (s.n !== 1 && s.n !== 9);
  $('#readHead').innerHTML = `<h2>${t('surah')} ${esc(s.name)}</h2>
    <p>${s.type === 'Medinan' ? t('medinan') : t('meccan')} · ${num(s.count)} ${t('ayahs')} · ${t('order')} ${num(s.n)}</p>`;
  $('#ayatBox').innerHTML = (showBism ? `<div class="bism">${BASM}</div>` : '') +
    s.ayahs.map(a => {
      const isSaved = SAVED.some(x => x.s === s.n && x.a === a[0]);
      return `<span class="aya${isSaved ? ' saved' : ''}" data-a="${a[0]}">${esc(a[1])}<span class="num">${num(a[0])}</span> </span>`;
    }).join('');
  $('#ayatBox').querySelectorAll('.aya').forEach(el => el.onclick = ev => pickAyah(s.n, +el.dataset.a, ev));
  $('#readFoot').innerHTML = `<div class="navrow">
      ${s.n > 1 ? `<button data-go="${s.n - 1}">‹ ${t('prev')}</button>` : ''}
      ${s.n < 114 ? `<button data-go="${s.n + 1}">${t('next')} ›</button>` : ''}
    </div>`;
  $('#readFoot').querySelectorAll('[data-go]').forEach(b => b.onclick = () => openSurah(+b.dataset.go));
  if (scroll) go('Read');
  applyFont();
}

function openSurah(n, focusAyah) {
  const s = Q[n - 1]; if (!s) return;
  curSurah = n;
  renderSurah(n, true);
  if (focusAyah) {
    const el = document.querySelector(`.aya[data-a="${focusAyah}"]`);
    if (el) setTimeout(() => {
      el.scrollIntoView({ block: 'center' });
      el.style.background = 'color-mix(in srgb, var(--gold) 22%, transparent)';
      setTimeout(() => el.style.background = '', 1600);
    }, 130);
  }
  saveLast(s.n, focusAyah || 1, 0);
}
window.openSurah = openSurah;

function trackScroll() {
  if (!$('#pgRead').classList.contains('on') || !curSurah) return;
  const ayas = $$('.aya'); if (!ayas.length) return;
  let best = ayas[0], bestD = 1e9; const mid = window.innerHeight * .35;
  ayas.forEach(a => { const r = a.getBoundingClientRect(); const d = Math.abs(r.top - mid); if (d < bestD) { bestD = d; best = a; } });
  const n = +best.dataset.a;
  if (n && n !== curAyah) { curAyah = n; saveLast(curSurah, n, window.scrollY); }
}
window.addEventListener('scroll', trackScroll, { passive: true });

/* ---------- ayah sheet ---------- */
function pickAyah(s, a, ev) {
  if (ev) ev.stopPropagation();
  picked = { s, a };
  const su = Q[s - 1]; const ay = su.ayahs.find(x => x[0] === a);
  picked.text = ay ? ay[1] : '';
  $('#sheetT').textContent = `${t('surah')} ${su.name} · ${t('ayah')} ${num(a)}`;
  const isSaved = SAVED.some(x => x.s === s && x.a === a);
  $('#actSave').textContent = isSaved ? t('unsave_ayah') : t('save_ayah');
  $('#sheet').classList.add('on');
}
window.pickAyah = pickAyah;

function closeSheet() { $('#sheet').classList.remove('on'); }

function act(what) {
  if (!picked) return;
  const label = `﴿${picked.text}﴾ [${Q[picked.s - 1].name}: ${num(picked.a)}]`;
  if (what === 'save') {
    const i = SAVED.findIndex(x => x.s === picked.s && x.a === picked.a);
    if (i >= 0) { SAVED.splice(i, 1); toast(t('removed_ok')); }
    else { SAVED.push({ s: picked.s, a: picked.a, t: Date.now() }); toast(t('saved_ok')); }
    localStorage.setItem(LS.saved, JSON.stringify(SAVED));
    const el = document.querySelector(`.aya[data-a="${picked.a}"]`);
    if (el) el.classList.toggle('saved', SAVED.some(x => x.s === picked.s && x.a === picked.a));
  }
  if (what === 'copy') {
    if (navigator.clipboard) navigator.clipboard.writeText(label).then(() => toast(t('copied'))).catch(() => toast(t('copy_fail')));
    else toast(t('copy_fail'));
  }
  if (what === 'share') {
    if (navigator.share) navigator.share({ text: label, title: t('app') }).catch(() => {});
    else toast(t('share_fail'));
  }
  if (what === 'start') { saveLast(picked.s, picked.a, 0); renderLast(); toast(t('pos_saved')); }
  closeSheet();
}

/* ---------- search ---------- */
function doSearch(v) {
  const q = norm(v);
  const box = $('#resBox');
  if (q.length < 2) { box.innerHTML = `<div class="card center mut">${t('search_hint')}</div>`; return; }
  const res = [];
  for (const s of Q) {
    for (const a of s.ayahs) {
      if (norm(a[1]).includes(q)) { res.push({ s, a }); if (res.length >= 250) break; }
    }
    if (res.length >= 250) break;
  }
  box.innerHTML = res.length
    ? `<div class="tiny mut" style="padding:2px 4px 10px">${num(res.length)} ${t('results')}</div>` + res.map(r =>
        `<div class="res" data-s="${r.s.n}" data-a="${r.a[0]}">
          <div class="rh">${esc(r.s.name)} · ${t('ayah')} ${num(r.a[0])}</div>
          <div class="rt" dir="rtl">${esc(r.a[1].slice(0, 180))}${r.a[1].length > 180 ? '…' : ''}</div></div>`).join('')
    : `<div class="card center mut">${t('no_results')}</div>`;
  box.querySelectorAll('.res').forEach(el => el.onclick = () => openSurah(+el.dataset.s, +el.dataset.a));
}

/* ---------- events ---------- */
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('.tab'); if (!b) return;
  TAB = b.dataset.t; $$('.tab').forEach(x => x.classList.toggle('on', x === b)); buildList();
});
$('#searchBtn').onclick = () => go('Search');
$('#setBtn').onclick = () => { go('Set'); buildLangList(); };
$('#backBtn').onclick = () => go('Home');
$('#langBtn').onclick = () => { buildLangList(); $('#langSheet').classList.add('on'); };
$('#langSheet').onclick = e => { if (e.target.id === 'langSheet') $('#langSheet').classList.remove('on'); };
$('#themeBtn').onclick = () => {
  const order = ['light', 'sepia', 'dark'];
  TH = order[(order.indexOf(TH) + 1) % order.length];
  applyTheme();
  toast({ light: t('th_light'), sepia: t('th_sepia'), dark: t('th_dark') }[TH]);
};
$('#qGo').onclick = () => { const v = $('#q').value.trim(); if (v) { $('#q2').value = v; go('Search'); doSearch(v); } };
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') $('#qGo').click(); });
$('#q2Go').onclick = () => doSearch($('#q2').value);
$('#q2').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch($('#q2').value); });
$('#themeChips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; TH = b.dataset.th; applyTheme(); });
$('#fontChips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; FONT = b.dataset.f; applyFont(); });
$('#fs').addEventListener('input', e => { FS = +e.target.value; applyFont(); });
$('#clearBtn').onclick = () => {
  if (!confirm(t('clear_ask'))) return;
  SAVED = []; localStorage.removeItem(LS.saved); localStorage.removeItem(LS.last);
  buildList(); renderLast(); toast(t('cleared'));
};
$('#actSave').onclick = () => act('save');
$('#actCopy').onclick = () => act('copy');
$('#actShare').onclick = () => act('share');
$('#actStart').onclick = () => act('start');
$('#actCancel').onclick = closeSheet;
document.addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });

/* ---------- PWA ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e; $('#installBtn').hidden = false;
});
$('#installBtn').onclick = async () => {
  if (!deferredPrompt) { toast(t('install_hint')); return; }
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#installBtn').hidden = true;
};
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ---------- boot ---------- */
function boot() {
  applyLang(); applyTheme(); applyFont(); renderLast();
  const m = location.hash.match(/^#s:(\d+)(?::(\d+))?/);
  const spl = $('#splash');
  setTimeout(() => {
    if (spl) { spl.classList.add('hide'); setTimeout(() => spl.remove(), 600); }
    if (m) openSurah(+m[1], m[2] ? +m[2] : null);
  }, 700);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

/* ================= offline prep + in-app browser hint ================= */
(function offlinePrep(){
  const CACHE='quran-v4';
  const FILES=['./','./index.html','./styles.css','./app.js','./data.js','./i18n.js','./amiri.ttf','./manifest.json','./icons/i192.png','./icons/i512.png','./icons/apple-touch-icon.png'];
  const T = k => (window.I18N[localStorage.getItem('q_lang')||'ar']||window.I18N.ar)[k] || k;
  const bar=()=>document.getElementById('offbar'), txt=()=>document.getElementById('offtxt'), act=()=>document.getElementById('offact');
  const inApp=/WhatsApp|FBAN|FBAV|Instagram|Line\/|MicroMessenger/i.test(navigator.userAgent);
  const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);
  function show(msg,label,fn){ const b=bar(); if(!b) return; txt().textContent=msg;
    if(label){ act().style.display='inline-block'; act().textContent=label; act().onclick=fn; } else act().style.display='none';
    b.style.display='block'; document.body.style.paddingTop=b.offsetHeight+'px'; }
  function hide(){ const b=bar(); if(!b) return; b.style.display='none'; document.body.style.paddingTop=''; }
  async function ready(){ if(!('caches' in window)) return false; const c=await caches.open(CACHE); return (await c.keys()).length>=FILES.length-1; }
  async function prepare(manual){
    if(!('serviceWorker' in navigator)||!location.protocol.startsWith('http')) return;
    if(await ready()){
      if(manual){ show('✅ '+T('ready')); setTimeout(hide,2600); return; }
      if(inApp){ show('✅ '+T('inapp'), T('open_chrome'), ()=>{ location.href='intent://mido9980.github.io/quran/#Intent;scheme=https;package=com.android.chrome;end'; }); }
      return;
    }
    show('⏳ '+T('preparing')+'…');
    try{ await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; }catch(e){}
    const c=await caches.open(CACHE); let d=0;
    for(const f of FILES){ try{ const r=await fetch(f,{cache:'reload'}); if(r.ok) await c.put(f,r.clone()); }catch(e){} d++; txt().textContent=`⏳ ${T('preparing')} ${d}/${FILES.length}`; }
    if(await ready()){ show('✅ '+T('ready')); setTimeout(hide,2800); }
    else show('⚠ '+T('preparing'), T('retry'), ()=>prepare(true));
  }
  window.addEventListener('online',()=>prepare(false));
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>prepare(false),900));
})();
