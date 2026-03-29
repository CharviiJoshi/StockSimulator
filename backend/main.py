import os
import shutil
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow the React frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create the folder where CSVs will live
UPLOAD_DIR = "app/data/market_history"
os.makedirs(UPLOAD_DIR, exist_ok=True)

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
    
    # 1. Grab every file sitting in the market_history folder
    if not os.path.exists(UPLOAD_DIR):
        return assets
        
    for filename in os.listdir(UPLOAD_DIR):
        if filename.endswith(".csv"):
            # If the file is AAPL(in).csv, the symbol becomes AAPL
            symbol = filename.replace("(in)", "").replace(".csv", "").upper()
            
            file_path = os.path.join(UPLOAD_DIR, filename)
            
            try:
                # 1. Read the full file this time
                df = pd.read_csv(file_path)
                
                # 2. Sort it chronologically (Oldest dates first)
                df['Date'] = pd.to_datetime(df['Date'])
                df = df.sort_values(by="Date", ascending=True)
                
                # 3. Get the exact price from the very first trading day (e.g. Jan 2, 2020)
                close_col = [col for col in list(df.columns) if "Close" in col][0]
                starting_price = float(df[close_col].iloc[0])
                
            except Exception:
                starting_price = 100.00 # Backup price
                
            # Put this right back in so the dictionary isn't empty!
            assets[symbol] = {
                "name": f"{symbol} Stock",
                "price": starting_price
            }
            
    return assets

