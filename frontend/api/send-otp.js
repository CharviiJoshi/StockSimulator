// Vercel Serverless Function — POST /api/send-otp
// Generates a 6-digit OTP, hashes it, stores in Firestore, emails via Nodemailer

import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'
import { db } from './_firebase.js'
import {
  collection, query, where, getDocs, setDoc, doc, deleteDoc,
} from 'firebase/firestore'

// Create a reusable transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,   // your Gmail address
    pass: process.env.GMAIL_PASS,   // your Gmail App Password (not your real password)
  },
})

// Simple email format check
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.body || {}

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email is required.' })
  }

  try {
    const otpCollection = collection(db, 'Forget_password')

    // --- Rate limiting: check if an OTP was sent in the last 20 seconds ---
    const existing = query(otpCollection, where('email', '==', email))
    const snapshot = await getDocs(existing)

    if (!snapshot.empty) {
      const lastDoc = snapshot.docs[0].data()
      const lastSent = new Date(lastDoc.createdAt).getTime()
      const now = Date.now()

      if (now - lastSent < 20_000) {
        return res.status(429).json({ error: 'Please wait before requesting another OTP.' })
      }

      // Delete old OTP before creating a new one
      for (const d of snapshot.docs) {
        await deleteDoc(d.ref)
      }
    }

    // --- Check if the email is registered ---
    const usersRef = collection(db, 'users')
    const userQuery = query(usersRef, where('email', '==', email))
    const userSnap = await getDocs(userQuery)

    if (userSnap.empty) {
      return res.status(404).json({ error: 'This email is not registered.' })
    }

    // --- Generate & hash OTP ---
    const otp = String(crypto.randomInt(100000, 999999)) // 6-digit
    const otpHash = await bcrypt.hash(otp, 10)

    // --- Store in Firestore ---
    const otpRef = doc(otpCollection)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min

    await setDoc(otpRef, {
      email,
      otpHash,
      createdAt: new Date().toISOString(),
      expiresAt,
      attempts: 0,
    })

    // --- Send email via Nodemailer ---
    await transporter.sendMail({
      from: `"StockSimulator" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Password Reset OTP — Stock Simulator',
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f172a; color: #e2e8f0; border-radius: 12px;">
          <h2 style="color: #06b6d4; margin-bottom: 8px;">Stock Simulator</h2>
          <p style="color: #94a3b8;">Password Reset Request</p>
          <p>Your one-time password is:</p>
          <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 20px; margin: 16px 0; background: #1e293b; border-radius: 8px; color: #10b981;">
            ${otp}
          </div>
          <p style="color: #94a3b8; font-size: 14px;">This OTP expires in 5 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    })

    return res.status(200).json({ success: true, message: 'OTP sent to your email.' })
  } catch (err) {
    console.error('send-otp error:', err)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
