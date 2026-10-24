"""Register feature routers exposed by the backend API."""

from fastapi import APIRouter

from app.features.applications.router import router as applications_router
from app.features.assessments.router import router as assessments_router
from app.features.resume.router import router as resume_router
from app.features.roadmap.router import router as roadmap_router

router = APIRouter()
router.include_router(resume_router)
router.include_router(roadmap_router)
router.include_router(assessments_router)
router.include_router(applications_router)
