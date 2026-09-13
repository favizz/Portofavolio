import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot,
  serverTimestamp, doc, runTransaction, getDoc, setDoc,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

import { firebaseConfig } from './firebase-config.js';

const statusEl = document.getElementById('status');
const setupNote = document.getElementById('setupNote');
const counterEl = document.getElementById('visitorCount');
const messagesEl = document.getElementById('messages');
const form = document.getElementById('guestForm');
const input = document.getElementById('messageInput');

const isConfigured = !Object.values(firebaseConfig).some((v) => v.startsWith('REPLACE_ME'));

if (!isConfigured) {
  setupNote.hidden = false;
  statusEl.textContent = 'Not configured.';
  form.querySelector('button').disabled = true;
} else {
  run();
}

async function run() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  let uid = null;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      uid = user.uid;
      statusEl.textContent = 'Connected.';
      await bumpVisitorCountOnce(db, user.uid);
    }
  });

  try {
    await signInAnonymously(auth);
  } catch (err) {
    statusEl.textContent = `Auth error: ${err.message}`;
    return;
  }

  // Visitor counter, live.
  const counterRef = doc(db, 'stats', 'visitorCount');
  onSnapshot(counterRef, (snap) => {
    counterEl.textContent = snap.exists() ? snap.data().count : '0';
  });

  // Guestbook, live, most recent 50.
  const q = query(collection(db, 'guestbook'), orderBy('createdAt', 'desc'), limit(50));
  onSnapshot(q, (snap) => {
    if (snap.empty) {
      messagesEl.innerHTML = '<li class="empty">No messages yet — be the first.</li>';
      return;
    }
    messagesEl.innerHTML = '';
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const li = document.createElement('li');
      const time = data.createdAt ? data.createdAt.toDate().toLocaleString() : 'just now';
      li.innerHTML = `${escapeHtml(data.text)}<time>${time}</time>`;
      messagesEl.appendChild(li);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || !uid) return;
    input.value = '';
    try {
      await addDoc(collection(db, 'guestbook'), {
        text,
        uid,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      statusEl.textContent = `Write failed: ${err.message}`;
    }
  });
}

async function bumpVisitorCountOnce(db, uid) {
  const sessionKey = `firebase-demo-counted-${uid}`;
  if (sessionStorage.getItem(sessionKey)) return;

  const counterRef = doc(db, 'stats', 'visitorCount');
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      if (!snap.exists()) {
        tx.set(counterRef, { count: 1 });
      } else {
        tx.update(counterRef, { count: snap.data().count + 1 });
      }
    });
    sessionStorage.setItem(sessionKey, '1');
  } catch (err) {
    console.warn('Visitor count transaction failed (rules may not be deployed yet):', err.message);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
