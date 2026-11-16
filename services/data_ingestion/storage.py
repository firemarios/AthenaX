"""Object storage (contract §5.3): S3/MinIO when configured AND importable, else local disk.

No new dependencies: S3 requires boto3 (optional, lazily imported); otherwise objects
are stored under ATHENAX_STORAGE_DIR (default ./storage) and addressed as file:// URIs.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import url2pathname

logger = logging.getLogger("athenax.storage")


def _setting(settings: Any, name: str, env: str) -> Any:
    if settings is None:
        value = None
    elif isinstance(settings, dict):
        value = settings.get(name)
    else:
        value = getattr(settings, name, None)
    if value in (None, ""):
        value = os.environ.get(env) or None
    return value


def _safe_key(key: str) -> str:
    cleaned = str(key or "").replace("\\", "/").lstrip("/")
    parts = [p for p in cleaned.split("/") if p not in ("", ".", "..")]
    if not parts:
        raise ValueError("κενό κλειδί αντικειμένου")
    return "/".join(parts)


class ObjectStore:
    """put(key, data) → uri; get(uri) → bytes. S3 only when endpoint set AND boto3 importable."""

    def __init__(self, settings: Any = None) -> None:
        self.endpoint_url = _setting(settings, "s3_endpoint_url", "ATHENAX_S3_ENDPOINT_URL")
        self.bucket = _setting(settings, "s3_bucket", "ATHENAX_S3_BUCKET") or "athenax"
        self.access_key = _setting(settings, "s3_access_key", "ATHENAX_S3_ACCESS_KEY")
        self.secret_key = _setting(settings, "s3_secret_key", "ATHENAX_S3_SECRET_KEY")
        base_dir = _setting(settings, "storage_dir", "ATHENAX_STORAGE_DIR") or "./storage"
        self.base_dir = str(Path(str(base_dir)).expanduser().resolve())
        self.s3_enabled = False
        self.note: str | None = None
        self._client: Any = None

        if self.endpoint_url:
            try:
                import boto3  # type: ignore  # noqa: PLC0415 — optional dependency
            except ImportError:
                self.note = (
                    "Ορίστηκε ATHENAX_S3_ENDPOINT_URL αλλά ο boto3 δεν είναι διαθέσιμος — "
                    "χρήση τοπικού αποθηκευτικού συστήματος."
                )
                logger.warning(self.note)
            else:
                self.s3_enabled = True
                self._client = boto3.client(
                    "s3",
                    endpoint_url=self.endpoint_url,
                    aws_access_key_id=self.access_key,
                    aws_secret_access_key=self.secret_key,
                )

        if not self.s3_enabled:
            os.makedirs(self.base_dir, exist_ok=True)

    # -- local ---------------------------------------------------------------
    def _local_path(self, key: str) -> Path:
        return Path(self.base_dir).joinpath(*key.split("/"))

    def put(self, key: str, data: bytes) -> str:
        """Store bytes; returns uri (s3://... or file://...)."""
        safe = _safe_key(key)
        if not isinstance(data, (bytes, bytearray)):
            data = bytes(data)
        if self.s3_enabled:
            self._client.put_object(Bucket=self.bucket, Key=safe, Body=bytes(data))
            return f"s3://{self.bucket}/{safe}"
        path = self._local_path(safe)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(bytes(data))
        return path.as_uri()

    def get(self, uri: str) -> bytes:
        """Read bytes back from a uri produced by put() (file:// or s3://)."""
        text = str(uri or "").strip()
        if text.startswith("s3://"):
            if not self.s3_enabled:
                raise ValueError("S3 storage μη διαθέσιμο (απαιτείται endpoint και boto3)")
            remainder = text[len("s3://") :]
            bucket, _, key = remainder.partition("/")
            return self._client.get_object(Bucket=bucket or self.bucket, Key=key)["Body"].read()
        if text.startswith("file://"):
            parsed = urlparse(text)
            path = Path(url2pathname(parsed.path))
        else:
            path = self._local_path(_safe_key(text))
        return path.read_bytes()
