// app-fb-shim.js — НЕ МЕНЯЕТ твою логику, только синхронизирует orgData ⇄ Firestore
import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  doc, setDoc, getDoc, onSnapshot, collection, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

/** Мини-форма логина */
function ensureAuthUI(){
  if (document.getElementById("miniAuth")) return;
  const box = document.createElement("div");
  box.id = "miniAuth";
  box.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99999;font-family:system-ui, -apple-system, Segoe UI, Roboto;";
  box.innerHTML = `
    <div style="width:320px;background:#0f1623;border:1px solid #1e2a41;padding:18px 16px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35)">
      <h3 style="margin:0 0 12px;color:#e8f0ff">Вход в KPI Board</h3>
      <label style="color:#9fb2cf;font-size:13px;">Email</label>
      <input id="authEmail" type="email" style="width:100%;margin:6px 0 10px;padding:10px;border-radius:8px;border:1px solid #24324b;background:#0b111b;color:#e8f0ff">
      <label style="color:#9fb2cf;font-size:13px;">Пароль</label>
      <input id="authPass" type="password" style="width:100%;margin:6px 0 14px;padding:10px;border-radius:8px;border:1px solid #24324b;background:#0b111b;color:#e8f0ff">
      <div id="authErr" style="color:#f59e0b;min-height:18px;font-size:12px;margin-bottom:6px;"></div>
      <div style="display:flex;gap:8px;">
        <button id="btnLogin" style="flex:1;padding:10px;border-radius:8px;border:1px solid #2a3a59;background:#1a2440;color:#e8f0ff">Войти</button>
        <button id="btnRegister" style="flex:1;padding:10px;border-radius:8px;border:1px solid #315a38;background:#1d3a28;color:#d4ffe1">Регистрация</button>
      </div>
    </div>`;
  document.body.appendChild(box);
  const email = box.querySelector("#authEmail");
  const pass  = box.querySelector("#authPass");
  const errEl = box.querySelector("#authErr");
  const doLogin = async () => {
    try { await signInWithEmailAndPassword(auth, email.value, pass.value); } catch (e) { errEl.textContent = e.code || e.message; }
  };
  const doRegister = async () => {
    try { await createUserWithEmailAndPassword(auth, email.value, pass.value); } catch (e) { errEl.textContent = e.code || e.message; }
  };
  box.querySelector("#btnLogin").onclick = doLogin;
  box.querySelector("#btnRegister").onclick = doRegister;
  [email, pass].forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); }));
}
function hideAuthUI(){ const n = document.getElementById("miniAuth"); if (n) n.remove(); }

/** Создаём профиль, если ещё нет */
async function ensureUserProfile(){
  const u = auth.currentUser; if (!u) return null;
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()){
    await setDoc(ref, {
      email: u.email || "", name: (u.email||'').split('@')[0],
      departmentId: "General", departments: { General: "member" },
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  }
}

/** orgData ⇄ Firestore */
let idMap = {};
function pushOrgFromFirestore(boards){
  window.orgData = { departments: {} };
  boards.forEach(b => {
    const dep = b.departmentId || "General";
    const uname = b.userName || "User 1";
    window.orgData.departments[dep] = window.orgData.departments[dep] || { users: {} };
    window.orgData.departments[dep].users[uname] = { title: b.userTitle || "", board: b.board || { rows: [] } };
  });
  if (!Object.keys(window.orgData.departments).length){
    window.orgData.departments["General"] = { users: { "User 1": { title:"", board: (window.defaultBoard ? window.defaultBoard() : {rows:[]}) } } };
  }
  if (!window.currentDepartment) window.currentDepartment = Object.keys(window.orgData.departments)[0];
  if (!window.currentUser) window.currentUser = Object.keys(window.orgData.departments[window.currentDepartment].users)[0];
  window.renderUsers?.(); window.renderTable?.(); window.renderSidebar?.();
}

/** Облако-сохранение только текущего пользователя и департамента */
async function cloudSaveCurrent(){
  const depId = window.currentDepartment || "General";
  await setDoc(doc(db, "departments", depId), { title: depId }, { merge: true });
  const node = window.orgData?.departments?.[depId]?.users?.[window.currentUser];
  if (!node) return;
  const payload = {
    departmentId: depId, userName: window.currentUser, userTitle: node.title || "",
    board: node.board || { rows: [] }, updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid || null, ownerUid: auth.currentUser?.uid || null
  };
  const knownId = idMap[depId]?.[window.currentUser];
  if (knownId){ await setDoc(doc(db, "boards", knownId), payload, { merge: true }); }
  else {
    const customId = `${depId}__${window.currentUser}`.replace(/[^\w\-]+/g,"_").slice(0,200);
    await setDoc(doc(db, "boards", customId), payload, { merge: true });
    idMap[depId] = idMap[depId] || {}; idMap[depId][window.currentUser] = customId;
  }
}

/** Перехватываем твою save() и добавляем облако */
const _localSave = window.save;
window.save = async function(){ try{_localSave?.();}catch{} try{await cloudSaveCurrent();}catch(e){console.warn("Cloud save failed:", e);} };

/** Подписки */
let unsubBoards=null, unsubDeps=null;
function resubscribeBoards(scope="dept"){
  if (unsubBoards) unsubBoards();
  const col = collection(db, "boards");
  const dep = window.currentDepartment || "General";
  const q = scope==="dept" ? query(col, where("departmentId","==", dep)) : col;
  unsubBoards = onSnapshot(q, (ss) => {
    idMap = {};
    const list = ss.docs.map(d => {
      const data = d.data();
      idMap[data.departmentId] = idMap[data.departmentId] || {};
      idMap[data.departmentId][data.userName] = d.id;
      return { id:d.id, ...data };
    });
    pushOrgFromFirestore(list);
  });
}
function subscribeDepartments(){
  if (unsubDeps) unsubDeps();
  unsubDeps = onSnapshot(collection(db,"departments"), (ss) => {
    const depIds = ss.docs.map(d=>d.id);
    if (depIds.length && !depIds.includes(window.currentDepartment)) window.currentDepartment = depIds[0];
    window.ensureDeptSelector?.();
  });
}

const _switchDepartment = window.switchDepartment;
window.switchDepartment = function(d){ _switchDepartment?.(d); resubscribeBoards("dept"); };

/** Auth flow */
onAuthStateChanged(auth, async (u) => {
  if (!u){ ensureAuthUI(); return; }
  hideAuthUI();
  if (!document.getElementById("btnLogoutShim")){
    const b=document.createElement("button");
    b.id="btnLogoutShim"; b.textContent="Выйти";
    b.style.cssText="position:fixed;top:10px;right:12px;z-index:9999;background:#1a2440;color:#e8f0ff;border:1px solid #2a3a59;padding:6px 10px;border-radius:8px";
    b.onclick=()=>signOut(auth); document.body.appendChild(b);
  }
  await ensureUserProfile();
  subscribeDepartments();
  resubscribeBoards("dept");
});
