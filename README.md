# Pom-pom

Installable PWA: student Pomodoro tracker. Focus hours feed an **Inklet**. Breaks do not count.

Repo: [github.com/Romeo-04/pom-pom](https://github.com/Romeo-04/pom-pom)

## Run

```bash
npm install
npm test
npm run dev
```

PWA (service worker, install prompt) is produced on **build**:

```bash
npm run build
npm run preview
```

Then open the preview URL and use the browser’s install / “Add to Home Screen” control. Dev mode (`npm run dev`) does not register the production service worker.

After GitHub Pages is enabled, the live app is:

https://romeo-04.github.io/pom-pom/

## Offline

The service worker caches the app shell, pet placeholders, and icons. Tasks and hours still live in `localStorage` on the device. Google fonts cache after the first online visit.

## Gemini art

See [`docs/gemini-pet-assets.md`](docs/gemini-pet-assets.md).

## FE / BE split

See [`docs/fe-be-task-assignment.md`](docs/fe-be-task-assignment.md).
