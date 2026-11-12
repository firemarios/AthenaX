"""Record validation (contract §5.3): {"valid": bool, "errors": [str]}."""
from __future__ import annotations

from typing import Any

_TYPE_MAP: dict[str, type | tuple[type, ...]] = {
    "string": str,
    "str": str,
    "integer": int,
    "int": int,
    "number": (int, float),
    "float": (int, float),
    "boolean": bool,
    "bool": bool,
    "array": list,
    "list": list,
    "object": dict,
    "dict": dict,
}


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, (list, tuple, dict)):
        return len(value) == 0
    return False


def _type_ok(value: Any, expected: str) -> bool:
    py_type = _TYPE_MAP.get(expected)
    if py_type is None:
        return True  # unknown type names are ignored (tolerant)
    if expected in ("integer", "int") and isinstance(value, bool):
        return False
    if expected in ("number", "float") and isinstance(value, bool):
        return False
    return isinstance(value, py_type)


def validate_record(record: Any, schema: dict | None = None) -> dict:
    """Required keys: title + source_url (schema may override via {"required": [...]}).

    Returns {"valid": bool, "errors": [str]} with Greek messages.
    """
    errors: list[str] = []
    if not isinstance(record, dict):
        return {"valid": False, "errors": ["η εγγραφή πρέπει να είναι λεξικό (dict)"]}

    schema = schema if isinstance(schema, dict) else {}
    required = schema.get("required")
    if not isinstance(required, (list, tuple)) or not required:
        required = ["title", "source_url"]

    for key in required:
        if key not in record or _is_empty(record.get(key)):
            errors.append(f"απαιτείται συμπληρωμένο πεδίο: {key}")
        elif not isinstance(record.get(key), str):
            errors.append(f"μη έγκυρος τύπος για το πεδίο {key}: αναμένεται κείμενο")

    properties = schema.get("properties")
    if isinstance(properties, dict):
        for key, spec in properties.items():
            if key not in record:
                continue
            value = record.get(key)
            if value is None:
                continue
            expected = None
            if isinstance(spec, str):
                expected = spec
            elif isinstance(spec, dict):
                expected = spec.get("type")
            if expected and not _type_ok(value, str(expected)):
                errors.append(f"μη έγκυρος τύπος για το πεδίο {key}: αναμένεται {expected}")

    return {"valid": not errors, "errors": errors}
