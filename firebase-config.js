// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBl1d2cM0IFmojqvrm2RsvNjwR1fyQK7A8",
  authDomain: "kpi-board-dca40.firebaseapp.com",
  projectId: "kpi-board-dca40",
  storageBucket: "kpi-board-dca40.firebasestorage.app",
  messagingSenderId: "742719979967",
  appId: "1:742719979967:web:aa0b4a535149d0bd8da10a",
  measurementId: "G-XB9J14S8TZ"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
