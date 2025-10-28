import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc, serverTimestamp, collection, onSnapshot, query, where, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

export async function ensureUserProfile(){
  const u = auth.currentUser;
  const ref = doc(db, 'users', u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()){
    await setDoc(ref, {
      email: u.email,
      name: u.email.split('@')[0],
      position: '',
      departmentId: 'General',
      departments: { 'General': 'member' },
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  }
}

export function listenDepartments(cb){
  const ref = collection(db, 'departments');
  return onSnapshot(ref, ss => {
    const list = ss.docs.map(d=>({id:d.id, ...d.data()}));
    cb(list.length?list:[{id:'General', title:'General'}]);
  });
}

export function upsertDepartment(idOrTitle){
  const depId = idOrTitle;
  const ref = doc(db, 'departments', depId);
  return setDoc(ref, { title: depId, updatedAt: serverTimestamp() }, { merge: true });
}

// Boards: one document per user per department
// schema: { departmentId, userName, userTitle, ownerUid, board, updatedAt, updatedBy }
export function listenBoardsByDepartment(depId, cb){
  const qy = query(collection(db,'boards'), where('departmentId','==', depId));
  return onSnapshot(qy, ss => cb(ss.docs.map(d=>({id:d.id, ...d.data()}))));
}

export async function saveBoard({ id, departmentId, userName, userTitle, board, ownerUid }){
  const payload = {
    departmentId, userName, userTitle: userTitle||'', board,
    ownerUid: ownerUid || null,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  };
  if (id){
    await updateDoc(doc(db,'boards', id), payload);
  } else {
    await addDoc(collection(db,'boards'), payload);
  }
}
