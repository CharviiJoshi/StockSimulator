// Vercel Serverless Function — POST /api/verify-otp
// Verifies a user-submitted OTP against the hashed value in Firestore

import bcrypt from 'bcryptjs'
import { db } from './_firebase.js'
import {
  collection, query, where, getDocs, updateDoc, deleteDoc,
} from 'firebase/firestore'

const MAX_ATTEMPTS = 5

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, otp } = req.body || {}

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' })
  }

  try {
    const otpCollection = collection(db, 'Forget_password')
    const q = query(otpCollection, where('email', '==', email))
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      return res.status(404).json({ error: 'OTP not found. Please request a new one.' })
    }

    const otpDoc = snapshot.docs[0]
    const data = otpDoc.data()

    // Check expiry
    if (new Date() > new Date(data.expiresAt)) {
      await deleteDoc(otpDoc.ref)
      return res.status(410).json({ error: 'OTP has expired. Please request a new one.' })
    }

    // Brute force check
    if (data.attempts >= MAX_ATTEMPTS) {
      await deleteDoc(otpDoc.ref)
      return res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' })
    }

    // Increment attempts before comparing
    await updateDoc(otpDoc.ref, { attempts: data.attempts + 1 })

    // Compare submitted OTP with stored hash
    const isMatch = await bcrypt.compare(otp, data.otpHash)

    if (!isMatch) {
      const remaining = MAX_ATTEMPTS - data.attempts - 1
      return res.status(401).json({
        error: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      })
    }

    // OTP is correct — clean up
    await deleteDoc(otpDoc.ref)

    return res.status(200).json({ success: true, message: 'OTP verified.' })
  } catch (err) {
    console.error('verify-otp error:', err)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
