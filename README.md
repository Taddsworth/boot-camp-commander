# Boot Camp Commander

An idle clicker game where you run a Navy-style recruit training base. Tap to drill recruits, build training facilities, keep enough housing for every trainee, and collect a government check for every graduate.

## Gameplay

- **Tap the base map** to train recruits by hand.
- **Training facilities** (10 of them, from the Drill Hall up to the Recruit Command Academy) graduate recruits every second.
- **Recruit Housing** caps throughput. Trainees beyond capacity don't graduate, so expand housing as you grow (Tents → Quonset Huts → Barracks → Recruit Ships → … → Floating City).
- **Upgrades**: facility boosts, federal contracts (more pay per graduate), drill upgrades for tapping, housing and Mail Call perks.
- **Mail Call**: an envelope flies across the base every minute or two. Tap it for a care package, a Liberty Weekend (×7 output) or Hooyah (×15 taps).
- **Ranks** from Ensign (O-1) to Fleet Admiral, based on career earnings.
- **Change of Command** (prestige): hand over the base for permanent commendations (+5% each).
- **26 ribbons** (achievements), +1% output each.
- Offline progress for up to 12 hours. Autosaves every 5 seconds.

## Project layout

| Path | What it is |
| --- | --- |
| `src/game.html` | The whole game (HTML/CSS/JS, no build tools needed) |
| `tools/build.js` | Wraps the game into `www/index.html` for the native apps and syntax-checks the scripts |
| `tools/sim.js` | Balance simulator: `node tools/sim.js <hours> <tapsPerSec>` |
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
