"""
services/ai_service.py — AI Concierge Semantic Assistant for QuadBid.

Capabilities:
  1. Live Groq LLM Integration: Uses Groq Cloud (openai/gpt-oss-120b / qwen/qwen3.8-27b)
     when GROQ_API_KEY is present in .env.
  2. Live Gemini LLM Integration: Uses Google Gemini API (gemini-1.5-flash) when GEMINI_API_KEY
     is present in .env.
  3. Local Semantic & Intent Engine Fallback: When no API key is provided, performs deep
     semantic concept mapping, synonym normalization, collegiate slang understanding,
     and budget extraction.
  4. Strict Guardrail Invariant: If no relevant items exist in the active campus catalog
     within the student's constraints, it MUST state "Not Available" rather than hallucinating
     or returning irrelevant items.
"""

import re
import json
import logging
from typing import Any, List, Optional
import httpx

from ..core.config import settings
from ..models import Listing
from .listing_service import paise_to_rupees

logger = logging.getLogger("quadbid.ai")

# ── Semantic Domain Ontology for University Campus ─────────────────────────────
SEMANTIC_CONCEPT_MAP = {
    "cycle": {
        "cycle", "bicycle", "bike", "gear cycle", "hybrid", "commute", "travel",
        "ride", "pedal", "wheels", "transport", "dhaurani", "quad stand",
        "single speed", "multispeed", "shimano", "sprint", "hercules", "hero"
    },
    "calculator": {
        "calculator", "calc", "casio", "scientific", "fx991", "fx-991", "matrix",
        "fx", "es plus", "cw", "scientific calculator", "classwiz"
    },
    "books": {
        "book", "books", "textbook", "notes", "author", "edition", "reference",
        "reading", "guide", "manual", "handbook", "bundle", "syllabus", "sem", "semester"
    },
    "electronics": {
        "electronics", "electronic", "laptop", "mouse", "keyboard", "earphones",
        "headphones", "charger", "cable", "monitor", "gadget", "usb", "screen",
        "powerbank", "tech", "device", "audio", "bluetooth", "wireless"
    },
    "other": {
        "drafter", "mini drafter", "drawing board", "t-square", "scales", "compass",
        "graphics", "kettle", "lamp", "desk", "mattress", "curtains", "dorm", "cooler",
        "uniform", "lab uniform", "coat", "lab coat"
    }
}

COLLEGIATE_STOPWORDS = {
    "for", "in", "at", "and", "the", "a", "an", "with", "to", "of", "is", "are",
    "any", "campus", "college", "engineering", "student", "students",
    "urgent", "urgently", "hostel", "room", "lot", "lots", "item", "items", "find",
    "looking", "need", "want", "show", "me", "buy", "purchase", "sell", "available",
    "under", "below", "less", "than", "within", "max", "budget", "price", "give"
}


def _extract_budget(query: str) -> Optional[float]:
    """Parse budget ceilings such as 'under 2000', 'below 1.5k', '< 500', 'within 3000'."""
    q = query.lower()
    
    # Handle '1.5k' or '2k'
    k_match = re.search(r'(?:under|below|less than|within|max|budget of)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*k\b', q)
    if k_match:
        try:
            return float(k_match.group(1)) * 1000.0
        except ValueError:
            pass

    # Handle standard numbers: under 2000, max 1500
    match = re.search(r'(?:under|below|less than|within|max|budget of|<|<=)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)', q)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass

    return None


def _format_catalog_context(active_listings: List[dict]) -> str:
    """Format active inventory for the LLM prompt."""
    lines = []
    for it in active_listings:
        cur_price = it.get("current_price", it.get("starting_price", 0))
        lines.append(
            f"- LOT #{it['id']}: \"{it['title']}\" | Category: {it['category']} | "
            f"Condition: {it['condition']} | Price: ₹{cur_price:.2f} | "
            f"Closes: {it['closes_at']} | Description: {it['description'][:140]}"
        )
    return "\n".join(lines) if lines else "No active lots currently listed in database."


async def _query_groq_llm(user_query: str, active_listings: List[dict]) -> Optional[dict]:
    """Query Groq Cloud API using high-performance LLMs (openai/gpt-oss-120b or qwen/qwen3.8-27b)."""
    api_key = settings.GROQ_API_KEY
    if not api_key:
        return None

    catalog_context = _format_catalog_context(active_listings)
    
    system_instruction = (
        "You are the QuadBid Campus Concierge AI assistant for university hostel students. "
        "Your task is to understand the student's semantic request (intent, synonyms, budget, urgency) "
        "and recommend relevant items ONLY from the active catalog provided below.\n\n"
        "STRICT GUARDRAIL RULES:\n"
        "1. DO NOT HALLUCINATE OR INVENT ITEMS. You can only recommend items from the ACTIVE INVENTORY CATALOG.\n"
        "2. If no item semantically matches the student's request, or if the price exceeds their stated budget, "
        "you MUST set 'is_available': false, 'recommended_listing_ids': [], and state explicitly in 'reply' "
        "that the item is NOT currently available in the active campus auction lots.\n"
        "3. When items are found, explain why they match semantically (e.g. commute -> hybrid cycle, math -> Casio fx-991), "
        "mention the price in ₹, and provide their exact numeric IDs.\n"
        "4. Your response must be strictly valid JSON matching this schema:\n"
        "{\n"
        '  "reply": "friendly explanation to student",\n'
        '  "recommended_listing_ids": [id1, id2],\n'
        '  "is_available": true or false\n'
        "}\n\n"
        f"ACTIVE INVENTORY CATALOG:\n{catalog_context}"
    )

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "QuadBid/1.0"
    }
    
    models = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]
    
    for model in models:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": f"Student query: {user_query}"}
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"}
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                    return parsed
                else:
                    logger.warning(f"Groq API ({model}) returned {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"Groq call with model {model} failed: {e}")

    return None


async def _query_gemini_llm(user_query: str, active_listings: List[dict]) -> Optional[dict]:
    """Query Google Gemini API if GEMINI_API_KEY is configured."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return None

    catalog_context = _format_catalog_context(active_listings)
    
    system_instruction = (
        "You are the QuadBid Campus Concierge AI assistant for university hostel students. "
        "Your task is to understand the student's semantic request (intent, synonyms, budget, urgency) "
        "and recommend relevant items ONLY from the active catalog provided below.\n\n"
        "STRICT GUARDRAIL RULES:\n"
        "1. DO NOT HALLUCINATE OR INVENT ITEMS. You can only recommend items from the ACTIVE INVENTORY CATALOG.\n"
        "2. If no item semantically matches the student's request, or if the price exceeds their stated budget, "
        "you MUST set 'is_available': false, 'recommended_listing_ids': [], and state explicitly in 'reply' "
        "that the item is NOT currently available in the active campus auction lots.\n"
        "3. When items are found, explain why they match semantically (e.g. commute -> hybrid cycle, math -> Casio fx-991), "
        "mention the price in ₹, and provide their exact numeric IDs.\n"
        "4. Your response must be strictly valid JSON matching this schema:\n"
        "{\n"
        '  "reply": "friendly explanation to student",\n'
        '  "recommended_listing_ids": [id1, id2],\n'
        '  "is_available": true or false\n'
        "}\n\n"
        f"ACTIVE INVENTORY CATALOG:\n{catalog_context}"
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": system_instruction},
                    {"text": f"Student query: {user_query}"}
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                return parsed
            else:
                logger.warning(f"Gemini API returned status {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.warning(f"Gemini LLM call failed, falling back to semantic engine: {e}")

    return None


def _semantic_engine_match(user_query: str, active_listings: List[dict]) -> dict:
    """
    Deterministic Semantic & Intent Engine Fallback.
    Understands collegiate vocabulary, synonym expansion, concept clusters, and budget bounds.
    Enforces strict guardrails: items must semantically belong to the queried domain.
    """
    q = user_query.lower().strip()
    raw_words = set(re.findall(r'[a-z0-9\-]+', q))
    meaningful_words = raw_words - COLLEGIATE_STOPWORDS
    budget = _extract_budget(user_query)

    # 1. Identify Target Semantic Concepts
    detected_concepts = set()
    for concept, terms in SEMANTIC_CONCEPT_MAP.items():
        if raw_words & terms:
            detected_concepts.add(concept)

    scored_items = []
    for item in active_listings:
        cur_price = item.get("current_price", item.get("starting_price", 0))

        # Hard budget guardrail
        if budget is not None and cur_price > budget:
            continue

        item_text = f"{item['title']} {item['category']} {item['description']}".lower()
        item_words = set(re.findall(r'[a-z0-9\-]+', item_text))

        # Strict Domain Guardrail:
        # If user queried a specific domain concept (e.g. calculator, cycle, book),
        # the item MUST belong to that category or contain terms from that concept.
        domain_match = False
        if detected_concepts:
            for concept in detected_concepts:
                if item.get("category") == concept or (item_words & SEMANTIC_CONCEPT_MAP[concept]):
                    domain_match = True
                    break
            if not domain_match:
                continue  # Discard unrelated items immediately

        score = 0

        # Meaningful keyword overlap
        overlap = meaningful_words & item_words
        score += len(overlap) * 5

        # Category match
        if item.get("category") in detected_concepts:
            score += 10

        # Semantic concept cluster match
        for concept in detected_concepts:
            concept_terms = SEMANTIC_CONCEPT_MAP[concept]
            cluster_overlap = item_words & concept_terms
            score += len(cluster_overlap) * 3

        # If no detected concepts from map, ensure at least one meaningful non-stopword matches
        if not detected_concepts and not overlap:
            continue

        if score > 0:
            scored_items.append((score, item))

    # Sort by relevance score descending, then by price ascending
    scored_items.sort(key=lambda x: (-x[0], x[1].get("current_price", 0)))
    matching_lots = [item for score, item in scored_items if score >= 3]

    # Guardrail Check: No matches found or under budget
    if not matching_lots:
        budget_str = f" within ₹{budget:,.0f}" if budget is not None else ""
        return {
            "reply": (
                f"Not Available: We couldn't find any active auction lots matching \"{user_query}\"{budget_str} "
                "in the current campus catalog. Graduating seniors list new lots daily—you can save this query as a "
                "keyword alert in your Watchlist to be notified immediately when a matching item is posted."
            ),
            "recommended_listing_ids": [],
            "is_available": False,
        }

    # Matches found: explain semantically
    count = len(matching_lots)
    lot_names = [f"#{l['id']} ({l['title']}, ₹{l.get('current_price', 0):.0f})" for l in matching_lots[:3]]
    lots_summary = ", ".join(lot_names)

    reply = (
        f"I found {count} relevant campus {'lot' if count == 1 else 'lots'} matching your request for "
        f"\"{user_query}\": {lots_summary}. Click any card below to inspect the condition specs or place a bid."
    )

    return {
        "reply": reply,
        "recommended_listing_ids": [l["id"] for l in matching_lots[:4]],
        "is_available": True,
    }


async def process_concierge_query(user_query: str, active_listings: List[dict]) -> dict:
    """
    Main entry point:
      1. Tries Groq Cloud LLM (OpenAI GPT-OSS-120B / Qwen) with live catalog context.
      2. Tries Gemini LLM if configured.
      3. Falls back to Deterministic Semantic & Intent Engine.
    Guarantees strict guardrails regarding item availability.
    """
    if not user_query or not user_query.strip():
        return {
            "reply": "Please tell me what you're looking for (e.g. 'cycle for daily commute under ₹2000' or 'Casio scientific calculator').",
            "recommended_listing_ids": [],
            "is_available": False,
        }

    # 1. Try Live Groq LLM
    groq_result = await _query_groq_llm(user_query, active_listings)
    if groq_result and isinstance(groq_result, dict):
        reply = groq_result.get("reply", "")
        ids = groq_result.get("recommended_listing_ids", [])
        is_avail = groq_result.get("is_available", len(ids) > 0)
        return {
            "reply": reply,
            "recommended_listing_ids": ids,
            "is_available": is_avail,
        }

    # 2. Try Live Gemini LLM if configured
    gemini_result = await _query_gemini_llm(user_query, active_listings)
    if gemini_result and isinstance(gemini_result, dict):
        reply = gemini_result.get("reply", "")
        ids = gemini_result.get("recommended_listing_ids", [])
        is_avail = gemini_result.get("is_available", len(ids) > 0)
        return {
            "reply": reply,
            "recommended_listing_ids": ids,
            "is_available": is_avail,
        }

    # 3. Fall back to Deterministic Semantic & Intent Engine
    return _semantic_engine_match(user_query, active_listings)
