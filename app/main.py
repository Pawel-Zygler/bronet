import os
from pathlib import Path
from typing import List, Optional
from fastapi import Body, Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.economy_engine import economy_simulator

from app.database import (
    ADMIN_EMAIL,
    ProfileAuthError,
    ProfileValidationError,
    authenticate_profile_by_email,
    confirm_chlop_help,
    create_profile,
    delete_profile,
    get_chlopocoin_rankings,
    get_chlopocoin_stats,
    get_chlopocoin_status,
    get_global_chlopocoin_stats,
    get_matches_for_profile,
    get_profile,
    get_skills_catalog,
    init_db,
    is_admin_email,
    list_chat_messages,
    create_chat_message,
    create_direct_message,
    list_direct_messages,
    mark_direct_messages_as_read,
    list_user_conversations,
    clear_conversation_history,
    delete_single_direct_message,
    get_unread_dm_count,
    list_profiles,
    update_profile,
)
from app.models import (
    ChatMessagePayload,
    ChatMessageResponse,
    ConfirmHelpPayload,
    ConversationSummaryResponse,
    DeletePayload,
    DirectMessagePayload,
    DirectMessageResponse,
    LoginPayload,
    ProfilePayload,
    ProfileResponse,
    SimulatorConfigPayload,
)

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Bronet API",
    description="Minimalistyczna platforma wymiany umiejętności — jeden chłop pomaga drugiemu.",
    version="2.0.0",
)


@app.middleware("http")
async def revalidate_static_and_spa(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/static/assets/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif (
        path == "/"
        or path.startswith("/profil")
        or path.startswith("/dopasowania")
        or path.startswith("/chlopchain")
        or path.startswith("/rankingi")
        or path.startswith("/statystyki")
        or path.startswith("/static/")
    ):
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
    return response


@app.on_event("startup")
async def on_startup() -> None:
    init_db(seed=True)
    sim_enabled = os.environ.get("CHLOPCOIN_SIMULATOR_ENABLED", "true").lower() in ("1", "true", "yes")
    test_db = os.environ.get("BRONET_DB_PATH", "")
    if sim_enabled and "test" not in test_db.lower():
        await economy_simulator.start()


@app.on_event("shutdown")
def on_shutdown() -> None:
    economy_simulator.stop()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/profiles", response_model=List[ProfileResponse])
def api_list_profiles(
    q: str = Query(default="", description="Szukana umiejętność, imię lub e-mail"),
    mode: str = Query(default="all", description="all | can_help | need_help"),
) -> List[dict]:
    allowed_modes = {"all", "can_help", "need_help"}
    effective_mode = mode if mode in allowed_modes else "all"
    return list_profiles(query=q, mode=effective_mode)


@app.post("/api/profiles/login", response_model=ProfileResponse)
def api_login_profile(payload: LoginPayload) -> dict:
    try:
        profile = authenticate_profile_by_email(payload.email, payload.password or "")
    except ProfileAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    if not profile:
        raise HTTPException(status_code=404, detail="Nie znaleziono profilu dla podanego adresu e-mail.")
    return profile


@app.get("/api/profiles/by-email", response_model=ProfileResponse)
def api_get_profile_by_email(email: str = Query(..., min_length=3)) -> dict:
    try:
        profile = authenticate_profile_by_email(email, password="")
    except ProfileAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    if not profile:
        raise HTTPException(status_code=404, detail="Nie znaleziono profilu dla podanego adresu e-mail.")
    return profile


@app.post("/api/profiles", response_model=ProfileResponse, status_code=201)
def api_create_profile(payload: ProfilePayload) -> dict:
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Imię nie może być puste.")
    try:
        return create_profile(payload.dict())
    except ProfileValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ProfileAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


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
    try:
        updated = update_profile(profile_id, payload.dict())
    except ProfileValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ProfileAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    if not updated:
        raise HTTPException(status_code=404, detail="Nie znaleziono profilu.")
    return updated


@app.delete("/api/profiles/{profile_id}")
def api_delete_profile(
    profile_id: int,
    payload: Optional[DeletePayload] = Body(default=None),
    x_profile_password: Optional[str] = Header(default=""),
) -> dict:
    effective_password = (payload.password if payload and payload.password else None) or x_profile_password or ""
    try:
        deleted = delete_profile(profile_id, password=effective_password)
    except ProfileAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
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


@app.post("/api/profiles/{profile_id}/confirm-help")
def api_confirm_help(profile_id: int, payload: ConfirmHelpPayload) -> dict:
    try:
        return confirm_chlop_help(
            from_profile_id=profile_id,
            to_profile_id=payload.other_profile_id,
            password=payload.password or "",
        )
    except ProfileValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ProfileAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


@app.get("/api/profiles/{profile_id}/chlopocoin-status")
def api_chlopocoin_status(profile_id: int, other_id: int = Query(...)) -> dict:
    return get_chlopocoin_status(profile_id, other_id)


@app.get("/api/profiles/{profile_id}/chlopocoin-stats")
@app.get("/api/chlopocoin/stats/{profile_id}")
def api_chlopocoin_stats(profile_id: int) -> dict:
    prof = get_profile(profile_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Nie znaleziono profilu.")
    return get_chlopocoin_stats(profile_id)


@app.get("/api/chlopocoin/global-stats")
def api_global_chlopocoin_stats() -> dict:
    stats = get_global_chlopocoin_stats()
    stats["simulator"] = economy_simulator.get_status()
    return stats


def verify_admin_access(
    x_admin_email: Optional[str] = Header(None, alias="X-Admin-Email"),
    admin_email_query: Optional[str] = Query(None, alias="admin_email"),
) -> None:
    email = x_admin_email or admin_email_query
    if not is_admin_email(email):
        raise HTTPException(
            status_code=403,
            detail="Brak uprawnień. Tylko administrator (pawel.zygler@gmail.com) ma dostęp do kontrolek ekonomii.",
        )


@app.get("/api/chlopocoin/simulator/status")
def api_simulator_status() -> dict:
    return economy_simulator.get_status()


@app.post("/api/chlopocoin/simulator/tick", dependencies=[Depends(verify_admin_access)])
def api_simulator_tick(count: Optional[int] = Query(None, ge=1, le=50)) -> dict:
    return economy_simulator.tick(custom_count=count)


@app.post("/api/chlopocoin/simulator/config", dependencies=[Depends(verify_admin_access)])
async def api_simulator_config(payload: SimulatorConfigPayload) -> dict:
    return await economy_simulator.update_config(
        min_tps=payload.min_tps,
        max_tps=payload.max_tps,
        interval_seconds=payload.interval_seconds,
        daily_pool_pct=payload.daily_pool_pct,
        profiles_per_hour=payload.profiles_per_hour,
        is_running=payload.is_running,
    )


@app.post("/api/chlopocoin/simulator/generate-profile", dependencies=[Depends(verify_admin_access)])
def api_generate_profile() -> dict:
    return economy_simulator.generate_profile()


@app.post("/api/chlopocoin/simulator/reset-cycle", dependencies=[Depends(verify_admin_access)])
def api_simulator_reset_cycle() -> dict:
    return economy_simulator.reset_cycle()


@app.post("/api/chlopocoin/simulator/toggle", dependencies=[Depends(verify_admin_access)])
async def api_simulator_toggle() -> dict:
    return await economy_simulator.toggle_running()


@app.get("/api/chlopocoin/rankings")
def api_chlopocoin_rankings(
    q: str = Query(default="", description="Filtr po imieniu, mieście lub umiejętności"),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict:
    return get_chlopocoin_rankings(query=q, limit=limit)


@app.get("/api/chat/messages", response_model=List[ChatMessageResponse])
def api_list_chat_messages(
    limit: int = Query(default=50, ge=1, le=200),
    since_id: int = Query(default=0, ge=0),
) -> List[dict]:
    return list_chat_messages(limit=limit, since_id=since_id)


@app.post("/api/chat/messages", response_model=ChatMessageResponse, status_code=201)
def api_send_chat_message(
    payload: ChatMessagePayload,
    x_profile_id: Optional[int] = Header(default=None),
) -> dict:
    effective_profile_id = payload.profile_id or x_profile_id
    try:
        return create_chat_message(
            message=payload.message,
            author_name=payload.author_name or "",
            profile_id=effective_profile_id,
        )
    except ProfileValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.get("/api/dm/conversations", response_model=List[ConversationSummaryResponse])
def api_list_conversations(
    x_profile_id: Optional[int] = Header(default=None),
    profile_id: Optional[int] = Query(default=None),
) -> List[dict]:
    uid = profile_id or x_profile_id
    if not uid:
        raise HTTPException(status_code=400, detail="Brak identyfikatora zalogowanego profilu.")
    return list_user_conversations(uid)


@app.get("/api/dm/messages/{partner_id}", response_model=List[DirectMessageResponse])
def api_list_direct_messages(
    partner_id: int,
    x_profile_id: Optional[int] = Header(default=None),
    profile_id: Optional[int] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    since_id: int = Query(default=0, ge=0),
    mark_read: bool = Query(default=True),
) -> List[dict]:
    uid = profile_id or x_profile_id
    if not uid:
        raise HTTPException(status_code=400, detail="Brak identyfikatora zalogowanego profilu.")
    if mark_read:
        mark_direct_messages_as_read(user_id=uid, partner_id=partner_id)
    return list_direct_messages(user_id=uid, partner_id=partner_id, limit=limit, since_id=since_id)


@app.post("/api/dm/messages/{partner_id}", response_model=DirectMessageResponse, status_code=201)
def api_send_direct_message(
    partner_id: int,
    payload: DirectMessagePayload,
    x_profile_id: Optional[int] = Header(default=None),
) -> dict:
    sender_id = payload.profile_id or x_profile_id
    if not sender_id:
        raise HTTPException(status_code=400, detail="Brak identyfikatora nadawcy.")
    try:
        return create_direct_message(
            sender_id=sender_id,
            receiver_id=partner_id,
            message=payload.message,
        )
    except ProfileValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.delete("/api/dm/conversations/{partner_id}")
def api_clear_conversation(
    partner_id: int,
    x_profile_id: Optional[int] = Header(default=None),
    profile_id: Optional[int] = Query(default=None),
) -> dict:
    uid = profile_id or x_profile_id
    if not uid:
        raise HTTPException(status_code=400, detail="Brak identyfikatora zalogowanego profilu.")
    return clear_conversation_history(user_id=uid, partner_id=partner_id)


@app.delete("/api/dm/messages/{message_id}")
def api_delete_direct_message(
    message_id: int,
    x_profile_id: Optional[int] = Header(default=None),
    profile_id: Optional[int] = Query(default=None),
) -> dict:
    uid = profile_id or x_profile_id
    if not uid:
        raise HTTPException(status_code=400, detail="Brak identyfikatora zalogowanego profilu.")
    try:
        return delete_single_direct_message(user_id=uid, message_id=message_id)
    except ProfileAuthError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ProfileValidationError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/dm/messages/{partner_id}/read")
def api_mark_messages_read(
    partner_id: int,
    x_profile_id: Optional[int] = Header(default=None),
    profile_id: Optional[int] = Query(default=None),
) -> dict:
    uid = profile_id or x_profile_id
    if not uid:
        raise HTTPException(status_code=400, detail="Brak identyfikatora zalogowanego profilu.")
    updated = mark_direct_messages_as_read(user_id=uid, partner_id=partner_id)
    return {"read_count": updated, "partner_id": partner_id}


@app.get("/api/dm/unread-count")
def api_dm_unread_count(
    x_profile_id: Optional[int] = Header(default=None),
    profile_id: Optional[int] = Query(default=None),
) -> dict:
    uid = profile_id or x_profile_id
    if not uid:
        return {"unread_count": 0}
    return {"unread_count": get_unread_dm_count(uid)}


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/manifest.json", include_in_schema=False)
def serve_manifest() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "manifest.json"))


@app.get("/mapa", include_in_schema=False)
def redirect_mapa() -> RedirectResponse:
    return RedirectResponse(url="/chlopchain", status_code=302)


@app.get("/statystyki", include_in_schema=False)
def redirect_statystyki() -> RedirectResponse:
    return RedirectResponse(url="/chlopchain", status_code=302)


@app.get("/", include_in_schema=False)
@app.get("/dopasowania", include_in_schema=False)
@app.get("/chlopchain", include_in_schema=False)
@app.get("/rankingi", include_in_schema=False)
@app.get("/profil", include_in_schema=False)
@app.get("/profil/{profile_id}", include_in_schema=False)
def serve_spa(profile_id: str = "") -> FileResponse:
    return FileResponse(str(STATIC_DIR / "index.html"))
