"""
services/image_processor.py
Enhanced OpenCV preprocessing pipeline for OCR optimization.

Pipeline stages (in order):
  1.  load          — read image from disk (JPEG, PNG, BMP, TIFF, WebP)
  2.  orient        — auto-rotate based on EXIF / content heuristics
  3.  grayscale     — BGR → GRAY
  4.  upscale       — enlarge if width < MIN_WIDTH (INTER_CUBIC)
  5.  clahe         — Contrast Limited Adaptive Histogram Equalization
                      (recovers text on glossy / shadowed surfaces)
  6.  denoise       — fastNlMeansDenoising (removes JPEG artefacts + noise)
  7.  sharpen       — unsharp-mask kernel to crisp character edges
  8.  deskew        — correct rotation: minAreaRect → Hough-line fallback
  9.  threshold     — Otsu global; adaptive Gaussian fallback if Otsu poor
  10. morph_close   — light morphological closing to join broken strokes
  11. save          — write final image; optionally save each stage for debug

PreprocessResult dataclass exposes:
  - output_path       : Path of the final preprocessed image
  - confidence        : float [0–100] image-quality estimate for OCR
  - pipeline_stages   : list[str] of stage names that ran
  - debug_dir         : Path to folder with per-stage PNG files (or None)
  - stage_paths       : dict mapping stage_name → file path string
  - metrics           : dict of raw quality metrics for logging / UI
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


# ── Result ────────────────────────────────────────────────────────────────────

@dataclass
class PreprocessResult:
    """Returned by ImageProcessor.preprocess()."""
    output_path: Path
    confidence: float               # 0–100 quality score
    pipeline_stages: list[str]      # ordered list of stages applied
    debug_dir: Optional[Path]       # folder with per-stage images (if debug=True)
    stage_paths: dict[str, str]     # stage_name → absolute file path
    metrics: dict[str, float]       # sharpness, contrast, text_density, skew_angle


# ── Processor ─────────────────────────────────────────────────────────────────

class ImageProcessor:
    """
    Full preprocessing pipeline that turns a raw label photograph into a
    clean binary image optimised for Tesseract OCR.

    Parameters
    ----------
    min_width : int
        Minimum pixel width before upscaling (default 1 400).
    max_width : int
        Cap the width to avoid excessive memory use (default 3 000).
    save_debug : bool
        When True, each pipeline stage is written to debug_dir as a PNG.
    """

    MIN_WIDTH: int = 1_400
    MAX_WIDTH: int = 3_000
    # Otsu confidence threshold: if text pixels < this fraction, use adaptive
    _OTSU_MIN_TEXT_DENSITY: float = 0.02
    _OTSU_MAX_TEXT_DENSITY: float = 0.40

    def __init__(self, save_debug: bool = False):
        self.save_debug = save_debug

    # ─────────────────────────────── public API ───────────────────────────────

    def preprocess(
        self,
        input_path: str | Path,
        output_path: str | Path,
        debug_dir: str | Path | None = None,
    ) -> PreprocessResult:
        """
        Run the full 10-stage preprocessing pipeline.

        Args:
            input_path:  Path to the raw uploaded image.
            output_path: Destination for the final preprocessed image.
            debug_dir:   Optional folder; when provided (or when save_debug=True)
                         each pipeline stage is saved there for inspection.

        Returns:
            PreprocessResult with path, confidence, stage metadata and metrics.
        """
        t0 = time.perf_counter()
        input_path = Path(input_path)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Resolve debug directory
        _debug: Optional[Path] = None
        if debug_dir or self.save_debug:
            _debug = Path(debug_dir) if debug_dir else output_path.parent / "debug" / output_path.stem
            _debug.mkdir(parents=True, exist_ok=True)

        stages_run: list[str] = []
        stage_paths: dict[str, str] = {}
        metrics: dict[str, float] = {}

        def _save_stage(name: str, img: np.ndarray) -> None:
            stages_run.append(name)
            if _debug is not None:
                p = _debug / f"{len(stages_run):02d}_{name}.png"
                cv2.imwrite(str(p), img)
                stage_paths[name] = str(p)
                logger.debug("Stage [%s] saved → %s", name, p.name)

        logger.info("Preprocessing: %s", input_path.name)

        # ── 1. Load ──────────────────────────────────────────────────────
        img_color = self._load(input_path)
        _save_stage("load", img_color)

        # ── 1.5 Label Region Extraction ──────────────────────────────────
        img_color = self._extract_label_region(img_color)
        _save_stage("label_region", img_color)

        # ── 2. Auto-orient ───────────────────────────────────────────────
        img_color, oriented = self._auto_orient(img_color)
        if oriented:
            _save_stage("orient", img_color)

        # ── 3. Grayscale ─────────────────────────────────────────────────
        gray = self._to_grayscale(img_color)
        _save_stage("grayscale", gray)

        # ── 4. Upscale / Downscale ───────────────────────────────────────
        gray, scale_factor = self._resize(gray)
        if scale_factor != 1.0:
            _save_stage("resize", gray)
        metrics["scale_factor"] = round(scale_factor, 3)

        # ── 5. CLAHE — contrast enhancement ─────────────────────────────
        gray = self._clahe(gray)
        _save_stage("clahe", gray)

        # ── 6. Denoise ───────────────────────────────────────────────────
        gray = self._denoise(gray)
        _save_stage("denoise", gray)

        # ── 7. Sharpen ───────────────────────────────────────────────────
        sharpness_before = self._sharpness(gray)
        gray = self._sharpen(gray)
        sharpness_after = self._sharpness(gray)
        _save_stage("sharpen", gray)
        metrics["sharpness"] = round(sharpness_after, 2)

        # ── 8. Deskew ────────────────────────────────────────────────────
        gray, skew_angle = self._deskew(gray)
        if abs(skew_angle) > 0.5:
            _save_stage("deskew", gray)
        metrics["skew_angle"] = round(skew_angle, 2)

        # ── 9. Threshold (Otsu with adaptive fallback) ───────────────────
        contrast = float(np.std(gray))
        metrics["contrast"] = round(contrast, 2)
        binary = self._threshold(gray)
        text_density = self._text_density(binary)
        metrics["text_density"] = round(text_density, 4)
        _save_stage("threshold", binary)

        # ── 10. Morphological closing (join broken strokes) ──────────────
        binary = self._morph_close(binary)
        _save_stage("morph_close", binary)

        # ── Save final output ────────────────────────────────────────────
        cv2.imwrite(str(output_path), binary)
        stage_paths["final"] = str(output_path)

        # ── Compute confidence ───────────────────────────────────────────
        confidence = self._compute_confidence(metrics)
        metrics["confidence"] = round(confidence, 2)

        elapsed = time.perf_counter() - t0
        logger.info(
            "Preprocessing done in %.2fs | confidence=%.1f | skew=%.1f° | "
            "sharpness=%.1f | contrast=%.1f | text_density=%.3f",
            elapsed, confidence, skew_angle, sharpness_after, contrast, text_density,
        )

        return PreprocessResult(
            output_path=output_path,
            confidence=confidence,
            pipeline_stages=stages_run,
            debug_dir=_debug,
            stage_paths=stage_paths,
            metrics=metrics,
        )

    # ─────────────────────────── pipeline stages ─────────────────────────────

    def _load(self, path: Path) -> np.ndarray:
        """Load image; raise ValueError if unreadable."""
        img = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if img is None:
            # Try with IMREAD_UNCHANGED (handles some unusual formats)
            img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if img is None:
            raise ValueError(f"Could not read image: {path}")
        # Convert 4-channel (RGBA/PNG-with-alpha) to BGR
        if len(img.shape) == 3 and img.shape[2] == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
        return img

    def _extract_label_region(self, img: np.ndarray) -> np.ndarray:
        """
        Enhance and extract the main label region by finding the largest contour.
        Useful for images with busy backgrounds around the packaging.
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Apply GaussianBlur to reduce noise and improve edge detection
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        # Edge detection
        edges = cv2.Canny(blurred, 50, 150)
        
        # Dilate to connect edges
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        dilated = cv2.dilate(edges, kernel, iterations=1)
        
        # Find contours
        contours, _ = cv2.findContours(dilated.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return img
            
        # Find the largest contour by area
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)
        
        # If the largest contour is too small (e.g. less than 5% of image area), skip cropping
        h, w = img.shape[:2]
        if area < (0.05 * w * h):
            return img
            
        x, y, cw, ch = cv2.boundingRect(largest_contour)
        
        # Add a small margin (e.g., 2% of width/height)
        margin_x = int(w * 0.02)
        margin_y = int(h * 0.02)
        
        x1 = max(0, x - margin_x)
        y1 = max(0, y - margin_y)
        x2 = min(w, x + cw + margin_x)
        y2 = min(h, y + ch + margin_y)
        
        logger.debug("Extracted label region: [%d:%d, %d:%d]", y1, y2, x1, x2)
        return img[y1:y2, x1:x2]

    def _auto_orient(self, img: np.ndarray) -> tuple[np.ndarray, bool]:
        """
        Detect and correct common 90°/180°/270° orientations using text
        direction heuristics (portrait vs landscape aspect ratio of a label).

        This handles phone photos taken in landscape mode where the OS
        didn't apply EXIF rotation.

        Returns (corrected_image, was_rotated).
        """
        h, w = img.shape[:2]
        # If image is very strongly portrait (h > 2w) it may need rotation
        # We apply a simple heuristic: tall-narrow images are rotated 90°
        # Only correct when the ratio is extreme to avoid false positives
        if h > 2.5 * w:
            logger.debug("Auto-orient: rotating 90° CW (h/w=%.1f)", h / w)
            return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE), True
        return img, False

    def _to_grayscale(self, img: np.ndarray) -> np.ndarray:
        if len(img.shape) == 3:
            return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        return img

    def _resize(self, img: np.ndarray) -> tuple[np.ndarray, float]:
        """
        Upscale narrow images (better OCR resolution).
        Downscale very large images (avoid Tesseract memory issues).
        Returns (image, scale_factor).
        """
        h, w = img.shape[:2]
        if w < self.MIN_WIDTH:
            scale = self.MIN_WIDTH / w
            new_w, new_h = int(w * scale), int(h * scale)
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
            logger.debug("Upscaled %.2fx → %dx%d", scale, new_w, new_h)
            return img, scale
        elif w > self.MAX_WIDTH:
            scale = self.MAX_WIDTH / w
            new_w, new_h = int(w * scale), int(h * scale)
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
            logger.debug("Downscaled %.2fx → %dx%d", scale, new_w, new_h)
            return img, scale
        return img, 1.0

    def _clahe(self, img: np.ndarray) -> np.ndarray:
        """
        Contrast Limited Adaptive Histogram Equalization.
        Dramatically improves text visibility on:
          - Glossy/reflective surfaces
          - Curved labels with uneven illumination
          - Low-contrast or faded print
        clipLimit=2.0 and tileGridSize=(8,8) are conservative to avoid
        over-amplifying noise.
        """
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(img)

    def _denoise(self, img: np.ndarray) -> np.ndarray:
        """
        Non-local means denoising.
        h=10 removes JPEG compression artefacts without blurring strokes.
        """
        return cv2.fastNlMeansDenoising(img, h=10, templateWindowSize=7, searchWindowSize=21)

    def _sharpen(self, img: np.ndarray) -> np.ndarray:
        """
        Unsharp mask: emphasises high-frequency edges (character strokes).
        Kernel: centre=5, neighbours=-1 (Laplacian-type sharpener).
        Blended 70/30 with original to avoid over-sharpening.
        """
        kernel = np.array([
            [-1, -1, -1],
            [-1,  9, -1],
            [-1, -1, -1],
        ], dtype=np.float32)
        sharpened = cv2.filter2D(img, -1, kernel)
        return cv2.addWeighted(img, 0.7, sharpened, 0.3, 0)

    def _deskew(self, img: np.ndarray) -> tuple[np.ndarray, float]:
        """
        Two-pass deskew:
          Pass 1 (fast) — minAreaRect on dark pixel coords
          Pass 2 (robust) — Probabilistic Hough lines fallback
        Corrects up to ±45° (minAreaRect) or smaller angles from Hough.

        Returns (deskewed_image, angle_degrees_corrected).
        """
        angle = self._estimate_angle_minarearect(img)

        # If minAreaRect gives a suspiciously large angle (> 10°), validate
        # with Hough lines before applying
        if abs(angle) > 10:
            hough_angle = self._estimate_angle_hough(img)
            if hough_angle is not None and abs(hough_angle) < abs(angle):
                logger.debug("Deskew: Hough overrides minAreaRect (%.1f° → %.1f°)", angle, hough_angle)
                angle = hough_angle

        if abs(angle) < 0.3:
            return img, 0.0

        h, w = img.shape[:2]
        M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
        rotated = cv2.warpAffine(
            img, M, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )
        logger.debug("Deskewed by %.2f°", angle)
        return rotated, angle

    def _estimate_angle_minarearect(self, img: np.ndarray) -> float:
        """Estimate skew via minAreaRect on dark-pixel cluster."""
        dark = np.column_stack(np.where(img < 128))
        if dark.shape[0] < 100:
            return 0.0
        rect = cv2.minAreaRect(dark)
        angle = rect[-1]
        # minAreaRect returns [-90, 0]; normalise to [-45, 45]
        if angle < -45:
            angle = 90 + angle
        return angle

    def _estimate_angle_hough(self, img: np.ndarray) -> float | None:
        """Estimate skew via Probabilistic Hough lines (more accurate for text)."""
        edges = cv2.Canny(img, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi / 180,
            threshold=100,
            minLineLength=img.shape[1] // 4,
            maxLineGap=20,
        )
        if lines is None or len(lines) == 0:
            return None

        angles: list[float] = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            if x2 - x1 == 0:
                continue  # vertical line
            angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
            # Only include near-horizontal lines (text baseline candidates)
            if abs(angle) < 20:
                angles.append(angle)

        if not angles:
            return None
        # Use median to reject outliers
        return float(np.median(angles))

    def _threshold(self, img: np.ndarray) -> np.ndarray:
        """
        Intelligent thresholding strategy:
          1. Try Otsu global threshold (fast, good for uniform backgrounds)
          2. Evaluate text density of result
          3. If density is outside acceptable range → fallback to adaptive
             Gaussian (handles uneven lighting, curved labels, glare)
        """
        # Otsu
        _, otsu = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        density = self._text_density(otsu)
        if self._OTSU_MIN_TEXT_DENSITY <= density <= self._OTSU_MAX_TEXT_DENSITY:
            logger.debug("Threshold: Otsu (density=%.3f)", density)
            return otsu

        # Adaptive Gaussian fallback
        logger.debug("Threshold: adaptive fallback (Otsu density=%.3f out of range)", density)
        return cv2.adaptiveThreshold(
            img, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            blockSize=31,
            C=10,
        )

    def _morph_close(self, binary: np.ndarray) -> np.ndarray:
        """
        Morphological closing with a tiny 2×1 horizontal kernel.
        Connects small gaps within character strokes without merging words.
        Only applied if the image is large enough that 2px gaps are meaningful.
        """
        h, w = binary.shape[:2]
        if w < 800:
            return binary
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 1))
        return cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    # ──────────────────────────── quality metrics ─────────────────────────────

    @staticmethod
    def _sharpness(img: np.ndarray) -> float:
        """Laplacian variance — higher = sharper / more edge detail."""
        return float(cv2.Laplacian(img, cv2.CV_64F).var())

    @staticmethod
    def _text_density(binary: np.ndarray) -> float:
        """Fraction of dark (text) pixels in a binarized image."""
        total = binary.size
        dark = int(np.sum(binary < 128))
        return dark / total if total > 0 else 0.0

    def _compute_confidence(self, metrics: dict[str, float]) -> float:
        """
        Heuristic image-quality confidence score in [0, 100].

        Contributors:
          - Sharpness    : high Laplacian variance → sharper text (max 40 pts)
          - Contrast     : high std-dev → better ink-to-background separation (max 30 pts)
          - Text density : text pixels in ideal 2–25% range (max 30 pts)

        The score indicates how reliable the OCR output is likely to be.
        It complements (not replaces) the per-word Tesseract confidence.
        """
        sharpness = metrics.get("sharpness", 0.0)
        contrast  = metrics.get("contrast", 0.0)
        density   = metrics.get("text_density", 0.0)

        # Sharpness: cap at 500, normalise to 40 pts
        sharp_score = min(sharpness / 500.0, 1.0) * 40.0

        # Contrast: std-dev of 0–80 maps to 0–30 pts
        contrast_score = min(contrast / 80.0, 1.0) * 30.0

        # Text density: ideal window [0.04, 0.20]
        if 0.04 <= density <= 0.20:
            density_score = 30.0
        elif density < 0.04:
            density_score = (density / 0.04) * 30.0
        else:
            # Overloaded with dark pixels → poor quality
            density_score = max(0.0, 30.0 - ((density - 0.20) / 0.20) * 30.0)

        return round(sharp_score + contrast_score + density_score, 2)


# ── Module-level singleton ────────────────────────────────────────────────────

image_processor = ImageProcessor(save_debug=False)
