import { auth } from './firebase-config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ensureUserProfile } from './firestore.js';

const authView = document.getElementById('authView');
const appView  = document.getElementById('appView');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const goRegister = document.getElementById('goRegister');
const goLogin = document.getElementById('goLogin');
const btnLogout = document.getElementById('btnLogout');
const userBadge = document.getElementById('userBadge');

goRegister.addEventListener('click', (e)=>{ e.preventDefault(); loginForm.style.display='none'; registerForm.style.display='block'; });
goLogin.addEventListener('click', (e)=>{ e.preventDefault(); registerForm.style.display='none'; loginForm.style.display='block'; });

loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = (document.getElementById('loginEmail').value||'').trim();
  const pass  = document.getElementById('loginPass').value;
  await signInWithEmailAndPassword(auth, email, pass);
});

registerForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = (document.getElementById('regEmail').value||'').trim();
  const pass  = document.getElementById('regPass').value;
  await createUserWithEmailAndPassword(auth, email, pass);
});

btnLogout.addEventListener('click', ()=> signOut(auth));

onAuthStateChanged(auth, async (u)=>{
  if (u) {
    authView.style.display = 'none';
    appView.style.display = 'flex';
    userBadge.textContent = u.email;
    await ensureUserProfile();
    window._onSignIn?.(u);
  } else {
    appView.style.display = 'none';
    authView.style.display = 'block';
  }
});
