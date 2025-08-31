# 💬 LAN Token Chat

A lightweight **LAN chat app** built with **FastAPI** + **WebSockets**.  
Supports both **public chatrooms** (everyone on the network) and **token-protected private spaces** for secure group conversations.  

![img 01 (1)](https://github.com/user-attachments/assets/b5d9a945-99d1-4b7c-b939-cb12c226cbe1)
> First update `No CSS`

Works directly in the browser — no extra software needed!  
Supports **desktop & mobile** displays.  

---

<div style="display: flex; align-items: center; gap: 10px;" align="center">
  
# ⭐ main [**`project concept`**](https://github.com/akashdip2001/Token-Based-Authentication) ⭐
### `Token-Based-Authentication`
</div>

---

## ✨ Features
- 🌐 **Public Chat** — all devices on the LAN can join easily.
- 🔑 **Private Chat (Token)** — create a personal space with a unique token.  
  Only people who enter that token can join.
- 🕒 **Timestamps** on every message.
- 📱 **Responsive UI** — works on PC & mobile.
- ⚡ Powered by **FastAPI** + **WebSockets**.

</br>

<details>
  <summary style="opacity: 0.85;"><b>🔐 User Session Features</b></summary><br>

---

## 🔐 User Session Features

1. **First-Time Login**

   * When a new user opens the app, they are prompted to enter:

     * A **username**
     * A **password** (set by the user, minimum 4 characters for easier recall)
   * The username and password are stored locally in the browser (`localStorage`) as part of a session object.

2. **Password Security (Masked View)**

   * Whenever the password is shown in popups, only the 2nd and 3rd characters are hidden.
   * Examples:

     * `1234` → `1**4`
     * `12345` → `1**45`
     * `abcdef` → `a**def`

3. **30-Minute Session Timeout**

   * If the page is refreshed or reopened after **30 minutes of inactivity**, a popup appears:

     * **Option 1:** Continue with the saved username (requires entering the saved password).
     * **Option 2:** Start a new session with a new username and password (clears old data).

4. **Username Bar Interaction**

   * Clicking the username at the top of the page shows a popup with:

     * The current username
     * The current password (masked)
     * Two buttons:

       * **“Use another username”** → allows setting a new username & password.
       * **“Cancel”** → closes the popup without changes.

5. **Reload & Cache Refresh**

   * Choosing to reset (new session) clears all stored data, including username, password, and messages.
   * On reset, the page reloads, ensuring that any **new CSS/JS updates** are also applied.

---

⚡ This makes the app behave more like a real chat system with **basic account persistence**, **session expiry**, and **manual username management**, while still being lightweight and browser-based.

</details>

---

</br>
</br>

![IMG_20250817_221919211_HDR](https://github.com/user-attachments/assets/722b68af-6918-4e4a-971d-0bf57f2ef343)
> Second Update

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
git clone https://github.com/akashdip2001/LAN-Token-Chat.git
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

<img width="100%" alt="Screenshot (692)" src="https://github.com/user-attachments/assets/1da3302e-ec00-41c5-92e0-8fb59cf49cd5" />

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

<p align="center">
  <img src="https://github.com/user-attachments/assets/3c388fae-7b66-45ae-8427-6a551bb29fda" width="72%" /> &nbsp; &nbsp;
  <img src="https://github.com/user-attachments/assets/301d9ca9-4f82-424b-afea-96cda52d02f9" width="19%" /> 
</p>

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
[12:45:15] Bob: Hi Akashdip 👋
```

*Private Chat (Token: 7fa21bc3)*

```
[13:10:22] Alice: Secret group chat 🕵️
[13:10:45] Bob: Only we can see this 😎
```

![img 3 (2)](https://github.com/user-attachments/assets/ed027bf3-7413-4e23-9384-0e0bcf2ea65d)

---

## 🏗️ Tech Stack

* **Backend:** Python, FastAPI, WebSockets
* **Frontend:** HTML, JavaScript, CSS
* **Environment:** Runs on any OS with Python 3

---

## 🔮 Future Ideas

* Encrypt messages for extra privacy.

---
