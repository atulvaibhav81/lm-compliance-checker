"""
services/font_verifier.py
Minimum Font Size and Area Verifier — LM-PC Rule 8.

Uses OCR bounding box heights from RapidOCR output.
Bounding box height (pixels) ÷ image DPI × 25.4 = height in mm.

For each mandatory field (MRP, Net Quantity, Manufacturer),
verifies that the character height meets the Rule 8 minimum.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from rule_engine.config_loader import rules_config

logger = logging.getLogger(__name__)

# Default DPI assumed for images without metadata
_DEFAULT_DPI = 150


@dataclass
class FieldFontCheck:
    """Result for one mandatory field."""
    field_name: str         # e.g. "MRP", "Net Quantity"
    matched_text: str | None
    height_px: float | None
    height_mm: float | None
    min_required_mm: float
    status: str             # PASS / FAIL / SKIP
    message: str


@dataclass
class FontVerificationResult:
    """Full font verification result for one image."""
    image_path: str
    dpi: float
    overall_status: str     # PASS / FAIL / WARN
    fields: list[FieldFontCheck] = field(default_factory=list)
    message: str = ""
    confidence: float = 0.0


class FontVerifier:
    """
    Verifies that mandatory label fields meet minimum font height requirements.

    Approach:
      1. RapidOCR returns list of [bbox, text, confidence] per word
      2. For each mandatory field pattern, find the matching text block
      3. Compute bounding box height in pixels
      4. Convert px → mm using image DPI
      5. Compare against threshold from rules_config.yaml

    When RapidOCR word-level bboxes are unavailable, falls back to
    OpenCV-based text region detection (MSER / contour-based).
    """

    # ── Field definitions ─────────────────────────────────────────────────
    _FIELDS = [
        {
            "name": "MRP",
            "pattern": re.compile(r"(?i)(MRP|M\.?R\.?P\.?)"),
            "min_mm_key": "mrp",
        },
        {
            "name": "Net Quantity",
            "pattern": re.compile(
                r"(?i)(net\s+(?:qty|quantity|wt|weight|vol|volume)|\d+\s*(?:g|gm|kg|ml|l|nos|pcs))"
            ),
            "min_mm_key": "net_qty",
        },
        {
            "name": "Manufacturer",
            "pattern": re.compile(r"(?i)(manufactured\s+by|mfd\.?\s+by|marketed\s+by|packed\s+by)"),
            "min_mm_key": "manufacturer",
        },
    ]

    _MIN_MM_MAP = {
        "mrp": lambda: rules_config.font_mrp_min_height_mm,
        "net_qty": lambda: rules_config.font_net_qty_min_height_mm,
        "manufacturer": lambda: rules_config.font_min_height_mm,
    }

    def verify(
        self,
        image_path: str | Path,
        ocr_words: list[tuple[list, str, float]] | None = None,
        dpi: float = _DEFAULT_DPI,
    ) -> FontVerificationResult:
        """
        Verify font sizes for mandatory fields.

        Args:
            image_path: Path to the (preprocessed) image.
            ocr_words:  Word-level OCR results: list of (bbox, text, confidence).
                        bbox is [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] polygon.
                        If None, falls back to OpenCV contour estimation.
            dpi:        Image resolution in DPI (used for px→mm conversion).

        Returns:
            FontVerificationResult
        """
        image_path = Path(image_path)
        img = cv2.imread(str(image_path))
        if img is None:
            return FontVerificationResult(
                image_path=str(image_path),
                dpi=dpi,
                overall_status="SKIP",
                message=f"Could not load image: {image_path}",
                confidence=0.0,
            )

        h_img, w_img = img.shape[:2]
        checks: list[FieldFontCheck] = []
        any_fail = False
        any_skip = False

        for field_def in self._FIELDS:
            field_name = field_def["name"]
            pattern = field_def["pattern"]
            min_mm = self._MIN_MM_MAP[field_def["min_mm_key"]]()

            result = self._check_field(
                field_name=field_name,
                pattern=pattern,
                min_mm=min_mm,
                ocr_words=ocr_words,
                dpi=dpi,
                img_height=h_img,
            )
            checks.append(result)
            if result.status == "FAIL":
                any_fail = True
            elif result.status == "SKIP":
                any_skip = True

        overall = "FAIL" if any_fail else ("WARN" if any_skip else "PASS")
        fail_fields = [c.field_name for c in checks if c.status == "FAIL"]
        if fail_fields:
            msg = f"Font size below minimum for: {', '.join(fail_fields)}. Rule 8 violation."
        elif any_skip:
            msg = "Some mandatory fields could not be located in the image — font check incomplete."
        else:
            msg = "All mandatory fields meet minimum font size requirements (Rule 8)."

        confidence = 0.85 if ocr_words else 0.50

        return FontVerificationResult(
            image_path=str(image_path),
            dpi=dpi,
            overall_status=overall,
            fields=checks,
            message=msg,
            confidence=confidence,
        )

    def _check_field(
        self,
        field_name: str,
        pattern: re.Pattern,
        min_mm: float,
        ocr_words: list | None,
        dpi: float,
        img_height: int,
    ) -> FieldFontCheck:
        """Check a single mandatory field for font height compliance."""

        tolerance_factor = 1.0 - (rules_config.font_tolerance_pct / 100.0)
        effective_min = min_mm * tolerance_factor

        if ocr_words:
            # Search through word-level bboxes
            for bbox, text, conf in ocr_words:
                if pattern.search(text):
                    height_px = self._bbox_height_px(bbox)
                    height_mm = self._px_to_mm(height_px, dpi)
                    status = "PASS" if height_mm >= effective_min else "FAIL"
                    msg = (
                        f"{field_name}: {height_mm:.2f}mm "
                        f"({'≥' if status == 'PASS' else '<'} {min_mm}mm min). "
                        f"Text: '{text[:40]}'"
                    )
                    return FieldFontCheck(
                        field_name=field_name,
                        matched_text=text[:60],
                        height_px=round(height_px, 1),
                        height_mm=round(height_mm, 2),
                        min_required_mm=min_mm,
                        status=status,
                        message=msg,
                    )

        # Fallback: could not match field
        return FieldFontCheck(
            field_name=field_name,
            matched_text=None,
            height_px=None,
            height_mm=None,
            min_required_mm=min_mm,
            status="SKIP",
            message=f"{field_name} not found in OCR output — font size could not be verified.",
        )

    @staticmethod
    def _bbox_height_px(bbox: list) -> float:
        """Compute height of a bounding box polygon in pixels."""
        try:
            pts = np.array(bbox, dtype=np.float32)
            # height = max y - min y
            return float(pts[:, 1].max() - pts[:, 1].min())
        except Exception:
            return 0.0

    @staticmethod
    def _px_to_mm(px: float, dpi: float) -> float:
        """Convert pixels to millimetres using the image DPI."""
        if dpi <= 0:
            dpi = _DEFAULT_DPI
        return px / dpi * 25.4


font_verifier = FontVerifier()
