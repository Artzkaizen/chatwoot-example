---

# 🧾  Chatwoot Integration: Buyer ↔ Multiple Vendors

---

## 🧠 Key Concepts

| Entity       | Chatwoot Role             |
| ------------ | ------------------------- |
| Buyer        | Contact                   |
| Vendor       | Contact                   |
| Conversation | One per buyer-vendor pair |
| Inbox        | API Inbox                 |

---

## ✅ Full Flow Summary

```text
[BUYER] ─ Logs into app
   │
   ├─► App fetches list of vendors they’re chatting with
   │
   ├─► Buyer selects Vendor X
   │     ├─ Check if a conversation exists
   │     └─ If not, create one
   │
   ├─► Buyer sends message → API → Chatwoot
   │
   └─► Backend relays message to vendor's view (mirrored message)
```

---

## 📁 Data Relationships (Your DB)

```text
users (buyers & vendors)
  └── id, name, role, chatwoot_contact_id

conversations
  └── id, buyer_id, vendor_id, chatwoot_conversation_id
```

---

## 🧱 Backend APIs (You must build)

### POST `/chat/init`

* Creates Chatwoot contact if not found.
* Stores contact ID in your DB.

---

### POST `/chat/conversation`

Creates a conversation between buyer and vendor if one doesn’t already exist.

```json
{
  "buyer_id": 123,
  "vendor_id": 456
}
```

Returns:

```json
{
  "conversation_id": "abc123",
  "messages": [...]
}
```

---

### POST `/chat/send`

Relays message from buyer to vendor (or vice versa):

```json
{
  "conversation_id": "abc123",
  "sender_id": "<buyer_contact_id>",
  "message": "Hello Vendor!"
}
```

Backend logic:

1. Send message as buyer to Chatwoot.
2. Mirror message as vendor (incoming) for vendor to see.
3. Save to DB if needed for audit or indexing.

---

### GET `/chat/conversations?buyer_id=123`

Returns list of all vendor conversations for this buyer:

```json
[
  {
    "vendor_name": "Vendor A",
    "conversation_id": "abc123",
    "last_message": "Hi there",
    "unread": true
  },
  ...
]
```

---

### GET `/chat/messages?conversation_id=abc123`

Returns chat thread between buyer and selected vendor.

---

## 📱 Expo Flow in UI

### 🔐 1. On Login:

* App calls `/chat/init` to ensure the buyer has a contact in Chatwoot.

---

### 📥 2. Fetch Vendor Conversations:

```ts
const res = await api.get(`/chat/conversations?buyer_id=123`);
```

Show this in a list (e.g., vendor name, last message).

---

### 💬 3. Start or Open Chat With Vendor:

```ts
const { conversation_id, messages } = await api.post('/chat/conversation', {
  buyer_id: 123,
  vendor_id: 456,
});
```

---

### 📨 4. Send Message:

```ts
await api.post('/chat/send', {
  conversation_id: "abc123",
  sender_id: buyer_chatwoot_id,
  message: "Hello Vendor!"
});
```

You can use `react-native-gifted-chat` to show messages nicely.

---

## 🔁 Example Conversation Creation Flow

### 1. Buyer wants to chat with Vendor B

1. Check if conversation exists in DB:

   ```sql
   SELECT * FROM conversations WHERE buyer_id = 123 AND vendor_id = 456
   ```

2. If not found:

   * Create Chatwoot conversation using:

     ```http
     POST /api/v1/accounts/:account_id/conversations
     ```

     Payload:

     ```json
     {
       "contact_id": "<buyer_contact_id>",
       "inbox_id": <api_inbox_id>,
       "source_id": "buyer_123",
       "additional_attributes": {
         "peer_contact_id": "<vendor_contact_id>"
       }
     }
     ```

3. Save the `conversation_id` and return it to the app.

---

## 👁 Vendor’s Experience

Vendors also log into the app (as contacts).

* Their app does the same: loads `vendor_contact_id`, lists conversations where they are the vendor.
* When they reply, the backend mirrors it as if from the buyer’s side.

---

## 🔒 Security Considerations

* Your backend should **validate roles** (buyer cannot impersonate vendor).
* Keep Chatwoot `Account API Key` secret — never expose it in the app.
* Add rate limiting to avoid spam/abuse.

---

## 🔧 Optional Enhancements

* Add typing indicators via socket
* Track unread messages using Chatwoot’s `read` status (or your own flag)
* Allow vendor blocking/muting

---

## ✅ Final Thoughts

With this setup, you now support:

* Multiple vendor conversations per buyer
* A proper message history per pair
* Separation of roles
* Control over message routing

---

