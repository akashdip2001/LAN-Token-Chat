import socket
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, PlainTextResponse   
from fastapi.staticfiles import StaticFiles
from datetime import datetime
from fastapi import HTTPException
from fastapi.responses import FileResponse
import secrets
import json
import os
from typing import Dict, List, Tuple

app = FastAPI(title="LAN Token Chat")

# Rooms: {"public": [(ws, username)], "room_<token>": [(ws, username)]}
rooms: Dict[str, List[Tuple[WebSocket, str]]] = {"public": []}
tokens: Dict[str, str] = {}   # token -> room
public_users: Dict[str, WebSocket] = {}  # track users in public

# -------------------------
# Serve static frontend
# -------------------------
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def index():
    if os.path.exists("static/index.html"):
        return HTMLResponse(open("static/index.html", encoding="utf-8").read())
    return PlainTextResponse("Place index.html in /static folder", status_code=404)

# -------------------------
# Create a private room token
# -------------------------
@app.post("/api/create_token")
async def create_token():
    token = secrets.token_hex(3)
    room = f"room_{token}"
    tokens[token] = room
    rooms.setdefault(room, [])
    return {"token": token}

@app.get("/api/tokens")
async def list_tokens():
    return {"tokens": list(tokens.keys())}

@app.delete("/api/tokens/{token}")
async def delete_token(token: str):
    """Delete a token (server-side) if exists."""
    if token not in tokens:
        raise HTTPException(status_code=404, detail="Token not found")
    room = tokens.pop(token)
    # optionally remove the room contents if you want:
    rooms.pop(room, None)
    return {"deleted": token}

# -------------------------
# Serve HTML pages
# -------------------------
# -------------------------
# Serve landing page (index.html from /static)
# -------------------------
@app.get("/")
async def index():
    return FileResponse(os.path.join("static", "index.html"))

# -------------------------
# Serve any other .html page from /static
# -------------------------
@app.get("/{page_name}")
async def serve_page(page_name: str):
    file_path = os.path.join("static", page_name)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    return PlainTextResponse(f"Page '{page_name}' not found", status_code=404)

# -------------------------
# WebSocket Chat Handler
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

    # ✅ Ensure username uniqueness in this room
    existing = [u for _, u in rooms[target_room]]
    final_username = username
    suffix = 1
    while final_username in existing:
        final_username = f"{username}{suffix:02d}"
        suffix += 1
    username = final_username

    # Add user to room
    rooms[target_room].append((ws, username))

    # ✅ Track only real users in public (skip previews)
    if target_room == "public" and not username.startswith("preview"):
        public_users[username] = ws
        await broadcast_users()

    # ✅ Announce join (skip previews)
    if not username.startswith("preview"):
        await broadcast(
            target_room,
            {"type": "system", "message": f"👋 {username} joined {room}", "ts": timestamp_str()}
        )

    try:
        while True:
            raw = await ws.receive_text()
            data = parse_json(raw)

            if not data:  # plain text
                await broadcast(target_room, chat_payload(username, raw))
                continue

            t = data.get("type")

            if t == "chat":
                await broadcast(target_room, chat_payload(username, data.get("text", "")))

            elif t == "private_request" and target_room == "public":
                to_user = data.get("to")
                token = data.get("token") or secrets.token_hex(3)
                room_name = tokens.get(token) or f"room_{token}"
                if token not in tokens:
                    tokens[token] = room_name
                    rooms.setdefault(room_name, [])
                to_ws = public_users.get(to_user)
                if to_ws:
                    await safe_send(to_ws, {
                        "type": "private_invite",
                        "from": username,
                        "token": token,
                        "ts": timestamp_str()
                    })

            elif t == "private_accept" and target_room == "public":
                to_ws = public_users.get(data.get("to"))
                if to_ws:
                    await safe_send(to_ws, {
                        "type": "private_accept",
                        "from": username,
                        "token": data.get("token"),
                        "ts": timestamp_str()
                    })

            elif t == "private_deny" and target_room == "public":
                to_ws = public_users.get(data.get("to"))
                if to_ws:
                    await safe_send(to_ws, {
                        "type": "private_deny",
                        "from": username,
                        "token": data.get("token"),
                        "ts": timestamp_str()
                    })

            elif t == "who":
                await safe_send(ws, {
                    "type": "users",
                    "room": target_room,
                    "users": [u for _, u in rooms[target_room]]
                })

    except WebSocketDisconnect:
        pass
    finally:
        # Remove from room
        try:
            rooms[target_room].remove((ws, username))
        except ValueError:
            pass

        # ✅ Remove only real users from public_users
        if target_room == "public" and not username.startswith("preview"):
            public_users.pop(username, None)
            await broadcast_users()

        # ✅ Announce leave (skip previews)
        if not username.startswith("preview"):
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

async def broadcast(room: str, payload: dict):
    dead: List[Tuple[WebSocket, str]] = []
    for conn, u in rooms.get(room, []):
        if not await safe_send(conn, payload):
            dead.append((conn, u))
    for d in dead:
        try:
            rooms[room].remove(d)
        except ValueError:
            pass

async def broadcast_users():
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
    try: return json.loads(text)
    except: return None

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
    print(f"\n🔗 Local:  http://127.0.0.1:{port}")
    print(f"📡 LAN:    http://{ip}:{port}\n")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
