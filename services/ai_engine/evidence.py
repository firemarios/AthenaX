"""Evidence layer (contract §4): source building and limitation handling."""
from __future__ import annotations


def _record_urls(record: dict) -> list[str]:
    urls: list[str] = []
    for key in ("source_url", "url"):
        value = record.get(key)
        if isinstance(value, str) and value.startswith(("http://", "https://")):
            urls.append(value.strip())
    extra = record.get("extra")
    if isinstance(extra, dict):
        for key in ("url", "source_url", "link"):
            value = extra.get(key)
            if isinstance(value, str) and value.startswith(("http://", "https://")):
                urls.append(value.strip())
    resources = record.get("resources")
    if isinstance(resources, list):
        for resource in resources:
            if isinstance(resource, dict):
                value = resource.get("url")
                if isinstance(value, str) and value.startswith(("http://", "https://")):
                    urls.append(value.strip())
    return urls


def _record_title(record: dict) -> str:
    for key in ("title", "name", "source_name"):
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def build_sources(records: list[dict]) -> list[dict]:
    """Collect unique sources from records: [{"url", "title"}], dedup by url (title fallback)."""
    seen: set[str] = set()
    sources: list[dict] = []
    for record in records or []:
        if not isinstance(record, dict):
            continue
        fallback_title = _record_title(record)
        for url in _record_urls(record):
            if url in seen:
                continue
            seen.add(url)
            sources.append({"url": url, "title": fallback_title or url})
    return sources


def attach_limitations(base: list[str], extra: list[str]) -> list[str]:
    """Merge limitation lists, dedup (order-preserving), drop empties/non-strings."""
    merged: list[str] = []
    seen: set[str] = set()
    for item in list(base or []) + list(extra or []):
        if not isinstance(item, str):
            continue
        text = item.strip()
        if not text or text in seen:
            continue
        seen.add(text)
        merged.append(text)
    return merged
