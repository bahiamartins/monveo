"""Wrapper to run backend.chat_app.app from project root for backwards compatibility."""

from chat_app import app

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
