import os
import shutil
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Body, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Dict, List, Optional

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

# Create the folder where CSVs will live
UPLOAD_DIR = "app/data/market_history"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# In-memory storage for OTPs (In production, use Redis or a DB)
otp_storage: Dict[str, str] = {}

# Gmail Configuration (Ideally from .env)
GMAIL_USER = "technicalreport24@gmail.com"
GMAIL_PASS = "ibtj itoi mpfj aysh"

class OTPRequest(BaseModel):
    email: str

class OTPVerify(BaseModel):
    email: str
    otp: str

@app.post("/api/admin/upload-csv")
async def upload_market_data(file: UploadFile = File(...)):
    # 1. Define where to save the incoming file
    file_location = os.path.join(UPLOAD_DIR, file.filename)
    
    # 2. Save it to your hard drive
    try:
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

            # 3. Pandas Auto-Clean Validation Logic
    try:
        warnings = []
        df = pd.read_csv(file_location)
        
        # FIX 1: Strip invisible spaces from headers (e.g. "Close " -> "Close")
        original_cols = list(df.columns)
        df.columns = df.columns.str.strip()
        if list(df.columns) != original_cols:
            warnings.append("Automatically stripped invisible spaces from headers.")
        
        # RULE A: Missing Crucial Columns (Fatal Error)
        required_columns = ["Date", "Open", "High", "Low", "Close", "Volume"]
        missing_cols = [col for col in required_columns if col not in df.columns]
        
        if missing_cols:
            os.remove(file_location)
            raise HTTPException(status_code=400, detail=f"FATAL: Missing required columns: {missing_cols}")
        
        # FIX 2: Delete corrupted rows (like "0.26 Dividend" strings or blanks)
        original_row_count = len(df)
        df = df.dropna(subset=required_columns) # Auto-deletes any row missing math values
        
        rows_deleted = original_row_count - len(df)
        if rows_deleted > 0:
            warnings.append(f"Auto-deleted {rows_deleted} corrupted or blank rows.")
            
        # Optional Rule C: Sort chronologically 
        # df['Date'] = pd.to_datetime(df['Date'])
        # df = df.sort_values(by="Date")
            
        # Save the freshly scrubbed DataFrame back over the file
        df.to_csv(file_location, index=False)

    except HTTPException:
        raise # Let the 400 Fatal Error pass through
    except Exception as e:
        if os.path.exists(file_location):
            os.remove(file_location)
        raise HTTPException(status_code=400, detail=f"Pandas failed to read CSV. Error: {str(e)}")

    return {
        "status": "success", 
        "filename": file.filename, 
        "message": "File scrubbed and saved!",
        "admin_warnings": warnings
    }

@app.get("/api/available-assets")
def get_available_assets():
    """Dynamically reads the uploaded CSVs and gives them to the User Dashboard"""
    assets = {}
    
    if not os.path.exists(UPLOAD_DIR):
        return assets
        
    for filename in os.listdir(UPLOAD_DIR):
        if filename.endswith(".csv"):
            symbol = filename.replace("(in)", "").replace(".csv", "").upper()
            assets[symbol] = {
                "name": f"{symbol} Stock",
                "price": 0.0 # Price will be synced by date in the frontend
            }
            
    return assets

@app.get("/api/market-range")
def get_market_range():
    """Returns the absolute min and max dates found across all uploaded CSVs"""
    all_dates = []
    
    if not os.path.exists(UPLOAD_DIR):
        return {"min": "2020-01-01", "max": "2026-03-19"} # Default range
        
    for filename in os.listdir(UPLOAD_DIR):
        if filename.endswith(".csv"):
            file_path = os.path.join(UPLOAD_DIR, filename)
            try:
                df = pd.read_csv(file_path)
                df['Date'] = pd.to_datetime(df['Date'])
                all_dates.extend(df['Date'].tolist())
            except Exception:
                continue
                
    if not all_dates:
        return {"min": "2020-01-01", "max": "2026-03-19"}
        
    return {
        "min": min(all_dates).strftime('%Y-%m-%d'),
        "max": max(all_dates).strftime('%Y-%m-%d')
    }

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

@app.get("/api/historical-prices")
def get_historical_prices(date: str):
    """Returns prices for all assets on the requested date exactly"""
    prices = {}
    try:
        target_date = pd.to_datetime(date)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    if not os.path.exists(UPLOAD_DIR):
        return prices

    for filename in os.listdir(UPLOAD_DIR):
        if filename.endswith(".csv"):
            symbol = filename.replace("(in)", "").replace(".csv", "").upper()
            file_path = os.path.join(UPLOAD_DIR, filename)
            
            try:
                df = pd.read_csv(file_path)
                df['Date'] = pd.to_datetime(df['Date'])
                
                # Filter for the exact date
                exact_row = df[df['Date'] == target_date]
                if not exact_row.empty:
                    row = exact_row.iloc[0]
                    close_col = [col for col in list(df.columns) if "Close" in col][0]
                    prices[symbol] = float(row[close_col])
                # If NOT found, we don't add it to 'prices'. 
                # This will signal 'NA' to the frontend.
                    
            except Exception as e:
                print(f"Error reading {filename}: {e}")
                continue
                
    return prices

@app.post("/api/send-otp")
async def send_otp(request: OTPRequest, background_tasks: BackgroundTasks):
    email = request.email
    otp = str(random.randint(100000, 999999))
    otp_storage[email] = otp
    
    # Send Email in background
    background_tasks.add_task(send_email_task, email, otp)
    
    return {"message": "OTP initiated successfully"}

@app.post("/api/verify-otp")
async def verify_otp(request: OTPVerify):
    email = request.email
    otp = request.otp
    
    if email in otp_storage and otp_storage[email] == otp:
        del otp_storage[email] # Clear after use
        return {"message": "OTP verified successfully"}
    else:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

@app.get("/api/admin/list-csvs")
def list_csvs():
    """Lists all uploaded CSV files and their metadata"""
    files = []
    if not os.path.exists(UPLOAD_DIR):
        return files
        
    for filename in os.listdir(UPLOAD_DIR):
        if filename.endswith(".csv"):
            file_path = os.path.join(UPLOAD_DIR, filename)
            stats = os.stat(file_path)
            try:
                df = pd.read_csv(file_path)
                records = len(df)
            except Exception:
                records = 0
                
            files.append({
                "id": filename,
                "name": filename,
                "date": pd.to_datetime(stats.st_mtime, unit='s').strftime('%Y-%m-%d %H:%M'),
                "size": f"{stats.st_size / 1024:.1f} KB",
                "records": records,
                "status": "Active" # Can be extended
            })
    return files

@app.delete("/api/admin/delete-csv/{filename}")
def delete_csv(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"message": f"File {filename} deleted successfully"}
    raise HTTPException(status_code=404, detail="File not found")

