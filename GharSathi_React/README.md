# Ghar Sathi React panels

This project was created from the uploaded Ghar Sathi website source (`index(1).html`, `style.css`, `script.js`) and the earlier structured HTML version. The original files are preserved in `legacy-source/structured-html/` for reference.

## What's included

- **Customer Panel** — service catalogue based on the uploaded `services.html`, prices, booking form, area selection, date/time, cash/online-demo choice, optional browser geolocation, my bookings, profile and complaints.
- **Technician Panel** — technician profile registration, verification status, unassigned job list, accept/start/complete flow and 15% commission estimate.
- **Admin Dashboard** — booking assignment/status management, technician verification, customer records, service price editing, complaints, activity feed and commission report preview.
- **Shared browser demo data** — panels share records through `localStorage`, so you can test a simple flow on the same browser.
- **Original source backup** — all 15 structured HTML pages, CSS/JS and uploaded shell source are retained in `legacy-source/`.

## Run on Windows (VS Code)

1. Install Node.js LTS from https://nodejs.org/ if it is not installed.
2. Extract the ZIP and open the `GharSathi_React` folder in VS Code.
3. Open Terminal → New Terminal.
4. Run:

   ```bash
   npm install
   npm run dev
   ```

5. Open the local URL printed by Vite, usually `http://localhost:5173`.
6. Select Customer, Technician or Admin Dashboard from the start page.

To check the production build, run `npm run build`.

## Service prices copied from uploaded source

The initial service values come from `legacy-source/structured-html/services.html`: AC ₹499, washing machine ₹599, fridge ₹649, RO ₹499, cooler ₹399, electrician ₹199, home cleaning ₹1,299, chimney cleaning ₹749 and other work ₹99. Geyser ₹449 is included as another editable option because it is part of the existing Ghar Sathi service catalogue described for this project. Prices are initial frontend demo values; the Admin panel can change them within the current browser.

## Important limitations — read before live launch

This is a **front-end prototype**, not a production booking/payment system yet. It has not been connected to your Django API because the actual API endpoint paths, response formats and authentication setup were not present in the uploaded files.

- Login/roles are not protected by Django yet. The Admin route is accessible in this demo; never expose it publicly as a real admin dashboard until backend authentication and permissions are connected.
- Booking/customer/technician data is stored in this browser's `localStorage`, not the Django database.
- “Online” is a demo selection only. No payment is charged.
- Location only asks the browser for geolocation permission. It does not yet use a map, reverse geocoding or live route tracking.
- OTP in the original uploaded HTML was demo OTP logic. Real OTP/SMS is not configured here.
- Technician accept/complete and the 15% commission report are demo actions. Real wallet deduction, insufficient-balance blocking, payout and a transaction-safe ledger must be implemented on the Django backend.
- Notifications, number masking, automatic nearby-technician dispatch, real-time updates and verified bank/KYC workflows are not live.

## Connecting the Django API later

- Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the base of the actual API.
- The reusable request helper is in `src/services/api.js`.
- Before switching the UI to API mode, confirm the actual Django endpoints and authentication. Frontend checks are never a replacement for server-side permissions or financial rules.

## Images

The source code refers to paths like `images/GHARSATHI_LOGO-removebg-preview.png`, `images/homebanner2.png`, `images/GharSathi AC Cleaning Service.png`, `images/washine.png`, and other images. The image files themselves were not included with the uploaded HTML/CSS/JS bundle, so they have not been fabricated. If you have the original `images` folder, copy it to `public/images/` (the demo panel currently uses built-in illustrations/emojis, so it still renders without those images).
