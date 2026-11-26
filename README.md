# 🌸 My Planner

A small, cute personal planner made for phones. It uses only HTML, CSS and JavaScript, with no build step.

- **Today**: today's events and to-dos together, with a progress bar
- **Week**: a Monday–Sunday view. Tap **+** to add an event on a day, tap an event to edit or delete it, and swipe or use ‹ › to change week
- **To-do**: quick-add to-dos and tick them off. Tap a to-do to give it a date and time so it becomes a reminder
- **Cycle** (in 💜 Me): a period tracker. Tap "My period started" (and "Still on my period" on the days after), or tap any day on the month calendar to log flow, symptoms and a note. It learns your average cycle, predicts your next period and shows an estimated fertile window. It also shows which phase you're in (menstrual 🩸, follicular 🌱, ovulation ✨ or luteal 🍂), with a short explanation, self-care tips and a coloured line under each calendar date. Predictions are estimates only and aren't suitable for contraception. You can hide the cycle line on the Today screen with a switch at the bottom of the Cycle tab
- **Google Calendar**: connect it from ⚙️ Settings to see all your Google events on the Today and Week screens, and to send planner events to Google (see the setup below)
- **Morning & night routines**: a short checklist on the Today screen (morning until midday, night from 8 pm) with a streak counter. Tap **Edit** to change the steps
- **Evening view**: from 8 pm the Today screen also shows tomorrow's plan
- **Print this week**: a button at the bottom of the Week screen prints a one-page wall schedule
- **Journal**: a daily entry with mood, energy, a few lines about the day and one good thing. See your mood over the last 30 days (with cycle phases underneath), patterns by weekday, by cycle phase and with or without your routines, look-backs to a week ago, the same point last cycle and a month ago, plus search
- **Privacy lock**: a 4-digit PIN for the Journal and Cycle tabs (⚙️ Settings). They lock again whenever you leave the app
- **Backups**: ⚙️ Settings → Backup saves a password-protected file (to Files, iCloud Drive or email) and can restore it on any phone. Keep the password safe: without it the backup can't be opened
- **Made for ADHD brains**: an *Up next* card with a live countdown, *Focus mode* (one thing at a time, a visual timer with a chime, Done or Later), routines you can play step by step, only the next 3 to-dos on Today, confetti and cheers when you tick things off, and a floating 🧠 *Brain dump* button to empty your head into your to-dos
- **Built on habit research**: forgiving streaks (one missed day is OK, "never miss twice"), a habit-building tracker towards ~66 days, a trigger for each routine ("After I turn off my alarm…"), and a lights-out countdown for a regular bedtime
- **Repeating events**: every day, weekdays or every week (also sent to Google Calendar as repeating events)
- **Life goals**: goals with a "why" and small steps; add any step to your to-dos. Ticking it off moves the goal forward
- **Weekly reset**: a 10-minute look back (routines, to-dos, mood) and pick 3 things for the week
- **Day timeline**: today's events with free-time gaps, a "now" line and lights-out
- **Break it down**: split any to-do into tiny steps, and Focus mode walks you through them
- **Plant buddy**: grows as you tick things off, from seedling to secret garden, and never dies
- **Learn as you go**: 💡 buttons explain the science behind each feature, plus a daily 🧠 Brain snack fact
- **Easy to use**: a friendly welcome tour on first open (replay it in ⚙️), one big ➕ button to add anything, and 5 simple tabs (Journal and Cycle live together in 💜 Me)
- **Easy to read**: no all-caps labels, 1.5 line spacing, a soft off-white background, plus ⚙️ → Reading comfort for bigger text, extra letter spacing, a choice of clear fonts (Nunito, Verdana, Atkinson Hyperlegible) and 🔊 read-aloud on tips
- **Six looks** in ⚙️ → Look: 🍒 Cherry (cream, cherry, wine and gold with a leopard trim), 🌸 Soft pink, 🤍 Clean girl, 🍵 Matcha, 🦋 Y2K and 🖤 Midnight. All are contrast-checked for easy reading
- **One fact per line**: details are stacked instead of squeezed together with dots
- **Plant care**: add your plants (tomato, basil, rosemary, string of hearts, succulents, pothos, monstera, snake plant, peace lily, fern, orchid and more), each with its own watering schedule and care tip. Outdoor pots in sun or wind get a shorter schedule. Today shows what needs water, Week shows watering days, and you can get a Google Calendar notification on watering days. Add your own photo of each plant (camera or photo library); photos are shrunk to save space and included in backups
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

## Connecting Google Calendar (one-time setup)

Google requires every app that reads a calendar to have its own free "Client ID". You only make it once, and it takes about 15 minutes. A computer is easiest, but a phone browser in desktop mode works too. Google sometimes renames buttons, so look for the closest match.

1. **Create a project.** Go to https://console.cloud.google.com and sign in with the Google account whose calendar you want. Accept the terms if asked. Click the project picker at the top, then **New project**, name it `My Planner`, and click **Create**. Make sure it's selected at the top.
2. **Turn on the Calendar and Tasks APIs.** Go to https://console.cloud.google.com/apis/library/calendar-json.googleapis.com and click **Enable**. Then do the same at https://console.cloud.google.com/apis/library/tasks.googleapis.com for Google Tasks.
3. **Set up the sign-in screen.** Go to https://console.cloud.google.com/auth/overview and click **Get started**.
   - App name: `My Planner`. Support email: your email.
   - Audience: **External**.
   - Contact email: your email. Tick the agreement, then **Create**.
4. **Add yourself as a tester.** In the left menu, open **Audience**. Under **Test users**, click **Add users**, enter your Gmail address, and **Save**.
5. **Create the Client ID.** In the left menu, open **Clients**, then **Create client**.
   - Application type: **Web application**. Name: `My Planner`.
   - **Authorized JavaScript origins**, click Add URI: `https://sesrina.github.io`
   - **Authorized redirect URIs**, click Add URI: `https://sesrina.github.io/Life-tracker-/` (keep the slash at the end)
   - Click **Create**, then copy the **Client ID**. It ends in `.apps.googleusercontent.com`.
6. **Connect.** Open the planner, tap **⚙️**, paste the Client ID, and tap **Connect Google Calendar**.
   - Google will say **"Google hasn't verified this app"**. That's expected for a personal app, so tap **Continue**.
   - When it asks what the planner can access, **tick all the boxes** (calendar and tasks), then **Continue**.

### How it works
- Events from every calendar that's ticked in Google Calendar appear in the planner, from 4 weeks ago to about 4 months ahead, and further as you browse weeks.
- Tap a Google event to open it in Google Calendar.
- **Notifications**: choose "🔔 Notify me" on an event or a to-do with a time. The planner puts it in your Google Calendar with an alert, so your phone notifies you (install the Google Calendar app, or add your Google account to the iPhone Calendar app). Ticking a to-do off removes its reminder.
- **Google Tasks** show in the To-do list, and on Today and Week when they have a due date. Ticking one off in the planner ticks it off in Google too. Tap a task to open it in Google Tasks. (Google only shares a task's date, not its time.)
- Planner events with **🗓️ Also in Google Calendar** switched on are added to your main Google calendar. Editing or deleting them in the planner updates Google too.
- Google signs the planner out after about an hour. When that happens, tap the **🗓️** bar at the top to sync again. It usually takes a second. Changes you make in the meantime wait and are sent on the next sync.
- To stop, use **Disconnect** in ⚙️ Settings. Your Google events stay in Google.
