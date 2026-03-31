"""Graphic agent: generates infographics/images via Vertex AI Imagen and stores them in GCS."""

import os
import uuid
import logging

# All heavy imports are lazy (inside functions) so a missing package never
# prevents chat_app.py from importing and starting Flask.

logger = logging.getLogger(__name__)

GOOGLE_APPLICATION_CREDENTIALS = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "google_auth.json")

def _read_project_id() -> str:
    import json
    try:
        with open(GOOGLE_APPLICATION_CREDENTIALS) as f:
            return json.load(f).get("project_id", "jc-vertex")
    except Exception:
        return "jc-vertex"

PROJECT_ID = _read_project_id()
LOCATION = "us-central1"
GCS_BUCKET = os.environ.get("GCS_BUCKET", "agent-seo-images")

# Imagen model — imagegeneration@006 is Imagen 2 (broadly available, no visible branding)
IMAGEN_MODEL = "imagen-3.0-generate-002"


def _get_credentials():
    from google.oauth2 import service_account  # lazy
    return service_account.Credentials.from_service_account_file(
        GOOGLE_APPLICATION_CREDENTIALS
    )


def generate_and_store(image_prompt: str) -> str | None:
    """Generate an image from *image_prompt* and upload it to GCS.

    Returns the public URL of the uploaded image, or None on failure.
    The image_prompt should be in English for best results.
    """
    try:
        import vertexai
        from vertexai.preview.vision_models import ImageGenerationModel

        credentials = _get_credentials()
        vertexai.init(project=PROJECT_ID, location=LOCATION, credentials=credentials)

        model = ImageGenerationModel.from_pretrained(IMAGEN_MODEL)
        images = model.generate_images(
            prompt=image_prompt,
            number_of_images=1,
            add_watermark=False,  # no invisible SynthID watermark / no Gemini branding
        )

        if not images:
            logger.warning("Imagen returned no images.")
            return None

        # Extract raw bytes — the attribute differs between SDK versions
        img_obj = images[0]
        if hasattr(img_obj, "_image_bytes"):
            image_bytes = img_obj._image_bytes
        elif hasattr(img_obj, "image") and hasattr(img_obj.image, "image_bytes"):
            image_bytes = img_obj.image.image_bytes
        else:
            # Fallback: save to temp file and read back
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                img_obj.save(location=tmp.name, include_generation_parameters=False)
                tmp_path = tmp.name
            with open(tmp_path, "rb") as f:
                image_bytes = f.read()
            os.unlink(tmp_path)

        return _upload_to_gcs(image_bytes)

    except Exception as e:
        logger.error("Image generation failed: %s", e, exc_info=True)
        return None


def _upload_to_gcs(image_bytes: bytes) -> str:
    """Upload image bytes to GCS and return a long-lived signed URL.

    Uses v4 signed URLs (max 7 days) — compatible with uniform bucket-level
    access, which disables legacy ACLs and makes blob.make_public() fail.
    For URLs that survive beyond 7 days consider enabling public IAM access:
      gsutil iam ch allUsers:objectViewer gs://<bucket>
    """
    import datetime
    from google.cloud import storage  # lazy

    credentials = _get_credentials()
    client = storage.Client(credentials=credentials, project=PROJECT_ID)
    bucket = client.bucket(GCS_BUCKET)

    blob_name = f"images/{uuid.uuid4()}.png"
    blob = bucket.blob(blob_name)
    blob.upload_from_string(image_bytes, content_type="image/png")

    url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(days=7),
        method="GET",
        credentials=credentials,
    )
    return url
