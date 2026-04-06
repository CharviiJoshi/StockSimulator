import os
import io
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import pandas as pd
import requests as http_requests
from fastapi import FastAPI, HTTPException, Body, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Allow the React frontend to talk to this backend
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for OTPs (In production, use Redis or a DB)
otp_storage: Dict[str, str] = {}

# In-memory CSV cache: { symbol: { "df": DataFrame, "url": str, "cached_at": timestamp } }
csv_cache: Dict[str, dict] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes

# Gmail Configuration
GMAIL_USER = os.getenv("GMAIL_USER", "technicalreport24@gmail.com")
GMAIL_PASS = os.getenv("GMAIL_PASS", "ibtj itoi mpfj aysh")


class OTPRequest(BaseModel):
    email: str

class OTPVerify(BaseModel):
    email: str
    otp: str

class CSVFileInfo(BaseModel):
    symbol: str
    cloudinaryUrl: str
    status: Optional[str] = "Active"

class CSVFilesPayload(BaseModel):
    files: List[CSVFileInfo]


# ── Helper: Download and cache a CSV from Cloudinary ─────────

import time

def fetch_csv_from_url(symbol: str, url: str, force_refresh: bool = False) -> Optional[pd.DataFrame]:
    """Download a CSV from Cloudinary URL, with in-memory caching."""
    now = time.time()

    if not force_refresh and symbol in csv_cache:
        cached = csv_cache[symbol]
        if cached["url"] == url and (now - cached["cached_at"]) < CACHE_TTL_SECONDS:
            return cached["df"]

    try:
        response = http_requests.get(url, timeout=30)
        response.raise_for_status()
        df = pd.read_csv(io.StringIO(response.text))
        df.columns = df.columns.str.strip()
        df['Date'] = pd.to_datetime(df['Date'])

        csv_cache[symbol] = {
            "df": df,
            "url": url,
            "cached_at": now,
        }
        print(f"[BACKEND] Cached CSV for {symbol} ({len(df)} rows)")
        return df
    except Exception as e:
        print(f"[BACKEND] Error fetching CSV for {symbol}: {e}")
        return None


# ── API: Available Assets ────────────────────────────────────

@app.post("/api/available-assets")
def get_available_assets(payload: CSVFilesPayload):
    """Returns asset info for all active CSV files (sent from frontend via Firestore)."""
    assets = {}
    for f in payload.files:
        if f.status == "Active":
            assets[f.symbol] = {
                "name": f"{f.symbol} Stock",
                "price": 0.0
            }
    return assets


# ── API: Market Date Range ───────────────────────────────────

@app.post("/api/market-range")
def get_market_range(payload: CSVFilesPayload):
    """Returns the min/max dates across all active CSV files."""
    all_dates = []

    for f in payload.files:
        if f.status != "Active":
            continue
        df = fetch_csv_from_url(f.symbol, f.cloudinaryUrl)
        if df is not None and 'Date' in df.columns:
            all_dates.extend(df['Date'].tolist())

    if not all_dates:
        return {"min": "2020-01-01", "max": "2026-03-19"}

    return {
        "min": min(all_dates).strftime('%Y-%m-%d'),
        "max": max(all_dates).strftime('%Y-%m-%d')
    }


# ── API: Historical Prices ──────────────────────────────────

@app.post("/api/historical-prices")
def get_historical_prices(date: str, payload: CSVFilesPayload):
    """Returns Close prices for all active stocks on the given date."""
    prices = {}
    try:
        target_date = pd.to_datetime(date)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    for f in payload.files:
        if f.status != "Active":
            continue
        df = fetch_csv_from_url(f.symbol, f.cloudinaryUrl)
        if df is None:
            continue

        try:
            exact_row = df[df['Date'] == target_date]
            if not exact_row.empty:
                row = exact_row.iloc[0]
                close_col = [col for col in list(df.columns) if "Close" in col][0]
                prices[f.symbol] = float(row[close_col])
        except Exception as e:
            print(f"[BACKEND] Error reading {f.symbol}: {e}")
            continue

    return prices


# ── API: OTP ─────────────────────────────────────────────────

def send_email_task(email: str, otp: str):
    """Background task to send OTP emails without blocking the main request"""
    try:
        msg = MIMEMultipart()
        msg['From'] = GMAIL_USER
        msg['To'] = email
        msg['Subject'] = "Your Stock Simulator OTP"

        body = f"Your one-time password for resetting your Stock Simulator password is: {otp}. It will expire soon."
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(GMAIL_USER, GMAIL_PASS)
        text = msg.as_string()
        server.sendmail(GMAIL_USER, email, text)
        server.quit()
        print(f"OTP email sent to {email}")
    except Exception as e:
        print(f"Background Email Error: {str(e)}")

@app.post("/api/send-otp")
async def send_otp(request: OTPRequest, background_tasks: BackgroundTasks):
    email = request.email
    otp = str(random.randint(100000, 999999))
    otp_storage[email] = otp

    background_tasks.add_task(send_email_task, email, otp)

    return {"message": "OTP initiated successfully"}

@app.post("/api/verify-otp")
async def verify_otp(request: OTPVerify):
    email = request.email
    otp = request.otp

    if email in otp_storage and otp_storage[email] == otp:
        del otp_storage[email]
        return {"message": "OTP verified successfully"}
    else:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
