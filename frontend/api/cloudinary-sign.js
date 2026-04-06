// Vercel Serverless Function — POST /api/cloudinary-sign
// Generates a signed upload URL for Cloudinary (raw CSV uploads)
// This avoids the unsigned preset issue entirely

import crypto from 'crypto'

const CLOUD_NAME = process.env.VITE_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || 'dz9o6gddm'
const API_KEY = process.env.CLOUDINARY_API_KEY || '651894386886899'
const API_SECRET = process.env.CLOUDINARY_API_SECRET || 'znkWCfKNvFXXf1Nqo1lx9Qstzcs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const timestamp = Math.round(Date.now() / 1000)
  const folder = 'stock-csvs'

  // Generate signature
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${API_SECRET}`
  const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex')

  return res.status(200).json({
    signature,
    timestamp,
    folder,
    api_key: API_KEY,
    cloud_name: CLOUD_NAME,
  })
}
