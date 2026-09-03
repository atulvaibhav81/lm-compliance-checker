"""
services/barcode_service.py
Barcode and QR Code Validator.

Decodes 1D barcodes via pyzbar and QR codes via OpenCV's
built-in QRCodeDetector. Validates EAN-13 check digits and
compares decoded payload against OCR-extracted product details.

Graceful fallback: if pyzbar / zbar native library is not installed,
the service falls back to OpenCV-only QR detection and warns.
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

# ── Optional pyzbar import (lazy — loaded on first use) ─────────────────────
# pyzbar requires native libzbar.dll on Windows. We import it lazily so the
# module loads cleanly even when the DLL is absent.
_pyzbar_mod = None
_PYZBAR_AVAILABLE: bool | None = None  # None = not yet checked

def _try_load_pyzbar():
    global _pyzbar_mod, _PYZBAR_AVAILABLE
    if _PYZBAR_AVAILABLE is not None:
        return _PYZBAR_AVAILABLE
    try:
        from pyzbar import pyzbar as _mod
        _pyzbar_mod = _mod
        _PYZBAR_AVAILABLE = True
        logger.info("pyzbar loaded — 1D barcode decoding enabled")
    except (ImportError, OSError, FileNotFoundError):
        _PYZBAR_AVAILABLE = False
        logger.warning("pyzbar/libzbar not available — 1D barcode decoding disabled (QR via OpenCV still works)")
    return _PYZBAR_AVAILABLE


# ── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class DecodedCode:
    """A single decoded barcode or QR code."""
    symbology: str                  # EAN-13, QR Code, CODE-128, etc.
    raw_data: str                   # Decoded text payload
    location: str                   # Bounding rect as "x,y,w,h" string
    checksum_valid: bool | None     # None = not applicable
    confidence: float               # 0–1


@dataclass
class BarcodeValidationResult:
    """Result of barcode/QR validation for one image."""
    found_codes: list[DecodedCode] = field(default_factory=list)
    overall_status: str = "SKIP"    # PASS / FAIL / WARN / SKIP
    match_status: str = "UNVERIFIED"  # MATCH / MISMATCH / UNVERIFIED
    message: str = ""
    ocr_product_ref: str | None = None  # Reference product text from OCR


# ── Service ───────────────────────────────────────────────────────────────────

class BarcodeService:
    """
    Detects and validates barcodes / QR codes in label images.

    Pipeline:
      1. Try pyzbar on original + grayscale image (1D + 2D barcodes)
      2. Try OpenCV QRCodeDetector (QR codes)
      3. Validate EAN-13 / EAN-8 checksum if applicable
      4. Compare decoded payload with OCR text reference
    """

    def validate_image(
        self,
        image_path: str | Path,
        ocr_text: str | None = None,
    ) -> BarcodeValidationResult:
        """
        Detect and validate all barcodes/QR codes in an image.

        Args:
            image_path:  Path to the (original or preprocessed) image.
            ocr_text:    Optional OCR text used to cross-reference decoded data.

        Returns:
            BarcodeValidationResult
        """
        image_path = Path(image_path)
        img_bgr = cv2.imread(str(image_path))
        if img_bgr is None:
            return BarcodeValidationResult(
                overall_status="SKIP",
                message=f"Could not load image: {image_path}",
            )

        img_gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        found: list[DecodedCode] = []

        # ── 1. pyzbar decoding ─────────────────────────────────────────
        if _try_load_pyzbar():
            found.extend(self._decode_pyzbar(img_bgr, img_gray))

        # ── 2. OpenCV QR detection ─────────────────────────────────────
        qr_codes = self._decode_opencv_qr(img_bgr, img_gray)
        # Deduplicate: skip QR codes already found by pyzbar
        existing_payloads = {c.raw_data for c in found}
        for qr in qr_codes:
            if qr.raw_data not in existing_payloads:
                found.append(qr)

        result = BarcodeValidationResult(
            found_codes=found,
            ocr_product_ref=ocr_text[:200] if ocr_text else None,
        )

        if not found:
            result.overall_status = "WARN"
            result.match_status = "UNVERIFIED"
            result.message = (
                "No barcode or QR code detected in image. "
                "Ensure barcode is clearly visible and not damaged."
            )
            return result

        # ── 3. Validate each code ─────────────────────────────────────
        any_invalid = False
        for code in found:
            if code.symbology in ("EAN-13", "EAN13"):
                code.checksum_valid = self._validate_ean13(code.raw_data)
                if not code.checksum_valid:
                    any_invalid = True
            elif code.symbology in ("EAN-8", "EAN8"):
                code.checksum_valid = self._validate_ean8(code.raw_data)
                if not code.checksum_valid:
                    any_invalid = True

        # ── 4. Cross-reference with OCR ────────────────────────────────
        match_status, match_msg = self._cross_reference(found, ocr_text)
        result.match_status = match_status

        # ── 5. Build overall status ────────────────────────────────────
        if any_invalid:
            result.overall_status = "FAIL"
            result.message = (
                f"Found {len(found)} code(s) but EAN checksum validation FAILED. "
                + match_msg
            )
        elif match_status == "MISMATCH":
            result.overall_status = "WARN"
            result.message = f"Barcode decoded but may not match product details. {match_msg}"
        else:
            result.overall_status = "PASS"
            result.message = (
                f"Successfully decoded {len(found)} code(s): "
                f"{', '.join(c.symbology for c in found)}. {match_msg}"
            )

        logger.info(
            "Barcode validation: %d codes found, status=%s, match=%s",
            len(found), result.overall_status, result.match_status
        )
        return result

    # ── pyzbar decoding ────────────────────────────────────────────────────

    def _decode_pyzbar(self, img_bgr: np.ndarray, img_gray: np.ndarray) -> list[DecodedCode]:
        """Decode all barcodes/QR in image using pyzbar."""
        results = []
        min_conf = rules_config.barcode_min_confidence

        for image in [img_bgr, img_gray]:
            decoded = _pyzbar_mod.decode(image)
            if decoded:
                for obj in decoded:
                    try:
                        text = obj.data.decode("utf-8", errors="replace").strip()
                        symbology = obj.type  # e.g. "EAN13", "QRCODE", "CODE128"
                        # Normalise symbology names
                        symbology = self._normalise_symbology(symbology)
                        rect = obj.rect
                        location = f"{rect.left},{rect.top},{rect.width},{rect.height}"
                        results.append(DecodedCode(
                            symbology=symbology,
                            raw_data=text,
                            location=location,
                            checksum_valid=None,
                            confidence=0.90,
                        ))
                    except Exception as exc:
                        logger.debug("pyzbar decode error: %s", exc)
                break  # found codes, stop trying other image variants
        return results

    # ── OpenCV QR detection ────────────────────────────────────────────────

    def _decode_opencv_qr(self, img_bgr: np.ndarray, img_gray: np.ndarray) -> list[DecodedCode]:
        """Decode QR codes using OpenCV's built-in QRCodeDetector."""
        results = []
        detector = cv2.QRCodeDetector()

        # Try on both color and gray
        for img in [img_bgr, img_gray]:
            try:
                data, points, _ = detector.detectAndDecode(img)
                if data and data.strip():
                    location = ""
                    if points is not None:
                        pts = points[0].astype(int)
                        location = ";".join(f"{p[0]},{p[1]}" for p in pts)
                    results.append(DecodedCode(
                        symbology="QR Code",
                        raw_data=data.strip(),
                        location=location,
                        checksum_valid=None,
                        confidence=0.85,
                    ))
                    break
            except Exception as exc:
                logger.debug("OpenCV QR detect error: %s", exc)

        return results

    # ── Cross-reference ────────────────────────────────────────────────────

    def _cross_reference(
        self, codes: list[DecodedCode], ocr_text: str | None
    ) -> tuple[str, str]:
        """Compare decoded barcode payload with OCR text."""
        if not ocr_text or not codes:
            return "UNVERIFIED", "No OCR reference available for cross-check."

        for code in codes:
            # Check if the barcode number appears anywhere in OCR text
            payload = re.sub(r"\s+", "", code.raw_data)
            if len(payload) >= 6 and payload in re.sub(r"\s+", "", ocr_text):
                return "MATCH", f"Barcode data '{code.raw_data}' found in OCR text."

        return "UNVERIFIED", "Barcode payload not found in OCR text (may be a URL or product code not printed)."

    # ── Checksum validators ────────────────────────────────────────────────

    @staticmethod
    def _validate_ean13(data: str) -> bool:
        """Validate EAN-13 check digit."""
        digits = re.sub(r"\D", "", data)
        if len(digits) != 13:
            return False
        weights = [1 if i % 2 == 0 else 3 for i in range(12)]
        total = sum(int(d) * w for d, w in zip(digits[:12], weights))
        check = (10 - (total % 10)) % 10
        return check == int(digits[12])

    @staticmethod
    def _validate_ean8(data: str) -> bool:
        """Validate EAN-8 check digit."""
        digits = re.sub(r"\D", "", data)
        if len(digits) != 8:
            return False
        weights = [3 if i % 2 == 0 else 1 for i in range(7)]
        total = sum(int(d) * w for d, w in zip(digits[:7], weights))
        check = (10 - (total % 10)) % 10
        return check == int(digits[7])

    @staticmethod
    def _normalise_symbology(sym: str) -> str:
        """Normalise pyzbar symbology names to readable form."""
        _MAP = {
            "EAN13": "EAN-13", "EAN8": "EAN-8",
            "QRCODE": "QR Code", "CODE128": "CODE-128",
            "CODE39": "CODE-39", "UPCA": "UPC-A",
            "UPCE": "UPC-E", "I25": "ITF",
            "PDF417": "PDF417", "DATAMATRIX": "DataMatrix",
        }
        return _MAP.get(sym.upper(), sym)


barcode_service = BarcodeService()
