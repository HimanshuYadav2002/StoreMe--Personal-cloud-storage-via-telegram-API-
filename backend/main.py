from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect
from telethon import TelegramClient
import os
from dotenv import load_dotenv
from typing import Dict

load_dotenv()

API_ID = int(os.getenv("API_ID"))
API_HASH = os.getenv("API_HASH")
SESSION_NAME = os.getenv("SESSION_NAME")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = TelegramClient(SESSION_NAME, API_ID, API_HASH)

# Store active websocket connections
active_connections: Dict[str, WebSocket] = {}

@app.on_event("startup")
async def start_client():
    print("Starting Telegram...")
    await client.start()
    print("Telegram client started.")

@app.websocket("/ws/progress/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await websocket.accept()
    active_connections[client_id] = websocket
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except WebSocketDisconnect:
        active_connections.pop(client_id, None)

@app.post("/upload")
async def upload_files(file: UploadFile, client_id: str):
    temp_path = f"./{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())

    # Progress callback
    async def upload_percentage(current, total):
        percent = float(current) / float(total)
        ws = active_connections.get(client_id)
        if ws:
            try:
                await ws.send_json({
                    "filename": file.filename,
                    "progress": percent
                })
            except Exception:
                pass

    # Wrap callback for Telethon (which is sync)
    def sync_upload_percentage(current, total):
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(upload_percentage(current, total))
        else:
            loop.run_until_complete(upload_percentage(current, total))

    await client.send_file(
        "me",
        temp_path,
        caption=f"Uploaded {file.filename}",
        force_document=True,
        progress_callback=sync_upload_percentage
    )
    os.remove(temp_path)
    ws = active_connections.get(client_id)
    if ws:
        await ws.send_json({
            "filename": file.filename,
            "progress": 1.0,
            "done": True
        })
    return {"status": "success"}