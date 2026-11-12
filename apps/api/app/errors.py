"""Error handlers → envelope with Greek messages (contract §1)."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.envelope import fail

logger = logging.getLogger("policylab.errors")

GREEK_MESSAGES: dict[int, str] = {
    400: "Μη έγκυρο αίτημα",
    401: "Μη εξουσιοδοτημένη πρόσβαση",
    403: "Απαγορεύεται η πρόσβαση",
    404: "Ο πόρος δεν βρέθηκε",
    405: "Μη επιτρεπτή μέθοδος",
    409: "Σύγκρουση πόρων",
    422: "Μη έγκυρη είσοδος",
    429: "Πολλά αιτήματα. Δοκιμάστε ξανά σύντομα.",
    500: "Εσωτερικό σφάλμα διακομιστή",
    501: "Μη υλοποιημένη λειτουργία",
    502: "Λανθασμένη απάντηση διακομιστή",
    503: "Η υπηρεσία δεν είναι διαθέσιμη",
    504: "Λήξη χρόνου από τον διακομιστή",
}

_DEFAULT_EN_DETAILS = {"Not Found", "Method Not Allowed"}


def _field_from_loc(loc: tuple | list) -> str:
    parts = [str(part) for part in loc if part not in ("body", "query", "path", "header")]
    return ".".join(parts) if parts else "body"


def _greek_field_error(err: dict) -> dict:
    field = _field_from_loc(tuple(err.get("loc") or ()))
    err_type = str(err.get("type") or "")
    if err_type == "missing":
        message = f"Το πεδίο '{field}' είναι υποχρεωτικό."
    elif err_type in ("string_too_short", "string_too_long", "string_pattern_mismatch"):
        message = f"Μη έγκυρη τιμή για το πεδίο '{field}'."
    elif err_type in ("greater_than_equal", "less_than_equal", "greater_than", "less_than"):
        message = f"Μη έγκυρη τιμή για το πεδίο '{field}'."
    else:
        message = f"Μη έγκυρη είσοδος για το πεδίο '{field}'."
    return {"field": field, "message": message}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [_greek_field_error(err) for err in exc.errors()]
        return JSONResponse(status_code=422, content=fail(422, "Μη έγκυρη είσοδος", details))

    @app.exception_handler(StarletteHTTPException)
    async def _http_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = int(exc.status_code)
        detail = exc.detail
        if isinstance(detail, str) and detail and detail not in _DEFAULT_EN_DETAILS:
            message = detail
        else:
            message = GREEK_MESSAGES.get(code, "Σφάλμα αιτήματος")
        return JSONResponse(status_code=code, content=fail(code, message))

    @app.exception_handler(Exception)
    async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Μη αντιμετωπισμένο σφάλμα σε %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content=fail(500, GREEK_MESSAGES[500]))
