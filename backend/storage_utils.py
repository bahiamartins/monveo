"""Utility for uploading user-attached files to GCS (seo-attached-files bucket)."""

import os
import uuid
import datetime
import mimetypes
import logging

logger = logging.getLogger(__name__)

GOOGLE_APPLICATION_CREDENTIALS = os.environ.get(
    "GOOGLE_APPLICATION_CREDENTIALS", "google_auth.json"
)
ATTACHMENTS_BUCKET = os.environ.get("ATTACHMENTS_BUCKET", "seo-attached-files")

_PROJECT_ID: str | None = None


def _get_project_id() -> str:
    global _PROJECT_ID
    if _PROJECT_ID:
        return _PROJECT_ID
    import json
    try:
        with open(GOOGLE_APPLICATION_CREDENTIALS) as f:
            _PROJECT_ID = json.load(f).get("project_id", "jc-vertex")
    except Exception:
        _PROJECT_ID = "jc-vertex"
    return _PROJECT_ID


def _get_credentials():
    from google.oauth2 import service_account
    return service_account.Credentials.from_service_account_file(
        GOOGLE_APPLICATION_CREDENTIALS,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )


def upload_attachment(file_bytes: bytes, filename: str, content_type: str | None = None) -> str:
    """Upload *file_bytes* to the attachments bucket and return a 7-day signed URL.

    The object is stored under  attachments/<uuid>/<original_filename>
    so filenames never collide and the original name is preserved.
    """
    from google.cloud import storage

    if not content_type:
        content_type, _ = mimetypes.guess_type(filename)
        content_type = content_type or "application/octet-stream"

    credentials = _get_credentials()
    project = _get_project_id()
    client = storage.Client(credentials=credentials, project=project)
    bucket = client.bucket(ATTACHMENTS_BUCKET)

    blob_name = f"attachments/{uuid.uuid4()}/{filename}"
    blob = bucket.blob(blob_name)
    blob.upload_from_string(file_bytes, content_type=content_type)

    signed_url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(days=7),
        method="GET",
        credentials=credentials,
    )

    logger.info("Uploaded attachment %s → %s", filename, blob_name)
    return signed_url
