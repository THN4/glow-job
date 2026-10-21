"""Resume API and application services."""

__all__ = ["router"]


def __getattr__(name: str):
    if name == "router":
        from .router import router

        return router
    raise AttributeError(name)
