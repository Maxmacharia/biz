from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, Set
import asyncio
import json

ws_router = APIRouter()

# Connection manager
class ConnectionManager:
    def __init__(self):
        # business_id -> set of websockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, business_id: str):
        await websocket.accept()
        if business_id not in self.active_connections:
            self.active_connections[business_id] = set()
        self.active_connections[business_id].add(websocket)

    def disconnect(self, websocket: WebSocket, business_id: str):
        if business_id in self.active_connections:
            self.active_connections[business_id].discard(websocket)
            if not self.active_connections[business_id]:
                del self.active_connections[business_id]

    async def broadcast_to_business(self, business_id: str, message: dict):
        if business_id in self.active_connections:
            disconnected = set()
            for ws in self.active_connections[business_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    disconnected.add(ws)
            for ws in disconnected:
                self.active_connections[business_id].discard(ws)


manager = ConnectionManager()


@ws_router.websocket("/dashboard/{business_id}")
async def dashboard_ws(
    websocket: WebSocket,
    business_id: str,
    token: str = Query(...),
):
    from app.core.security import decode_token
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, business_id)
    try:
        # Send initial ping
        await websocket.send_json({"type": "connected", "business_id": business_id})
        while True:
            # Keep connection alive with periodic pings
            await asyncio.sleep(30)
            await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, business_id)
    except Exception:
        manager.disconnect(websocket, business_id)


async def notify_new_sale(business_id: str, receipt_data: dict):
    """Called after a receipt is created to push real-time update."""
    await manager.broadcast_to_business(business_id, {
        "type": "new_sale",
        "data": receipt_data,
    })


async def notify_low_stock(business_id: str, product_data: dict):
    """Called when a product hits low stock threshold."""
    await manager.broadcast_to_business(business_id, {
        "type": "low_stock_alert",
        "data": product_data,
    })
