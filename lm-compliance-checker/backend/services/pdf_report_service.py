"""
services/pdf_report_service.py
Automated Audit Report PDF Generator using ReportLab.

Generates a professional, branded PDF audit report for a compliance analysis.
Includes: header, product metadata, compliance findings table,
penalty summary, barcode results, and a signature block.
"""
from __future__ import annotations

import io
import logging
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

logger = logging.getLogger(__name__)

# ── Colour palette ────────────────────────────────────────────────────────────
BRAND_DARK  = colors.HexColor("#0F172A")
BRAND_BLUE  = colors.HexColor("#3B82F6")
BRAND_LIGHT = colors.HexColor("#EFF6FF")
PASS_GREEN  = colors.HexColor("#22C55E")
FAIL_RED    = colors.HexColor("#EF4444")
WARN_AMBER  = colors.HexColor("#F59E0B")
SKIP_GRAY   = colors.HexColor("#94A3B8")
TABLE_HDR   = colors.HexColor("#1E40AF")
TABLE_ALT   = colors.HexColor("#F1F5F9")
WHITE       = colors.white
BORDER      = colors.HexColor("#CBD5E1")


STATUS_COLORS = {
    "PASS": PASS_GREEN,
    "FAIL": FAIL_RED,
    "WARN": WARN_AMBER,
    "SKIP": SKIP_GRAY,
}


class PDFReportService:
    """Generates a professional PDF compliance audit report."""

    PAGE_W, PAGE_H = A4
    MARGIN = 18 * mm

    def generate(self, report_data: dict[str, Any]) -> bytes:
        """
        Generate the PDF and return as bytes.

        Args:
            report_data: Dict with keys:
                - analysis_id, upload_id, filename, ocr_confidence,
                  image_quality_confidence, created_at
                - summary: {total_rules, PASS, FAIL, WARN, compliance_score}
                - findings: list of {rule_code, rule_name, status, extracted_value, message}
                - penalty: optional {total_fine_min, total_fine_max, violations}
                - barcode: optional {found_codes, overall_status, message}

        Returns:
            PDF file as bytes.
        """
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN,
            title=f"LM Compliance Report #{report_data.get('analysis_id', '?')}",
            author="LM Compliance Checker",
        )

        styles = self._make_styles()
        story = []

        # ── Cover header ──────────────────────────────────────────────────
        story.extend(self._build_header(report_data, styles))
        story.append(Spacer(1, 8 * mm))

        # ── Compliance score banner ───────────────────────────────────────
        story.extend(self._build_score_banner(report_data, styles))
        story.append(Spacer(1, 6 * mm))

        # ── Scan metadata ─────────────────────────────────────────────────
        story.extend(self._build_metadata_table(report_data, styles))
        story.append(Spacer(1, 6 * mm))

        # ── Product Images ────────────────────────────────────────────────
        story.extend(self._build_images_section(report_data, styles))
        story.append(Spacer(1, 6 * mm))

        # ── Findings table ────────────────────────────────────────────────
        story.append(Paragraph("Compliance Findings", styles["section_header"]))
        story.append(Spacer(1, 3 * mm))
        story.extend(self._build_findings_table(report_data.get("findings", []), styles))
        story.append(Spacer(1, 6 * mm))

        # ── Penalty summary ───────────────────────────────────────────────
        penalty = report_data.get("penalty")
        if penalty:
            story.append(Paragraph("Penalty Summary", styles["section_header"]))
            story.append(Spacer(1, 3 * mm))
            story.extend(self._build_penalty_section(penalty, styles))
            story.append(Spacer(1, 6 * mm))

        # ── Barcode results ───────────────────────────────────────────────
        barcode = report_data.get("barcode")
        if barcode:
            story.append(Paragraph("Barcode / QR Code Validation", styles["section_header"]))
            story.append(Spacer(1, 3 * mm))
            story.extend(self._build_barcode_section(barcode, styles))
            story.append(Spacer(1, 6 * mm))

        # ── Signature block ───────────────────────────────────────────────
        story.extend(self._build_signature_block(report_data, styles))

        doc.build(story, onFirstPage=self._page_footer, onLaterPages=self._page_footer)
        pdf_bytes = buf.getvalue()
        logger.info(
            "PDF generated for analysis_id=%s — %d bytes",
            report_data.get("analysis_id"), len(pdf_bytes)
        )
        return pdf_bytes

    # ── Header ────────────────────────────────────────────────────────────

    def _build_header(self, data: dict, styles: dict) -> list:
        header_data = [
            [
                Paragraph("⚖ LM Compliance Audit Certificate & Inspection Report", styles["brand_title"]),
                Paragraph(
                    f"Audit ID: <b>#{data.get('analysis_id', '?')}</b><br/>"
                    f"<font size='9' color='#64748B'>Legal Metrology (PC) Rules, 2011</font>",
                    styles["header_right"]
                ),
            ]
        ]
        table = Table(header_data, colWidths=[100 * mm, 80 * mm])
        table.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, 0), BRAND_DARK),
            ("TEXTCOLOR",    (0, 0), (-1, 0), WHITE),
            ("ALIGN",        (0, 0), (0, 0), "LEFT"),
            ("ALIGN",        (1, 0), (1, 0), "RIGHT"),
            ("VALIGN",       (0, 0), (-1, 0), "MIDDLE"),
            ("TOPPADDING",   (0, 0), (-1, 0), 10),
            ("BOTTOMPADDING",(0, 0), (-1, 0), 10),
            ("LEFTPADDING",  (0, 0), (0, 0), 12),
            ("RIGHTPADDING", (1, 0), (1, 0), 12),
            ("ROUNDEDCORNERS", (0, 0), (-1, -1), 4),
        ]))
        return [table]

    # ── Score banner ───────────────────────────────────────────────────────

    def _build_score_banner(self, data: dict, styles: dict) -> list:
        summary = data.get("summary", {})
        score = summary.get("compliance_score", 0)
        total = summary.get("total_rules", 0)
        passed = summary.get("PASS", 0)
        failed = summary.get("FAIL", 0)
        warned = summary.get("WARN", 0)

        score_color = PASS_GREEN if score >= 80 else (WARN_AMBER if score >= 50 else FAIL_RED)
        verdict = "COMPLIANT" if score >= 80 else ("PARTIAL" if score >= 50 else "NON-COMPLIANT")

        banner_data = [
            [
                Paragraph(f"<font size='32' color='white'><b>{score:.0f}%</b></font>", styles["center"]),
                Paragraph(
                    f"<b>{verdict}</b><br/>"
                    f"<font size='9'>{passed} Pass / {failed} Fail / {warned} Warn / {total} Total</font>",
                    styles["banner_text"]
                ),
            ]
        ]
        table = Table(banner_data, colWidths=[55 * mm, 125 * mm])
        table.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (0, 0), score_color),
            ("BACKGROUND",   (1, 0), (1, 0), BRAND_LIGHT),
            ("TEXTCOLOR",    (0, 0), (0, 0), WHITE),
            ("ALIGN",        (0, 0), (0, 0), "CENTER"),
            ("VALIGN",       (0, 0), (-1, 0), "MIDDLE"),
            ("TOPPADDING",   (0, 0), (-1, 0), 14),
            ("BOTTOMPADDING",(0, 0), (-1, 0), 14),
            ("LEFTPADDING",  (1, 0), (1, 0), 12),
            ("BOX",          (0, 0), (-1, -1), 1, BORDER),
            ("ROUNDEDCORNERS", (0, 0), (-1, -1), 4),
        ]))
        return [table]

    # ── Metadata table ─────────────────────────────────────────────────────

    def _build_metadata_table(self, data: dict, styles: dict) -> list:
        created = data.get("created_at", "")
        if isinstance(created, datetime):
            created = created.strftime("%d %b %Y, %H:%M")
        elif isinstance(created, str) and created:
            try:
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                created = dt.strftime("%d %b %Y, %H:%M")
            except ValueError:
                pass

        rows = [
            ["Company Name",     data.get("company_name") or "Not Specified"],
            ["Product Name",     data.get("product_name") or "Not Specified"],
            ["File Name",        data.get("filename", "N/A")],
            ["Analysis ID",      str(data.get("analysis_id", "?"))],
            ["Scan Date",        created],
            ["OCR Confidence",   f"{data.get('ocr_confidence', 0):.1f}%"],
            ["Image Quality",    f"{data.get('image_quality_confidence', 0):.1f}%"],
        ]
        
        notes = data.get("auditor_notes")
        if notes:
            rows.append(["Auditor Notes", notes])

        table_data = [[Paragraph(f"<b>{r[0]}</b>", styles["meta_key"]),
                        Paragraph(r[1], styles["meta_val"])] for r in rows]
        table = Table(table_data, colWidths=[55 * mm, 125 * mm])
        table.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (0, -1), BRAND_LIGHT),
            ("GRID",        (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING",  (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING",(0,0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ]))
        return [table]

    # ── Images section ──────────────────────────────────────────────────────

    def _build_images_section(self, data: dict, styles: dict) -> list:
        from reportlab.platypus import Image as RLImage
        import os
        
        elements = []
        annotated = data.get("annotated_image_path")
        preprocessed = data.get("preprocessed_image_path")
        
        images_to_show = []
        if preprocessed and os.path.exists(preprocessed):
            images_to_show.append((preprocessed, "Product Image"))
        if annotated and os.path.exists(annotated):
            images_to_show.append((annotated, "OCR Highlighted Regions"))
            
        if not images_to_show:
            return elements

        elements.append(Paragraph("Inspection Images", styles["section_header"]))
        elements.append(Spacer(1, 3 * mm))
        
        img_table_data = [[]]
        for path, label in images_to_show:
            try:
                img = RLImage(path)
                # Scale image to fit within half the page width (minus margins)
                max_width = (self.PAGE_W - 2 * self.MARGIN) / len(images_to_show) - 10
                max_height = 80 * mm
                aspect = img.imageWidth / float(img.imageHeight)
                if aspect > (max_width / max_height):
                    img.drawWidth = max_width
                    img.drawHeight = max_width / aspect
                else:
                    img.drawHeight = max_height
                    img.drawWidth = max_height * aspect
                
                cell = [
                    img,
                    Spacer(1, 2 * mm),
                    Paragraph(f"<font size='8' color='#64748B'>{label}</font>", styles["center"])
                ]
                img_table_data[0].append(cell)
            except Exception as e:
                logger.warning(f"Failed to embed image {path} into PDF: {e}")
                
        if img_table_data[0]:
            table = Table(img_table_data)
            table.setStyle(TableStyle([
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]))
            elements.append(table)
            
        return elements

    # ── Findings table ─────────────────────────────────────────────────────

    def _build_findings_table(self, findings: list[dict], styles: dict) -> list:
        if not findings:
            return [Paragraph("No findings recorded.", styles["body"])]

        header = [
            Paragraph("<b>Rule Code</b>", styles["th"]),
            Paragraph("<b>Check</b>", styles["th"]),
            Paragraph("<b>Status</b>", styles["th"]),
            Paragraph("<b>Details</b>", styles["th"]),
        ]
        rows = [header]
        for i, f in enumerate(findings):
            status = f.get("status", "SKIP")
            status_color = STATUS_COLORS.get(status, SKIP_GRAY)
            row = [
                Paragraph(f.get("rule_code", ""), styles["td_code"]),
                Paragraph(f.get("rule_name", ""), styles["td"]),
                Paragraph(f"<b>{status}</b>", ParagraphStyle(
                    "status_cell", fontName="Helvetica-Bold", fontSize=8,
                    textColor=status_color, alignment=TA_CENTER
                )),
                Paragraph((f.get("message", "") or "")[:120], styles["td_small"]),
            ]
            rows.append(row)

        col_w = [30 * mm, 45 * mm, 20 * mm, 85 * mm]
        table = Table(rows, colWidths=col_w, repeatRows=1)

        ts = [
            ("BACKGROUND",    (0, 0), (-1, 0), TABLE_HDR),
            ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
            ("GRID",          (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
        ]
        for i in range(1, len(rows)):
            if i % 2 == 0:
                ts.append(("BACKGROUND", (0, i), (-1, i), TABLE_ALT))

        table.setStyle(TableStyle(ts))
        return [table]

    # ── Penalty section ────────────────────────────────────────────────────

    def _build_penalty_section(self, penalty: dict, styles: dict) -> list:
        story = []
        violations = penalty.get("violations", [])

        summary_data = [
            [Paragraph("<b>Total Violations</b>", styles["meta_key"]),
             Paragraph(str(penalty.get("violation_count", 0)), styles["meta_val"])],
            [Paragraph("<b>Estimated Fine Range</b>", styles["meta_key"]),
             Paragraph(
                 f"₹{penalty.get('total_fine_min', 0):,.0f} – ₹{penalty.get('total_fine_max', 0):,.0f}",
                 styles["meta_val"]
             )],
            [Paragraph("<b>Offense Type</b>", styles["meta_key"]),
             Paragraph("Repeat Offense" if penalty.get("is_repeat_offense") else "First Offense",
                       styles["meta_val"])],
        ]
        t = Table(summary_data, colWidths=[55 * mm, 125 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (0, -1), colors.HexColor("#FEF3C7")),
            ("GRID",        (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING",  (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING",(0,0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(t)

        if violations:
            story.append(Spacer(1, 4 * mm))
            viol_header = [
                Paragraph("<b>Rule Code</b>", styles["th"]),
                Paragraph("<b>Act Section</b>", styles["th"]),
                Paragraph("<b>Fine Min (₹)</b>", styles["th"]),
                Paragraph("<b>Fine Max (₹)</b>", styles["th"]),
                Paragraph("<b>Notes</b>", styles["th"]),
            ]
            viol_rows = [viol_header]
            for v in violations:
                viol_rows.append([
                    Paragraph(v.get("rule_code", ""), styles["td_code"]),
                    Paragraph(v.get("act_section", "")[:80], styles["td_small"]),
                    Paragraph(f"₹{v.get('fine_min', 0):,.0f}", styles["td"]),
                    Paragraph(f"₹{v.get('fine_max', 0):,.0f}", styles["td"]),
                    Paragraph(v.get("notes") or "", styles["td_small"]),
                ])
            vt = Table(viol_rows, colWidths=[20 * mm, 60 * mm, 20 * mm, 25 * mm, 55 * mm], repeatRows=1)
            vt.setStyle(TableStyle([
                ("BACKGROUND",   (0, 0), (-1, 0), colors.HexColor("#92400E")),
                ("TEXTCOLOR",    (0, 0), (-1, 0), WHITE),
                ("GRID",         (0, 0), (-1, -1), 0.5, BORDER),
                ("TOPPADDING",   (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING",(0,0),  (-1, -1), 5),
                ("LEFTPADDING",  (0, 0), (-1, -1), 6),
                ("FONTSIZE",     (0, 0), (-1, -1), 8),
            ]))
            story.append(vt)

        return story

    # ── Barcode section ────────────────────────────────────────────────────

    def _build_barcode_section(self, barcode: dict, styles: dict) -> list:
        codes = barcode.get("found_codes", [])
        status = barcode.get("overall_status", "SKIP")
        status_color = STATUS_COLORS.get(status, SKIP_GRAY)

        story = [
            Paragraph(
                f"Status: <font color='{status_color.hexval()}'><b>{status}</b></font> — "
                f"{barcode.get('message', '')}",
                styles["body"]
            ),
            Spacer(1, 3 * mm),
        ]

        if codes:
            header = [
                Paragraph("<b>Symbology</b>", styles["th"]),
                Paragraph("<b>Decoded Data</b>", styles["th"]),
                Paragraph("<b>Checksum</b>", styles["th"]),
                Paragraph("<b>Location</b>", styles["th"]),
            ]
            rows = [header]
            for c in codes:
                checksum = (
                    "✓ Valid" if c.get("checksum_valid") is True
                    else ("✗ Invalid" if c.get("checksum_valid") is False else "N/A")
                )
                rows.append([
                    Paragraph(c.get("symbology", ""), styles["td"]),
                    Paragraph((c.get("raw_data", "") or "")[:60], styles["td_small"]),
                    Paragraph(checksum, styles["td"]),
                    Paragraph((c.get("location", "") or "")[:40], styles["td_small"]),
                ])
            t = Table(rows, colWidths=[30 * mm, 90 * mm, 25 * mm, 35 * mm], repeatRows=1)
            t.setStyle(TableStyle([
                ("BACKGROUND",   (0, 0), (-1, 0), TABLE_HDR),
                ("TEXTCOLOR",    (0, 0), (-1, 0), WHITE),
                ("GRID",         (0, 0), (-1, -1), 0.5, BORDER),
                ("TOPPADDING",   (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING",(0,0),  (-1, -1), 5),
                ("LEFTPADDING",  (0, 0), (-1, -1), 6),
                ("FONTSIZE",     (0, 0), (-1, -1), 8),
            ]))
            story.append(t)

        return story

    # ── Signature block ────────────────────────────────────────────────────

    def _build_signature_block(self, data: dict, styles: dict) -> list:
        from reportlab.graphics.shapes import Drawing
        from reportlab.graphics.barcode import qr

        analysis_id = str(data.get("analysis_id", "?"))
        # Local URL for the QR code
        qr_url = f"http://localhost:5173/scan?id={analysis_id}"
        
        qr_code = qr.QrCodeWidget(qr_url)
        qr_code.barWidth = 25 * mm
        qr_code.barHeight = 25 * mm
        qr_code.qrVersion = 1
        d = Drawing(25 * mm, 25 * mm)
        d.add(qr_code)

        sig_data = [
            [
                d,
                Paragraph(
                    "<b>Inspector / Authorized Officer</b><br/><br/><br/>"
                    "________________________<br/>Signature &amp; Stamp",
                    styles["sig"]
                ),
                Paragraph(
                    "<b>Date of Inspection</b><br/><br/><br/>"
                    f"________________________<br/>{datetime.now().strftime('%d %b %Y')}",
                    styles["sig"]
                ),
            ]
        ]
        t = Table(sig_data, colWidths=[60 * mm, 60 * mm, 60 * mm])
        t.setStyle(TableStyle([
            ("BOX",          (0, 0), (0, 0), 0.5, BORDER),
            ("BOX",          (1, 0), (1, 0), 0.5, BORDER),
            ("BOX",          (2, 0), (2, 0), 0.5, BORDER),
            ("TOPPADDING",   (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING",(0,0),  (-1, -1), 20),
            ("LEFTPADDING",  (0, 0), (-1, -1), 10),
            ("ALIGN",        (0, 0), (-1, -1), "CENTER"),
            ("VALIGN",       (0, 0), (0, 0), "MIDDLE"),
        ]))
        return [
            HRFlowable(width="100%", thickness=1, color=BORDER),
            Spacer(1, 6 * mm),
            Paragraph("Official Use — Compliance Audit Signoff", styles["small_center"]),
            Spacer(1, 4 * mm),
            t,
        ]

    # ── Page footer ────────────────────────────────────────────────────────

    @staticmethod
    def _page_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(SKIP_GRAY)
        canvas.drawString(
            doc.leftMargin,
            10 * mm,
            f"LM Compliance Checker — Confidential — Generated {datetime.now().strftime('%d %b %Y %H:%M')}",
        )
        canvas.drawRightString(
            doc.width + doc.leftMargin,
            10 * mm,
            f"Page {doc.page}",
        )
        canvas.restoreState()

    # ── Styles ─────────────────────────────────────────────────────────────

    def _make_styles(self) -> dict:
        base = getSampleStyleSheet()
        return {
            "brand_title": ParagraphStyle(
                "brand_title", fontName="Helvetica-Bold", fontSize=16,
                textColor=WHITE, alignment=TA_LEFT, leading=20,
            ),
            "header_right": ParagraphStyle(
                "header_right", fontName="Helvetica-Bold", fontSize=11,
                textColor=WHITE, alignment=TA_RIGHT, leading=16,
            ),
            "section_header": ParagraphStyle(
                "section_header", fontName="Helvetica-Bold", fontSize=12,
                textColor=BRAND_DARK, spaceBefore=4, spaceAfter=2,
            ),
            "body": ParagraphStyle(
                "body", fontName="Helvetica", fontSize=9, textColor=BRAND_DARK, leading=13,
            ),
            "meta_key": ParagraphStyle(
                "meta_key", fontName="Helvetica-Bold", fontSize=9, textColor=BRAND_DARK,
            ),
            "meta_val": ParagraphStyle(
                "meta_val", fontName="Helvetica", fontSize=9, textColor=BRAND_DARK,
            ),
            "th": ParagraphStyle(
                "th", fontName="Helvetica-Bold", fontSize=8, textColor=WHITE, alignment=TA_CENTER,
            ),
            "td": ParagraphStyle(
                "td", fontName="Helvetica", fontSize=8, textColor=BRAND_DARK,
            ),
            "td_code": ParagraphStyle(
                "td_code", fontName="Courier", fontSize=7, textColor=BRAND_BLUE,
            ),
            "td_small": ParagraphStyle(
                "td_small", fontName="Helvetica", fontSize=7, textColor=BRAND_DARK, leading=9,
            ),
            "center": ParagraphStyle(
                "center", fontName="Helvetica-Bold", fontSize=32,
                textColor=WHITE, alignment=TA_CENTER,
            ),
            "banner_text": ParagraphStyle(
                "banner_text", fontName="Helvetica-Bold", fontSize=14,
                textColor=BRAND_DARK, alignment=TA_LEFT, leftIndent=8,
            ),
            "sig": ParagraphStyle(
                "sig", fontName="Helvetica", fontSize=9,
                textColor=BRAND_DARK, alignment=TA_CENTER, leading=14,
            ),
            "small_center": ParagraphStyle(
                "small_center", fontName="Helvetica", fontSize=8,
                textColor=SKIP_GRAY, alignment=TA_CENTER,
            ),
        }


pdf_report_service = PDFReportService()
