"""Register feature routers exposed by the backend API."""

from fastapi import APIRouter

from app.features.resume import router as resume_router

router = APIRouter()
router.include_router(resume_router)
