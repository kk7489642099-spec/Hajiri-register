# Hajiri Register

A free, static Progressive Web App for construction labour attendance and wage records.

## Project structure

- `index.html` — page structure
- `css/styles.css` — visual design
- `js/app.js` — user interface and app workflows
- `js/db.js` — IndexedDB storage layer
- `js/reports.js` — wage/report calculations
- `manifest.json` — installable app metadata
- `sw.js` — offline cache and update version

## Features in this starter release

- Multiple construction sites
- Separate labour list for each site
- Daily Present / Half-day / Absent marking
- Attendance saved by site and date
- Wage snapshot stored with each attendance entry
- Edit labourer and current daily wage
- Archive a labourer without deleting old records
- Advance and wage-payment entries
- Monthly earned / paid / balance summary
- CSV report export
- Full JSON backup and restore
- IndexedDB storage and offline app shell

## Publish on GitHub Pages

1. Upload all project files and folders to the repository root.
2. Open repository Settings → Pages.
3. Under Build and deployment, choose Deploy from a branch.
4. Select `main` and `/ (root)`, then Save.
5. Open the published Pages address once while online. Install the app from the browser menu if offered.

## Updating the app

Edit the relevant source file and commit the changes. GitHub Pages publishes the new version. Whenever you change app files, increment `CACHE_VERSION` in `sw.js` (for example `hajiri-cache-v1` to `hajiri-cache-v2`) so the browser downloads the new offline files.

## Data and privacy

Attendance and payment records are stored in IndexedDB on the device/browser where the app is used. They are not sent to GitHub. The repository contains app source code only. Make JSON backups regularly. Clearing browser data, uninstalling the browser, or losing the phone can remove local records if no backup exists.

## Important limitations in this starter release

- This is a single-device register, not a cloud sync system.
- A browser's local storage is tied to that browser and device.
- CSV export is provided; PDF can be created using the browser's Print → Save as PDF feature.
- Before relying on this for official wage accounting, test it with sample records and verify monthly totals.
