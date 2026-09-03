"""
rule_engine/config_loader.py
Loads and caches the rules_config.yaml file.
Provides typed access to all rule thresholds.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

_CONFIG_PATH = Path(__file__).parent / "rules_config.yaml"


@lru_cache(maxsize=1)
def load_rules_config() -> dict[str, Any]:
    """Load and cache the YAML rules config. Reload on first import only."""
    if not _CONFIG_PATH.exists():
        logger.warning("rules_config.yaml not found at %s — using defaults", _CONFIG_PATH)
        return {}
    with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    logger.info("Loaded rules config from %s", _CONFIG_PATH)
    return cfg or {}


class RulesConfig:
    """Typed facade over the YAML config dict."""

    def __init__(self) -> None:
        self._cfg = load_rules_config()

    def get(self, *keys: str, default: Any = None) -> Any:
        """Safely navigate nested keys: get('font_size', 'min_height_mm')."""
        val = self._cfg
        for k in keys:
            if not isinstance(val, dict):
                return default
            val = val.get(k, default)
        return val

    # ── Font size ─────────────────────────────────────────────────────────────
    def get_font_thresholds(self, pdp_area: float | None = None) -> dict[str, float]:
        thresholds_dict = self.get("font_size", "pdp_area_thresholds", default={})
        if not thresholds_dict:
            # Fallback
            return {
                "min_height_mm": 1.0,
                "mrp_min_height_mm": 2.0,
                "net_qty_min_height_mm": 1.5,
                "manufacturer_min_height_mm": 1.0,
            }
        
        area = pdp_area if pdp_area is not None else 50.0
        sorted_keys = sorted([float(k) for k in thresholds_dict.keys()])
        
        selected_key = sorted_keys[-1]
        for k in sorted_keys:
            if area <= k:
                selected_key = k
                break
                
        # Find the original dict key
        original_key = None
        for k in thresholds_dict:
            if float(k) == selected_key:
                original_key = k
                break
                
        t = thresholds_dict.get(original_key, {})
        return {
            "min_height_mm": float(t.get("min_height_mm", 1.0)),
            "mrp_min_height_mm": float(t.get("mrp_min_height_mm", 2.0)),
            "net_qty_min_height_mm": float(t.get("net_qty_min_height_mm", 1.5)),
            "manufacturer_min_height_mm": float(t.get("manufacturer_min_height_mm", 1.0)),
        }

    @property
    def font_tolerance_pct(self) -> float:
        return float(self.get("font_size", "tolerance_pct", default=10.0))

    # ── USP ───────────────────────────────────────────────────────────────────
    @property
    def usp_tolerance_pct(self) -> float:
        return float(self.get("usp", "tolerance_pct", default=2.0))

    # ── Penalty matrix ────────────────────────────────────────────────────────
    @property
    def penalty_matrix(self) -> dict[str, Any]:
        return self._cfg.get("penalty_matrix", {})

    def get_penalty_entry(self, rule_code: str) -> dict[str, Any] | None:
        return self.penalty_matrix.get(rule_code)

    # ── Barcode ───────────────────────────────────────────────────────────────
    @property
    def barcode_min_confidence(self) -> float:
        return float(self.get("barcode", "min_confidence", default=0.70))


# Module-level singleton
rules_config = RulesConfig()
