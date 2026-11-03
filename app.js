(function(){
'use strict';
const Q = window.QURAN || [];
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const LS = { last:'q_last', saved:'q_saved', th:'q_theme', fs:'q_fs', font:'q_font' };
let TH = localStorage.getItem(LS.th) || 'light';
let FS = +(localStorage.getItem(LS.fs) || 30);
let FONT = localStorage.getItem(LS.font) || 'amiri';
let SAVED = JSON.parse(localStorage.getItem(LS.saved) || '[]');
let curSurah = null, curAyah = null, readerScroll = 0;

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const AR_NUM = n => String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
const toast = (m, ms=1800) => { const t=$('#toast'); t.textContent=m; t.classList.add('on'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('on'), ms); };

/* normalize arabic for search */
function norm(s){
  return String(s)
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g,'')  // harakat, tatweel
    .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ة/g,'ه')
    .replace(/[^\u0621-\u064A\s]/g,' ')
    .replace(/\s+/g,' ').trim();
}

/* strip basmala from first ayah (kept separately) */
const BASM = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
(function clean(){
  Q.forEach(s => {
    if (s.n === 1 || s.n === 9) return;
    const a = s.ayahs[0];
    if (a && a[1].startsWith(BASM)) a[1] = a[1].slice(BASM.length).trim();
  });
})();

/* ---------- theme / font ---------- */
function applyTheme(){
  document.documentElement.setAttribute('data-th', TH);
  localStorage.setItem(LS.th, TH);
  $$('#themeChips button').forEach(b => b.classList.toggle('on', b.dataset.th === TH));
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.setAttribute('content', TH === 'dark' ? '#0d1512' : '#0b3a34');
}
function applyFont(){
  document.documentElement.style.setProperty('--read-font', FONT === 'amiri' ? "Amiri, serif" : "inherit");
  document.body.style.setProperty('--fs', FS + 'px');
  $$('.aya, .srow b, .readhead h2, .sample, .bism').forEach(el => { el.style.fontFamily = FONT === 'amiri' ? 'Amiri, serif' : 'inherit'; });
  $$('.aya').forEach(el => { el.style.fontSize = FS + 'px'; });
  $$('#fontChips button').forEach(b => b.classList.toggle('on', b.dataset.f === FONT));
  localStorage.setItem(LS.fs, FS); localStorage.setItem(LS.font, FONT);
  $('#fsVal').textContent = FS;
  $('#fsSample').style.fontSize = (FS * .85) + 'px';
  $('#fsSample').style.fontFamily = FONT === 'amiri' ? 'Amiri, serif' : 'inherit';
}

/* ---------- navigation ---------- */
function go(page, opts){
  $$('.page').forEach(p => p.classList.remove('on'));
  $('#pg' + page).classList.add('on');
  $('#backBtn').hidden = (page === 'Home');
  $('#brandBox').style.visibility = (page === 'Home') ? 'visible' : 'hidden';
  window.scrollTo(0, 0);
  if (page === 'Home') { buildList(); renderLast(); }
  if (page === 'Search') setTimeout(()=>$('#q2').focus(), 60);
}
window.go = go;

/* ---------- home list ---------- */
let TAB = 'surah';
function buildList(){
  const box = $('#listBox');
  if (TAB === 'surah') {
    box.innerHTML = Q.map(s => `<div class="srow" onclick="openSurah(${s.n})">
      <div class="snum">${AR_NUM(s.n)}</div>
      <div class="mid"><b>${esc(s.name)}</b><i>${s.type === 'Medinan' ? 'مدنية' : 'مكية'} · ${AR_NUM(s.count)} آية</i></div>
      <span class="mut" style="font-size:1.1rem">›</span></div>`).join('');
  } else if (TAB === 'juz') {
    const starts = {};
    Q.forEach(s => s.ayahs.forEach(a => { if (!starts[a[2]]) starts[a[2]] = { s:s.n, name:s.name, a:a[0] }; }));
    box.innerHTML = Object.keys(starts).map(Number).sort((a,b)=>a-b).map(j => {
      const st = starts[j];
      return `<div class="srow" onclick="openSurah(${st.s},${st.a})">
        <div class="snum">${AR_NUM(j)}</div>
        <div class="mid"><b>الجزء ${AR_NUM(j)}</b><i>يبدأ من ${esc(st.name)} · آية ${AR_NUM(st.a)}</i></div>
        <span class="mut" style="font-size:1.1rem">›</span></div>`;
    }).join('');
  } else {
    if (!SAVED.length) { box.innerHTML = `<div class="card center mut">لا توجد آيات محفوظة بعد.<br><span class="tiny">اضغط أي آية أثناء القراءة واختار «حفظ الآية».</span></div>`; return; }
    box.innerHTML = SAVED.slice().reverse().map(x => {
      const s = Q[x.s-1]; const a = s && s.ayahs.find(y => y[0] === x.a);
      return `<div class="res" onclick="openSurah(${x.s},${x.a})">
        <div class="rh">${esc(s ? s.name : '')} · آية ${AR_NUM(x.a)}</div>
        <div class="rt">${a ? esc(a[1].slice(0,120)) + (a[1].length>120?'…':'') : ''}</div></div>`;
    }).join('');
  }
}

/* ---------- last read ---------- */
function saveLast(s, a, sc){
  localStorage.setItem(LS.last, JSON.stringify({ s, a, sc: Math.round(sc || 0), t: Date.now() }));
}
function renderLast(){
  const raw = localStorage.getItem(LS.last); const el = $('#lastRead');
  if (!raw) { el.hidden = true; return; }
  let d; try { d = JSON.parse(raw); } catch(e){ el.hidden = true; return; }
  const s = Q[d.s-1]; if (!s) { el.hidden = true; return; }
  el.hidden = false;
  $('#lrName').textContent = 'سورة ' + s.name;
  $('#lrAyah').textContent = 'من الآية ' + AR_NUM(d.a);

  el.onclick = () => openSurah(d.s, d.a);
}
window.openLast = () => { const raw = localStorage.getItem(LS.last); if (!raw) return; const d = JSON.parse(raw); openSurah(d.s, d.a); };

/* ---------- reader ---------- */
function openSurah(n, focusAyah){
  const s = Q[n-1]; if (!s) return;
  curSurah = n;
  const head = `<div class="readhead"><h2>سورة ${esc(s.name)}</h2>
    <p>${s.type === 'Medinan' ? 'مدنية' : 'مكية'} · ${AR_NUM(s.count)} آية · الترتيب ${AR_NUM(s.n)}</p></div>`;
  $('#readHead').innerHTML = head;
  const showBism = (s.n !== 1 && s.n !== 9);
  $('#ayatBox').innerHTML = (showBism ? `<div class="bism">${BASM}</div>` : '') +
    s.ayahs.map(a => {
      const isSaved = SAVED.some(x => x.s === s.n && x.a === a[0]);
      return `<span class="aya${isSaved?' saved':''}" data-a="${a[0]}" onclick="pickAyah(${s.n},${a[0]},event)">${esc(a[1])}<span class="num">${AR_NUM(a[0])}</span> </span>`;
    }).join('');
  $('#readFoot').innerHTML = `<div class="navrow">
      ${s.n > 1 ? `<button onclick="openSurah(${s.n-1})">‹ السورة السابقة</button>` : ''}
      ${s.n < 114 ? `<button onclick="openSurah(${s.n+1})">السورة التالية ›</button>` : ''}
    </div>`;
  go('Read');
  applyFont();
  if (focusAyah) {
    const el = document.querySelector(`.aya[data-a="${focusAyah}"]`);
    if (el) setTimeout(() => { el.scrollIntoView({ block:'center' }); el.style.background = 'color-mix(in srgb, var(--gold) 22%, transparent)'; setTimeout(()=>el.style.background='', 1600); }, 120);
  }
  saveLast(s.n, focusAyah || 1, 0);
  window.addEventListener('scroll', trackScroll, { passive:true });
}
window.openSurah = openSurah;

function trackScroll(){
  if (!$('#pgRead').classList.contains('on') || !curSurah) return;
  const ayas = $$('.aya'); if (!ayas.length) return;
  let best = ayas[0], bestD = 1e9;
  const mid = window.innerHeight * .35;
  ayas.forEach(a => { const r = a.getBoundingClientRect(); const d = Math.abs(r.top - mid); if (d < bestD) { bestD = d; best = a; } });
  const n = +best.dataset.a;
  if (n && n !== curAyah) { curAyah = n; saveLast(curSurah, n, window.scrollY); }
}
window.addEventListener('scroll', trackScroll, { passive:true });

/* ---------- ayah sheet ---------- */
let picked = null;
function pickAyah(s, a, ev){
  if (ev) ev.stopPropagation();
  picked = { s, a };
  const su = Q[s-1]; const ay = su.ayahs.find(x => x[0] === a);
  $('#sheetT').textContent = `سورة ${su.name} · آية ${AR_NUM(a)}`;
  $('#sheet').classList.add('on');
  picked.text = ay ? ay[1] : '';
}
window.pickAyah = pickAyah;
window.closeSheet = () => $('#sheet').classList.remove('on');
window.act = (what) => {
  if (!picked) return;
  const label = `﴿${picked.text}﴾ [${Q[picked.s-1].name}: ${AR_NUM(picked.a)}]`;
  if (what === 'save'){
    const i = SAVED.findIndex(x => x.s === picked.s && x.a === picked.a);
    if (i >= 0) { SAVED.splice(i,1); toast('تم إزالة الحفظ'); }
    else { SAVED.push({ s: picked.s, a: picked.a, t: Date.now() }); toast('تم الحفظ ✓'); }
    localStorage.setItem(LS.saved, JSON.stringify(SAVED));
    const el = document.querySelector(`.aya[data-a="${picked.a}"]`);
    if (el) el.classList.toggle('saved', SAVED.some(x => x.s === picked.s && x.a === picked.a));
  }
  if (what === 'copy'){
    navigator.clipboard ? navigator.clipboard.writeText(label).then(()=>toast('تم النسخ ✓')).catch(()=>toast('تعذّر النسخ'))
      : toast('تعذّر النسخ');
  }
  if (what === 'share'){
    if (navigator.share) navigator.share({ text: label, title: 'القرآن الكريم' }).catch(()=>{});
    else toast('المشاركة غير متاحة على هذا الجهاز');
  }
  if (what === 'start'){ saveLast(picked.s, picked.a, 0); toast('تم حفظ موضع القراءة'); }
  closeSheet();
};

/* ---------- search ---------- */
function doSearch(v){
  const q = norm(v);
  if (q.length < 2) { $('#resBox').innerHTML = `<div class="card center mut">اكتب كلمتين على الأقل للبحث.</div>`; return; }
  const res = [];
  for (const s of Q) {
    for (const a of s.ayahs) {
      if (norm(a[1]).includes(q)) { res.push({ s, a }); if (res.length >= 250) break; }
      }
    if (res.length >= 250) break;
  }
  $('#resBox').innerHTML = res.length
    ? `<div class="tiny mut" style="padding:2px 4px 10px">${AR_NUM(res.length)} نتيجة</div>` + res.map(r => {
        const txt = esc(r.a[1]);
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i');
        return `<div class="res" onclick="openSurah(${r.s.n},${r.a[0]})">
          <div class="rh">${esc(r.s.name)} · آية ${AR_NUM(r.a[0])}</div>
          <div class="rt">${txt.slice(0, 180)}${txt.length>180?'…':''}</div></div>`;
      }).join('')
    : `<div class="card center mut">لا توجد نتائج مطابقة.</div>`;
}

/* ---------- events ---------- */
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('.tab'); if (!b) return;
  TAB = b.dataset.t; $$('.tab').forEach(x => x.classList.toggle('on', x === b)); buildList();
});
$('#searchBtn').onclick = () => go('Search');
$('#setBtn').onclick = () => go('Set');
$('#backBtn').onclick = () => go('Home');
$('#qGo').onclick = () => { const v = $('#q').value.trim(); if (v) { $('#q2').value = v; go('Search'); doSearch(v); } };
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') $('#qGo').click(); });
$('#q2Go').onclick = () => doSearch($('#q2').value);
$('#q2').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch($('#q2').value); });
$('#themeChips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; TH = b.dataset.th; applyTheme(); });
$('#fontChips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; FONT = b.dataset.f; applyFont(); });
$('#fs').addEventListener('input', e => { FS = +e.target.value; applyFont(); });
$('#clearBtn').onclick = () => {
  if (!confirm('مسح كل المحفوظات وموضع القراءة؟')) return;
  SAVED = []; localStorage.removeItem(LS.saved); localStorage.removeItem(LS.last);
  buildList(); renderLast(); toast('تم المسح');
};
document.addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });

/* ---------- PWA ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('#installBtn').hidden = false; });
$('#installBtn').onclick = async () => {
  if (!deferredPrompt) { toast('افتح قائمة المتصفح ← «إضافة إلى الشاشة الرئيسية»'); return; }
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#installBtn').hidden = true;
};
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}

/* ---------- boot ---------- */
function boot(){
  const fill = $('#loadFill'), txt = $('#loadTxt');
  let p = 0;
  const tick = setInterval(() => {
    p = Math.min(100, p + 12);
    fill.style.width = p + '%';
    if (p >= 100) {
      clearInterval(tick);
      txt.textContent = 'تم';
      applyTheme(); applyFont();
      buildList(); renderLast();
      setTimeout(() => { $('#splash').classList.add('hide'); setTimeout(()=>$('#splash').remove(), 600); }, 220);
    }
  }, 90);
  // direct hash support: #s:18
  const m = location.hash.match(/^#s:(\d+)(?::(\d+))?/);
  if (m) setTimeout(() => openSurah(+m[1], m[2] ? +m[2] : null), 900);
}
document.addEventListener('DOMContentLoaded', boot);
if (document.readyState !== 'loading') boot();
})();


/* ================= offlineManager: make "offline" obvious and reliable ================= */
const offlineManager = (() => {
  const CACHE = 'quran-v3';
  const FILES = ['./', './index.html', './styles.css', './app.js', './data.js', './amiri.ttf', './manifest.json', './icons/i192.png', './icons/i512.png'];
  const bar = () => document.getElementById('offbar');
  const txt = () => document.getElementById('offtxt');
  const act = () => document.getElementById('offact');

  function show(msg, actionText, actionFn) {
    const b = bar(); if (!b) return;
    txt().textContent = msg;
    if (actionText) { act().style.display = 'inline-block'; act().textContent = actionText; act().onclick = actionFn; }
    else act().style.display = 'none';
    b.style.display = 'block';
    document.body.style.paddingTop = b.offsetHeight + 'px';
  }
  function hide() {
    const b = bar(); if (!b) return;
    b.style.display = 'none'; document.body.style.paddingTop = '';
  }

  const isInApp = /WhatsApp|FBAN|FBAV|Instagram|Line\/|MicroMessenger/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  async function cacheAll(onProgress) {
    const c = await caches.open(CACHE);
    let done = 0;
    for (const f of FILES) {
      try { const r = await fetch(f, { cache: 'reload' }); if (r.ok) await c.put(f, r.clone()); }
      catch (e) {}
      done++; onProgress && onProgress(done, FILES.length);
    }
    return done;
  }

  async function isReady() {
    if (!('caches' in window)) return false;
    const c = await caches.open(CACHE);
    const keys = await c.keys();
    return keys.length >= FILES.length - 1;
  }

  async function prepare(manual) {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    if (await isReady()) {
      if (manual) { show('✅ التطبيق جاهز ويعمل بدون إنترنت'); setTimeout(hide, 2600); return; }
      if (isInApp) { show('✅ محفوظ. عشان يشتغل بدون نت ثبته: افتحه في كروم ← إضافة إلى الشاشة الرئيسية',
        'افتح في كروم', () => { location.href = 'intent://mido9980.github.io/quran/#Intent;scheme=https;package=com.android.chrome;end'; }); }
      return;
    }
    show('⏳ بجهّز التطبيق للعمل بدون نت...');
    try {
      await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
    } catch (e) {}
    await cacheAll((d, n) => { txt().textContent = `⏳ بجهّز التطبيق للعمل بدون نت ${d}/${n}`; });
    const ok = await isReady();
    if (ok) {
      if (isInApp) {
        show(isIOS ? '✅ جاهز. على الآيفون: افتحه في سفاري واختار «إضافة إلى الشاشة الرئيسية»'
                   : '✅ جاهز. عشان يفضل أوف لاين نزّله على الشاشة الرئيسية من كروم',
             isIOS ? 'طريقة التثبيت' : 'افتح في كروم',
             isIOS ? () => show('من سفاري: زرار المشاركة ← إضافة إلى الشاشة الرئيسية', null)
                   : () => { location.href = 'intent://mido9980.github.io/quran/#Intent;scheme=https;package=com.android.chrome;end'; });
      } else {
        show('✅ التطبيق جاهز ويعمل بدون إنترنت');
        setTimeout(hide, 3200);
      }
    } else {
      show('⚠ التحميل ما اكتملش — اضغط لإعادة المحاولة', 'إعادة المحاولة', () => prepare(true));
    }
  }

  window.addEventListener('online', () => prepare(false));
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => prepare(false), 800));
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', () => prepare(false));
  return { prepare, isReady };
})();
