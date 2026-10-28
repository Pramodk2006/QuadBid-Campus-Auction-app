"""
core/websocket.py — Real-time WebSocket connection manager for live auctions.

Features:
  - Per-listing broadcast channel (/ws/listings/{id}):
    Sends immediate updates for new bids, anti-sniping countdown extensions,
    and new Q&A inquiries.
  - Global marketplace stream channel (/ws/live):
    Sends real-time ticker stream events across all lots on campus.
"""

import json
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # listing_id -> list of active WebSockets
        self.listing_rooms: Dict[int, List[WebSocket]] = {}
        # global subscribers for live stream ticker
        self.global_subscribers: List[WebSocket] = []

    async def connect_listing(self, websocket: WebSocket, listing_id: int):
        await websocket.accept()
        if listing_id not in self.listing_rooms:
            self.listing_rooms[listing_id] = []
        self.listing_rooms[listing_id].append(websocket)

    def disconnect_listing(self, websocket: WebSocket, listing_id: int):
        if listing_id in self.listing_rooms:
            if websocket in self.listing_rooms[listing_id]:
                self.listing_rooms[listing_id].remove(websocket)
            if not self.listing_rooms[listing_id]:
                del self.listing_rooms[listing_id]

    async def connect_global(self, websocket: WebSocket):
        await websocket.accept()
        self.global_subscribers.append(websocket)

    def disconnect_global(self, websocket: WebSocket):
        if websocket in self.global_subscribers:
            self.global_subscribers.remove(websocket)

    async def broadcast_listing(self, listing_id: int, message: dict):
        if listing_id in self.listing_rooms:
            for connection in list(self.listing_rooms[listing_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    self.disconnect_listing(connection, listing_id)

    async def broadcast_global(self, message: dict):
        for connection in list(self.global_subscribers):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect_global(connection)


manager = ConnectionManager()
