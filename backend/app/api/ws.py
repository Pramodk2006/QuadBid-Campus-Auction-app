"""
api/ws.py — WebSocket routes for real-time live bidding and campus stream.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..core.websocket import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/listings/{listing_id}")
async def listing_websocket(websocket: WebSocket, listing_id: int):
    """
    Real-time room for an individual auction listing.
    Receives instant broadcasts for:
      - NEW_BID (amount, bidder, count)
      - ANTI_SNIPING_EXTENSION (new closes_at timestamp)
      - NEW_QUESTION / NEW_ANSWER
    """
    await manager.connect_listing(websocket, listing_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect_listing(websocket, listing_id)
    except Exception:
        manager.disconnect_listing(websocket, listing_id)


@router.websocket("/ws/live")
async def global_live_websocket(websocket: WebSocket):
    """
    Global campus live ticker stream. Receives live bid events across all campus lots.
    """
    await manager.connect_global(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect_global(websocket)
    except Exception:
        manager.disconnect_global(websocket)

