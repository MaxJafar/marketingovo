from __future__ import annotations


class WorkerError(Exception):
    """A stable, user-safe worker failure."""

    def __init__(self, code: str, message: str, *, exit_code: int = 1) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.exit_code = exit_code


class WorkerCancelled(WorkerError):
    def __init__(self, message: str = "Analysis was cancelled by the parent process.") -> None:
        super().__init__("cancelled", message, exit_code=130)
