from pathlib import Path
from typing import List
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import (
    create_profile,
    delete_profile,
    get_matches_for_profile,
    get_profile,
    get_profile_by_email,
    get_skills_catalog,
    init_db,
    list_profiles,
    update_profile,
)
from app.models import ProfilePayload, ProfileResponse

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(
    title="Bronet API",
    description="Minimalistyczna platforma wymiany umiejętności — jeden profil pomaga drugiemu.",
    version="1.1.0",
)


@app.on_event("startup")
def on_startup() -> None:
    init_db(seed=True)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/profiles", response_model=List[ProfileResponse])
def api_list_profiles(
    q: str = Query(default="", description="Szukana umiejętność lub imię"),
    mode: str = Query(default="all", description="all | can_help | need_help"),
) -> List[dict]:
    allowed_modes = {"all", "can_help", "need_help"}
    effective_mode = mode if mode in allowed_modes else "all"
    return list_profiles(query=q, mode=effective_mode)


@app.get("/api/profiles/by-email", response_model=ProfileResponse)
def api_get_profile_by_email(email: str = Query(..., min_length=3)) -> dict:
    profile = get_profile_by_email(email)
    if not profile:
        raise HTTPException(status_code=404, detail="Nie znaleziono profilu dla podanego adresu e-mail.")
    return profile


@app.post("/api/profiles", response_model=ProfileResponse, status_code=201)
def api_create_profile(payload: ProfilePayload) -> dict:
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Imię nie może być puste.")
    return create_profile(payload.dict())


@app.get("/api/profiles/{profile_id}", response_model=ProfileResponse)
def api_get_profile(profile_id: int) -> dict:
    profile = get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Nie znaleziono profilu.")
    return profile


@app.put("/api/profiles/{profile_id}", response_model=ProfileResponse)
def api_update_profile(profile_id: int, payload: ProfilePayload) -> dict:
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Imię nie może być puste.")
    updated = update_profile(profile_id, payload.dict())
    if not updated:
        raise HTTPException(status_code=404, detail="Nie znaleziono profilu.")
    return updated


@app.delete("/api/profiles/{profile_id}")
def api_delete_profile(profile_id: int) -> dict:
    deleted = delete_profile(profile_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Nie znaleziono profilu.")
    return {"deleted": True, "id": profile_id}


@app.get("/api/profiles/{profile_id}/matches")
def api_profile_matches(profile_id: int) -> dict:
    matches = get_matches_for_profile(profile_id)
    if not matches:
        raise HTTPException(status_code=404, detail="Nie znaleziono profilu.")
    return matches


@app.get("/api/skills")
def api_skills() -> dict:
    return get_skills_catalog()


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/manifest.json", include_in_schema=False)
def serve_manifest() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "manifest.json"))


@app.get("/", include_in_schema=False)
@app.get("/profil", include_in_schema=False)
@app.get("/profil/{profile_id}", include_in_schema=False)
def serve_spa(profile_id: str = "") -> FileResponse:
    return FileResponse(str(STATIC_DIR / "index.html"))
