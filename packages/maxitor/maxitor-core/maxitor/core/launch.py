# packages/maxitor/maxitor-core/maxitor/core/launch.py
"""
``maxitor-core`` — the core's command: ``migrate`` brings the database up to date as maxitor_core, ``serve`` runs the
backend under uvicorn with proxy headers, so the request's address is the client's (research R4).
"""

from __future__ import annotations

import argparse
import asyncio
import os


def main(argv: list[str] | None = None) -> None:
    """Run ``migrate`` or ``serve``."""
    parser = argparse.ArgumentParser(prog="maxitor-core", description="Maxitor's core: its database and its backend.")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("migrate", help="Run the core's migrations as maxitor_core ($MAXITOR_CORE_DSN)")
    serve = commands.add_parser("serve", help="Run the core's backend")
    serve.add_argument("--host", default=os.environ.get("MAXITOR_CORE_HOST", "127.0.0.1"))
    serve.add_argument("--port", type=int, default=int(os.environ.get("MAXITOR_CORE_PORT", "8020")))
    serve.add_argument("--forwarded-allow-ips", default=os.environ.get("MAXITOR_FORWARDED_ALLOW_IPS", "127.0.0.1"))
    args = parser.parse_args(argv)
    if args.command == "migrate":
        from maxitor.core.migrate import apply_migrations  # pylint: disable=import-outside-toplevel
        from maxitor.core.schemas import CoreSchemas  # pylint: disable=import-outside-toplevel
        from maxitor.core.storage.migrations_storage import MigrationsStorage  # pylint: disable=import-outside-toplevel

        storage = MigrationsStorage(connection_params=os.environ["MAXITOR_CORE_DSN"])
        for name in asyncio.run(apply_migrations(storage, CoreSchemas.from_environment())):
            print(name)
        return
    import uvicorn  # pylint: disable=import-outside-toplevel
    from maxitor.core.server import create_app  # pylint: disable=import-outside-toplevel

    uvicorn.run(
        create_app(), host=args.host, port=args.port, proxy_headers=True, forwarded_allow_ips=args.forwarded_allow_ips
    )


if __name__ == "__main__":
    main()
