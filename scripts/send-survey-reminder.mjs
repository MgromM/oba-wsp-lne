// Runs hourly via GitHub Actions. Only acts when it's 12:00 local time in Warsaw
// (computed from UTC so it self-adjusts for DST — no need for two cron schedules),
// and only if yesterday's confirmed dinner hasn't already gotten a survey nudge.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PUSH_ENDPOINT = 'https://kolacja-send-push.michalgromjr.workers.dev';
const PERSON_NAMES = { michal: 'Michał', ona: 'Aga' };

function warsawHour(now = new Date()) {
  return parseInt(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: 'numeric', hour12: false }).format(now),
    10
  );
}

function warsawDateStr(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(date);
}

async function main() {
  const hour = warsawHour();
  if (hour !== 12) {
    console.log(`Not noon in Warsaw (it's ${hour}:00) — skipping.`);
    return;
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const confirmedRef = db.collection('meta').doc('confirmed_date');
  const snap = await confirmedRef.get();
  if (!snap.exists) {
    console.log('No confirmed dinner — nothing to do.');
    return;
  }

  const confirmed = snap.data();
  if (confirmed.status !== 'confirmed') {
    console.log('Nothing confirmed (only a pending proposal, or old shape) — skipping.');
    return;
  }
  if (confirmed.surveySent) {
    console.log('Survey already sent for this dinner — skipping.');
    return;
  }

  const yesterday = warsawDateStr(new Date(Date.now() - 86400000));
  if (confirmed.date !== yesterday) {
    console.log(`Confirmed dinner is ${confirmed.date}, not yesterday (${yesterday}) — skipping.`);
    return;
  }

  const surveyUrl = `https://oba-wolne.web.app/ankieta.html?date=${confirmed.date}`;
  const title = 'Jak było wczoraj? 🍽';
  const message = 'Dwa szybkie pytania o wczorajszą kolację — zajmie 10 sekund.';

  for (const person of ['michal', 'ona']) {
    const res = await fetch(PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toExternalId: person, title, message, url: surveyUrl }),
    });
    console.log(`Push to ${PERSON_NAMES[person]}: ${res.status}`, await res.text());
  }

  await confirmedRef.set({ ...confirmed, surveySent: true }, { merge: true });
  console.log('Marked survey as sent.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
