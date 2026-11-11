# B. Mashilo Designs — Atelier Attendance Register

React + Vite + Tailwind v4 frontend with a local fingerprint kiosk.

## Layout

- `/` — frontend (Vite + React). `npm install`, then `npm run dev` or `npm run build`.
- `fingerprint-bridge/` — Node bridge on `127.0.0.1:4000`. `npm install`, then `npm start`.
- `fingerprint-matcher/` — Java 25 LTS/SourceAFIS matcher on `127.0.0.1:8787` (requires a Java 25+ runtime). From `fingerprint-matcher/`, run `mvn package`, then `java -jar target/fingerprint-matcher.jar`.

Data flow: kiosk browser -> bridge (:4000) -> Java matcher (:8787). Firestore holds `rollcall/data`, `fingerprints/*` and `users/credentials`.

Put `MTlogo.png`, `fingerprint-icon.png` and `logo.png` in `public/`.
