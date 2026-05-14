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

app = FastAPI()

@app.get("/api/health")
def health():
    return {"status": "ok"}
