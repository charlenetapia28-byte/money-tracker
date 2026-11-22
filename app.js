import { firebaseConfig } from "./config.js";

const FB = "https://www.gstatic.com/firebasejs/13.1.0/";
const CATS = { spending: ["Food","Transport","Household","Apparel","Insurance","Boxing","Investment","Hospital","Extra"], income: ["Salary","Extra"] };
const NAMES = ["Woojung","Charlene"];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const won = n => (n < 0 ? "−" : "") + "₩" + Math.abs(Math.round(n)).toLocaleString("en-US");
const trim = x => (x >= 100 ? x.toFixed(0) : x.toFixed(1)).replace(/\.0$/, "");
const short = n => n >= 1e6 ? trim(n/1e6) + "M" : n >= 1e3 ? trim(n/1e3) + "k" : String(Math.round(n));
const pad = n => String(n).padStart(2, "0");
const nowLocal = () => { const d = new Date(); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes()); };
const todayKey = () => nowLocal().slice(0, 10);

let type = "spending", filter = "all", selDay = null, armed = null, armTimer = null;
let ym = (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })();
let entries = [], people = {}, peopleLoaded = false, uid = null, meName = null, ready = false;
let fs = null, au = null, db = null, auth = null, unsubs = [];

function setMsg(text, info) { const m = $("msg"); if (!text) { m.hidden = true; return; } m.hidden = false; m.textContent = text; m.className = "msg" + (info ? " info" : ""); }

/* ---------- form ---------- */
function setType(t) {
  type = t;
  $("tSp").classList.toggle("on", t === "spending"); $("tIn").classList.toggle("on", t === "income");
  $("tSp").setAttribute("aria-selected", t === "spending"); $("tIn").setAttribute("aria-selected", t === "income");
  $("cat").innerHTML = CATS[t].map(c => `<option>${c}</option>`).join("");
  $("txtLbl").textContent = t === "income" ? "Content (optional)" : "Content";
  $("add").classList.toggle("in", t === "income");
  $("err").textContent = "";
}
$("tSp").addEventListener("click", () => setType("spending"));
$("tIn").addEventListener("click", () => setType("income"));
setType("spending");
$("dt").value = nowLocal();
$("amt").addEventListener("input", e => { const d = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 13); e.target.value = d ? Number(d).toLocaleString("en-US") : ""; });
$("amt").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("txt").focus(); } });

function errText(err, fallback) {
  const c = err && err.code;
  if (c === "permission-denied") return "This Google account isn't allowed to use the tracker.";
  if (c === "unavailable") return "No connection. Check your internet and try again.";
  return fallback;
}

$("form").addEventListener("submit", async e => {
  e.preventDefault();
  const amount = Number($("amt").value.replace(/\D/g, ""));
  const at = $("dt").value, content = $("txt").value.trim();
  const miss = [];
  if (!at) miss.push("the date and time");
  if (!(amount > 0)) miss.push("the amount");
  if (type === "spending" && !content) miss.push("what it was for (Content)");
  if (miss.length) { $("err").textContent = "Please add " + miss.join(", ").replace(/, ([^,]*)$/, " and $1") + "."; return; }
  if (!db || !uid) { $("err").textContent = "Sign in first."; return; }
  if (!meName) { $("who").hidden = false; $("err").textContent = "Choose who you are first."; return; }
  $("add").disabled = true; $("err").textContent = "";
  try {
    await fs.addDoc(fs.collection(db, "entries"), { type, amount, category: $("cat").value, content, at: at.slice(0, 16), name: meName, by: uid, createdAt: Date.now() });
    $("amt").value = ""; $("txt").value = ""; $("dt").value = nowLocal();
    if (document.activeElement) document.activeElement.blur();
    const [y, m] = at.split("-").map(Number); ym = { y, m: m - 1 }; selDay = null; render();
    $("add").textContent = "Added ✓"; setTimeout(() => { $("add").textContent = "Add entry"; }, 1500);
  } catch (err) { $("err").textContent = errText(err, "Couldn't save. Try again."); }
  finally { $("add").disabled = false; }
});

/* ---------- month view ---------- */
$("prev").addEventListener("click", () => { ym.m--; if (ym.m < 0) { ym.m = 11; ym.y--; } selDay = null; render(); });
$("next").addEventListener("click", () => { ym.m++; if (ym.m > 11) { ym.m = 0; ym.y++; } selDay = null; render(); });
$("seg").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; filter = b.dataset.f; for (const x of $("seg").children) x.classList.toggle("on", x === b); render(); });
$("cal").addEventListener("click", e => { const b = e.target.closest(".day[data-d]"); if (!b) return; selDay = selDay === b.dataset.d ? null : b.dataset.d; render(); });
$("whole").addEventListener("click", () => { selDay = null; render(); });
$("list").addEventListener("click", async e => {
  const b = e.target.closest(".del"); if (!b) return;
  const id = b.dataset.id;
  if (armed !== id) { armed = id; clearTimeout(armTimer); armTimer = setTimeout(() => { armed = null; render(); }, 4000); render(); return; }
  armed = null; clearTimeout(armTimer); b.disabled = true; b.textContent = "Deleting…";
  try { await fs.deleteDoc(fs.doc(db, "entries", id)); } catch (err) { setMsg(errText(err, "Couldn't delete. Try again.")); render(); }
});

function render() {
  const mk = ym.y + "-" + pad(ym.m + 1);
  $("mlabel").textContent = new Date(ym.y, ym.m, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const month = entries.filter(e => e.at.startsWith(mk) && (filter === "all" || e.name === filter));
  let inc = 0, sp = 0; const byCat = {}, byDay = {};
  for (const e of month) {
    const d = e.at.slice(0, 10); byDay[d] = byDay[d] || { i: 0, s: 0 };
    if (e.type === "income") { inc += e.amount; byDay[d].i += e.amount; }
    else { sp += e.amount; byDay[d].s += e.amount; byCat[e.category] = (byCat[e.category] || 0) + e.amount; }
  }
  $("sIn").textContent = won(inc); $("sSp").textContent = won(sp);
  const net = inc - sp; $("sNet").textContent = won(net); $("sNet").style.color = net < 0 ? "var(--r)" : net > 0 ? "var(--g)" : "";
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]); const max = cats.length ? cats[0][1] : 1;
  $("bars").innerHTML = cats.length ? cats.map(([c, v]) => `<div class="bar"><span>${esc(c)}</span><span class="t"><i style="width:${Math.max(2, v / max * 100)}%"></i></span><em>${won(v)}</em></div>`).join("") : `<p class="empty">No spending this month.</p>`;
  const first = new Date(ym.y, ym.m, 1).getDay(), days = new Date(ym.y, ym.m + 1, 0).getDate(), tk = todayKey();
  let h = ["S","M","T","W","T","F","S"].map(d => `<div class="dow">${d}</div>`).join("") + `<div class="pad"></div>`.repeat(first);
  for (let d = 1; d <= days; d++) {
    const k = mk + "-" + pad(d), t = byDay[k];
    h += `<button class="day${k === tk ? " today" : ""}${k === selDay ? " sel" : ""}" data-d="${k}" aria-label="${k}"><span class="n">${d}</span>${t && t.i ? `<span class="p">+${short(t.i)}</span>` : ""}${t && t.s ? `<span class="m">−${short(t.s)}</span>` : ""}</button>`;
  }
  $("cal").innerHTML = h;
  const shown = (selDay ? month.filter(e => e.at.startsWith(selDay)) : month).slice().sort((a, b) => a.at < b.at ? 1 : a.at > b.at ? -1 : (b.createdAt || 0) - (a.createdAt || 0));
  $("lTitle").textContent = selDay ? new Date(selDay + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "Entries";
  $("whole").hidden = !selDay;
  $("list").innerHTML = shown.length ? shown.map(e => {
    const inc = e.type === "income", dt = new Date(e.at);
    const when = isNaN(dt) ? e.at : dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " · " + e.at.slice(11, 16);
    return `<div class="ent"><span class="c">${esc(e.content || e.category)}</span><span class="a ${inc ? "g" : "r"}">${inc ? "+" : "−"}${won(e.amount)}</span><span class="d">${esc(when)} · ${esc(e.category)} · ${esc(e.name)}</span>${db ? `<button class="del${armed === e.id ? " arm" : ""}" data-id="${esc(e.id)}">${armed === e.id ? "Tap again to delete" : "Delete"}</button>` : "<span></span>"}</div>`;
  }).join("") : `<p class="empty">${ready ? (selDay ? "No entries on this day." : "No entries this month.") : "Loading entries…"}</p>`;
}

function clean(id, v) {
  v = v || {};
  const at = typeof v.at === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v.at) ? v.at.slice(0, 16) : null;
  const amount = Number(v.amount);
  if (!at || !(amount > 0)) return null;
  const t = v.type === "income" ? "income" : "spending";
  return { id, type: t, amount, at, category: String(v.category || "Extra"), content: String(v.content || ""), name: NAMES.includes(v.name) ? v.name : "Someone", createdAt: Number(v.createdAt) || 0 };
}

/* ---------- who is using this ---------- */
function showWho() {
  if (!peopleLoaded || !uid) return;
  meName = NAMES.find(n => people[n] === uid) || null;
  $("me").textContent = meName ? "Using as " + meName : "";
  const ov = $("who");
  if (meName) { ov.hidden = true; return; }
  ov.hidden = false; let open = 0;
  for (const b of ov.querySelectorAll("button[data-n]")) { const taken = !!people[b.dataset.n]; b.disabled = taken; if (!taken) open++; b.textContent = b.dataset.n + (taken ? " (taken)" : ""); }
  $("whoMsg").textContent = open ? "" : "Both names are already taken by other Google accounts.";
}
$("who").addEventListener("click", async e => {
  const b = e.target.closest("button[data-n]"); if (!b || b.disabled) return;
  const name = b.dataset.n, ref = fs.doc(db, "people", name), msg = $("whoMsg");
  msg.textContent = "Saving…";
  try {
    await fs.runTransaction(db, async tx => {
      const s = await tx.get(ref);
      const cur = s.exists() ? (s.data() || {}).uid : null;
      if (cur && cur !== uid) throw { code: "taken" };
      if (!cur) tx.set(ref, { uid, name });
    });
    people[name] = uid; showWho();
  } catch (err) { msg.textContent = err && err.code === "taken" ? name + " is already taken." : errText(err, "Couldn't save your choice. Try again."); }
});

/* ---------- import from the old tracker ---------- */
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }
$("impBtn").addEventListener("click", async () => {
  const out = $("impMsg");
  if (!db || !uid) { out.textContent = "Sign in first."; return; }
  let list;
  try { list = JSON.parse($("impTxt").value); if (!Array.isArray(list)) throw 0; } catch { out.textContent = "That doesn't look like copied entries. Copy them again from the old tracker."; return; }
  const rows = list.map(v => clean("", v)).filter(Boolean);
  if (!rows.length) { out.textContent = "No entries found in what you pasted."; return; }
  $("impBtn").disabled = true; out.textContent = "Importing " + rows.length + " entries…";
  try {
    for (let i = 0; i < rows.length; i += 400) {
      const batch = fs.writeBatch(db);
      for (const r of rows.slice(i, i + 400)) {
        const id = "imp-" + hash([r.at, r.type, r.amount, r.category, r.content, r.name].join("|"));
        batch.set(fs.doc(db, "entries", id), { type: r.type, amount: r.amount, category: r.category, content: r.content, at: r.at, name: r.name, by: uid, createdAt: r.createdAt || Date.now() });
      }
      await batch.commit();
    }
    out.textContent = "Imported " + rows.length + " entries."; $("impTxt").value = "";
  } catch (err) { out.textContent = errText(err, "Import failed. Try again."); }
  finally { $("impBtn").disabled = false; }
});

/* ---------- sign-in and live data ---------- */
function stopData() { unsubs.forEach(u => u()); unsubs = []; entries = []; people = {}; peopleLoaded = false; meName = null; ready = false; }

function startData() {
  ready = false; render();
  const timer = setTimeout(() => setMsg("Can't reach the shared data right now. Check your connection — entries will appear when it's back."), 10000);
  unsubs.push(fs.onSnapshot(fs.collection(db, "entries"), s => {
    clearTimeout(timer); setMsg("");
    entries = s.docs.map(d => clean(d.id, d.data())).filter(Boolean); ready = true;
    if (armed && !entries.some(e => e.id === armed)) armed = null;
    render();
  }, err => {
    clearTimeout(timer); ready = true;
    setMsg(err && err.code === "permission-denied"
      ? "This Google account (" + (auth.currentUser && auth.currentUser.email || "unknown") + ") isn't on the allowed list. Sign out and use your own account."
      : "Lost connection to the shared data. Close and reopen the app.");
    render();
  }));
  unsubs.push(fs.onSnapshot(fs.collection(db, "people"), s => {
    people = {}; for (const d of s.docs) { const v = d.data() || {}; if (NAMES.includes(d.id) && typeof v.uid === "string") people[d.id] = v.uid; }
    peopleLoaded = true; showWho();
  }, () => {}));
}

$("gbtn").addEventListener("click", async () => {
  const m = $("signMsg"); m.textContent = "";
  const provider = new au.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try { await au.signInWithPopup(auth, provider); }
  catch (err) {
    if (err && (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment")) { try { await au.signInWithRedirect(auth, provider); return; } catch (e2) { err = e2; } }
    if (err && err.code === "auth/popup-closed-by-user") return;
    m.textContent = err && err.code === "auth/unauthorized-domain" ? "This web address isn't authorized in Firebase yet (see setup guide, step 2)." : "Sign-in didn't work. Check your connection and try again.";
  }
});
$("out").addEventListener("click", () => { if (auth) au.signOut(auth); });

render();

(async () => {
  if (!firebaseConfig || !firebaseConfig.apiKey || /PASTE/.test(firebaseConfig.apiKey)) {
    setMsg("Setup isn't finished: paste your Firebase settings into config.js (see the setup guide)."); $("add").disabled = true; ready = true; render(); return;
  }
  let app;
  try {
    const [a, auMod, fsMod] = await Promise.all([import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js")]);
    au = auMod; fs = fsMod;
    app = a.initializeApp(firebaseConfig);
    auth = au.getAuth(app); db = fs.getFirestore(app);
  } catch (e) {
    setMsg("Couldn't load the app. Check your internet connection and reopen it."); ready = true; render(); return;
  }
  au.getRedirectResult(auth).catch(() => {});
  au.onAuthStateChanged(auth, user => {
    stopData();
    uid = user ? user.uid : null;
    $("signin").hidden = !!user; $("out").hidden = !user;
    if (!user) { $("who").hidden = true; $("me").textContent = ""; setMsg(""); ready = true; render(); return; }
    setMsg("Loading your entries…", true);
    startData();
  });
})();

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
