# JJ and Chin’s Money Tracker: installable app setup

This folder is the installable version of the tracker. You set it up once, on a computer, in about 20–30 minutes. After that, both of you install it on your Samsung phones like a normal app.

You'll use two free services:
- **Firebase** (by Google): stores the entries and lets you each sign in with Google.
- **GitHub Pages**: hosts the app files at a web address you install from.

The setup screens may look slightly different from what's described here, but the steps are the same.

---

## What's in this folder

| File | What it is |
|---|---|
| `index.html`, `app.js` | The app itself |
| `config.js` | Where you paste your Firebase settings (step 4) |
| `manifest.webmanifest`, `sw.js`, `icons/` | What makes it installable, with its own icon |
| `firestore.rules` | Who is allowed to read and write entries (step 3) |
| `SETUP.md` | This guide |

---

## Step 1: Create the Firebase project

1. Go to **console.firebase.google.com** and sign in with your Google account.
2. Click **Create a project** (or **Add project**), name it e.g. `money-tracker`, and continue. You can turn Google Analytics off.

## Step 2: Turn on Google sign-in

1. In the left menu: **Build → Authentication → Get started**.
2. Under **Sign-in method**, choose **Google**, switch it on, pick your email as the support email, and **Save**.
3. Open the **Settings** tab, then **Authorized domains → Add domain**, and add
   `YOUR-GITHUB-USERNAME.github.io` (you'll create that username in step 5; decide it now).

## Step 3: Create the database and lock it to the two of you

1. Left menu: **Build → Firestore Database → Create database**.
2. Location: **asia-northeast3 (Seoul)**. Start in **production mode**.
3. Open the **Rules** tab, delete what's there, and paste the whole contents of `firestore.rules`.
4. Replace the two example addresses with **your Gmail address and Woojung's Gmail address**, in lowercase. Click **Publish**.

These rules are what keep your data private. Only those two Google accounts can see or change entries.

## Step 4: Connect the app to Firebase

1. Click the **gear icon → Project settings**. Under **Your apps**, click the **web icon `</>`**.
2. Give it a nickname (e.g. `tracker`). You don't need Firebase Hosting. Click **Register app**.
3. Firebase shows a `firebaseConfig = { ... }` block. Open `config.js` in a text editor (Notepad is fine) and replace the `PASTE…` values with yours. Keep the quotes and commas. Save.

These settings aren't secret. Anyone could see them in the app, and that's normal for Firebase. The rules from step 3 are what protect your entries.

## Step 5: Put the app online with GitHub Pages

1. Create a free account at **github.com** (or sign in).
2. Click **+ → New repository**. Name it `money-tracker`, set it to **Public**, and click **Create repository**.
3. On the new page, click **uploading an existing file**. Drag in **everything inside this folder**, including the `icons` folder. Click **Commit changes**.
4. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
5. After a minute or two, your app is live at
   **https://YOUR-GITHUB-USERNAME.github.io/money-tracker/**

Free GitHub Pages sites have to be public. That's fine here: the address only gives the app's screens. Entries stay protected by your Firebase rules and Google sign-in.

## Step 6: Install it on each Samsung phone

1. Open the address from step 5 on the phone, in **Samsung Internet** or **Chrome**.
2. Install it:
   - **Samsung Internet:** tap the install icon in the address bar, or **☰ menu → Add page to → Home screen**.
   - **Chrome:** tap **⋮ → Add to Home screen → Install** (Chrome may also show an **Install app** banner).
3. Open **Money Tracker** from the home screen or app drawer. Tap **Sign in with Google** and use the Gmail address from step 3.
4. Choose **Charlene** or **Woojung**. It only asks once per account.

Send Woojung the address and step 6. That's all he needs to do.

## Step 7 (once): Bring over your existing entries

1. Open the old tracker on claude.ai and tap **Copy all entries** at the bottom.
2. In the new app, scroll to the bottom, open **Bring entries from the old tracker**, paste, and tap **Import entries**.
   Importing the same entries twice won't create duplicates.

---

## Changing the app later

To update the app, replace the file in your GitHub repository (open the file → pencil icon, or **Add file → Upload files**). The phones pick up the change the next time the app is opened with internet.

## If something goes wrong

| What you see | What to do |
|---|---|
| “Setup isn't finished: paste your Firebase settings…” | `config.js` still has the `PASTE` values. Redo step 4 and re-upload `config.js`. |
| “This web address isn't authorized in Firebase yet” | Add `YOUR-GITHUB-USERNAME.github.io` under Authentication → Settings → Authorized domains. |
| “This Google account … isn't on the allowed list” | The email in `firestore.rules` doesn't match the account you signed in with. Fix the rules and Publish, or tap **Sign out** and use the right account. |
| No install option on the phone | Make sure the address starts with `https://` and the page has fully loaded once. Then try the menu option in step 6 again. |
| GitHub shows a 404 page | Wait a couple of minutes after step 5.4. Check that `index.html` is at the top level of the repository, not inside a subfolder. |
