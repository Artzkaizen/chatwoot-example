---

# 🧭 FLOW: Buyer ↔ Vendor Chat Using Chatwoot + Expo

---

## 🧩 1. Architectural Overview

Since **Chatwoot is built for client-agent messaging**, we simulate buyer ↔ vendor by:

| Actor        | Role in Chatwoot                             |
| ------------ | -------------------------------------------- |
| Buyer        | Chatwoot Contact                             |
| Vendor       | Chatwoot Contact                             |
| Inbox        | API Inbox                                    |
| Relay System | Your backend server (Node.js/Hono/Nest/etc.) |

The buyer and vendor **never directly message each other inside Chatwoot** — instead:

> You create a Chatwoot conversation with one of them and use your backend to **relay the messages** to the other party by posting messages on their behalf.

---

## 📱 2. Mobile App Flow (Expo)

```text
Buyer logs in ──► App loads their Chatwoot contact info
         │
         ├──► App fetches existing conversations (from your backend)
         │
         └──► Buyer sends message to vendor
                  │
           ┌────► Message sent to Chatwoot as buyer
           │
           └────► Backend picks it up and re-posts it as vendor (so vendor sees it)
```

Same applies in reverse when vendor replies.

---

## 🧱 3. Project Requirements

### 🔑 Your Expo app needs:

* Buyer/vendor auth system (you probably have this already)
* A way to store the associated `chatwoot_contact_id` for each user
* API calls to:

  * Create conversations
  * Send messages
  * List messages per conversation
  * Show contact list (optional)

### 💻 Your backend needs to:

* Create Chatwoot **contacts** for each user (once)
* Create **conversations** when Buyer wants to chat with a Vendor
* Relay messages (simulate both ends)
* Use Chatwoot’s **Account API Key** (keep this secret)

---

## 🪜 4. Detailed Step-by-Step Flow

---

### 🧍  Step 1: Register Each Buyer/Vendor in Chatwoot

Your backend creates a Chatwoot **contact** when a user signs up/logs in.

**POST** `/contacts`

```ts
POST /api/v1/accounts/:account_id/contacts
Authorization: Bearer <CHATWOOT_API_KEY>
```

Payload:

```json
{
  "name": "Alice Buyer",
  "identifier": "buyer_001",
  "inbox_id": <API_INBOX_ID>,
  "custom_attributes": {
    "role": "buyer"
  }
}
```

➡️ Save the `contact_id` in your DB and return it to the app.

---

### 🗣️ Step 2: Create a Conversation When Buyer Wants to Chat with Vendor

**POST** `/conversations`

```ts
POST /api/v1/accounts/:account_id/conversations
Authorization: Bearer <CHATWOOT_API_KEY>
```

Payload:

```json
{
  "source_id": "buyer_001",
  "inbox_id": <API_INBOX_ID>,
  "contact_id": "<buyer_contact_id>",
  "additional_attributes": {
    "peer_contact_id": "<vendor_contact_id>"
  }
}
```

➡️ Save the `conversation_id` and associate with both users.

---

### 💬 Step 3: Sending Messages (App → Backend → Chatwoot)

When a buyer sends a message:

1. App calls **your backend** with:

   ```json
   {
     "sender": "buyer_001",
     "recipient": "vendor_002",
     "message": "Hi, I'm interested in your product.",
     "conversation_id": "conv_abc123"
   }
   ```

2. Your backend:

   * Sends the message to Chatwoot as the **buyer** (incoming message)
   * Posts a mirror message to Chatwoot **from the vendor** (also as incoming)

✅ This fakes a 2-way chat between two contacts.

---

### 📥 Step 4: Fetch Conversation Messages

In your **Expo frontend**, call your backend:

```ts
GET /chat/messages?conversation_id=abc123
```

And your backend proxies:

```ts
GET /api/v1/accounts/:account_id/conversations/:conversation_id/messages
```

Return that data to your app, which renders the chat thread.

---

## 📦 5. Chatwoot Inbox Setup (One-Time)

In Chatwoot Dashboard:

1. Go to **Inboxes → Add Inbox → API Inbox**
2. Name it “Mobile Buyer-Vendor”
3. Save:

   * `Inbox ID`
   * `Channel API Key`

Use this inbox ID for all Chatwoot contact and conversation creation.

---

## 💻 6. Backend Responsibilities Summary

| Action                  | Endpoint              |
| ----------------------- | --------------------- |
| Create Contact          | `POST /contacts`      |
| Create Conversation     | `POST /conversations` |
| Send Message as Contact | `POST /messages`      |
| Fetch Messages          | `GET /messages`       |
| Relay message to peer   | Yes (custom logic)    |

---

## 📱 7. Expo Frontend Responsibilities

* Call backend to:

  * Fetch messages
  * Send messages
  * Load contact list / conversations
* Display messages
* Provide chat UI using something like [`react-native-gifted-chat`](https://github.com/FaridSafi/react-native-gifted-chat)

---

## 📋 8. Example Expo API Flow (Simplified)

### 🔐 On Login:

```ts
const contact = await api.post("/chatwoot/init", { userId, role });
```

Returns:

```json
{
  "contact_id": "...",
  "conversation_id": "...",
  "peer_id": "...",
  "messages": []
}
```

---

### 💬 On Send Message:

```ts
await api.post("/chatwoot/send", {
  senderId: contact_id,
  conversation_id,
  message: "Hello Vendor!"
});
```

Your backend sends to Chatwoot and mirrors it to peer.

---

## ✅ Final Notes

* You **do not use Chatwoot’s built-in widget** — only API.
* Your app handles full UI and message history.
* Chatwoot acts as a **messaging engine**, your backend controls the routing.

---

### ✅ Want Sample Code?

I can scaffold:

* A simple **Node.js backend relay service**
* Expo example with `react-native-gifted-chat` and dummy messages

Let me know what you’d like!
