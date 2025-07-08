import os
import io
from telethon import errors

import uvicorn
import base64
import asyncio
import uuid
import phonenumbers
from typing import Dict
from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect, Body, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from telethon import TelegramClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# access env variables

API_ID = int(os.getenv("API_ID"))
API_HASH = os.getenv("API_HASH")

# Data Stores
Client_Sessions: Dict[str, TelegramClient] = {}
Client_Phones: Dict[str, str] = {}
Phone_Hashes: Dict[str, str] = {}
active_connections: Dict[str, WebSocket] = {}

# initialise app

app = FastAPI()

# add cors middleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# helper function to validate phone number


def validate_phone(phone: str) -> bool:
    try:
        parsed = phonenumbers.parse(phone, "IN")
        return phonenumbers.is_possible_number(parsed) and phonenumbers.is_valid_number(parsed)
    except Exception:
        return False

# route to delete client_session object when client_id changes in local storage on frontend


@app.post("/removeClient")
def removeClient(payload: dict = Body(...)):
    client_id = payload.get("client_id")
    print(client_id)
    print(Client_Sessions)
    Client_Sessions.pop(client_id, None)
    Client_Phones.pop(client_id, None)
    print(Client_Sessions)
    return JSONResponse(status_code=200, content={"message": "client object removed"})

# check for client id in clientSessions on login page and if it exists send 200
# which redirect client to upload page


@app.post("/getClientActiveStatus")
def getClientActiveStatus(payload: dict = Body(...)):
    client_id = payload.get("client_id")
    if client_id in Client_Sessions:
        return {"message": "client found"}
    else:
        return {"message": "client not found"}


# route to send OTP

@app.post("/getCode")
async def get_code(payload: dict = Body(...)):
    phone = payload.get("phone")
    if not phone or not validate_phone(phone):
        return JSONResponse(status_code=400, content={"error": "Invalid phone number"})

    client = TelegramClient(session=None, api_id=API_ID, api_hash=API_HASH)
    await client.connect()

    try:
        code_request = await client.send_code_request(phone)
    except errors.FloodWaitError as e:
        print(f"Flood wait Error wait for {e.seconds//3600} Hours")
        return JSONResponse(status_code=400, content={"error": f"Flood wait Error wait for {e.seconds//3600} Hours"})
    phone_hash = code_request.phone_code_hash

    client_id = str(uuid.uuid4())
    Client_Sessions[client_id] = client
    Client_Phones[client_id] = phone
    Phone_Hashes[phone] = phone_hash

    return {"client_id": client_id, "message": "OTP sent"}


@app.post("/login")
async def login(payload: dict = Body(...)):
    print(Client_Sessions)
    client_id = payload.get("client_id")
    verify_code = payload.get("verify_code")

    client = Client_Sessions.get(client_id)
    phone = Client_Phones.get(client_id)
    phone_hash = Phone_Hashes.get(phone)

    if not client or not phone or not phone_hash:
        return JSONResponse(status_code=400, content={"error": "Invalid session or expired code"})

    try:
        await client.sign_in(phone=phone, code=verify_code, phone_code_hash=phone_hash)
    except Exception as e:
        return JSONResponse(status_code=401, content={"error": "Invalid OTP", "detail": str(e)})

    Phone_Hashes.pop(phone, None)
    Client_Phones.pop(client_id, None)
    return {"message": "Login successful"}


@app.websocket("/ws/progress/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    # accepting websocket request fron frontend
    await websocket.accept()
    # storing active websocket connection
    active_connections[client_id] = websocket

    # Keep connection alive
    # removes current web socket object to none on closing of connecton
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.pop(client_id, None)


@app.post("/upload")
async def upload_files(client_id: str = Form(...), file: UploadFile = File(...)):
    ws = active_connections.get(client_id)
    client = Client_Sessions.get(client_id)

    if not client or not await client.is_user_authorized():
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    # stores a single file in root with temporary path ./file.name
    temp_path = f"./{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())

    # Real function that send upload progress of file via web socket
    async def upload_percentage(current, total):
        percent = float(current) / float(total)
        if ws:
            try:
                await ws.send_json({"filename": file.filename, "progress": percent})
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
    return {"message": "Upload successful"}

# route for getting photos


@app.websocket("/streamPhotos/{client_id}/{Limit}")
async def streamPhotos(websocket: WebSocket, client_id: str, Limit: int):
    if Limit == 0:
        Limit = None
    await websocket.accept()

    client = Client_Sessions.get(client_id)
    if not client or not await client.is_user_authorized():
        await websocket.send_json({"error": "Unauthorized"})
        await websocket.close()
        return

    try:
        messages = await client.get_messages("me", limit=Limit)
        for message in messages:
            # Download to memory
            buffer = io.BytesIO()
            await client.download_media(message, file=buffer, thumb=1)
            buffer.seek(0)

            # Encode to base64
            b64_img = base64.b64encode(buffer.read()).decode("utf-8")

            # Send over WebSocket
            await websocket.send_json({
                "message_id": message.id,
                "thumbnail": b64_img,
            })

        await websocket.send_json({"done": True})
    except Exception as e:
        await websocket.send_json({"error": str(e)})
        await websocket.close()


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=10000, reload=True)
