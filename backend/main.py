import os , asyncio
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect
from telethon import TelegramClient
from dotenv import load_dotenv
from typing import Dict

# loading environment variables 
load_dotenv()

API_ID = int(os.getenv("API_ID"))
API_HASH = os.getenv("API_HASH")
SESSION_NAME = os.getenv("SESSION_NAME")
client = TelegramClient(SESSION_NAME, API_ID, API_HASH)
# Store active websocket connections
active_connections: Dict[str, WebSocket] = {}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# triggerd on startup of server 
@app.on_event("startup")
async def start_client():
    print("Starting Telegram...")
    await client.start()
    print("Telegram client started.")

@app.websocket("/ws/progress/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    # accepting websocket request fron frontend 
    await websocket.accept()
    # storing active websocket connection 
    active_connections[client_id] = websocket
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    # removes current web socket object to none on closing of connecton 
    except WebSocketDisconnect:
        active_connections.pop(client_id, None)

@app.post("/upload/{client_id}")
async def upload_files(file: UploadFile, client_id: str):

    # getting web socket object for current user/client_id
    ws = active_connections.get(client_id)

    # stores a single file in root with temporary path ./file.name
    temp_path = f"./{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())

    # Real function that send upload progress of file via web socket
    async def upload_percentage(current, total):
        percent = float(current) / float(total)
        if ws:
            try:
                await ws.send_json({
                    "filename": file.filename,
                    "progress": percent
                })
            except Exception:
                pass

    # Wrapper function for upload_percentage because its a async function and telethon only accepts sync callbacks functions .
    def sync_upload_percentage(current, total):
        
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(upload_percentage(current, total))
        else:
            loop.run_until_complete(upload_percentage(current, total))

    # actual function from telethon which send files to telegram saved messages as documents (with compression)
    await client.send_file(
        "me",
        temp_path,
        caption=f"Uploaded {file.filename}",
        force_document=True,
        progress_callback=sync_upload_percentage
    )

    # removes temporary stored file 
    os.remove(temp_path)
    return 