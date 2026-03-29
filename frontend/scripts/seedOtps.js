import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Generate 500 unique 4-digit OTPs
function generateUniqueOtps(count) {
  const otps = new Set();
  while (otps.size < count) {
    const otp = String(Math.floor(1000 + Math.random() * 9000)); // 1000–9999
    otps.add(otp);
  }
  return Array.from(otps);
}

async function seed() {
  console.log('Generating 500 unique 4-digit OTPs...');
  const otps = generateUniqueOtps(500);

  console.log('Writing to Firestore: otp/available ...');
  await setDoc(doc(db, 'otp', 'available'), { codes: otps });

  console.log(`Done! Stored ${otps.length} OTPs in otp/available.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
