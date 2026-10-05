"""CV extraction feature. Mount into a FastAPI app with:

    from app.cv_extraction import router as cv_router
    app.include_router(cv_router, prefix="/api")
"""

from .router import router

__all__ = ["router"]
