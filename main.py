import socket
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from datetime import datetime
import secrets
import json
import os
from typing import Dict, List, Tuple

app = FastAPI(title="LAN Token Chat")

# Rooms:
# - "public": list of (ws, username)
# - "room_<token>": list of (ws, username)
rooms: Dict[str, List[Tuple[WebSocket, str]]] = {"public": []}

# token -> room_name (for private rooms)
tokens: Dict[str, str] = {}

# In public room, track username -> websocket for signaling (private requests)
public_users: Dict[str, WebSocket] = {}

# -------------------------
# Serve SPA index
# -------------------------
@app.get("/")
async def index():
    if os.path.exists("index.html"):
        return HTMLResponse(open("index.html", encoding="utf-8").read())
    return PlainTextResponse("index.html not found. Place it next to main.py.", status_code=404)

# -------------------------
# Create a private room token
# -------------------------
@app.post("/api/create_token")
async def create_token():
    token = secrets.token_hex(3)  # short, e.g., "a3f9b2"
    room = f"room_{token}"
    tokens[token] = room
    rooms.setdefault(room, [])
    return {"token": token}

# Optional: check which tokens exist (for debugging)
@app.get("/api/tokens")
async def list_tokens():
    return {"tokens": list(tokens.keys())}

# -------------------------
# WebSocket handler (JSON protocol)
# Path: /ws/{room}/{username}
# room = "public" OR token (e.g., "a3f9b2")
# -------------------------
@app.websocket("/ws/{room}/{username}")
async def ws_handler(ws: WebSocket, room: str, username: str):
    await ws.accept()

    # Resolve room
    if room == "public":
        target_room = "public"
    elif room in tokens:
        target_room = tokens[room]
    else:
        await ws.send_text(json.dumps({"type": "system", "message": "Invalid room/token"}))
        await ws.close()
        return

    # Add to room
    rooms[target_room].append((ws, username))

    # Public user map (for signaling)
    if target_room == "public":
        public_users[username] = ws
        await broadcast_users()

    # Announce join
    await broadcast(
        target_room,
        {"type": "system", "message": f"👋 {username} joined {room}", "ts": timestamp_str()}
    )

    try:
        while True:
            raw = await ws.receive_text()
            data = parse_json(raw)

            # default = chat message
            if not data:
                await broadcast(target_room, chat_payload(username, raw))
                continue

            msg_type = data.get("type")

            if msg_type == "chat":
                text = data.get("text", "")
                await broadcast(target_room, chat_payload(username, text))

            elif msg_type == "private_request":
                # Only valid from public room
                if target_room != "public":
                    continue
                to_user = data.get("to")
                from_user = username
                # Generate a temp token for this request
                token = data.get("token") or secrets.token_hex(3)
                room_name = tokens.get(token) or f"room_{token}"
                if token not in tokens:
                    tokens[token] = room_name
                    rooms.setdefault(room_name, [])
                # Relay to target user if online
                to_ws = public_users.get(to_user)
                if to_ws:
                    await safe_send(to_ws, {
                        "type": "private_invite",
                        "from": from_user,
                        "token": token,
                        "ts": timestamp_str()
                    })

            elif msg_type == "private_accept":
                # Relay acceptance back to requester (still via public signaling)
                if target_room != "public":
                    continue
                to_user = data.get("to")
                token = data.get("token")
                to_ws = public_users.get(to_user)
                if to_ws:
                    await safe_send(to_ws, {
                        "type": "private_accept",
                        "from": username,  # the one accepting
                        "token": token,
                        "ts": timestamp_str()
                    })

            elif msg_type == "private_deny":
                if target_room != "public":
                    continue
                to_user = data.get("to")
                token = data.get("token")
                to_ws = public_users.get(to_user)
                if to_ws:
                    await safe_send(to_ws, {
                        "type": "private_deny",
                        "from": username,
                        "token": token,
                        "ts": timestamp_str()
                    })

            elif msg_type == "who":
                # send back current users for this room
                await safe_send(ws, {
                    "type": "users",
                    "room": target_room,
                    "users": [u for _, u in rooms[target_room]]
                })

            # else: ignore unknown types

    except WebSocketDisconnect:
        pass
    finally:
        # Remove from room
        try:
            rooms[target_room].remove((ws, username))
        except ValueError:
            pass

        if target_room == "public":
            public_users.pop(username, None)
            await broadcast_users()

        await broadcast(
            target_room,
            {"type": "system", "message": f"❌ {username} left {room}", "ts": timestamp_str()}
        )

# -------------------------
# Helpers
# -------------------------
def timestamp_str():
    return datetime.now().strftime("%H:%M:%S")

def chat_payload(username: str, text: str):
    return {"type": "chat", "from": username, "text": text, "ts": timestamp_str()}

async def broadcast(room_name: str, payload: dict):
    dead: List[Tuple[WebSocket, str]] = []
    for conn, _ in rooms.get(room_name, []):
        if not await safe_send(conn, payload):
            dead.append((conn, _))
    for d in dead:
        try:
            rooms[room_name].remove(d)
        except ValueError:
            pass

async def broadcast_users():
    """Broadcast public user list to everyone in public room."""
    payload = {
        "type": "users",
        "room": "public",
        "users": [u for _, u in rooms["public"]]
    }
    await broadcast("public", payload)

async def safe_send(ws: WebSocket, obj: dict) -> bool:
    try:
        await ws.send_text(json.dumps(obj))
        return True
    except Exception:
        return False

def parse_json(text: str):
    try:
        return json.loads(text)
    except Exception:
        return None

# -------------------------
# Utility: get LAN IP
# -------------------------
def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

# -------------------------
# Run
# -------------------------
if __name__ == "__main__":
    ip = get_ip()
    port = 8000
    print(f"\n🔗 Open on this PC:   http://127.0.0.1:{port}")
    print(f"📡 Open on LAN:       http://{ip}:{port}\n")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
