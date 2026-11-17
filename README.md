# Boot Camp Commander

An idle clicker game where you run a Navy-style recruit training base. Tap to drill recruits, build training facilities, keep enough housing for every trainee, and collect a government check for every graduate.

## Play it

**https://taddsworth.github.io/boot-camp-commander/**

- **iPhone:** open the link in **Safari** → tap **Share** → **Add to Home Screen**. It launches full-screen with its own icon and works offline once loaded.
- **Android:** open in Chrome → menu → **Add to Home screen** (or install the APK, see below).

Redeploy after changes: `npm run build`, then push the contents of `www/` to the `gh-pages` branch.

## Gameplay

- **Tap the base map** to train recruits by hand.
- **Training facilities** (10 of them, from the Drill Hall up to the Recruit Command Academy) graduate recruits every second.
- **Esprit de corps**: every unit of a facility makes that whole line 5% better, so income compounds as you build.
- **Recruit Housing** caps throughput. Trainees beyond capacity don't graduate, so expand housing as you grow (Tents → Quonset Huts → Barracks → Recruit Ships → … → Floating City).
- **Upgrades**: facility boosts, federal contracts (more pay per graduate), drill upgrades for tapping, housing and Mail Call perks.
- **Mail Call**: an envelope flies across the base every minute or two. Tap it for a care package, a Liberty Weekend (×7 output) or Hooyah (×15 taps).
- **Ranks** from Ensign (O-1) to Fleet Admiral, based on career earnings.
- **Change of Command** (prestige): hand over the base for permanent commendations (+5% each).
- **Base Master Plan** (late game, unlocks at $10B career earnings): the fixed map becomes a tile grid you lay out yourself, around the parade ground.
  - **Training partners** (13 pairs, e.g. Pool + Wet Trainer, Range + Battle Stations) give each other +25% per different partner touching. Touching the parade ground adds +15%.
  - **Annexes** at 75 and 200 owned give a facility more tiles to reach partners. Without them only 9 of the 13 links fit (the grid can't hold odd cycles).
  - **Housing blocks** are placed too. Noisy facilities (Range, Firefighting, Battle Stations) cost touching blocks 15% capacity unless a Green Space shields them.
  - **Support structures** (9, rebuilt each command): Green Space, Galley, Fitness Center, Branch Clinic, Armory, Water Tower, Navy Exchange, Chapel, Headquarters. Each boosts its neighbours.
  - **Land parcels** (permanent) grow the grid from 6×4 to 10×6.
  - The planner (🗺️ Plan on the map) shows, for the selected building, the income change on every tile. The plan and land survive Change of Command.
- **38 ribbons** (achievements), +1% output each.
- **Staff**: hire and promote specialists one level at a time, with MAX, or with Hire all.
- Offline progress for up to 12 hours (more with the Corpsman). Autosaves every 5 seconds.
- **Cloud save** (More tab): create an account on one device and sign in on the others. The base syncs every minute and when you leave the app. If two devices disagree, the one with more career earnings wins.

## Project layout

| Path | What it is |
| --- | --- |
| `src/game.html` | The whole game (HTML/CSS/JS, no build tools needed) |
| `tools/build.js` | Wraps the game into `www/index.html` for the native apps and syntax-checks the scripts |
| `tools/sim.js` | Balance simulator: `node tools/sim.js <hours> <tapsPerSec> [noplan]` (prints the tap share of income; the plan is laid out by greedy auto-placement unless `noplan`) |
| `tools/plan-test.js` | Master Plan logic tests: `npm test` (add `--search` for the max-links search) |
| `supabase/schema.sql` | Leaderboard table and functions |
| `supabase/sync.sql` | Cloud save accounts and functions. Run once in the Supabase SQL editor |
| `android/`, `ios/` | Capacitor native projects |

## Building

```sh
npm install
npm run build          # src/game.html -> www/index.html
npx cap sync           # copy into the native projects
```

**Android APK** (Windows; needs the Android SDK and a JDK 17+):

```sh
npm run android:apk
# output: android/app/build/outputs/apk/debug/app-debug.apk
```

To sideload it, copy the APK to an Android phone, open it, and allow "install unknown apps" when prompted.

**iOS** (requires a Mac with Xcode and CocoaPods):

```sh
npm run sync
cd ios/App && pod install
npx cap open ios       # then pick your team under Signing and run on a device
```
