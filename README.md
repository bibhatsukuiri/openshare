# OpenShare

A simple public web-app starter built with HTML, CSS, and JavaScript. It includes a working idea board that saves entries in your browser using localStorage.

## Files

- `index.html`: page layout and accessible form
- `styles.css`: responsive styling
- `app.js`: add, search, and delete ideas
- `.nojekyll`: tells GitHub Pages to serve files directly without Jekyll

## Run locally

Clone this repository and open `index.html` in a browser. No packages, build system, or server are required.

## Publish with GitHub Pages

1. In GitHub, open **Settings > Pages** in this repository.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **main** and **/(root)**, then click **Save**.
4. After GitHub finishes deploying, visit **https://bibhatsukuiri.github.io/openshare/**.

Note: The Pages URL works **only after GitHub Pages is enabled and deployment finishes**.

## Customize

Change the content in `index.html`, the design in `styles.css`, and app behavior in `app.js`. This is a frontend-only starter. Ideas are private to the current browser, not synced across devices or shared online. For user accounts, collaborative storage, and server-side operations, add a backend/database later.

## License

No license has been added yet. A public repository is viewable, but an open-source reuse license must be chosen separately if you want to grant reuse permissions.

## Harmonium Classroom (installable PWA)

Visit **https://bibhatsukuiri.github.io/openshare/music.html**. The harmonium can be installed on phones as a standalone Progressive Web App.

- **Android Chrome:** Use the in-page **Install Harmonium** button when available, or browser menu > Install app / Add to Home screen.
- **iPhone Safari:** Share > Add to Home Screen > Add.
- Once installed, open the **Harmonium** icon from your phone. It does not need an app store.
- The service worker (`sw.js`) caches the music page, CSS, JavaScript, manifest, and icons, so the keyboard and built-in lessons can run offline after initial caching.
- `harmonium.webmanifest` sets the standalone app name and home-screen icon. `harmonium-192.png` and `harmonium-512.png` are app icons; `harmonium-180.png` is the Apple touch icon.
- To release changes to the PWA, update the version query strings in `music.html` and `sw.js` and bump `CACHE_NAME` to refresh offline assets.

Web Audio requires the user to tap a key or press Listen to unlock audio. The app remains a static front-end with no accounts or data syncing.
