"""
Multi-Channel Router — cross-channel message routing for OpenClaw.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any


class TransformType(Enum):
    FORWARD = "forward"
    NOTIFY = "notify"
    DIGEST = "digest"
    MIRROR = "mirror"


@dataclass(frozen=True)
class RoutingRule:
    name: str
    from_channel: str | None
    to_channel: str
    transform: TransformType = TransformType.FORWARD
    keywords: tuple[str, ...] = ()
    regex_pattern: str | None = None
    priority: str = "normal"
    enabled: bool = True
    schedule: str | None = None
    label: str | None = None

    def matches_text(self, text: str) -> bool:
        if self.keywords:
            text_lower = text.lower()
            if any(kw.lower() in text_lower for kw in self.keywords):
                return True
        if self.regex_pattern:
            try:
                if re.search(self.regex_pattern, text, re.IGNORECASE):
                    return True
            except re.error:
                pass
        return False


@dataclass
class RoutedMessage:
    original_channel: str
    target_channel: str
    rule_name: str
    transform: TransformType
    original_text: str
    transformed_text: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    success: bool = False
    error: str | None = None


class MultiChannelRouter:
    def __init__(self, rules: list[RoutingRule] | None = None):
        self.rules = rules or []
        self._routing_log: list[RoutedMessage] = []

    def add_rule(self, rule: RoutingRule) -> None:
        self.rules.append(rule)

    def find_matching_rules(self, channel: str, text: str, labels: tuple[str, ...] | None = None) -> list[RoutingRule]:
        matches = []
        for rule in self.rules:
            if not rule.enabled:
                continue
            if rule.from_channel is not None and rule.from_channel != channel:
                continue
            if rule.label is not None:
                if labels is None or rule.label not in labels:
                    continue
            if rule.matches_text(text):
                matches.append(rule)
        priority_order = {"critical": 0, "high": 1, "normal": 2, "low": 3}
        matches.sort(key=lambda r: priority_order.get(r.priority, 9))
        return matches

    def transform_message(self, text: str, transform: TransformType, source_channel: str, rule_name: str) -> str:
        prefix = f"[From {source_channel} via {rule_name}]"
        if transform == TransformType.NOTIFY:
            return f"{prefix}\n{text}"
        elif transform == TransformType.DIGEST:
            truncated = text[:500] + "..." if len(text) > 500 else text
            return f"{prefix}\n[Summary]\n{truncated}"
        elif transform == TransformType.MIRROR:
            return f"{prefix}\n{text}"
        return text

    def route(self, channel: str, text: str, labels: tuple[str, ...] | None = None) -> list[RoutedMessage]:
        results: list[RoutedMessage] = []
        for rule in self.find_matching_rules(channel, text, labels):
            transformed = self.transform_message(text, rule.transform, channel, rule.name)
            results.append(RoutedMessage(
                original_channel=channel, target_channel=rule.to_channel,
                rule_name=rule.name, transform=rule.transform,
                original_text=text, transformed_text=transformed,
            ))
        self._routing_log.extend(results)
        return results

    def get_default_rules(self) -> list[RoutingRule]:
        return [
            RoutingRule(name="urgent-to-qq", from_channel="webchat", to_channel="qqbot",
                       transform=TransformType.NOTIFY, keywords=("紧急", "报警", "立刻", "快", "急"), priority="high"),
            RoutingRule(name="digest-to-web", from_channel="qqbot", to_channel="webchat",
                       transform=TransformType.DIGEST, keywords=("摘要", "总结", "报告"), priority="normal"),
            RoutingRule(name="mirror-all", from_channel="qqbot", to_channel="webchat",
                       transform=TransformType.MIRROR, keywords=("转发", "cross-post", "mirror"), priority="normal"),
        ]

    def load_from_config(self, config: dict) -> None:
        routing_cfg = config.get("skills", {}).get("multi_channel_routing", {})
        rules_cfg = routing_cfg.get("rules", [])
        if not rules_cfg:
            self.rules = self.get_default_rules()
            return
        for rule_dict in rules_cfg:
            try:
                self.rules.append(RoutingRule(
                    name=rule_dict["name"],
                    from_channel=rule_dict.get("from"),
                    to_channel=rule_dict["to"],
                    transform=TransformType(rule_dict.get("transform", "forward")),
                    keywords=tuple(rule_dict.get("keywords", [])),
                    regex_pattern=rule_dict.get("regex"),
                    priority=rule_dict.get("priority", "normal"),
                    enabled=rule_dict.get("enabled", True),
                    schedule=rule_dict.get("schedule"),
                    label=rule_dict.get("label"),
                ))
            except Exception:
                pass

    @classmethod
    def from_config(cls, config: dict) -> "MultiChannelRouter":
        router = cls()
        router.load_from_config(config)
        return router


def _serialize(obj):
    if hasattr(obj, 'value'):
        return obj.value
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)


def cmd_route(args=None) -> str:
    import argparse, sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

    parser = argparse.ArgumentParser()
    parser.add_argument("--from", dest="from_channel", default="webchat")
    parser.add_argument("--to", dest="to_channel", default="qqbot")
    parser.add_argument("--message", required=True)
    parser.add_argument("--rule", default=None)
    parser.add_argument("--config", default=None)
    parsed = parser.parse_args(args)

    config = {}
    if parsed.config:
        p = Path(parsed.config)
        if p.exists():
            raw = p.read_bytes()
            if raw.startswith(b"\xef\xbb\xbf"):
                raw = raw[3:]
            config = json.loads(raw.decode("utf-8"))

    router = MultiChannelRouter.from_config(config)
    results = router.route(parsed.from_channel, parsed.message)

    if not results:
        return json.dumps({"routed": False, "reason": "no_matching_rules"})

    return json.dumps([{k: _serialize(v) for k, v in r.__dict__.items()} for r in results], indent=2, ensure_ascii=False)


if __name__ == '__main__':
    print(cmd_route())
