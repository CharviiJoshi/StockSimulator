import { db } from './api/_firebase.js'
import { collection, query, limit, getDocs } from 'firebase/firestore'

async function test() {
  const usersRef = collection(db, 'users')
  const snapshot = await getDocs(query(usersRef, limit(1)))
  if (snapshot.empty) {
    console.log("No registered users found in DB")
  } else {
    const email = snapshot.docs[0].data().email
    console.log("Found registered user:", email)
    
    console.log("Sending OTP request...")
    const res = await fetch("http://localhost:5174/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    })
    console.log("Response:", await res.json())
  }
}

test().catch(console.error)
