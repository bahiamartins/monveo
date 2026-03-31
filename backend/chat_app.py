from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import re

from google.oauth2 import service_account
from google import genai
from google.genai import types

try:
    from . import firestore as fs
    from . import file_processor
except ImportError:
    import firestore as fs
    import file_processor

try:
    from . import image_agent as image_agent
except ImportError:
    try:
        import image_agent as image_agent
    except ImportError:
        image_agent = None  # type: ignore[assignment]

try:
    from . import storage_utils
except ImportError:
    try:
        import storage_utils
    except ImportError:
        storage_utils = None  # type: ignore[assignment]

app = Flask(__name__)
CORS(app)

GOOGLE_APPLICATION_CREDENTIALS = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "google_auth.json")
CREDENTIALS = service_account.Credentials.from_service_account_file(
    GOOGLE_APPLICATION_CREDENTIALS
)
def _read_project_id() -> str:
    import json
    try:
        with open(GOOGLE_APPLICATION_CREDENTIALS) as f:
            return json.load(f).get("project_id", "jc-vertex")
    except Exception:
        return "jc-vertex"
        
PROJECT_ID = _read_project_id()
LOCATION = "us-central1"
GEMINI_MODEL = "gemini-2.5-pro"

_IMAGE_VERBS = re.compile(
    r"\b(ger[ae]|gerar|gerou|cri[ae]|criar|criou|fa[zç]|fa[cç]a|fazer|fez|"
    r"mont[ae]|montar|montou|produz[ai]|produzir|produziu|"
    r"desenh[ae]|desenhar|desenhou|desenvolv[ae]|desenvolver|"
    r"preciso|quero|pode|gostaria|solicito|solicitar|"
    r"generate|create|make|draw|build)\b",
    re.IGNORECASE,
)

_IMAGE_NOUNS = re.compile(
    r"\b(imagens?|infogr[aá]ficos?|banners?|ilustra[cç][oõ]es?|ilustra[cç][aã]o|"
    r"fotos?|fotografias?|figuras?|artes?|visuais?|gr[aá]ficos?|"
    r"posters?|p[oô]steres?|thumbnails?|capas?|designs?|diagramas?|"
    r"imagem|infographic)\b",
    re.IGNORECASE,
)


def _wants_image(text: str) -> bool:
    """Return True when the message asks for image/infographic generation."""
    return bool(_IMAGE_VERBS.search(text) and _IMAGE_NOUNS.search(text))

IMAGE_PROMPT_EXTRACTOR = (
    "You are an expert image prompt writer for Imagen (Google's image generation model).\n"
    "Based on the user request below, write a detailed image generation prompt in English.\n\n"
    "CRITICAL RULES:\n"
    "1. The prompt must be written in English (Imagen understands English best).\n"
    "2. BUT any text labels, headings, titles or captions that should APPEAR INSIDE the image "
    "must be written in Brazilian Portuguese. List them explicitly in the prompt, e.g.: "
    "\"with the heading 'SEO On-Page' written in large bold text\" or "
    "\"labeled 'Palavras-chave', 'Meta Descrição', 'Link Interno'\".\n"
    "3. Style: clean infographic or editorial illustration, professional, high contrast, "
    "clear readable typography, flat design or modern gradient, white or light background.\n"
    "4. Include specific Portuguese text elements relevant to the topic so the image is "
    "immediately useful for a Brazilian audience.\n"
    "5. Return ONLY the image prompt, nothing else.\n\n"
    "User request: "
)

def _extract_text(response) -> str:
    """Extract text from a google.genai GenerateContentResponse."""
    t = getattr(response, "text", None)
    if t:
        return t

    try:
        parts = response.candidates[0].content.parts
        joined = "".join(
            p.text
            for p in parts
            if getattr(p, "text", None)
            and not (getattr(p, "thought", None) is True)
        )
        if joined:
            return joined
    except Exception:
        pass

    return "(no text generated)"


SEO_SYSTEM_PROMPT = (
    "Você é um especialista em SEO e marketing de conteúdo digital. "
    "Suas respostas devem ser claras, estruturadas e otimizadas para uso em WordPress ou Word. "
    "Use headings (H1, H2, H3), listas, negrito e formatação markdown quando aplicável. "
    "Sempre que possível, inclua dicas de SEO on-page, palavras-chave relevantes e meta descrições. "
    "Responda sempre em português do Brasil, com linguagem profissional e orientada a resultados."
    "A resposta deve ser em formato markdown para poder ser copiada e colada em sistemas como wordpress ou word."
    "Pergunte ao usuário se ele deseja gerar uma imagem conforme este contexto para ficar em destaque no post\n\n"
)

try:
    genai_client = genai.Client(
        vertexai=True,
        project=PROJECT_ID,
        location=LOCATION,
        credentials=CREDENTIALS,
    )
    print("✅ Authentication successful!")
    print(f"Project: {PROJECT_ID}, Database: mktjob")
    print(f"Gemini client ready (model={GEMINI_MODEL}).")
except Exception as e:
    print(f"❌ Authentication failed: {e}")
    genai_client = None


IMAGE_MIME_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "gif": "image/gif",
}


@app.route("/api/upload", methods=["POST"])
def upload_file():
    import base64 as _b64
    if "file" not in request.files:
        return jsonify({"error": "nenhum arquivo enviado"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "nome de arquivo vazio"}), 400

    raw = f.read()
    if len(raw) > 15 * 1024 * 1024:
        return jsonify({"error": "Arquivo muito grande (máximo 15 MB)"}), 413

    ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""

    # Upload original file to GCS for archival (best-effort, never blocks the response)
    file_url: str | None = None
    if storage_utils:
        try:
            mime = IMAGE_MIME_TYPES.get(ext, "application/octet-stream")
            file_url = storage_utils.upload_attachment(raw, f.filename, mime)
        except Exception as exc:
            import traceback; traceback.print_exc()
            print(f"⚠️ Attachment upload to GCS skipped: {exc}")

    # Images — return base64 for multimodal Gemini call
    if ext in IMAGE_MIME_TYPES:
        return jsonify({
            "type": "image",
            "b64": _b64.b64encode(raw).decode("utf-8"),
            "mime_type": IMAGE_MIME_TYPES[ext],
            "filename": f.filename,
            "file_url": file_url,
        })

    # All other files — extract text
    try:
        content = file_processor.extract_text(raw, f.filename)
        return jsonify({"type": "text", "content": content, "filename": f.filename, "file_url": file_url})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Erro ao processar arquivo: {e}"}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    import base64 as _b64

    payload = request.get_json(silent=True) or {}
    prompt = payload.get("prompt", "")
    session_id = payload.get("session_id")
    title = payload.get("title")
    file_context = payload.get("file_context", "").strip()
    file_image_b64 = payload.get("file_image_b64", "").strip()
    file_image_mime = payload.get("file_image_mime", "image/jpeg")
    filename_hint = payload.get("file_name", "arquivo")
    file_url = payload.get("file_url", "")  # GCS signed URL of the original attachment

    if not prompt:
        return jsonify({"error": "no prompt provided"}), 400

    if not genai_client:
        return jsonify({"error": "model not initialized"}), 500

    original_prompt = prompt

    # Prepend text file content as labelled context block
    if file_context:
        prompt = (
            f"[Conteúdo do arquivo: {filename_hint}]\n"
            f"{file_context}\n\n"
            f"[Pergunta do usuário sobre o arquivo acima]\n"
            f"{prompt}"
        )

    memory = None
    if session_id:
        try:
            from .chat_memory import ChatMemory
        except ImportError:
            from chat_memory import ChatMemory
        memory = ChatMemory(session_id)

        # set title on first message if provided and doc doesn't exist yet
        if title:
            existing = memory.doc_ref.get()
            if not existing.exists:
                memory.doc_ref.set({"title": title}, merge=True)

        history_objs = memory.get_history()
        if history_objs and isinstance(history_objs[0], dict):
            ctx = "\n".join([f"{m['role']}: {m['text']}" for m in history_objs[-15:]])
            prompt = ctx + "\n" + prompt
        else:
            try:
                prompt_texts = [p.parts[0].text for p in history_objs[-15:]]
                prompt = "\n".join(prompt_texts) + "\n" + prompt
            except Exception:
                pass

    full_prompt = SEO_SYSTEM_PROMPT + prompt

    # Build content — add image part if present (multimodal)
    if file_image_b64:
        image_bytes = _b64.b64decode(file_image_b64)
        contents = [
            types.Part.from_text(text=full_prompt),
            types.Part.from_bytes(data=image_bytes, mime_type=file_image_mime),
        ]
    else:
        contents = full_prompt

    response = genai_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
    )

    text = _extract_text(response)

    # --- image generation ---
    image_url = None
    if image_agent and _wants_image(original_prompt):
        try:
            # Ask Gemini to produce a clean English image prompt
            img_prompt_response = genai_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=IMAGE_PROMPT_EXTRACTOR + original_prompt,
            )
            img_prompt = _extract_text(img_prompt_response).strip() or original_prompt
            image_url = image_agent.generate_and_store(img_prompt)
        except Exception as e:
            import traceback
            print(f"⚠️ Image generation error: {e}")
            traceback.print_exc()
            text += f"\n\n_(Erro ao gerar imagem: {e})_"

    if memory:
        try:
            saved_text = text
            if image_url:
                saved_text += f"\n\n![imagem gerada]({image_url})"
            # Build user message — append attachment reference when present
            user_saved = original_prompt
            if file_url:
                user_saved += f"\n\n[📎 {filename_hint}]({file_url})"
            memory.save_message("user", user_saved)
            memory.save_message("assistant", saved_text)
        except Exception:
            pass

    result = {"response": text}
    if image_url:
        result["image_url"] = image_url
    return jsonify(result)


# --- session management routes ---

@app.route("/api/sessions", methods=["GET"])
def list_sessions():
    try:
        sessions = fs.list_sessions()
        return jsonify({"sessions": sessions})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sessions/<session_id>", methods=["GET"])
def get_session(session_id):
    try:
        data = fs.get_session_messages(session_id)
        if not data:
            return jsonify({"error": "session not found"}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sessions/<session_id>/title", methods=["PATCH"])
def rename_session(session_id):
    payload = request.get_json(silent=True) or {}
    title = payload.get("title", "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400
    try:
        fs.update_session_title(session_id, title)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sessions/<session_id>/messages/<int:msg_index>", methods=["DELETE"])
def delete_message(session_id, msg_index):
    try:
        ok = fs.delete_session_message(session_id, msg_index)
        if not ok:
            return jsonify({"error": "message not found"}), 404
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sessions/<session_id>", methods=["DELETE"])
def delete_session(session_id):
    try:
        fs.delete_session(session_id)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- legacy history routes (kept for backward compat) ---

@app.route("/api/history/save", methods=["POST"])
def save_history():
    payload = request.get_json(silent=True) or {}
    title = payload.get("title")
    description = payload.get("description", "")
    entries = payload.get("entries", [])
    if not title:
        return jsonify({"error": "title required"}), 400
    if isinstance(entries, list):
        entries = entries[-15:]
    try:
        fs.save_history(title, description, entries)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/history/list", methods=["GET"])
def list_histories():
    try:
        docs = fs.list_histories()
        return jsonify({"histories": docs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/history/get", methods=["GET"])
def get_history():
    title = request.args.get("title")
    if not title:
        return jsonify({"error": "title required"}), 400
    try:
        doc = fs.get_history(title)
        if not doc:
            return jsonify({"error": "not found"}), 404
        return jsonify({"history": doc})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
