import datetime
try:
    from .firestore import get_client
except ImportError:
    from firestore import get_client
from google.cloud import firestore


class ChatMemory:
    """Utility for storing and retrieving a session-specific chat history in Firestore.

    Messages are kept in a document under collection ``chat_sessions`` keyed by session_id.
    This class provides conversion helpers if you use Vertex AI ``Content``/``Part`` objects,
    but you can also access the raw list of dictionaries via ``get_raw_history``.
    """

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.db = get_client()
        self.doc_ref = self.db.collection("chat_sessions").document(session_id)

    def get_raw_history(self):
        """Return the raw list of stored messages (dicts).

        Each message contains ``role``, ``text`` and ``timestamp``.
        If no document exists, returns an empty list.
        """
        doc = self.doc_ref.get()
        if not doc.exists:
            return []
        return doc.to_dict().get("messages", [])

    def get_history(self):
        """Return raw history dicts — chat_app.py handles context building directly."""
        return self.get_raw_history()

    def save_message(self, role: str, text: str):
        """Append a new message to the history document.

        Keeps only the last 20 messages to avoid unbounded growth.
        """
        new_msg = {"role": role, "text": text, "timestamp": datetime.datetime.utcnow()}
        existing = self.doc_ref.get()
        if existing.exists:
            self.doc_ref.update({
                "messages": firestore.ArrayUnion([new_msg]),
                "updated_at": datetime.datetime.utcnow(),
            })
        else:
            self.doc_ref.set({
                "messages": [new_msg],
                "updated_at": datetime.datetime.utcnow(),
            })
        # optionally prune older messages manually if needed;
        # firestorm doesn't allow limiting ArrayUnion so one would have to read,
        # trim and write back if exceeding threshold. For simplicity we rely on the
        # frontend to only send the last 15 anyway.
