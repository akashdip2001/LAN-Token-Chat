# 💬 LAN Token Chat

A lightweight **LAN chat app** built with **FastAPI** + **WebSockets**.  
Supports both **public chatrooms** (everyone on the network) and **token-protected private spaces** for secure group conversations.  

Works directly in the browser — no extra software needed!  
Supports **desktop & mobile** displays.  

---

## ✨ Features
- 🌐 **Public Chat** — all devices on the LAN can join easily.
- 🔑 **Private Chat (Token)** — create a personal space with a unique token.  
  Only people who enter that token can join.
- 🕒 **Timestamps** on every message.
- 📱 **Responsive UI** — works on PC & mobile.
- ⚡ Powered by **FastAPI** + **WebSockets**.

---

## 📂 Project Structure
```

LAN-Token-Chat/
│── main.py       # Backend server (FastAPI + WebSocket)
│── index.html    # Frontend UI (simple chat interface)
│── README.md     # Project documentation

````

---

## 🚀 Setup & Run

### 1. Clone the repository
```bash
git clone https://github.com/your-username/LAN-Token-Chat.git
cd LAN-Token-Chat
````

### 2. Install dependencies

```bash
pip install fastapi uvicorn
```

### 3. Run the server

```bash
python main.py
```

### 4. Open in browser

On the host computer:

```
http://127.0.0.1:8000
```

On another device in the **same LAN**:

```
http://<your-local-ip>:8000
```

---

## 🛠️ How It Works

### Public Chat

* Everyone can join by pressing **Join Public Chat**.

### Private Chat

1. One person clicks **Create Private Space**.
   → The server generates a **token** (example: `a3f9c1b2`).
2. Share this token with friends.
3. Others click **Join Private Space**, enter the token, and join the private chatroom.

✅ Only users with the correct token can access that private space.

---

```
[12:45:01] Alice: Hello everyone!
[12:45:15] Bob: Hi Alice 👋
```

*Private Chat (Token: 7fa21bc3)*

```
[13:10:22] Alice: Secret group chat 🕵️
[13:10:45] Bob: Only we can see this 😎
```

---

## 🏗️ Tech Stack

* **Backend:** Python, FastAPI, WebSockets
* **Frontend:** HTML, JavaScript, CSS
* **Environment:** Runs on any OS with Python 3

---

## 🔮 Future Ideas

* Add **usernames** so people know who sent the message.
* Option to **list active private rooms**.
* Encrypt messages for extra privacy.

---
