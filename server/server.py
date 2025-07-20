from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from twelvelabs import TwelveLabs
from twelvelabs.models.task import Task
from dotenv import load_dotenv
import json
import time
import urllib.parse
from google import genai
from google.genai.types import GenerateContentConfig, Modality
from PIL import Image
from io import BytesIO
import base64

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])
load_dotenv()

client = None
try:
    client = TwelveLabs(api_key=os.getenv("TL_API_KEY"))
    print("Twelve Labs client initialized")
except Exception as e:
    print(f"Failed to initialize Twelve Labs client: {e}")

try:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in .env")
    print(f"Loaded GEMINI_API_KEY: {api_key[:5]}...{api_key[-5:]}")
    gemini_client = genai.Client(api_key=api_key)
    print("Gemini client initialized")
except Exception as e:
    print(f"Failed to initialize Gemini client: {e}")


INDEX_NAME = "FortniteVODs"
index_id = "687c96f2c5994cb471749ec0"
VIDEO_METADATA_FILE = "videos.json"
chat_histories = {}

def load_videos():
    try:
        with open(VIDEO_METADATA_FILE, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def save_videos(videos):
    with open(VIDEO_METADATA_FILE, "w") as f:
        json.dump(videos, f, indent=2)

@app.route("/api/upload", methods=["POST"])
def upload_video():
    try:
        print("Received upload request")
        if not index_id:
            print("No valid index_id")
            return jsonify({"error": "No valid index_id. Please verify the index ID in server.py and Twelve Labs dashboard."}), 500

        if "file" in request.files:
            video_file = request.files["file"]
            filename = urllib.parse.quote(video_file.filename)
            video_path = os.path.join("uploads", video_file.filename).replace("\\", "/")
            os.makedirs("uploads", exist_ok=True)
            video_file.save(video_path)
            print(f"Saved file: {video_path}")
            task = client.task.create(index_id=index_id, file=video_path)
        elif "url" in request.form:
            video_url = request.form["url"]
            print(f"Processing URL: {video_url}")
            task = client.task.create(index_id=index_id, url=video_url)
            video_path = video_url
            filename = video_url.split("/")[-1]
        else:
            print("No file or URL provided")
            return jsonify({"error": "No file or URL provided"}), 400

        def on_task_update(task: Task):
            print(f"Task {task.id} status: {task.status}")

        print(f"Created task: {task.id}")
        timeout = 600
        start_time = time.time()
        task.wait_for_done(sleep_interval=50, callback=on_task_update)
        if time.time() - start_time > timeout:
            print(f"Indexing timed out for task {task.id}")
            return jsonify({"error": f"Indexing timed out for task {task.id}. Video uploaded to Twelve Labs, please check dashboard."}), 504
        if task.status != "ready":
            print(f"Indexing failed with status {task.status}")
            return jsonify({"error": f"Indexing failed with status {task.status}. Ensure your video meets requirements (360p-4K, 4s-60min, <2GB, audio track)."}), 500

        print(f"Indexing complete, video_id: {task.video_id}")
        advice = {"good": [], "bad": [], "improve": []}
        try:
            prompt = (
                "Analyze this Fortnite gameplay video and provide detailed feedback in JSON format with keys 'good', 'bad', and 'improve', each containing a list of up to 5 strings. Focus on specific gameplay elements like aim, building, positioning, decision-making, and resource management. For 'bad' and 'improve', include specific timestamps (e.g., '0:45') where the issue or improvement opportunity occurred. Ensure feedback is precise and tied to specific moments in the video. Example:\n"
                "{\n"
                "  \"good\": [\"Accurate aim on headshots at 0:30\", \"Effective building during combat at 1:15\", \"Good positioning on high ground at 2:00\"],\n"
                "  \"bad\": [\"Missed shots during exchange at 0:45\", \"Poor positioning in storm at 1:30\"],\n"
                "  \"improve\": [\"Practice quicker building at 1:15 to minimize exposure\", \"Improve situational awareness at 0:45 to avoid ambushes\"]\n"
                "}\n"
                "Ensure the response is a valid JSON object."
            )
            res = client.analyze(video_id=task.video_id, prompt=prompt)
            if hasattr(res, "data"):
                if isinstance(res.data, dict):
                    advice = res.data
                elif isinstance(res.data, str):
                    try:
                        advice = json.loads(res.data)
                    except json.JSONDecodeError:
                        print(f"Non-JSON response: {res.data}")
                        lines = res.data.split('\n')
                        for line in lines:
                            line = line.strip()
                            if line.startswith("Good:") or line.startswith("- Good:"):
                                advice["good"].append(line.replace("Good:", "").replace("- Good:", "").strip())
                            elif line.startswith("Bad:") or line.startswith("- Bad:"):
                                advice["bad"].append(line.replace("Bad:", "").replace("- Bad:", "").strip())
                            elif line.startswith("Improve:") or line.startswith("- Improve:"):
                                advice["improve"].append(line.replace("Improve:", "").replace("- Improve:", "").strip())
            print(f"Generated advice: {advice}")
        except Exception as e:
            print(f"Failed to generate advice: {e}")
            advice = {
                "good": ["Analysis failed, unable to evaluate gameplay"],
                "bad": ["Analysis failed, unable to evaluate gameplay"],
                "improve": ["Check video requirements (360p-4K, 4s-60min, <2GB, audio) and try again"]
            }

        try:
            summary = client.summarize(video_id=task.video_id, type="summary").summary
            print(f"Generated summary: {summary}")
        except Exception as e:
            print(f"Failed to generate summary: {e}")
            summary = "Summary generation failed"

        chapters = []
        try:
            chapters = [
                {
                    "chapter_number": c.chapter_number,
                    "chapter_title": c.chapter_title,
                    "chapter_summary": c.chapter_summary,
                    "start": c.start,
                    "end": c.end
                } for c in client.summarize(video_id=task.video_id, type="chapter").chapters
            ]
            print(f"Generated chapters: {len(chapters)}")
        except Exception as e:
            print(f"Failed to generate chapters: {e}")

        # Generate thumbnail with Gemini 2.0 Flash
        thumbnail_url = None
        try:
            # model = gemini_client.models.get("gemini-2.0-flash-preview-image-generation")
            response = gemini_client.models.generate_content(
                model="gemini-2.0-flash-preview-image-generation",
                contents=(
                    f"Generate an image for a Fortnite gameplay video thumbnail with the summary: '{summary}'. "
                    "Include vibrant colors (#178FDB to #6AE2FD gradient background), SypherPK's Icon Series skin or Chun-Li, "
                    "and elements like weapons, builds, or loot chests. Make it dynamic, action-packed, with a bold Fortnite aesthetic "
                    "using 'Luckiest Guy' font style for any text. Ensure the output is an image (400x400 pixels)."
                ),
                config=GenerateContentConfig(response_modalities=[Modality.TEXT, Modality.IMAGE])
            )
            for part in response.candidates[0].content.parts:
                if hasattr(part, "text") and part.text:
                    print(f"Gemini response text: {part.text}")
                elif hasattr(part, "inline_data") and part.inline_data:
                    image_data = base64.b64decode(part.inline_data.data)
                    image = Image.open(BytesIO(image_data))
                    image = image.resize((400, 400), Image.Resampling.LANCZOS)
                    thumbnail_path = f"uploads/thumbnail_{video_id}.png"
                    image.save(thumbnail_path, "PNG")
                    thumbnail_url = f"http://localhost:5000/{thumbnail_path}"
                    print(f"Generated thumbnail: {thumbnail_url}")
                    break
        except Exception as e:
            print(f"Failed to generate thumbnail1: {e}")

        videos = load_videos()
        video_metadata = {
            "video_id": task.video_id,
            "filename": filename,
            "video_path": video_path,
            "summary": summary,
            "chapters": chapters,
            "advice": advice,
            "thumbnail_url": thumbnail_url or "http://localhost:5173/placeholder.png"
        }
        videos.append(video_metadata)
        save_videos(videos)
        print(f"Saved metadata to videos.json")

        # Initialize chat history for this video
        chat_histories[task.video_id] = []

        return jsonify({
            "video_id": task.video_id,
            "video_path": video_path,
            "advice": advice,
            "chapters": chapters,
            "summary": summary,
            "thumbnail_url": thumbnail_url or "http://localhost:5173/placeholder.png"
        })

    except Exception as e:
        print(f"Error in upload_video: {str(e)}")
        return jsonify({"error": f"{str(e)}. Ensure your video meets requirements (360p-4K, 4s-60min, <2GB, audio track)."}), 500

@app.route("/api/videos", methods=["GET"])
def get_videos():
    try:
        print("Fetching videos")
        videos = load_videos()
        # Sync with Twelve Labs index
        try:
            index_videos = client.index.video.list(index_id=index_id)
            for video in index_videos:
                if not any(v["video_id"] == video.id for v in videos):
                    summary = "Summary not generated"
                    try:
                        summary = client.summarize(video_id=video.id, type="summary").summary
                    except Exception as e:
                        print(f"Failed to generate summary for video {video.id}: {e}")
                    # Generate thumbnail for new videos
                    thumbnail_url = None
                    try:
                        # model = gemini_client.models.get("gemini-2.0-flash-preview-image-generation")
                        response = gemini_client.models.generate_content(
                            model="gemini-2.0-flash-preview-image-generation",
                            contents=(
                                f"Generate an image for a Fortnite gameplay video thumbnail with the summary: '{summary}'. "
                                "Include vibrant colors (#178FDB to #6AE2FD gradient background), SypherPK's Icon Series skin or Chun-Li, "
                                "and elements like weapons, builds, or loot chests. Make it dynamic, action-packed, with a bold Fortnite aesthetic "
                                "using 'Luckiest Guy' font style for any text. Ensure the output is an image (400x400 pixels)."
                            ),
                            config=GenerateContentConfig(response_modalities=[Modality.TEXT, Modality.IMAGE])
                        )
                        for part in response.candidates[0].content.parts:
                            if hasattr(part, "text") and part.text:
                                print(f"Gemini response text: {part.text}")
                            elif hasattr(part, "inline_data") and part.inline_data:
                                image_data = base64.b64decode(part.inline_data.data)
                                image = Image.open(BytesIO(image_data))
                                image = image.resize((400, 400), Image.Resampling.LANCZOS)
                                thumbnail_path = f"uploads/thumbnail_{video_id}.png"
                                image.save(thumbnail_path, "PNG")
                                thumbnail_url = f"http://localhost:5000/{thumbnail_path}"
                                print(f"Generated thumbnail: {thumbnail_url}")
                                break
                    except Exception as e:
                        print(f"Failed to generate thumbnail for video {video.id}: {e}")
                    videos.append({
                        "video_id": video.id,
                        "filename": video.metadata.filename if video.metadata else "Unknown",
                        "video_path": video.source_url if video.source_url else f"uploads/{video.metadata.filename if video.metadata else video.id}",
                        "summary": summary,
                        "chapters": [],
                        "advice": {"good": [], "bad": [], "improve": []},
                        "thumbnail_url": thumbnail_url or "http://localhost:5173/placeholder.png"
                    })
            save_videos(videos)
        except Exception as e:
            print(f"Failed to fetch videos from Twelve Labs: {e}")
        return jsonify(videos)
    except Exception as e:
        print(f"Error in get_videos: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/uploads/<path:filename>", methods=["GET"])
def serve_video(filename):
    print(f"Serving video: {filename}")
    return send_from_directory("uploads", filename)

@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        video_id = data.get("video_id")
        message = data.get("message")
        summary = data.get("summary")

        if not video_id or not message or not summary:
            print("Missing video_id, message, or summary")
            return jsonify({"error": "Missing video_id, message, or summary"}), 400

        if not client:
            print("Twelve Labs client not initialized")
            return jsonify({"error": "Twelve Labs client not initialized"}), 500

        # Initialize chat history if not exists
        if video_id not in chat_histories:
            chat_histories[video_id] = []

        # Prepare SypherPK persona prompt
        prompt = (
            "You are SypherPK (Ali Hassan), a Fortnite YouTuber and streamer known for being an educational entertainer, entrepreneur, and community builder. You teach Fortnite strategies (building, editing, aiming) in an insightful and entertaining way, breaking down complex gameplay into easy lessons. You're authentic, relatable, and self-aware, often joking about your 'crooked fingers,' snacking on stream, and your dogs Aegon, Aiko, and Yuna. You're obsessed with the Chun-Li Fortnite skin, and fans love memeing about it, saying you love Chun-Li more than your wife and pushing your creator code 'SypherPK' for Chun-Li. You're the founder of Oni Studios, supporting Fortnite Creative content. Respond to the following question about this Fortnite clip with the summary: '{summary}'. Use casual language like 'bro,' 'nasty clip' for good plays, 'yo what are we doing' for bad plays, and reference your traits (e.g., Chun-Li, dogs, snacking). Keep responses concise, strategic, and fun, like you're coaching a fan. Use the video's indexed data to provide specific advice tied to gameplay moments with timestamps where possible. Previous chat history: {chat_history}\n\nQuestion: {message}"
        ).format(
            summary=summary,
            chat_history=json.dumps(chat_histories[video_id]),
            message=message
        )

        # Call Twelve Labs analyze
        response = client.analyze(video_id=video_id, prompt=prompt)
        ai_response = response.data if hasattr(response, "data") else "Sorry, bro, couldn't analyze that. Try again!"

        if isinstance(ai_response, dict):
            ai_response = json.dumps(ai_response)
        elif isinstance(ai_response, str):
            # Clean up if response is not conversational
            lines = ai_response.split('\n')
            cleaned_response = []
            for line in lines:
                line = line.strip()
                if line and not line.startswith(("#", "-", "*")):
                    cleaned_response.append(line)
            ai_response = " ".join(cleaned_response) if cleaned_response else "Yo, what are we doing? Couldn't get a good read on that clip!"

        # Store in chat history
        chat_histories[video_id].append({"user": message, "ai": ai_response})

        print(f"Chat response for video_id {video_id}: {ai_response}")
        return jsonify({"response": ai_response, "history": chat_histories[video_id]})

    except Exception as e:
        print(f"Error in chat: {str(e)}")
        return jsonify({"error": f"Chat error: {str(e)}"}), 500

@app.route("/api/generate-image", methods=["POST"])
def generate_image():
    try:
        data = request.get_json()
        video_id = data.get("video_id")
        summary = data.get("summary", "Fortnite gameplay")

        if not video_id:
            print("Missing video_id")
            return jsonify({"error": "Missing video_id"}), 400

        thumbnail_url = None
        try:
            # model = gemini_client.models.get("gemini-2.0-flash-preview-image-generation")
            response = gemini_client.models.generate_content(
                model="gemini-2.0-flash-preview-image-generation",
                contents=(
                    f"Generate an image for a Fortnite gameplay video thumbnail with the summary: '{summary}'. "
                    "Include vibrant colors (#178FDB to #6AE2FD gradient background), SypherPK's Icon Series skin or Chun-Li, "
                    "and elements like weapons, builds, or loot chests. Make it dynamic, action-packed, with a bold Fortnite aesthetic "
                    "using 'Luckiest Guy' font style for any text. Ensure the output is an image (400x400 pixels)."
                ),
                config=GenerateContentConfig(response_modalities=[Modality.TEXT, Modality.IMAGE])
            )
            for part in response.candidates[0].content.parts:
                if hasattr(part, "text") and part.text:
                    print(f"Gemini response text: {part.text}")
                elif hasattr(part, "inline_data") and part.inline_data:
                    image_data = base64.b64decode(part.inline_data.data)
                    image = Image.open(BytesIO(image_data))
                    image = image.resize((400, 400), Image.Resampling.LANCZOS)
                    thumbnail_path = f"uploads/thumbnail_{video_id}.png"
                    image.save(thumbnail_path, "PNG")
                    thumbnail_url = f"http://localhost:5000/{thumbnail_path}"
                    print(f"Generated thumbnail: {thumbnail_url}")
                    break
            if not thumbnail_url:
                raise ValueError("No image data in response")
        except Exception as e:
            print(f"Failed to generate thumbnail2: {str(e)}")
            thumbnail_url = "http://localhost:5173/placeholder.png"

        # Update videos.json
        videos = load_videos()
        for video in videos:
            if video["video_id"] == video_id:
                video["thumbnail_url"] = thumbnail_url
                break
        save_videos(videos)

        return jsonify({"image_url": thumbnail_url, "error": None if thumbnail_url != "http://localhost:5173/placeholder.png" else str(e)})

    except Exception as e:
        print(f"Error in generate_image: {str(e)}")
        return jsonify({"error": str(e), "image_url": "http://localhost:5173/placeholder.png"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)