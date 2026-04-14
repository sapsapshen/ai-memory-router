"""
Session Compaction Skill for OpenClaw.

Monitors active session length, triggers compaction when threshold is exceeded.
Ships with a default threshold of 60,000 tokens.

Usage:
  - Cron-triggered periodic check (recommended: every 30 minutes during active sessions)
  - Manual trigger: say "compact session" or "compress conversation"

Config (in openclaw.json):
  skills.session_compaction.threshold = 60000  # tokens
  skills.session_compaction.keep_recent = 30   # messages to always keep
"""
from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

# Add workspace src to path for SessionCompactor
WORKSPACE = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(WORKSPACE))

try:
    from src.runtime.session_compactor import SessionCompactor, estimate_tokens, estimate_messages_tokens
    from src.models import CapabilityLevel
except ImportError:
    from src.runtime.session_compactor import SessionCompactor, estimate_tokens, estimate_messages_tokens
    from src.models import CapabilityLevel


@dataclass
class CompactionConfig:
    threshold: int = 60_000
    keep_recent: int = 30
    enabled: bool = True
    auto_trigger: bool = True

    @classmethod
    def from_env(cls) -> "CompactionConfig":
        return cls(
            threshold=int(os.environ.get("CLAUDE_CODE_AUTO_COMPACT_INPUT_TOKENS", 60000)),
            keep_recent=int(os.environ.get("SESSION_COMPACT_KEEP_RECENT", 30)),
            enabled=os.environ.get("SESSION_COMPACT_ENABLED", "true").lower() != "false",
            auto_trigger=os.environ.get("SESSION_COMPACT_AUTO", "true").lower() != "false",
        )


def get_active_session_key() -> str | None:
    """
    Attempt to read the active session key from OpenClaw's runtime state.
    Returns None if we can't determine it.
    """
    # Check environment variable set by OpenClaw runtime
    session_key = os.environ.get("OPENCLAW_ACTIVE_SESSION_KEY")
    if session_key:
        return session_key

    # Check for a session state file
    state_dir = Path.home() / ".openclaw" / "sessions"
    if state_dir.exists():
        # Find the most recently modified state file
        try:
            files = list(state_dir.glob("*.state.json"))
            if files:
                latest = max(files, key=lambda f: f.stat().st_mtime)
                data = json.loads(latest.read_text(encoding="utf-8"))
                return data.get("sessionKey") or latest.stem.replace(".state", "")
        except Exception:
            pass

    return None


def read_session_messages(session_key: str) -> list[dict]:
    """
    Read messages from a session's transcript file.
    OpenClaw stores transcripts in ~/.openclaw/sessions/<key>/transcript.json
    """
    transcript_path = Path.home() / ".openclaw" / "sessions" / session_key / "transcript.json"
    if not transcript_path.exists():
        return []

    try:
        data = json.loads(transcript_path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data.get("messages", [])
        if isinstance(data, list):
            return data
        return []
    except Exception:
        return []


def write_compacted_session(session_key: str, compacted_messages: list[dict], summary: str) -> bool:
    """Write compacted session back. Returns True on success."""
    session_dir = Path.home() / ".openclaw" / "sessions" / session_key
    session_dir.mkdir(parents=True, exist_ok=True)

    backup_path = session_dir / "transcript.pre-compact.json.bak"
    transcript_path = session_dir / "transcript.json"

    try:
        if transcript_path.exists():
            backup_path.write_text(transcript_path.read_text(encoding="utf-8"), encoding="utf-8")

        data = {
            "messages": compacted_messages,
            "compacted_at": datetime.now().isoformat(),
            "summary": summary,
        }
        transcript_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        return True
    except Exception:
        return False


def run_compaction_session(session_key: str | None = None) -> dict:
    """
    Run compaction on the active session (or specified session).

    Returns a dict with:
      - session_key, compaction_done, original_count, compacted_count,
        original_tokens, compacted_tokens, compression_ratio, summary
    """
    cfg = CompactionConfig.from_env()

    if not cfg.enabled:
        return {"compaction_done": False, "reason": "disabled"}

    if session_key is None:
        session_key = get_active_session_key()

    if session_key is None:
        return {"compaction_done": False, "reason": "no_active_session"}

    messages = read_session_messages(session_key)
    if not messages:
        return {"compaction_done": False, "reason": "no_messages", "session_key": session_key}

    original_count = len(messages)
    original_tokens = estimate_messages_tokens(messages)

    if original_tokens < cfg.threshold:
        return {
            "compaction_done": False,
            "reason": "below_threshold",
            "session_key": session_key,
            "original_tokens": original_tokens,
            "threshold": cfg.threshold,
        }

    # Run compaction
    compactor = SessionCompactor(
        auto_compaction_threshold=cfg.threshold,
        keep_recent_messages=cfg.keep_recent,
    )

    result = compactor.compact(messages)

    if not result.success:
        return {
            "compaction_done": False,
            "reason": result.error or "compaction_failed",
            "session_key": session_key,
        }

    # Build compacted message list
    summary_msg = {
        "role": "system",
        "content": f"[Session compacted at {datetime.now().isoformat()} — "
                   f"{result.removed_indices.__len__()} messages summarized "
                   f"({result.original_tokens} → {result.compacted_tokens} tokens, "
                   f"{result.compression_ratio():.1%} compression)]: {result.summary}",
    }

    # Reconstruct: summary + preserved messages
    compacted = [summary_msg] + messages[-cfg.keep_recent:]

    success = write_compacted_session(session_key, compacted, result.summary)

    return {
        "compaction_done": success,
        "session_key": session_key,
        "original_count": original_count,
        "compacted_count": len(compacted),
        "original_tokens": result.original_tokens,
        "compacted_tokens": result.compacted_tokens,
        "compression_ratio": f"{result.compression_ratio():.1%}",
        "summary": result.summary,
        "removed_count": len(result.removed_indices),
    }


def cmd_compact(args=None) -> str:
    """Main entry point when run as a script."""
    import argparse
    parser = argparse.ArgumentParser(description="Session Compaction Skill")
    parser.add_argument("--session", type=str, default=None, help="Session key")
    parser.add_argument("--threshold", type=int, default=None, help="Token threshold override")
    parser.add_argument("--keep", type=int, default=None, help="Messages to keep")
    parsed = parser.parse_args(args)

    if parsed.threshold:
        os.environ["CLAUDE_CODE_AUTO_COMPACT_INPUT_TOKENS"] = str(parsed.threshold)
    if parsed.keep:
        os.environ["SESSION_COMPACT_KEEP_RECENT"] = str(parsed.keep)

    result = run_compaction_session(parsed.session)

    output = json.dumps(result, indent=2, ensure_ascii=False)
    print(output)
    return output


if __name__ == "__main__":
    cmd_compact()
