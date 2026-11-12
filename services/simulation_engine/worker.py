"""Sandboxed subprocess entry: python -m services.simulation_engine.worker <model> <params.json> <out.json>"""
from __future__ import annotations

import json
import sys


def main(argv: list[str] | None = None) -> int:
    argv = list(argv if argv is not None else sys.argv[1:])
    if len(argv) != 3:
        print("usage: worker <model> <params.json> <out.json>", file=sys.stderr)
        return 2
    model, params_path, out_path = argv
    from services.simulation_engine.runner import run_model

    with open(params_path, encoding="utf-8") as fh:
        params = json.load(fh)
    result = run_model(model, params)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False)
    return 0 if result.get("status") == "succeeded" else 1


if __name__ == "__main__":
    raise SystemExit(main())
