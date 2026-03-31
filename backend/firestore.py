import os
import datetime
from google.oauth2 import service_account
from google.cloud import firestore

GOOGLE_APPLICATION_CREDENTIALS = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "google_auth.json")

def get_client():
    credentials = service_account.Credentials.from_service_account_file(GOOGLE_APPLICATION_CREDENTIALS)
    return firestore.Client(credentials=credentials, database="mktjob")

def save_history(title, description, entries):
    """Save a conversation history document. entries should be a list of dicts {role, text}."""
    db = get_client()
    doc_ref = db.collection("veo_histories").document(title)
    doc_ref.set({
        "title": title,
        "description": description or "",
        "entries": entries,
    })

def list_histories():
    db = get_client()
    docs = db.collection("veo_histories").stream()
    return [d.to_dict() for d in docs]

def get_history(title):
    db = get_client()
    doc = db.collection("veo_histories").document(title).get()
    if doc.exists:
        return doc.to_dict()
    return None

# --- chat_sessions helpers ---

def list_sessions():
    """Return all chat sessions ordered by updated_at desc (id, title, updated_at)."""
    db = get_client()
    docs = db.collection("chat_sessions").order_by(
        "updated_at", direction=firestore.Query.DESCENDING
    ).stream()
    result = []
    for d in docs:
        data = d.to_dict()
        updated_at = data.get("updated_at")
        if isinstance(updated_at, datetime.datetime):
            updated_at = updated_at.isoformat()
        result.append({
            "session_id": d.id,
            "title": data.get("title", d.id),
            "updated_at": updated_at,
        })
    return result

def get_session_messages(session_id):
    """Return the last 15 messages for a session."""
    db = get_client()
    doc = db.collection("chat_sessions").document(session_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    messages = data.get("messages", [])
    serialized = []
    for m in messages[-15:]:
        ts = m.get("timestamp")
        if isinstance(ts, datetime.datetime):
            ts = ts.isoformat()
        serialized.append({"role": m.get("role"), "text": m.get("text"), "timestamp": ts})
    return {
        "session_id": session_id,
        "title": data.get("title", session_id),
        "messages": serialized,
    }

def update_session_title(session_id, title):
    """Update the title field for a chat session."""
    db = get_client()
    db.collection("chat_sessions").document(session_id).set(
        {"title": title, "updated_at": datetime.datetime.utcnow()},
        merge=True,
    )

def delete_session(session_id):
    """Delete a chat session document."""
    db = get_client()
    db.collection("chat_sessions").document(session_id).delete()

def delete_session_message(session_id: str, display_index: int):
    """Remove a single message from the displayed window (last 15) by its 0-based index.

    Uses the same offset logic as get_session_messages so indices are consistent.
    Returns True if a message was removed, False otherwise.
    """
    db = get_client()
    doc_ref = db.collection("chat_sessions").document(session_id)
    doc = doc_ref.get()
    if not doc.exists:
        return False
    messages = doc.to_dict().get("messages", [])
    total = len(messages)
    start = max(0, total - 15)
    actual_index = start + display_index
    if actual_index < 0 or actual_index >= total:
        return False
    messages.pop(actual_index)
    doc_ref.update({"messages": messages, "updated_at": datetime.datetime.utcnow()})
    return True
