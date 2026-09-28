# Local Development

The core and website use the same `61-web-interface` branch.
Place both repositories next to each other.

Requirements: Node.js 22.12 or newer and npm 11.19.

## 1. Clone Both Repositories

Run these commands from the directory where you keep projects:

```bash
git clone https://github.com/design-token-kit/design-token-kit.git
git clone https://github.com/design-token-kit/design-token-kit.github.io.git website
```

## 2. Switch Both Repositories To The Development Branch

Run these commands from the parent directory containing both repositories:

```bash
cd design-token-kit
git switch 61-web-interface
cd ../website
git switch 61-web-interface
```

## 3. Install Core Dependencies

Run from `design-token-kit`:

```bash
cd ../design-token-kit
npm install
```

## 4. Install Website Dependencies

Run from `website`:

```bash
cd ../website
npm install
```

## 5. Connect Local Core

Run from `website`, not from `design-token-kit`:

```bash
npm run core:local
```

This builds the local core package and installs it into the website without
changing `package.json`.

## 6. Start The Website

Still from `website`:

```bash
npm run dev
```

Open the URL printed by Astro, usually `http://localhost:4321/`.

After changing core, run `npm run core:local` again and restart `npm run dev`.
