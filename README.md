# Arrow Escape

A mobile puzzle game built with **Expo** and **React Native**. Tap arrows so they slide off the board without colliding — paths can bend with 90° corners before the arrowhead.

## Requirements

- Node.js 20+
- npm
- Expo Go app on a phone (optional), or an Android/iOS emulator

## Getting started

```bash
# Install dependencies
npm install

# Start the Expo dev server
npx expo start
```

### `npx expo start` — what you get

After the server starts, Expo prints a QR code and a menu in the terminal:

| Action | What it does |
|--------|----------------|
| Scan QR with **Expo Go** | Open the app on a physical device |
| Press `a` | Open on Android emulator |
| Press `i` | Open on iOS simulator (macOS) |
| Press `w` | Open in a web browser |
| Press `r` | Reload the app |
| Press `m` | Toggle developer menu |

You can also use the npm scripts:

```bash
npm start          # same as npx expo start
npm run android    # expo start --android
npm run ios        # expo start --ios
npm run web        # expo start --web
```

## Project structure

```text
arrow-escape-app/
├── App.tsx                 # Root app + screen routing
├── index.ts                # Expo entry point
├── app.json                # Expo app config
├── babel.config.js
├── package.json
├── tsconfig.json
├── assets/                 # Icons & splash
└── src/
    ├── config.ts           # Tunables (arrow size, animation, board)
    ├── theme.ts            # Colors & shared styles
    ├── components/
    │   ├── ArrowBoard.tsx  # Skia board + arrow drawing / escape anim
    │   ├── GameResult.tsx
    │   ├── Header.tsx
    │   └── Lives.tsx
    ├── game/
    │   ├── types.ts
    │   ├── engine.ts       # Core game loop / state transitions
    │   ├── collision.ts
    │   ├── geometry.ts
    │   └── directions.ts
    ├── levels/
    │   ├── index.ts        # Loaded levels (LEVELS, getLevel)
    │   ├── format.ts       # Level JSON → Level conversion
    │   ├── registry.ts     # Imports every level JSON file
    │   └── json/           # level-XX.json data files
    ├── screens/
    │   ├── HomeScreen.tsx
    │   ├── LevelSelectScreen.tsx
    │   ├── GameScreen.tsx
    │   └── SettingsScreen.tsx
    ├── store/
    │   └── gameStore.ts    # Zustand store (progress, settings)
    └── utils/
        ├── haptics.ts
        └── storage.ts
```

## Adding levels

Put a `level-XX.json` file in `src/levels/json/`, then import it and add it to the list in `src/levels/registry.ts`. Each file needs `version`, `level`, `name`, `board` (`width` = `height`), `hintQuota`, and `arrows`. Each arrow has an `id`, a `start` cell, a list of `segments` (`direction` + `length`), and `head.direction`, which must match the last segment. Any other fields are ignored.

## Stack

- Expo SDK 57
- React Native + TypeScript
- `@shopify/react-native-skia` — board & arrows
- `react-native-reanimated` + `react-native-gesture-handler`
- Zustand — app state
