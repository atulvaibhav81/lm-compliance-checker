"""
services/compliance_service.py
Orchestrates: upload → image processing → OCR → rule engine → DB persistence.
"""
from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy.orm import Session

from core.config import settings
from db.models.analysis import Analysis
from db.models.compliance import ComplianceFinding
from db.models.upload import Upload, UploadStatus
from rule_engine.engine import RuleEngine
from services.image_processor import image_processor
from services.ocr_service import ocr_service

logger = logging.getLogger(__name__)


class ComplianceService:
    def __init__(self):
        self.engine = RuleEngine()

    def run_analysis(self, upload: Upload, db: Session, pdp_area: float | None = None) -> Analysis:
        """
        Full pipeline for one upload:
          1. Preprocess image with OpenCV
          2. Extract text with Tesseract
          3. Run rule engine
          4. Persist Analysis + ComplianceFinding rows
          5. Return the Analysis ORM object
        """
        logger.info("Starting compliance analysis for upload id=%d", upload.id)

        # ── Mark upload as processing ──────────────────────────────────
        upload.status = UploadStatus.PROCESSING
        db.commit()

        try:
            # ── 1. Preprocess ────────────────────────────────────────────
            raw_path = Path(upload.file_path)
            preprocessed_path = (
                settings.upload_path / "preprocessed" / f"pre_{upload.stored_filename}"
            )
            debug_dir = settings.upload_path / "debug" / str(upload.id)
            
            # Extract DPI from original image
            dpi = None
            try:
                from PIL import Image
                with Image.open(raw_path) as img:
                    dpi_info = img.info.get("dpi")
                    if dpi_info and isinstance(dpi_info, tuple) and len(dpi_info) >= 2:
                        dpi = int(dpi_info[0])
            except Exception as e:
                logger.warning(f"Could not extract DPI: {e}")

            preprocess_result = image_processor.preprocess(
                raw_path, preprocessed_path, debug_dir=debug_dir
            )
            scale_factor = preprocess_result.metrics.get("scale_factor", 1.0)

            # ── 2. OCR ───────────────────────────────────────────────────
            ocr_result = ocr_service.extract(preprocessed_path)
            ocr_result.dpi = dpi

            # ── 2b. Draw Bounding Boxes ──────────────────────────────────
            annotated_path = None
            if ocr_result.boxes:
                try:
                    import cv2
                    import numpy as np
                    img = cv2.imread(str(preprocessed_path))
                    if img is not None:
                        for box in ocr_result.boxes:
                            pts = np.array(box, np.int32)
                            pts = pts.reshape((-1, 1, 2))
                            cv2.polylines(img, [pts], isClosed=True, color=(0, 255, 0), thickness=3)
                        
                        annotated_p = settings.upload_path / "preprocessed" / f"annotated_{upload.stored_filename}"
                        cv2.imwrite(str(annotated_p), img)
                        annotated_path = str(annotated_p)
                except Exception as e:
                    logger.warning(f"Failed to draw OCR bounding boxes: {e}")

            # ── 3. Rule engine ──────────────────────────────────────────
            findings = self.engine.run(
                ocr_result.text,
                ocr_result=ocr_result,
                scale_factor=scale_factor,
                pdp_area=pdp_area,
                image_path=str(raw_path)
            )

            # ── 4. Persist ──────────────────────────────────────────────
            analysis = Analysis(
                upload_id=upload.id,
                raw_ocr_text=ocr_result.text,
                preprocessed_image_path=str(preprocessed_path),
                ocr_confidence=ocr_result.confidence,
                image_quality_confidence=preprocess_result.confidence,
                annotated_image_path=annotated_path,
            )
            db.add(analysis)
            db.flush()  # get analysis.id

            for f in findings:
                db.add(
                    ComplianceFinding(
                        analysis_id=analysis.id,
                        rule_code=f.rule_code,
                        rule_name=f.rule_name,
                        status=f.status,
                        extracted_value=f.extracted_value,
                        message=f.message,
                    )
                )

            upload.status = UploadStatus.DONE
            db.commit()
            db.refresh(analysis)
            logger.info("Analysis complete — id=%d, findings=%d", analysis.id, len(findings))
            return analysis

        except Exception as exc:
            logger.exception("Analysis failed for upload id=%d: %s", upload.id, exc)
            upload.status = UploadStatus.ERROR
            db.commit()
            raise


compliance_service = ComplianceService()
