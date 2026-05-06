# NICO Life Agent PWA

**NICO Life Insurance · In Partnership with Sanlam|Allianz**

---

## 📁 File Structure

```
/
├── index.html                      ← Main app entry point
├── nico-life-agent-pwa.html        ← App (same as index.html)
├── manifest.json                   ← PWA install config
├── sw.js                           ← Service worker (offline support)
├── NicoLifeAgentScript.gs          ← Google Apps Script for Sheets sync
├── README.md
├── icons/
│   ├── icon-72x72.png … 512x512.png
│   ├── apple-touch-icon.png        ← iOS (180×180)
│   ├── favicon.ico / favicon-16/32.png
│   └── icon.svg
└── .github/
    └── workflows/
        └── deploy.yml              ← Auto-deploy to GitHub Pages
```

---

## 🚀 Deploy to GitHub Pages

### Step 1 — Create Repository
1. Go to [github.com](https://github.com) → **New repository**
2. Name: `nico-agent` · Set to **Public** · Click **Create**

### Step 2 — Upload Files
1. On the empty repo page click **"uploading an existing file"**
2. Unzip the package, then drag **all files and folders** into the upload area
   - ✅ Include the `icons/` folder
   - ✅ Include the `.github/` folder (may be hidden — show hidden files on your OS)
3. Click **Commit changes**

### Step 3 — Enable GitHub Pages with Actions
1. Go to **Settings → Pages**
2. Under *Source* select **GitHub Actions**
3. Click **Save**

### Step 4 — Trigger Deployment
- The workflow runs automatically on every push
- Or go to **Actions tab → Deploy to GitHub Pages → Run workflow**
- Wait ~60 seconds → your URL appears at the top of the Pages settings:

```
https://YOUR-USERNAME.github.io/nico-agent/
```

---

## 📱 Install on Phone

**Android (Chrome)**
> Open the URL → tap ⋮ menu → **Add to Home Screen**

**iPhone (Safari)**
> Open the URL → tap **Share (□↑)** → **Add to Home Screen** → **Add**

---

## 📊 Google Sheets Sync

1. Go to [script.google.com](https://script.google.com) → **New Project**
2. Paste `NicoLifeAgentScript.gs` contents
3. **Deploy → New Deployment → Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Copy the Web App URL
5. In the app: **Profile → Google Sheets Sync → Paste URL → Connect**

---

## 🔑 Login

Enter any Agent ID and password — demo auth accepts all credentials.  
Update your name under **Profile → Edit Profile**.

---

*Call Centre: 323 · customercare@nicomw.com · www.nicomw.com*
