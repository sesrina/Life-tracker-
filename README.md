# 🌸 My Planner

A small, cute personal planner made for phones. It uses only HTML, CSS and JavaScript, with no build step.

- **Today**: today's events and to-dos together, with a progress bar
- **Week**: a Monday–Sunday view. Tap **+** to add an event on a day, tap an event to edit or delete it, and swipe or use ‹ › to change week
- **To-do**: quick-add to-dos and tick them off. Tap a to-do to give it a date and time so it becomes a reminder
- **Cycle**: a period tracker. Tap "My period started" (and "Still on my period" on the days after), or tap any day on the month calendar to log flow, symptoms and a note. It learns your average cycle, predicts your next period and shows an estimated fertile window. Predictions are estimates only and aren't suitable for contraception. You can hide the cycle line on the Today screen with a switch at the bottom of the Cycle tab
- Everything is saved in your browser (`localStorage`), so it's still there after you close the app
- Deleted something by mistake? Tap **Undo** on the pop-up

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page and its layout |
| `style.css` | Colours and design (it also switches to dark mode automatically) |
| `app.js` | All the planner logic and saving |
| `manifest.webmanifest`, `icon.svg` | Let you add it to your home screen like an app |

## Opening it on your phone

### Option A: GitHub Pages (recommended, free)
1. On GitHub, open this repository and go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, then pick the branch (e.g. `main`) and the `/ (root)` folder, and press **Save**.
3. After a minute, GitHub shows a link like `https://<your-username>.github.io/<repo-name>/`. Open it on your phone.
4. Add it to your home screen:
   - **iPhone (Safari):** tap the Share button, then **Add to Home Screen**.
   - **Android (Chrome):** tap the ⋮ menu, then **Add to Home screen** or **Install app**.

### Option B: from your computer on the same Wi-Fi
1. In this folder, run `python3 -m http.server 8000`.
2. Find your computer's local IP address (e.g. `192.168.1.20`).
3. On your phone, open `http://192.168.1.20:8000`.

### Option C: on a computer
Double-click `index.html` to open it in your browser.

## Good to know
- Your data lives only in the browser you use it in. Your phone and your laptop each keep their own separate copy.
- Clearing your browser's website data, or using private/incognito mode, will erase or skip saved data.
- Reminders show up in the app (with ⏰ and an "overdue" label), but they don't send phone notifications.
