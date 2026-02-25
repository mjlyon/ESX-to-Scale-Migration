import json
from datetime import datetime, timezone

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.subscriptions: dict[int, list[WebSocket]] = {}  # job_id -> websockets

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        for job_id in list(self.subscriptions.keys()):
            if websocket in self.subscriptions[job_id]:
                self.subscriptions[job_id].remove(websocket)

    async def handle_client_message(self, websocket: WebSocket, data: dict):
        msg_type = data.get("type", "")
        if msg_type == "subscribe":
            job_id = data.get("job_id")
            if job_id is not None:
                self.subscriptions.setdefault(job_id, [])
                if websocket not in self.subscriptions[job_id]:
                    self.subscriptions[job_id].append(websocket)
        elif msg_type == "subscribe_all":
            # Mark this ws as subscribed to all (use job_id=-1)
            self.subscriptions.setdefault(-1, [])
            if websocket not in self.subscriptions[-1]:
                self.subscriptions[-1].append(websocket)

    async def broadcast_job_update(self, job_id: int, data: dict):
        msg = {
            "type": "job_update",
            "job_id": job_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **data,
        }
        await self._send_to_subscribers(job_id, msg)

    async def broadcast_job_log(self, job_id: int, level: str, line: str):
        msg = {
            "type": "job_log",
            "job_id": job_id,
            "level": level,
            "line": line,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await self._send_to_subscribers(job_id, msg)

    async def broadcast_system_status(self, data: dict):
        msg = {
            "type": "system_status",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **data,
        }
        for ws in self.active_connections:
            try:
                await ws.send_json(msg)
            except Exception:
                pass

    async def _send_to_subscribers(self, job_id: int, msg: dict):
        targets: set[WebSocket] = set()
        # Specific subscribers
        for ws in self.subscriptions.get(job_id, []):
            targets.add(ws)
        # All-subscribers
        for ws in self.subscriptions.get(-1, []):
            targets.add(ws)

        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


# Global singleton
ws_manager = ConnectionManager()
