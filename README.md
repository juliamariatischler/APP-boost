# BoostSchule

## Project info

**Website**: https://www.boostschule.at

## How can I edit this code?

There are several ways of editing your application.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Deployment

Deployment is handled by GitHub Actions (`.github/workflows/deploy.yml`) to GitHub Pages with custom domain `www.boostschule.at`.

## Health integration (iOS + Android)

The app uses a shared health provider architecture:

- iOS: Apple Health (HealthKit)
- Android: Health Connect

To test as native app on phone:

```sh
npm run build
npx cap sync android
npx cap sync ios
npx cap open android
npx cap open ios
```

### iPhone testing

- Open `ios/App/App.xcworkspace`.
- In Xcode, `Signing & Capabilities`:
  - `Team` must be configured.
  - For real HealthKit access you need a paid Apple Developer account (Personal Team cannot sign HealthKit).
  - `HealthKit` capability enabled.
- `Info.plist` includes:
  - `NSHealthShareUsageDescription`
  - `NSHealthUpdateUsageDescription`
- Run on a real iPhone and allow Health permissions.

### Android testing

- Open Android Studio from `npx cap open android`.
- Run on a real Android device (USB debugging enabled).
- Ensure Health Connect is installed and permission prompts are accepted on first sync.

## Backend sync foundation

For scalable multi-device sync (idempotent ingest + sync cursors), a migration was added:

- `supabase/migrations/20260310170000_health_sync_foundation.sql`

## Lightning decay

- Home (`/dashboard`) now shows the level card (`Mein Level`) from Boost.
- Daily point decay is applied server-side via:
  - `supabase/migrations/20260310200000_daily_points_decay.sql`
- Refined 24h rule + warning via:
  - `supabase/migrations/20260310203000_points_decay_24h_warning.sql`
- Rule: if no activity for `24h`, `1` Blitz decays (never below `0`).
- Warning: one in-app notification is shown in the `2h` window before decay.
