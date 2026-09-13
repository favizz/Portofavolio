# Firebase — Live Guestbook

A realtime guestbook with a live visitor counter, talking directly to
**Cloud Firestore** from this static page via the Firebase JS SDK (loaded
from Google's own CDN, no npm install needed). No custom backend — access
is enforced entirely by `firestore.rules`.

This is the one demo in `demos/` that genuinely can't go live without your
input: Firebase needs a real project. Everything else here works out of
the box; this one needs ~5 minutes of setup.

## Setup (required before this demo does anything)

1. Go to [console.firebase.google.com](https://console.firebase.google.com), create a project (free Spark plan is enough).
2. **Build > Firestore Database > Create database** (start in production mode — the rules below handle access control).
3. **Build > Authentication > Sign-in method > Anonymous** — enable it.
4. **Project settings (gear icon) > General > Your apps > Web app (</>)** — register an app, copy the `firebaseConfig` object it gives you.
5. Paste those values into `firebase-config.js` in this folder, replacing every `REPLACE_ME`.
6. Deploy the security rules: install the [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`), then from this folder:
   ```sh
   firebase login
   firebase init firestore   # point it at firestore.rules already in this folder
   firebase deploy --only firestore:rules
   ```

Once that's done, reload the page — the "not configured" banner disappears
and the guestbook + counter go live.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy on Vercel

Static site, no build step. Set **Root Directory** to `demos/firebase-demo`,
leave Build Command / Output Directory blank, and deploy. `firebase-config.js`
ships with your real values baked in at deploy time (it's safe to commit —
a Firebase web config is not a secret, access control lives in
`firestore.rules`, already deployed separately via the Firebase CLI above).
