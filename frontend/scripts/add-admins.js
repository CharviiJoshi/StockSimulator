import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, runTransaction } from "firebase/firestore";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const admins = [
  {
    name: "Ayeshaani Kushwaha",
    email: "ayeshaanikushwaha@gmail.com",
    password: "ayeshaani123"
  },
  {
    name: "Ayush Solanki",
    email: "0801cs241037@sgsits.ac.in",
    password: "ayush123"
  }
];

async function addAdmins() {
  console.log("Starting Admin Addition Script...");

  for (const admin of admins) {
    try {
      // 1. Check if user already exists
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", admin.email));
      const snapshot = await getDocs(q);

      // 2. Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(admin.password, salt);

      if (!snapshot.empty) {
        // Update existing admin instead of skipping
        const existingDoc = snapshot.docs[0];
        const userRef = doc(db, "users", existingDoc.id);

        await setDoc(userRef, {
          name: admin.name,
          password: hashedPassword,
          role: "admin",
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        console.log(`Admin ${admin.email} updated successfully!`);
        continue;
      }

      // 3. Get next ID and save (Single Transaction)
      const counterRef = doc(db, "counters", "users");

      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let currentCount = 0;
        if (counterDoc.exists()) {
          currentCount = counterDoc.data().count;
        }

        const nextId = currentCount + 1;
        transaction.set(counterRef, { count: nextId });

        const userRef = doc(db, "users", String(nextId));
        transaction.set(userRef, {
          userId: nextId,
          name: admin.name,
          email: admin.email,
          password: hashedPassword,
          role: "admin",
          createdAt: new Date().toISOString(),
        });

        console.log(`Admin ${admin.email} added successfully with ID: ${nextId}`);
      });

    } catch (error) {
      console.error(`Error adding admin ${admin.email}:`, error);
    }
  }

  console.log("Admin script finished.");
  process.exit(0);
}

addAdmins();
