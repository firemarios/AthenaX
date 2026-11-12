"""Streaming helpers: incremental JSON string extraction + SSE framing (contract §4)."""
from __future__ import annotations

import json

_ESCAPES = {
    '"': '"',
    "\\": "\\",
    "/": "/",
    "n": "\n",
    "t": "\t",
    "r": "\r",
    "b": "\b",
    "f": "\f",
}


def extract_string_field(buffer: str, field: str) -> str:
    """Best-effort decode of a (possibly incomplete) JSON string value for `field`.

    Returns the decoded prefix; never raises. Used to stream `detailed_result`
    tokens out of the model's JSON-only answer while it is still being written.
    """
    key = f'"{field}"'
    key_at = buffer.find(key)
    if key_at == -1:
        return ""
    colon = buffer.find(":", key_at + len(key))
    if colon == -1:
        return ""
    start = buffer.find('"', colon + 1)
    if start == -1:
        return ""

    out: list[str] = []
    i = start + 1
    while i < len(buffer):
        ch = buffer[i]
        if ch == "\\":
            if i + 1 >= len(buffer):
                break
            nxt = buffer[i + 1]
            if nxt == "u":
                code = buffer[i + 2 : i + 6]
                if len(code) < 4:
                    break
                try:
                    out.append(chr(int(code, 16)))
                except ValueError:
                    pass
                i += 6
                continue
            out.append(_ESCAPES.get(nxt, nxt))
            i += 2
            continue
        if ch == '"':
            break
        out.append(ch)
        i += 1
    return "".join(out)


def sse(event: str, payload: object) -> str:
    """Serialize one Server-Sent Event frame (single-line JSON data)."""
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {data}\n\n"
