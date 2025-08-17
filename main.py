import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import secrets
from datetime import datetime

app = FastAPI()

# Store public + private rooms
rooms = {"public": []}   # each room -> list of WebSocket connections

# Keep track of generated tokens for private rooms
tokens = {}  # token -> room name


# -------------------------
# Generate new private room
# -------------------------
@app.get("/create_room")
async def create_room():
    token = secrets.token_hex(4)  # short unique token like "a3f9c1b2"
    room_name = f"room_{token}"
    rooms[room_name] = []
    tokens[token] = room_name
    return {"token": token, "room_name": room_name}


# -------------------------
# Serve simple UI
# -------------------------
@app.get("/")
async def get():
    return HTMLResponse(open("index.html").read())


# -------------------------
# WebSocket Chat Handler
# -------------------------
@app.websocket("/ws/{room}")
async def websocket_endpoint(websocket: WebSocket, room: str):
    await websocket.accept()

    # check room
    if room == "public":
        target_room = "public"
    elif room in tokens:  # if joined with token
        target_room = tokens[room]
    else:
        await websocket.send_text("❌ Invalid token/room")
        await websocket.close()
        return

    rooms[target_room].append(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            timestamp = datetime.now().strftime("%H:%M:%S")
            msg = f"[{timestamp}] {data}"
            # broadcast to everyone in the same room
            for conn in rooms[target_room]:
                await conn.send_text(msg)
    except WebSocketDisconnect:
        rooms[target_room].remove(websocket)
