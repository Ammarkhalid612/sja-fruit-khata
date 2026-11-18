/* SJA — فروٹ سبزی کمیشن شاپ: بل، وصولی، کھاتہ */
(function(){
"use strict";

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const n2 = v => { const x = Number(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(x) ? x : 0; };
const fmt = v => Math.round(n2(v)).toLocaleString("en-US");
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const ddmmyy = s => s ? s.slice(8, 10) + "-" + s.slice(5, 7) + "-" + s.slice(2, 4) : "";
const ddmmyyyy = s => s ? s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4) : "";
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const norm = s => String(s || "").trim().replace(/\s+/g, " ");

const DEFAULT_ITEMS = [
  "مسمی", "سیب", "کیلا", "انگور", "فروٹر", "خربوزہ", "سٹرابری",
  "تربوز", "فالسہ", "آم", "آلو بخارا", "خوبانی", "انار", "گرما", "جاپانی پھل",
  "کینو", "مالٹا", "سنگترہ", "لیموں", "گریپ فروٹ", "امرود", "پپیتا", "چیکو", "ناشپاتی", "آڑو",
  "لیچی", "جامن", "شہتوت", "بیر", "انجیر", "کھجور", "انناس", "ناریل", "چیری", "کیوی",
  "املوک", "شریفہ", "سردا", "ڈریگن فروٹ", "ایوکاڈو"
];
const ITEMS_VERSION = 2;   // نئے پھل شامل ہوں تو یہ بڑھائیں — پرانی دکانوں میں بھی خود شامل ہو جاتے ہیں
const DANA = ["", "20", "24", "30", "36", "40", "48", "56", "60", "64", "72", "80", "88", "100", "113", "125"];
const DEFAULT_SETTINGS = {
  name: "شیخ جاوید شیخ عاطف کمیشن شاپ",
  sub: "فروٹ سبزی کمیشن ایجنٹس",
  addr: "سبزی منڈی جی ٹی روڈ کامونکے",
  p1n: "شیخ جاوید", p1: "0300-6464326",
  p2n: "شیخ عاطف جاوید", p2: "0302-4290477, 0343-0579690",
  foot: "شکریہ — اللہ آپ کے کاروبار میں برکت دے",
  paper: "A5"
};

const S = { store:null, user:null, parties:[], items:[], bills:[], payments:[], settings:Object.assign({}, DEFAULT_SETTINGS),
  view:"dash", editBill:null, editPay:null };

/* app ke andar apna tasdeeq / sawal dialog (browser ke confirm/prompt har jagah nahi chalte) */
function ask(msg, okText, danger){
  return new Promise(res => {
    $("dlgMsg").textContent = msg; $("dlgInput").classList.add("hidden");
    $("dlgOk").textContent = okText || "ٹھیک ہے"; $("dlgOk").classList.toggle("danger-fill", !!danger);
    $("dlg").classList.remove("hidden"); $("dlgOk").focus();
    const done = v => { $("dlg").classList.add("hidden"); $("dlgOk").onclick = $("dlgCancel").onclick = null; res(v); };
    $("dlgOk").onclick = () => done(true); $("dlgCancel").onclick = () => done(false);
  });
}
function askText(msg, val){
  return new Promise(res => {
    $("dlgMsg").textContent = msg; const inp = $("dlgInput"); inp.classList.remove("hidden"); inp.value = val || "";
    $("dlgOk").textContent = "محفوظ کریں"; $("dlgOk").classList.remove("danger-fill");
    $("dlg").classList.remove("hidden"); inp.focus(); inp.select();
    const done = v => { $("dlg").classList.add("hidden"); $("dlgOk").onclick = $("dlgCancel").onclick = null; res(v); };
    $("dlgOk").onclick = () => done(inp.value); $("dlgCancel").onclick = () => done(null);
  });
}
function toast(msg){ const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3200); }

/* ============================ boot ============================ */
function boot(){
  const cfg = window.SJA_FIREBASE_CONFIG;
  if(cfg && window.firebase){
    firebase.initializeApp(cfg);
    const db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs:true }).catch(() => {});
    S.store = new SjaStore.FirebaseStore(db);
    firebase.auth().onAuthStateChanged(u => {
      S.user = u;
      if(u){ $("loginView").classList.add("hidden"); $("app").classList.remove("hidden"); $("userPill").textContent = u.email; $("logoutBtn").classList.remove("hidden"); start(); }
      else { $("app").classList.add("hidden"); $("loginView").classList.remove("hidden"); }
    });
    $("loginForm").addEventListener("submit", async e => {
      e.preventDefault(); $("lgErr").textContent = "";
      try { await firebase.auth().signInWithEmailAndPassword($("lgEmail").value.trim(), $("lgPass").value); }
      catch(err){ $("lgErr").textContent = "ای میل یا پاس ورڈ غلط ہے۔"; }
    });
    $("logoutBtn").addEventListener("click", () => firebase.auth().signOut());
  } else {
    S.store = new SjaStore.LocalStore();
    $("app").classList.remove("hidden");
    $("userPill").textContent = "صرف اس کمپیوٹر پر";
    start();
  }
  const net = () => { const p = $("syncPill"); if(navigator.onLine){ p.textContent = "آن لائن"; p.classList.remove("warn"); } else { p.textContent = "آف لائن — بعد میں سنک ہوگا"; p.classList.add("warn"); } };
  window.addEventListener("online", net); window.addEventListener("offline", net); net();
}

let started = false;
async function start(){
  if(!started){ wire(); started = true; }
  await loadAll();
  setView(S.view);
}

async function loadAll(){
  const st = S.store;
  const [parties, items, bills, payments, settings] = await Promise.all([
    st.list("parties"), st.list("items"), st.list("bills"), st.list("payments"), st.get("settings", "shop")
  ]);
  S.parties = parties; S.bills = bills; S.payments = payments;
  S.settings = Object.assign({}, DEFAULT_SETTINGS, settings || {});
  if(!items.length){
    const seed = DEFAULT_ITEMS.map((name, i) => ({ id:"it" + (i + 1), name, order:i + 1, active:true }));
    for(const it of seed) await st.set("items", it.id, it);
    S.items = seed;
  } else S.items = items;
  // پرانی لسٹ میں جو پھل نہیں، وہ ایک دفعہ آخر میں شامل کر دو (پرانے نام / بند کیے ہوئے ویسے ہی رہیں)
  if(n2(S.settings.itemsV) < ITEMS_VERSION){
    let order = Math.max(0, ...S.items.map(i => n2(i.order)));
    for(const name of DEFAULT_ITEMS){
      if(S.items.some(i => i.name === name)) continue;
      const it = { id:uid("it"), name, order:++order, active:true };
      await st.set("items", it.id, it); S.items.push(it);
    }
    S.settings.itemsV = ITEMS_VERSION;
    await st.set("settings", "shop", S.settings);
  }
  S.items.sort((a, b) => n2(a.order) - n2(b.order));
  S.parties.sort((a, b) => a.name.localeCompare(b.name, "ur"));
  $("brandName").textContent = S.settings.name;
  fillLists();
}

function fillLists(){
  $("partyList").innerHTML = S.parties.map(p => `<option value="${esc(p.name)}">${esc(p.city || "")}</option>`).join("");
  const marks = new Set(); S.bills.forEach(b => (b.rows || []).forEach(r => r.mark && marks.add(r.mark)));
  $("markList").innerHTML = [...marks].slice(0, 300).map(m => `<option value="${esc(m)}">`).join("");
}

/* ============================ helpers ============================ */
const partyByName = name => S.parties.find(p => norm(p.name) === norm(name));
const partyById = id => S.parties.find(p => p.id === id);

function balanceOf(pid, until){   // until: is tareekh se PEHLE tak (exclusive) — na ho to sab
  const p = partyById(pid); let bal = n2(p && p.opening);
  S.bills.forEach(b => { if(b.partyId === pid && (!until || b.date < until)) bal += n2(b.total); });
  S.payments.forEach(x => { if(x.partyId === pid && (!until || x.date < until)) bal -= n2(x.amount); });
  return bal;
}
function balHint(el, name){
  const p = partyByName(name);
  if(!name.trim()){ el.textContent = ""; return; }
  if(!p){ el.textContent = "نئی پارٹی — محفوظ کرتے وقت بن جائے گی"; el.classList.remove("due"); return; }
  const b = balanceOf(p.id);
  el.textContent = "موجودہ بقایا: " + fmt(b);
  el.classList.toggle("due", b > 0);
}
async function ensureParty(name){
  name = norm(name);
  if(!name){ toast("پارٹی کا نام لکھیں۔"); return null; }
  let p = partyByName(name);
  if(p) return p;
  if(!(await ask(`"${name}" نئی پارٹی ہے۔ بنا دیں؟`, "ہاں، بنا دیں"))) return null;
  p = { id:uid("pt"), name, city:"", phone:"", opening:0, at:Date.now() };
  await S.store.set("parties", p.id, p);
  S.parties.push(p); S.parties.sort((a, b) => a.name.localeCompare(b.name, "ur")); fillLists();
  return p;
}

/* ============================ views ============================ */
function setView(v){
  S.view = v;
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.view === v));
  document.querySelectorAll(".view").forEach(s => s.classList.toggle("hidden", s.id !== "v-" + v));
  ({ dash:renderDash, bill:renderBillForm, pay:renderPay, ledger:() => {}, bills:renderBillList, parties:renderParties,
     items:renderItems, reports:renderReport, settings:renderSettings }[v] || (() => {}))();
  window.scrollTo(0, 0);
}

/* ----- dashboard ----- */
function renderDash(){
  const t = today();
  const tb = S.bills.filter(b => b.date === t), tp = S.payments.filter(p => p.date === t);
  const totalDue = S.parties.reduce((s, p) => s + Math.max(0, balanceOf(p.id)), 0);
  $("kpis").innerHTML = [
    ["آج کی سیل", fmt(tb.reduce((s, b) => s + n2(b.total), 0)), ""],
    ["آج کی وصولی", fmt(tp.reduce((s, p) => s + n2(p.amount), 0)), "o"],
    ["آج کے نگ", fmt(tb.reduce((s, b) => s + n2(b.qtyTotal), 0)), ""],
    ["کل بقایا (سب پارٹیاں)", fmt(totalDue), "r"]
  ].map(k => `<div class="kpi ${k[2]}"><div class="k">${k[0]}</div><div class="v">${k[1]}</div></div>`).join("");
  $("dashBills").innerHTML = tb.length ? billTable(tb.sort((a, b) => b.no - a.no)) : `<p class="muted">آج ابھی کوئی بل نہیں بنا۔</p>`;
  const due = S.parties.map(p => ({ p, b:balanceOf(p.id) })).filter(x => x.b > 0).sort((a, b) => b.b - a.b).slice(0, 10);
  $("dashDue").innerHTML = due.length ? `<table class="tbl"><thead><tr><th>پارٹی</th><th class="n">بقایا</th></tr></thead><tbody>${
    due.map(x => `<tr class="clickable" data-ledger="${esc(x.p.id)}"><td>${esc(x.p.name)}</td><td class="n due">${fmt(x.b)}</td></tr>`).join("")}</tbody></table>`
    : `<p class="muted">کوئی بقایا نہیں۔</p>`;
}

function billTable(list){
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th class="n">بل نمبر</th><th>تاریخ</th><th>پارٹی</th><th>اشیاء</th><th class="n">نگ</th><th class="n">رقم</th><th></th></tr></thead><tbody>${
    list.map(b => `<tr><td class="n">${b.no}</td><td class="n">${ddmmyy(b.date)}</td><td>${esc(b.partyName)}</td>
      <td>${esc([...new Set((b.rows || []).map(r => r.item))].join("، "))}</td><td class="n">${fmt(b.qtyTotal)}</td><td class="n"><b>${fmt(b.total)}</b></td>
      <td style="white-space:nowrap"><button class="btn sm" data-print-bill="${esc(b.id)}">پرنٹ</button>
      <button class="btn sm" data-edit-bill="${esc(b.id)}">ترمیم</button>
      <button class="btn sm danger" data-del-bill="${esc(b.id)}">ڈیلیٹ</button></td></tr>`).join("")}</tbody></table></div>`;
}

/* ----- bill form ----- */
function itemOptions(sel){
  const names = S.items.filter(i => i.active !== false).map(i => i.name);
  if(sel && !names.includes(sel)) names.push(sel);
  return names.map(n => `<option${n === sel ? " selected" : ""}>${esc(n)}</option>`).join("");
}
function danaOptions(sel){
  const opts = DANA.slice(); if(sel && !opts.includes(String(sel))) opts.push(String(sel));
  return opts.map(d => `<option value="${esc(d)}"${String(sel || "") === d ? " selected" : ""}>${d ? d + " دانہ" : "—"}</option>`).join("");
}
function rowHtml(r, i){
  r = r || {};
  return `<tr>
    <td class="n">${i + 1}</td>
    <td><select class="r-item">${itemOptions(r.item)}</select></td>
    <td><input class="r-mark" list="markList" value="${esc(r.mark || "")}" placeholder="مثلاً رضوان"></td>
    <td><select class="r-dana">${danaOptions(r.dana)}</select></td>
    <td><input class="r-qty num-in" type="number" min="0" inputmode="numeric" value="${r.qty || ""}"></td>
    <td><input class="r-rate num-in" type="number" min="0" inputmode="numeric" value="${r.rate || ""}"></td>
    <td class="amt">${r.qty && r.rate ? fmt(n2(r.qty) * n2(r.rate)) : ""}</td>
    <td><button class="btn sm ghost r-del" type="button" title="لائن ہٹائیں">✕</button></td></tr>`;
}
function renderBillForm(){
  if(S.editBill) return;     // ترمیم جاری ہے — فارم ویسا ہی رہے
  if(!$("bRows").tBodies[0].rows.length) resetBill();
}
function resetBill(){
  S.editBill = null;
  $("billTitle").textContent = "نیا بل"; $("billNoHint").textContent = "";
  $("bParty").value = ""; $("bDate").value = today(); $("bTruck").value = ""; $("bNote").value = ""; $("bPartyBal").textContent = "";
  $("bRows").tBodies[0].innerHTML = [0, 1, 2].map(i => rowHtml(null, i)).join("");
  calcBill();
}
function readRows(){
  return [...$("bRows").tBodies[0].rows].map(tr => ({
    item: tr.querySelector(".r-item").value, mark: norm(tr.querySelector(".r-mark").value), dana: tr.querySelector(".r-dana").value,
    qty: n2(tr.querySelector(".r-qty").value), rate: n2(tr.querySelector(".r-rate").value)
  })).map(r => Object.assign(r, { amount: r.qty * r.rate }));
}
function calcBill(){
  const rows = readRows();
  [...$("bRows").tBodies[0].rows].forEach((tr, i) => {
    tr.cells[0].textContent = i + 1;
    tr.querySelector(".amt").textContent = rows[i].amount ? fmt(rows[i].amount) : "";
  });
  const use = rows.filter(r => r.qty > 0);
  $("bQty").textContent = fmt(use.reduce((s, r) => s + r.qty, 0));
  $("bTotal").textContent = fmt(use.reduce((s, r) => s + r.amount, 0));
}
async function saveBill(andPrint){
  const rows = readRows().filter(r => r.qty > 0);
  if(!rows.length){ toast("کم از کم ایک لائن میں تعداد لکھیں۔"); return; }
  if(rows.some(r => !r.rate)){ toast("ہر لائن کا ریٹ لکھیں۔"); return; }
  const p = await ensureParty($("bParty").value); if(!p) return;
  const date = $("bDate").value || today();
  const btns = [$("saveBill"), $("saveBillOnly")]; btns.forEach(b => b.disabled = true);
  try {
    const old = S.editBill;
    const no = old ? old.no : await S.store.nextNo("bill", 1);
    const truck = norm($("bTruck").value);
    const bill = { no, date, partyId:p.id, partyName:p.name, truck, rows:rows.map(r => Object.assign(r, { truck })),
      qtyTotal: rows.reduce((s, r) => s + r.qty, 0), total: rows.reduce((s, r) => s + r.amount, 0),
      note: norm($("bNote").value), at: old ? old.at : Date.now(), by: S.user ? S.user.email : "" };
    if(old) bill.editedAt = Date.now();
    const id = old ? old.id : "b" + String(no).padStart(6, "0");
    await S.store.set("bills", id, bill);
    bill.id = id;
    S.bills = S.bills.filter(b => b.id !== id).concat([bill]);
    fillLists();
    toast((old ? "بل نمبر " + no + " میں تبدیلی محفوظ" : "بل نمبر " + no + " محفوظ") + " — " + fmt(bill.total));
    resetBill();
    if(andPrint) printBill(bill);
  } catch(e){ console.error(e); toast("محفوظ نہیں ہوا: " + (e.message || e)); }
  finally { btns.forEach(b => b.disabled = false); }
}
function editBill(id){
  const b = S.bills.find(x => x.id === id); if(!b) return;
  setView("bill");
  S.editBill = b;
  $("billTitle").textContent = "بل نمبر " + b.no + " میں ترمیم"; $("billNoHint").textContent = "محفوظ کرنے پر یہی بل نمبر رہے گا";
  $("bParty").value = b.partyName; $("bDate").value = b.date; $("bTruck").value = b.truck || ""; $("bNote").value = b.note || "";
  $("bRows").tBodies[0].innerHTML = b.rows.map(rowHtml).join("");
  balHint($("bPartyBal"), b.partyName); calcBill();
}
async function delBill(id){
  const b = S.bills.find(x => x.id === id); if(!b) return;
  if(!(await ask(`بل نمبر ${b.no} (${b.partyName} — ${fmt(b.total)}) ڈیلیٹ کر دیں؟`, "ڈیلیٹ کریں", true))) return;
  await S.store.del("bills", id);
  S.bills = S.bills.filter(x => x.id !== id);
  toast("بل نمبر " + b.no + " ڈیلیٹ ہو گیا"); setView(S.view);
}

/* ----- payment ----- */
function renderPay(){
  if(!S.editPay){ $("pDate").value = $("pDate").value || today(); }
  const list = S.payments.filter(p => p.date === today()).sort((a, b) => b.no - a.no);
  $("payToday").innerHTML = list.length ? payTable(list) : `<p class="muted">آج ابھی کوئی وصولی نہیں۔</p>`;
}
function payTable(list){
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th class="n">رسید</th><th>تاریخ</th><th>پارٹی</th><th>طریقہ</th><th>نوٹ</th><th class="n">رقم</th><th></th></tr></thead><tbody>${
    list.map(p => `<tr><td class="n">${p.no}</td><td class="n">${ddmmyy(p.date)}</td><td>${esc(p.partyName)}</td><td>${esc(p.method || "")}</td><td>${esc(p.note || "")}</td>
      <td class="n"><b>${fmt(p.amount)}</b></td><td style="white-space:nowrap"><button class="btn sm" data-print-pay="${esc(p.id)}">رسید</button>
      <button class="btn sm danger" data-del-pay="${esc(p.id)}">ڈیلیٹ</button></td></tr>`).join("")}</tbody></table></div>`;
}
async function savePay(andPrint){
  const amount = n2($("pAmount").value);
  if(amount <= 0){ toast("رقم لکھیں۔"); return; }
  const p = await ensureParty($("pParty").value); if(!p) return;
  const btns = [$("savePay"), $("savePayOnly")]; btns.forEach(b => b.disabled = true);
  try {
    const no = await S.store.nextNo("pay", 1);
    const pay = { no, date:$("pDate").value || today(), partyId:p.id, partyName:p.name, amount, method:$("pMethod").value, note:norm($("pNote").value),
      at:Date.now(), by: S.user ? S.user.email : "" };
    const id = "p" + String(no).padStart(6, "0");
    await S.store.set("payments", id, pay); pay.id = id;
    S.payments.push(pay);
    toast("وصولی محفوظ — " + p.name + " — " + fmt(amount));
    $("pParty").value = ""; $("pAmount").value = ""; $("pNote").value = ""; $("pPartyBal").textContent = "";
    renderPay();
    if(andPrint) printPay(pay);
  } catch(e){ console.error(e); toast("محفوظ نہیں ہوا: " + (e.message || e)); }
  finally { btns.forEach(b => b.disabled = false); }
}
async function delPay(id){
  const p = S.payments.find(x => x.id === id); if(!p) return;
  if(!(await ask(`رسید ${p.no} (${p.partyName} — ${fmt(p.amount)}) ڈیلیٹ کر دیں؟`, "ڈیلیٹ کریں", true))) return;
  await S.store.del("payments", id);
  S.payments = S.payments.filter(x => x.id !== id);
  toast("رسید ڈیلیٹ ہو گئی"); setView(S.view);
}

/* ----- ledger (کھاتہ) ----- */
function ledgerData(pid, from, to){
  // "سے" tareekh na ho to shuru se — sirf party ka sabiqa baqaya
  const opening = from ? balanceOf(pid, from) : n2((partyById(pid) || {}).opening);
  const lines = [];
  S.bills.filter(b => b.partyId === pid && (!from || b.date >= from) && (!to || b.date <= to)).forEach(b => {
    (b.rows || []).forEach(r => lines.push({ no:b.no, date:b.date, type:"SL", t:0, detail:r.item + (r.dana ? " " + r.dana + " دانہ" : "") + (r.mark ? " — " + r.mark : ""),
      truck:r.truck || b.truck || "", qty:r.qty, rate:r.rate, dr:r.amount, cr:0, ref:b.id }));
  });
  S.payments.filter(p => p.partyId === pid && (!from || p.date >= from) && (!to || p.date <= to)).forEach(p => {
    lines.push({ no:p.no, date:p.date, type:"WC", t:1, detail:"وصولی" + (p.method ? " (" + p.method + ")" : "") + (p.note ? " — " + p.note : ""), truck:"", qty:0, rate:0, dr:0, cr:p.amount, ref:p.id });
  });
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.t - b.t || a.no - b.no);
  let bal = opening; lines.forEach(l => { bal += l.dr - l.cr; l.bal = bal; });
  return { opening, lines, closing: bal,
    dr: lines.reduce((s, l) => s + l.dr, 0), cr: lines.reduce((s, l) => s + l.cr, 0), qty: lines.reduce((s, l) => s + n2(l.qty), 0) };
}
function ledgerTableHtml(d, forPrint){
  const cls = forPrint ? "ledger" : "tbl";
  return `<table class="${cls}"><thead><tr><th class="n">بل نمبر</th><th>تاریخ</th><th></th><th>تفصیل</th><th>گاڑی نمبر</th><th class="n">نگ</th><th class="n">ریٹ</th>
    <th class="n">نام رقم</th><th class="n">جمع رقم</th><th class="n">بقایا</th></tr></thead><tbody>
    <tr><td class="n">0</td><td></td><td><span class="tag">OPN</span></td><td>سابقہ بیلنس</td><td></td><td></td><td></td><td></td><td></td><td class="n"><b>${fmt(d.opening)}</b></td></tr>
    ${d.lines.map(l => `<tr><td class="n">${l.no}</td><td class="n">${ddmmyy(l.date)}</td><td><span class="tag ${l.type === "WC" ? "wc" : ""}">${l.type}</span></td>
      <td>${esc(l.detail)}</td><td>${esc(l.truck)}</td><td class="n">${l.qty ? fmt(l.qty) : ""}</td><td class="n">${l.rate ? fmt(l.rate) : ""}</td>
      <td class="n">${l.dr ? fmt(l.dr) : ""}</td><td class="n">${l.cr ? fmt(l.cr) : ""}</td><td class="n"><b>${fmt(l.bal)}</b></td></tr>`).join("")}
    </tbody><tfoot><tr><td colspan="5">ٹوٹل</td><td class="n">${fmt(d.qty)}</td><td></td><td class="n">${fmt(d.dr)}</td><td class="n">${fmt(d.cr)}</td><td class="n">${fmt(d.closing)}</td></tr></tfoot></table>`;
}
function showLedger(){
  const p = partyByName($("lParty").value);
  if(!p){ toast("پارٹی چنیں۔"); return null; }
  const d = ledgerData(p.id, $("lFrom").value, $("lTo").value);
  $("ledgerOut").innerHTML = `<div class="row-head"><h2>${esc(p.name)} — کھاتہ</h2>
    <div>سابقہ: <b class="num">${fmt(d.opening)}</b> &nbsp; بل: <b class="num">${fmt(d.dr)}</b> &nbsp; وصولی: <b class="num">${fmt(d.cr)}</b> &nbsp;
    بقایا: <b class="num ${d.closing > 0 ? "due" : "adv"}">${fmt(d.closing)}</b></div></div><div class="table-wrap">${ledgerTableHtml(d)}</div>`;
  return { p, d };
}
function openLedger(pid){
  const p = partyById(pid); if(!p) return;
  setView("ledger"); $("lParty").value = p.name; $("lFrom").value = ""; $("lTo").value = ""; showLedger();
}

/* ----- bill list ----- */
function renderBillList(){
  if(!$("blFrom").value){ const d = new Date(); d.setDate(d.getDate() - 7); $("blFrom").value = d.toISOString().slice(0, 10); }
  if(!$("blTo").value) $("blTo").value = today();
  const from = $("blFrom").value, to = $("blTo").value, q = norm($("blQ").value);
  const list = S.bills.filter(b => (!from || b.date >= from) && (!to || b.date <= to) && (!q || b.partyName.includes(q) || String(b.no) === q))
    .sort((a, b) => b.no - a.no);
  $("billList").innerHTML = list.length ? `<div class="row-head"><h2>${list.length} بل</h2><div>کل: <b class="num">${fmt(list.reduce((s, b) => s + n2(b.total), 0))}</b></div></div>` + billTable(list)
    : `<p class="muted">ان تاریخوں میں کوئی بل نہیں۔</p>`;
}

/* ----- parties ----- */
function renderParties(){
  const q = norm($("ptQ").value);
  const rows = S.parties.filter(p => !q || p.name.includes(q) || (p.city || "").includes(q)).map(p => ({ p, b:balanceOf(p.id) }));
  $("partyTable").innerHTML = rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>نام</th><th>شہر</th><th>فون</th><th class="n">سابقہ</th><th class="n">بقایا</th><th></th></tr></thead><tbody>${
    rows.map(x => `<tr><td>${esc(x.p.name)}</td><td>${esc(x.p.city || "")}</td><td class="n">${esc(x.p.phone || "")}</td><td class="n">${fmt(x.p.opening)}</td>
      <td class="n ${x.b > 0 ? "due" : "adv"}">${fmt(x.b)}</td>
      <td style="white-space:nowrap"><button class="btn sm" data-ledger="${esc(x.p.id)}">کھاتہ</button>
      <button class="btn sm" data-edit-party="${esc(x.p.id)}">ترمیم</button>
      <button class="btn sm danger" data-del-party="${esc(x.p.id)}">ڈیلیٹ</button></td></tr>`).join("")}</tbody></table></div>`
    : `<p class="muted">ابھی کوئی پارٹی نہیں۔ اوپر سے شامل کریں — یا بل بناتے وقت نیا نام لکھیں، خود بن جائے گی۔</p>`;
}
let editPartyId = null;
async function saveParty(){
  const name = norm($("ptName").value); if(!name){ toast("نام لکھیں۔"); return; }
  const clash = partyByName(name); if(clash && clash.id !== editPartyId){ toast("اس نام کی پارٹی پہلے سے موجود ہے۔"); return; }
  const p = Object.assign({}, partyById(editPartyId) || { id:uid("pt"), at:Date.now() },
    { name, city:norm($("ptCity").value), phone:norm($("ptPhone").value), opening:n2($("ptOpen").value) });
  await S.store.set("parties", p.id, p);
  S.parties = S.parties.filter(x => x.id !== p.id).concat([p]).sort((a, b) => a.name.localeCompare(b.name, "ur"));
  // نام بدلا ہو تو پرانے بلوں پر بھی نیا نام
  if(editPartyId){
    for(const b of S.bills.filter(b => b.partyId === p.id && b.partyName !== p.name)){ b.partyName = p.name; await S.store.set("bills", b.id, b); }
    for(const x of S.payments.filter(x => x.partyId === p.id && x.partyName !== p.name)){ x.partyName = p.name; await S.store.set("payments", x.id, x); }
  }
  toast(editPartyId ? "پارٹی اپ ڈیٹ ہو گئی" : "پارٹی شامل ہو گئی");
  editPartyId = null; $("ptSave").textContent = "شامل کریں";
  ["ptName", "ptCity", "ptPhone"].forEach(i => $(i).value = ""); $("ptOpen").value = 0;
  fillLists(); renderParties();
}
function editParty(id){
  const p = partyById(id); if(!p) return;
  editPartyId = id; $("ptName").value = p.name; $("ptCity").value = p.city || ""; $("ptPhone").value = p.phone || ""; $("ptOpen").value = n2(p.opening);
  $("ptSave").textContent = "اپ ڈیٹ کریں"; $("ptName").focus(); window.scrollTo(0, 0);
}
async function delParty(id){
  const p = partyById(id); if(!p) return;
  if(S.bills.some(b => b.partyId === id) || S.payments.some(x => x.partyId === id)){ toast("اس پارٹی کے بل / وصولیاں موجود ہیں — پہلے وہ ڈیلیٹ کریں۔"); return; }
  if(!(await ask(`"${p.name}" ڈیلیٹ کر دیں؟`, "ڈیلیٹ کریں", true))) return;
  await S.store.del("parties", id); S.parties = S.parties.filter(x => x.id !== id); fillLists(); renderParties();
}

/* ----- items ----- */
function renderItems(){
  $("itemList").innerHTML = S.items.map(i => `<div class="item-row"><span class="nm">${esc(i.name)}${i.active === false ? ' <span class="tag wc">بند</span>' : ""}</span>
    <span><button class="btn sm" data-item-toggle="${esc(i.id)}">${i.active === false ? "چالو کریں" : "بند کریں"}</button>
    <button class="btn sm" data-item-rename="${esc(i.id)}">نام بدلیں</button></span></div>`).join("");
}
async function addItem(){
  const name = norm($("itName").value); if(!name) return;
  if(S.items.some(i => i.name === name)){ toast("یہ پہلے سے موجود ہے۔"); return; }
  const it = { id:uid("it"), name, order:S.items.length + 1, active:true };
  await S.store.set("items", it.id, it); S.items.push(it); $("itName").value = ""; renderItems(); toast(name + " شامل ہو گیا");
}

/* ----- reports ----- */
function renderReport(){
  if(!$("rFrom").value) $("rFrom").value = today();
  if(!$("rTo").value) $("rTo").value = today();
  const from = $("rFrom").value, to = $("rTo").value;
  const bills = S.bills.filter(b => b.date >= from && b.date <= to), pays = S.payments.filter(p => p.date >= from && p.date <= to);
  const byItem = {}; bills.forEach(b => b.rows.forEach(r => { const k = r.item; byItem[k] = byItem[k] || { qty:0, amt:0 }; byItem[k].qty += n2(r.qty); byItem[k].amt += n2(r.amount); }));
  const byParty = {}; bills.forEach(b => { byParty[b.partyName] = (byParty[b.partyName] || 0) + n2(b.total); });
  const sale = bills.reduce((s, b) => s + n2(b.total), 0), rec = pays.reduce((s, p) => s + n2(p.amount), 0);
  $("reportOut").innerHTML = `<div class="kpis">
      <div class="kpi"><div class="k">کل سیل</div><div class="v">${fmt(sale)}</div></div>
      <div class="kpi o"><div class="k">کل وصولی</div><div class="v">${fmt(rec)}</div></div>
      <div class="kpi"><div class="k">بل</div><div class="v">${bills.length}</div></div>
      <div class="kpi"><div class="k">کل نگ</div><div class="v">${fmt(bills.reduce((s, b) => s + n2(b.qtyTotal), 0))}</div></div></div>
    <div class="grid2">
      <div class="card"><h2>اشیاء کے حساب سے</h2><table class="tbl"><thead><tr><th>چیز</th><th class="n">نگ</th><th class="n">رقم</th></tr></thead><tbody>${
        Object.keys(byItem).sort((a, b) => byItem[b].amt - byItem[a].amt).map(k => `<tr><td>${esc(k)}</td><td class="n">${fmt(byItem[k].qty)}</td><td class="n">${fmt(byItem[k].amt)}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">کچھ نہیں</td></tr>`}</tbody></table></div>
      <div class="card"><h2>پارٹی کے حساب سے</h2><table class="tbl"><thead><tr><th>پارٹی</th><th class="n">سیل</th></tr></thead><tbody>${
        Object.keys(byParty).sort((a, b) => byParty[b] - byParty[a]).map(k => `<tr><td>${esc(k)}</td><td class="n">${fmt(byParty[k])}</td></tr>`).join("") || `<tr><td colspan="2" class="muted">کچھ نہیں</td></tr>`}</tbody></table></div>
    </div>
    <div class="card"><h2>وصولیاں</h2>${pays.length ? payTable(pays.sort((a, b) => a.no - b.no)) : '<p class="muted">کوئی وصولی نہیں۔</p>'}</div>`;
}

/* ----- settings ----- */
function renderSettings(){
  const s = S.settings;
  $("stName").value = s.name; $("stSub").value = s.sub; $("stAddr").value = s.addr; $("stP1n").value = s.p1n; $("stP1").value = s.p1;
  $("stP2n").value = s.p2n; $("stP2").value = s.p2; $("stFoot").value = s.foot; $("stPaper").value = s.paper;
}
async function saveSettings(){
  S.settings = Object.assign({}, S.settings, { name:norm($("stName").value), sub:norm($("stSub").value), addr:norm($("stAddr").value),
    p1n:norm($("stP1n").value), p1:norm($("stP1").value), p2n:norm($("stP2n").value), p2:norm($("stP2").value), foot:norm($("stFoot").value), paper:$("stPaper").value });
  await S.store.set("settings", "shop", S.settings);
  $("brandName").textContent = S.settings.name; toast("سیٹنگ محفوظ ہو گئی");
}

/* ============================ PRINT ============================ */
function docHead(){
  const s = S.settings;
  const phones = [[s.p1n, s.p1], [s.p2n, s.p2]].filter(x => x[1]).map(x => `<b>${esc(x[0])}</b><br>${esc(x[1]).split(",").map(t => t.trim()).join("<br>")}`).join("<br>");
  return `<div class="head"><img src="img/sja-logo.svg" alt="SJA">
    <div class="t"><div class="nm">${esc(s.name)}</div><div class="sb">${esc(s.sub)} — ${esc(s.addr)}</div></div>
    <div class="ph">${phones}</div></div>`;
}
function doPrint(html, paper){
  $("print").innerHTML = html;
  let st = $("pageStyle"); if(!st){ st = document.createElement("style"); st.id = "pageStyle"; document.head.appendChild(st); }
  const size = paper || S.settings.paper || "A5";
  st.textContent = `@page{ size:${size}; margin:${size === "A5" ? 8 : 10}mm }` + (size === "A5" ? ` .doc .head .t .nm{font-size:19px} .doc .head img{width:64px;height:64px}` : "");
  const imgs = [...$("print").querySelectorAll("img")];
  $("pvBody").innerHTML = html; $("pvPaper").textContent = size;
  $("preview").classList.remove("hidden");
  Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => { $("pvPrint").disabled = false; });
}
// is bill se pehle tak ka baqaya: pichli tareekhein + usi din ke pehle wale bill/wasooli
function balanceBeforeBill(b){
  const p = partyById(b.partyId); let bal = n2(p && p.opening);
  S.bills.forEach(x => { if(x.partyId === b.partyId && x.id !== b.id && (x.date < b.date || (x.date === b.date && x.no < b.no))) bal += n2(x.total); });
  S.payments.forEach(x => { if(x.partyId === b.partyId && (x.date < b.date || (x.date === b.date && n2(x.at) < n2(b.at)))) bal -= n2(x.amount); });
  return bal;
}
function printBill(b){
  const prev = balanceBeforeBill(b);
  const after = prev + n2(b.total);
  doPrint(`<div class="doc">${docHead()}
    <div class="meta"><span>بل نمبر: <span class="num">${b.no}</span></span><span>تاریخ: <span class="num">${ddmmyyyy(b.date)}</span></span>${b.truck ? `<span>گاڑی نمبر: ${esc(b.truck)}</span>` : ""}</div>
    <div class="party">${esc(b.partyName)}</div>
    <table><thead><tr><th class="n">#</th><th>مارکہ</th><th>دانہ</th><th>اشیاء</th><th class="n">ریٹ</th><th class="n">تعداد</th><th class="n">کل رقم</th></tr></thead><tbody>${
      b.rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td>${esc(r.mark || "")}</td><td>${r.dana ? esc(r.dana) + " دانہ" : ""}</td><td>${esc(r.item)}</td>
        <td class="n">${fmt(r.rate)}</td><td class="n">${fmt(r.qty)} ×</td><td class="n">${fmt(r.amount)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="5">ٹوٹل</td><td class="n">${fmt(b.qtyTotal)}</td><td class="n">${fmt(b.total)}</td></tr></tfoot></table>
    <div class="sum"><table>
      <tr><td>سابقہ بقایا</td><td class="n">${fmt(prev)}</td></tr>
      <tr><td>یہ بل</td><td class="n">${fmt(b.total)}</td></tr>
      <tr class="k"><td>کل بقایا</td><td class="n">${fmt(after)}</td></tr></table></div>
    ${b.note ? `<p>نوٹ: ${esc(b.note)}</p>` : ""}
    <div class="foot"><span>${esc(S.settings.foot)}</span><span class="sign">دستخط</span></div></div>`);
}
function printPay(p){
  const after = balanceOf(p.partyId);
  doPrint(`<div class="doc">${docHead()}
    <div class="title">وصولی رسید</div>
    <div class="meta"><span>رسید نمبر: <span class="num">${p.no}</span></span><span>تاریخ: <span class="num">${ddmmyyyy(p.date)}</span></span></div>
    <div class="party">${esc(p.partyName)}</div>
    <div class="sum" style="justify-content:center"><table>
      <tr><td>وصول شدہ رقم</td><td class="n"><b>${fmt(p.amount)}</b></td></tr>
      <tr><td>طریقہ</td><td>${esc(p.method || "")}</td></tr>
      ${p.note ? `<tr><td>نوٹ</td><td>${esc(p.note)}</td></tr>` : ""}
      <tr class="k"><td>باقی بقایا</td><td class="n">${fmt(after)}</td></tr></table></div>
    <div class="foot"><span>${esc(S.settings.foot)}</span><span class="sign">دستخط</span></div></div>`);
}
function printLedger(){
  const r = showLedger(); if(!r) return;
  const from = $("lFrom").value, to = $("lTo").value;
  doPrint(`<div class="doc">${docHead()}
    <div class="title">تفصیل پارٹی (کھاتہ)</div>
    <div class="meta"><span>${from ? "از " + ddmmyyyy(from) : "شروع سے"} ${to ? " تا " + ddmmyyyy(to) : " تا " + ddmmyyyy(today())}</span><span>پرنٹ: <span class="num">${ddmmyyyy(today())}</span></span></div>
    <div class="party">${esc(r.p.name)}</div>${ledgerTableHtml(r.d, true)}
    <div class="sum"><table><tr><td>سابقہ</td><td class="n">${fmt(r.d.opening)}</td></tr><tr><td>نام رقم (بل)</td><td class="n">${fmt(r.d.dr)}</td></tr>
      <tr><td>جمع رقم (وصولی)</td><td class="n">${fmt(r.d.cr)}</td></tr><tr class="k"><td>کل بقایا</td><td class="n">${fmt(r.d.closing)}</td></tr></table></div></div>`, "A4");
}
function printDay(){
  renderReport();
  const from = $("rFrom").value, to = $("rTo").value;
  const bills = S.bills.filter(b => b.date >= from && b.date <= to).sort((a, b) => a.no - b.no);
  const pays = S.payments.filter(p => p.date >= from && p.date <= to).sort((a, b) => a.no - b.no);
  doPrint(`<div class="doc">${docHead()}<div class="title">روزنامچہ</div>
    <div class="meta"><span>${ddmmyyyy(from)} تا ${ddmmyyyy(to)}</span></div>
    <table class="ledger"><thead><tr><th class="n">بل</th><th>تاریخ</th><th>پارٹی</th><th>اشیاء</th><th class="n">نگ</th><th class="n">رقم</th></tr></thead><tbody>${
      bills.map(b => `<tr><td class="n">${b.no}</td><td class="n">${ddmmyy(b.date)}</td><td>${esc(b.partyName)}</td><td>${esc([...new Set(b.rows.map(r => r.item))].join("، "))}</td><td class="n">${fmt(b.qtyTotal)}</td><td class="n">${fmt(b.total)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="4">کل سیل</td><td class="n">${fmt(bills.reduce((s, b) => s + n2(b.qtyTotal), 0))}</td><td class="n">${fmt(bills.reduce((s, b) => s + n2(b.total), 0))}</td></tr></tfoot></table>
    <br><table class="ledger"><thead><tr><th class="n">رسید</th><th>تاریخ</th><th>پارٹی</th><th>طریقہ</th><th class="n">رقم</th></tr></thead><tbody>${
      pays.map(p => `<tr><td class="n">${p.no}</td><td class="n">${ddmmyy(p.date)}</td><td>${esc(p.partyName)}</td><td>${esc(p.method || "")}</td><td class="n">${fmt(p.amount)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="4">کل وصولی</td><td class="n">${fmt(pays.reduce((s, p) => s + n2(p.amount), 0))}</td></tr></tfoot></table></div>`, "A4");
}
function printDue(){
  const rows = S.parties.map(p => ({ p, b:balanceOf(p.id) })).filter(x => Math.round(x.b) !== 0).sort((a, b) => b.b - a.b);
  doPrint(`<div class="doc">${docHead()}<div class="title">بقایا لسٹ</div><div class="meta"><span>تاریخ: <span class="num">${ddmmyyyy(today())}</span></span></div>
    <table class="ledger"><thead><tr><th class="n">#</th><th>پارٹی</th><th>شہر</th><th>فون</th><th class="n">بقایا</th></tr></thead><tbody>${
      rows.map((x, i) => `<tr><td class="n">${i + 1}</td><td>${esc(x.p.name)}</td><td>${esc(x.p.city || "")}</td><td class="n">${esc(x.p.phone || "")}</td><td class="n">${fmt(x.b)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="4">کل</td><td class="n">${fmt(rows.reduce((s, x) => s + x.b, 0))}</td></tr></tfoot></table></div>`, "A4");
}

/* ============================ backup ============================ */
async function backupDown(){
  const data = await S.store.exportAll();
  const blob = new Blob([JSON.stringify(data)], { type:"application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "SJA-backup-" + today() + ".json"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function backupUp(file){
  if(!file) return;
  if(!(await ask("بیک اپ واپس لانے سے موجودہ ڈیٹا اس فائل والے ڈیٹا سے بدل جائے گا۔ جاری رکھیں؟", "ہاں، واپس لائیں", true))) return;
  const data = JSON.parse(await file.text());
  if(S.store.importAll) await S.store.importAll(data);
  else for(const col of Object.keys(data)) for(const id of Object.keys(data[col])) await S.store.set(col, id, data[col][id]);
  toast("بیک اپ واپس آ گیا"); await loadAll(); setView("dash");
}

/* ============================ events ============================ */
function applyTheme(t){
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("sja.theme", t); } catch(e){}
  $("themeBtn").textContent = t === "dark" ? "☀️" : "🌙";
  $("themeBtn").title = t === "dark" ? "لائٹ تھیم" : "ڈارک تھیم";
  const m = document.querySelector('meta[name="theme-color"]'); if(m) m.content = t === "dark" ? "#06200F" : "#0F5E2A";
}
function wire(){
  applyTheme(document.documentElement.getAttribute("data-theme") || "dark");
  $("themeBtn").addEventListener("click", () => applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));
  $("pvPrint").addEventListener("click", () => window.print());
  $("pvClose").addEventListener("click", () => $("preview").classList.add("hidden"));
  document.addEventListener("keydown", e => { if(e.key === "Escape"){ $("preview").classList.add("hidden"); } });
  $("tabs").addEventListener("click", e => { const b = e.target.closest("button[data-view]"); if(b) setView(b.dataset.view); });

  // bill form
  const body = $("bRows").tBodies[0];
  $("addRow").addEventListener("click", () => {
    const last = readRows().pop() || {};
    body.insertAdjacentHTML("beforeend", rowHtml({ item:last.item, mark:last.mark, dana:last.dana }, body.rows.length));
    body.rows[body.rows.length - 1].querySelector(".r-qty").focus();
  });
  body.addEventListener("input", calcBill);
  body.addEventListener("change", calcBill);
  body.addEventListener("click", e => { if(e.target.closest(".r-del")){ e.target.closest("tr").remove(); if(!body.rows.length) $("addRow").click(); calcBill(); } });
  body.addEventListener("keydown", e => {   // آخری لائن کے ریٹ پر Enter = نئی لائن
    if(e.key === "Enter" && e.target.classList.contains("r-rate") && e.target.closest("tr") === body.rows[body.rows.length - 1]){ e.preventDefault(); $("addRow").click(); }
  });
  $("bParty").addEventListener("input", () => balHint($("bPartyBal"), $("bParty").value));
  $("saveBill").addEventListener("click", () => saveBill(true));
  $("saveBillOnly").addEventListener("click", () => saveBill(false));
  $("clearBill").addEventListener("click", resetBill);

  // payment
  $("pParty").addEventListener("input", () => balHint($("pPartyBal"), $("pParty").value));
  $("savePay").addEventListener("click", () => savePay(true));
  $("savePayOnly").addEventListener("click", () => savePay(false));

  // ledger
  $("lShow").addEventListener("click", showLedger);
  $("lPrint").addEventListener("click", printLedger);
  $("lParty").addEventListener("change", showLedger);

  // lists
  ["blFrom", "blTo", "blQ"].forEach(i => $(i).addEventListener("input", renderBillList));
  $("ptSave").addEventListener("click", saveParty);
  $("ptQ").addEventListener("input", renderParties);
  $("itSave").addEventListener("click", addItem);
  $("rShow").addEventListener("click", renderReport);
  $("rPrint").addEventListener("click", printDay);
  $("rDuePrint").addEventListener("click", printDue);
  $("stSave").addEventListener("click", saveSettings);
  $("bkDown").addEventListener("click", backupDown);
  $("bkUp").addEventListener("change", e => backupUp(e.target.files[0]));

  // table buttons (delegation)
  document.addEventListener("click", async e => {
    const t = e.target.closest("[data-print-bill],[data-edit-bill],[data-del-bill],[data-print-pay],[data-del-pay],[data-ledger],[data-edit-party],[data-del-party],[data-item-toggle],[data-item-rename]");
    if(!t) return;
    const d = t.dataset;
    if(d.printBill){ const b = S.bills.find(x => x.id === d.printBill); if(b) printBill(b); }
    else if(d.editBill) editBill(d.editBill);
    else if(d.delBill) delBill(d.delBill);
    else if(d.printPay){ const p = S.payments.find(x => x.id === d.printPay); if(p) printPay(p); }
    else if(d.delPay) delPay(d.delPay);
    else if(d.ledger) openLedger(d.ledger);
    else if(d.editParty) editParty(d.editParty);
    else if(d.delParty) delParty(d.delParty);
    else if(d.itemToggle){ const it = S.items.find(i => i.id === d.itemToggle); it.active = it.active === false; await S.store.set("items", it.id, it); renderItems(); }
    else if(d.itemRename){ const it = S.items.find(i => i.id === d.itemRename); const nm = norm(await askText("نیا نام", it.name)); if(nm){ it.name = nm; await S.store.set("items", it.id, it); renderItems(); } }
  });
}

boot();
// website par khule to offline cache chalu (file:// par service worker nahi chalta, wahan zaroorat bhi nahi)
if("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
