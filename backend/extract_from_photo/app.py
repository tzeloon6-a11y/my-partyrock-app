"""
SmartMed Cycle — Extract from Photo
Streaming Bedrock Lambda (Flask + Lambda Web Adapter).

Extracts medicine label details from an uploaded photo so the patient can
copy the values into the Section 1 input fields.
"""
import json
import os

import boto3
from flask import Flask, Response, request, stream_with_context

app = Flask(__name__)

AWS_REGION = os.environ.get("AWS_REGION", "ap-southeast-5")
MODEL_ID = "global.anthropic.claude-haiku-4-5-20251001-v1:0"
ANTHROPIC_VERSION = "bedrock-2023-05-31"

bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)

SYSTEM_PROMPT = """You are a clinical pharmacist assistant. A patient has uploaded a photo or scan of a medicine label. Extract the details and display them field by field so the patient can type each value into the matching input box below.

RULES:
- Extract only what is explicitly and clearly visible on the label. Do not infer or calculate missing fields.
- If a field is not visible or not readable, write: Not readable
- Do not identify unlabelled pills from appearance. If no readable label is visible, write: No readable label found — please fill in the fields manually.
- Do not diagnose, prescribe, or recommend dose changes.
- If no photo is uploaded, write: No photo uploaded yet. Upload a photo on the left to extract label details.

Output the extracted details in this exact format:

---
📋 **Extracted from photo — type each value into the matching field below:**

**Medicine name and strength:**
**Amount each time:**
**How often:**
**Other label instructions:**
**Start date and duration:**
**Quantity supplied and expiry:**

---
⚠️ Always compare with your actual label before typing values in."""

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
}


def build_content_blocks(data):
    """Build the Anthropic Messages API content blocks for the user turn.

    Prepends an image/document block when the request included an uploaded
    file (file_data = raw base64 string, file_mime = MIME type).
    """
    content = []
    file_data = data.get("file_data")
    file_mime = data.get("file_mime")

    if file_data and file_mime:
        if file_mime.startswith("image/"):
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": file_mime,
                        "data": file_data,
                    },
                }
            )
        else:
            content.append(
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": file_mime,
                        "data": file_data,
                    },
                }
            )
        text = "Extract the medicine label details from the uploaded photo above, following the system instructions."
    else:
        text = "No photo uploaded yet. Upload a photo on the left to extract label details."

    content.append({"type": "text", "text": text})
    return content


def generate(data):
    content = build_content_blocks(data)

    body = {
        "anthropic_version": ANTHROPIC_VERSION,
        "max_tokens": 1500,
        # Claude Haiku 4.5 on Bedrock rejects requests that set both
        # temperature and top_p (ValidationException) — use temperature only
        # for deterministic, low-variance output.
        "temperature": 0,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": content}],
    }

    try:
        resp = bedrock.invoke_model_with_response_stream(
            modelId=MODEL_ID,
            body=json.dumps(body),
        )
        for event in resp["body"]:
            chunk = event.get("chunk")
            if not chunk:
                continue
            payload = json.loads(chunk["bytes"])
            if payload.get("type") == "content_block_delta":
                delta = payload.get("delta", {})
                if delta.get("type") == "text_delta":
                    yield delta.get("text", "")
            elif payload.get("type") == "message_stop":
                break
    except Exception as exc:  # noqa: BLE001
        yield f"\n\n⚠️ Error contacting SmartMed AI: {exc}"


@app.route("/", methods=["POST"])
def extract_from_photo():
    try:
        data = request.get_json(silent=True) or {}
    except Exception:  # noqa: BLE001
        data = {}

    resp = Response(stream_with_context(generate(data)), content_type="text/plain; charset=utf-8")
    for k, v in CORS_HEADERS.items():
        resp.headers[k] = v
    return resp


@app.route("/", methods=["OPTIONS"])
def options():
    resp = Response("", status=200)
    for k, v in CORS_HEADERS.items():
        resp.headers[k] = v
    return resp


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
