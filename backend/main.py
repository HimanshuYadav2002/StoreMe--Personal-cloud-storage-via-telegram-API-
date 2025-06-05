from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File
from typing import List
from telethon import TelegramClient
import os
from dotenv import load_dotenv  # Add this import

load_dotenv()  # Load variables from .env

API_ID = int(os.getenv("API_ID"))  # Read from .env
API_HASH = os.getenv("API_HASH")
SESSION_NAME = os.getenv("SESSION_NAME")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can restrict this to your frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = TelegramClient(SESSION_NAME, API_ID, API_HASH)

@app.on_event("startup")
async def start_client():
    print("Starting Telegram...")
    await client.start()
    print("Telegram client started.")

@app.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    
    for file in files:
        temp_path = f"./{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(await file.read())

        # Send to Saved Messages as document
        await client.send_file(
            "me",
            temp_path,
            caption=f"Uploaded {file.filename}",
            force_document=True  # This ensures all files are sent as documents
        )
        os.remove(temp_path)

    return