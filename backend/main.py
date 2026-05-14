from __future__ import annotations

import os
import json
import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Literal, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

# ── Environment ──────────────────────────────────────────────────────────────
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "x-ai/grok-4.3")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "http://localhost:8000")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "Prompt Power AI")
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "prompt_power_ai")

# ── In-memory fallback ───────────────────────────────────────────────────────
_memory_projects: List[dict] = []

class _MemoryCursor:
    def __init__(self, docs: List[dict]):
        self.docs = docs
    def sort(self, key: str, direction: int):
        rev = direction == -1
        self.docs = sorted(self.docs, key=lambda x: x.get(key, ""), reverse=rev)
        return self
    def limit(self, n: int):
        self.docs = self.docs[:n]
        return self
    async def to_list(self, length: int):
        return self.docs

class _MemoryCollection:
    async def insert_one(self, doc):
        _memory_projects.append(doc)
        class R:
            inserted_id = doc.get("id")
        return R()
    def find(self, filter, projection=None):
        results = [p.copy() for p in _memory_projects if all(p.get(k) == v for k, v in filter.items())]
        return _MemoryCursor(results)
    async def delete_one(self, filter):
        global _memory_projects
        before = len(_memory_projects)
        _memory_projects = [p for p in _memory_projects if not all(p.get(k) == v for k, v in filter.items())]
        class R:
            deleted_count = before - len(_memory_projects)
        return R()
    async def delete_many(self, filter):
        global _memory_projects
        class R:
            deleted_count = len(_memory_projects)
        _memory_projects.clear()
        return R()

class _MemoryDB:
    def __init__(self):
        self._collections: dict[str, _MemoryCollection] = {}

    def __getitem__(self, name: str):
        if name not in self._collections:
            self._collections[name] = _MemoryCollection()
        return self._collections[name]

# ── MongoDB client lifecycle ─────────────────────────────────────────────────
mongo_client: AsyncIOMotorClient | None = None
memory_db = _MemoryDB()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global mongo_client
    if MONGO_URL == "memory://":
        mongo_client = None
    else:
        mongo_client = AsyncIOMotorClient(MONGO_URL)
    yield
    if mongo_client:
        mongo_client.close()


app = FastAPI(title="Prompt Power AI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic models ──────────────────────────────────────────────────────────

StyleLiteral = Literal["cinematic", "documentary", "commercial", "music video"]
RatioLiteral = Literal["9:16", "16:9", "1:1"]
MoodLiteral = Literal["drammatico", "energico", "calmo", "epico"]


class GenerateScenesRequest(BaseModel):
    idea: str = Field(..., min_length=1)
    style: StyleLiteral
    aspect_ratio: RatioLiteral
    mood: MoodLiteral
    num_scenes: int = Field(..., ge=1, le=6)
    duration_per_scene: int = Field(..., ge=3, le=15)


class Scene(BaseModel):
    scene_number: int
    duration: int
    title: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    transition: str = Field(..., min_length=1)


class GeneratedStoryboard(BaseModel):
    master_prompt: str = Field(..., min_length=1)
    scenes: List[Scene]


class Project(BaseModel):
    id: str
    idea: str
    style: str
    aspect_ratio: str
    mood: str
    num_scenes: int
    duration_per_scene: int
    total_duration: int
    scenes: List[Scene]
    master_prompt: str
    created_at: str


class OkResponse(BaseModel):
    ok: bool


# ── Helpers ──────────────────────────────────────────────────────────────────

def db():
    if MONGO_URL == "memory://":
        return memory_db
    if mongo_client is None:
        raise HTTPException(status_code=503, detail="MongoDB non disponibile")
    return mongo_client[DB_NAME]


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


async def generate_seedance_storyboard(request: GenerateScenesRequest) -> GeneratedStoryboard:
    if not OPENROUTER_API_KEY or OPENROUTER_API_KEY == "mock":
        # ── Mock mode: deterministic realistic storyboard for quick testing ──
        scenes: List[Scene] = []
        for i in range(1, request.num_scenes + 1):
            is_last = i == request.num_scenes
            title_words = ["Wide reveal", "Close drift", "Pan across", "Tracking shot", "Static frame", "Push in"]
            title = f"{title_words[(i - 1) % len(title_words)]} scene {i}"
            prompt = (
                f"Photorealistic 8k {request.style} shot on 35mm lens. "
                f"{request.mood} mood, {request.aspect_ratio} aspect ratio. "
                f"A physically detailed subject performs a concrete action within a richly described environment. "
                f"Dynamic camera movement with precise shot size. "
                f"Cinematic lighting: strong key light from the left, soft fill, subtle rim on the shoulders. "
                f"Color temperature balanced between warm tungsten and cool daylight. "
                f"RAW footage look, shallow DoF, natural motion blur, natural skin texture. "
                f"Audio cue: subtle atmospheric tone building tension. "
                f"Scene {i} of {request.num_scenes}, fully self-contained, no references to other clips. "
                f"Optimized for ByteDance Seedance 2.0 video generation in {request.duration_per_scene} seconds."
            )
            scenes.append(
                Scene(
                    scene_number=i,
                    duration=request.duration_per_scene,
                    title=title,
                    prompt=prompt,
                    transition="end" if is_last else "hard cut to next independent frame",
                )
            )
        master = (
            f"Master prompt for '{request.idea}' — {request.style} style, {request.mood} mood, "
            f"{request.aspect_ratio}, {request.num_scenes} scenes × {request.duration_per_scene}s. "
            "Each scene is a self-contained Seedance 2.0 generation with cinematic lighting, 35mm lens, 8k photorealism, and no inter-scene references."
        )
        return GeneratedStoryboard(master_prompt=master, scenes=scenes)

    client = AsyncOpenAI(
        api_key=OPENROUTER_API_KEY,
        base_url=OPENROUTER_BASE_URL,
        default_headers={
            "HTTP-Referer": OPENROUTER_SITE_URL,
            "X-OpenRouter-Title": OPENROUTER_APP_NAME,
        },
    )

    system_prompt = (
        "You are an expert video prompt engineer specialized in ByteDance Seedance 2.0.\n\n"
        "You create self-contained video generation prompts.\n\n"
        "Critical constraint:\n"
        "Each Seedance 2.0 clip is a separate generation and lasts a maximum of 15 seconds.\n"
        "Every scene prompt must be fully independent and must not reference any previous or next scene.\n\n"
        "Return only valid JSON.\n"
        "Do not use markdown.\n"
        "Do not add explanations.\n"
        "Do not wrap JSON in code fences.\n\n"
        "Each scene prompt must be in English and between 60 and 130 words.\n"
        "The user idea can be in any language.\n"
        "Preserve the user's creative intent while making the video prompts production-ready.\n\n"
        "Each scene prompt must include:\n"
        "- concrete physical subject details\n"
        "- environment / setting\n"
        "- action verbs that fit within the given duration\n"
        "- camera movement\n"
        "- shot size\n"
        "- lens choice: 24mm, 35mm, 50mm, 85mm, or macro\n"
        "- lighting details including key/fill/rim or equivalent\n"
        "- color temperature\n"
        "- realism boosters: photorealistic, 8k, RAW footage, shallow DoF, motion blur, natural skin texture\n"
        "- brief audio cue\n\n"
        "Avoid all inter-scene references such as:\n"
        "as before, previous scene, continues, same character, next shot, previously, as seen earlier.\n\n"
        "The last scene transition must be exactly \"end\".\n"
    )

    total_duration = request.num_scenes * request.duration_per_scene

    user_prompt = (
        f"User idea: {request.idea}\n"
        f"Style: {request.style}\n"
        f"Aspect ratio: {request.aspect_ratio}\n"
        f"Mood: {request.mood}\n"
        f"Number of scenes: {request.num_scenes}\n"
        f"Duration per scene: {request.duration_per_scene} seconds\n"
        f"Total duration: {total_duration} seconds\n\n"
        "Return strict JSON matching this schema:\n"
        '{\n'
        '  "master_prompt": "string",\n'
        '  "scenes": [\n'
        '    {\n'
        '      "scene_number": 1,\n'
        '      "duration": 5,\n'
        '      "title": "3-6 words",\n'
        '      "prompt": "60-130 words in English",\n'
        '      "transition": "description or end"\n'
        '    }\n'
        '  ]\n'
        '}\n'
    )

    try:
        response = await client.chat.completions.create(
            model=OPENROUTER_MODEL,
            temperature=0.4,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Errore OpenRouter: {exc}")

    raw_content = response.choices[0].message.content
    if not raw_content:
        raise HTTPException(status_code=502, detail="Risposta vuota da OpenRouter")

    # Strip possible markdown fences
    cleaned = raw_content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"JSON non valido dal modello: {exc}")

    try:
        storyboard = GeneratedStoryboard(**data)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Validazione output fallita: {exc}")

    # Force durations and ensure scene count / end transition
    if len(storyboard.scenes) != request.num_scenes:
        raise HTTPException(
            status_code=502,
            detail=f"Numero scene mismatch: attese {request.num_scenes}, ricevute {len(storyboard.scenes)}",
        )

    for idx, scene in enumerate(storyboard.scenes):
        scene.duration = request.duration_per_scene
        if idx == len(storyboard.scenes) - 1:
            scene.transition = "end"

    return storyboard


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/generate-scenes", response_model=Project)
async def generate_scenes(payload: GenerateScenesRequest):
    storyboard = await generate_seedance_storyboard(payload)

    total_duration = payload.num_scenes * payload.duration_per_scene
    project_id = str(uuid.uuid4())
    created_at = now_iso()

    doc = {
        "id": project_id,
        "idea": payload.idea,
        "style": payload.style,
        "aspect_ratio": payload.aspect_ratio,
        "mood": payload.mood,
        "num_scenes": payload.num_scenes,
        "duration_per_scene": payload.duration_per_scene,
        "total_duration": total_duration,
        "scenes": [s.model_dump() for s in storyboard.scenes],
        "master_prompt": storyboard.master_prompt,
        "created_at": created_at,
    }

    try:
        await db()["projects"].insert_one(doc)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Errore MongoDB: {exc}")

    # Remove Mongo _id if present (shouldn't be because we use custom id field)
    doc.pop("_id", None)
    return doc


@app.get("/api/projects", response_model=List[Project])
async def list_projects():
    try:
        cursor = db()["projects"].find({}, {"_id": 0}).sort("created_at", -1).limit(100)
        docs = await cursor.to_list(length=100)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Errore MongoDB: {exc}")
    return docs


@app.delete("/api/projects/{project_id}", response_model=OkResponse)
async def delete_project(project_id: str):
    try:
        result = await db()["projects"].delete_one({"id": project_id})
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Errore MongoDB: {exc}")
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    return {"ok": True}


# ── Static frontend (web export) ─────────────────────────────────────────────
from pathlib import Path as _Path
_dist_path = str((_Path(__file__).resolve().parent / ".." / "frontend" / "dist").resolve())
if _os.path.isdir(_dist_path):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=_dist_path, html=True), name="static")

@app.get("/api/debug")
async def debug_paths():
    return {
        "cwd": _os.getcwd(),
        "file": __file__,
        "dist_path": _dist_path,
        "dist_exists": _os.path.isdir(_dist_path),
        "parent_listing": _os.listdir(str(_Path(__file__).resolve().parent / "..")) if _os.path.isdir(str(_Path(__file__).resolve().parent / "..")) else None,
    }


@app.delete("/api/projects", response_model=OkResponse)
async def clear_projects():
    try:
        await db()["projects"].delete_many({})
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Errore MongoDB: {exc}")
    return {"ok": True}
