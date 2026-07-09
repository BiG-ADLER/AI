#!/usr/bin/env python3
"""Minimal L30 Tools API request helper. Loads /home/arman/Ai/.env automatically."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

DEFAULT_ENV = Path("/home/arman/Ai/.env")
DEFAULT_BASE = "https://l30on.top/api/v2/tools"


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), value)


def token() -> str:
    direct = os.getenv("L30_TOOLS_API_TOKEN")
    if direct:
        return direct
    kid = os.getenv("L30_API_KEY_ID")
    secret = os.getenv("L30_API_SECRET")
    if kid and secret:
        return f"{kid}.{secret}"
    raise SystemExit("Missing L30_TOOLS_API_TOKEN or L30_API_KEY_ID + L30_API_SECRET in .env")


def main() -> int:
    parser = argparse.ArgumentParser(description="Call L30 Tools API")
    parser.add_argument("method", help="HTTP method, e.g. GET or POST")
    parser.add_argument("path", help="API path, e.g. /subkeeper/entries")
    parser.add_argument("--json", dest="body", help="JSON request body")
    parser.add_argument("--env", default=str(DEFAULT_ENV), help="Path to .env file")
    parser.add_argument("--base", default=None, help="Override API base URL")
    args = parser.parse_args()

    load_dotenv(Path(args.env))
    base = (args.base or os.getenv("L30_TOOLS_API_BASE") or DEFAULT_BASE).rstrip("/")
    path = args.path if args.path.startswith("/") else f"/{args.path}"
    url = f"{base}{path}"

    headers = {
        "Authorization": f"Bearer {token()}",
        "Accept": "application/json",
    }
    data = None
    if args.body is not None:
        headers["Content-Type"] = "application/json"
        data = args.body.encode()

    req = Request(url, data=data, headers=headers, method=args.method.upper())
    try:
        with urlopen(req, timeout=30) as resp:
            body = resp.read().decode()
            print(body)
            return 0
    except HTTPError as exc:
        err = exc.read().decode()
        print(err or exc.reason, file=sys.stderr)
        return exc.code if 0 < exc.code < 256 else 1


if __name__ == "__main__":
    raise SystemExit(main())
