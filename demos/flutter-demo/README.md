# Wanderlist — Flutter Web Demo

A small, standalone trip-itinerary planner: create trips, add days, add
activities per day, check them off. Built fresh for this showcase (not
extracted from any private/team-owned codebase) to demonstrate real
Flutter fundamentals — Material 3 theming, `StatefulWidget` state
management, navigation (`Navigator.push`/`MaterialPageRoute`), dialogs and
forms — compiled to a static web build with `flutter build web`.

`lib/main.dart` is the entire app (single file, ~290 lines, kept
intentionally small for a demo). Everything else (`pubspec.yaml`, `web/`,
`analysis_options.yaml`) is the normal layout `flutter create` generates.

## Run locally (dev mode, hot reload)

Requires the [Flutter SDK](https://docs.flutter.dev/get-started/install)
(`brew install --cask flutter`):

```sh
flutter pub get
flutter run -d chrome
```

## Rebuild for production after editing lib/main.dart

```sh
flutter build web --release
```

Output lands in `build/web/` — a fully static site (HTML/JS/CSS/assets),
no server required. `build/web/` **is committed to this repo** (see
`.gitignore` — everything else under `build/` is ignored, only `web/` is
kept) specifically so this demo deploys with zero build step.

## Deploy on Vercel

Set **Root Directory** to `demos/flutter-demo/build/web`, leave Build
Command / Output Directory blank, and deploy. Re-run the build command
above and commit the result whenever `lib/main.dart` changes — Vercel
itself never runs Flutter.
