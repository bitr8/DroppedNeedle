"""Per-user dismissal of activity attention items."""

from __future__ import annotations

import sqlite3
import time

from core.config import get_settings
from core.dependencies._registry import singleton
from infrastructure.persistence._database import PersistenceBase


class ActivityDismissalStore(PersistenceBase):
    def _ensure_tables(self) -> None:
        conn = self._connect()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS activity_dismissals (
                  user_id      TEXT NOT NULL,
                  item_id      TEXT NOT NULL,
                  dismissed_at REAL NOT NULL,
                  PRIMARY KEY (user_id, item_id)
                )
                """
            )
            conn.commit()
        finally:
            conn.close()

    async def dismissed(self, user_id: str) -> set[str]:
        def operation(conn: sqlite3.Connection) -> set[str]:
            rows = conn.execute(
                "SELECT item_id FROM activity_dismissals WHERE user_id = ?",
                (user_id,),
            ).fetchall()
            return {row["item_id"] for row in rows}

        return await self._read(operation)

    async def dismiss(self, user_id: str, item_id: str) -> None:
        def operation(conn: sqlite3.Connection) -> None:
            conn.execute(
                "INSERT OR REPLACE INTO activity_dismissals "
                "(user_id, item_id, dismissed_at) VALUES (?, ?, ?)",
                (user_id, item_id, time.time()),
            )

        await self._write(operation)


@singleton
def get_activity_dismissal_store() -> ActivityDismissalStore:
    from core.dependencies.cache_providers import get_persistence_write_lock

    return ActivityDismissalStore(
        db_path=get_settings().library_db_path,
        write_lock=get_persistence_write_lock(),
    )
