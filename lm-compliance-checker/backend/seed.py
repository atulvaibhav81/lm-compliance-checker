import os
import sys
from datetime import datetime, timedelta
import random

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db.session import SessionLocal, init_db
from db.models.upload import Upload, UploadStatus
from db.models.analysis import Analysis
from db.models.compliance import ComplianceFinding
from db.models.batch_job import BatchJob, BatchItem, BatchJobStatus

def seed_database():
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(Analysis).count() > 0:
            print("Database already contains data, skipping seed.")
            return

        print("Seeding database...")
        now = datetime.now()
        
        # We will generate 30 analyses over the last 30 days
        for i in range(30):
            days_ago = random.randint(0, 30)
            created = now - timedelta(days=days_ago, hours=random.randint(1, 23))
            
            # Create Upload
            upload = Upload(
                original_filename=f"package_sample_{i+1}.jpg",
                stored_filename=f"mock_{i+1}.jpg",
                file_path="/mock/path.jpg",
                mime_type="image/jpeg",
                status=UploadStatus.DONE
            )
            db.add(upload)
            db.flush()
            
            # Update created_at
            upload.created_at = created
            
            # Determine score and rules
            rules = ["NAME", "NET_QTY", "MRP", "MFG_DATE", "CUSTOMER_CARE", "FONT_SIZE", "BARCODE"]
            is_good = random.random() > 0.4
            
            analysis = Analysis(
                upload_id=upload.id,
                raw_ocr_text="Mock OCR text...",
                preprocessed_image_path="/mock/path.jpg",
                ocr_confidence=random.uniform(0.7, 0.99),
                image_quality_confidence=random.uniform(0.6, 0.95),
            )
            db.add(analysis)
            db.flush()
            
            # Update created_at
            analysis.created_at = created
            
            pass_count = 0
            fail_count = 0
            warn_count = 0
            
            for rule in rules:
                if rule == "BARCODE" and not is_good:
                    status = "WARN"
                    warn_count += 1
                elif random.random() > 0.8 and not is_good:
                    status = "FAIL"
                    fail_count += 1
                else:
                    status = "PASS"
                    pass_count += 1
                    
                finding = ComplianceFinding(
                    analysis_id=analysis.id,
                    rule_code=rule,
                    rule_name=rule.replace("_", " ").title(),
                    status=status,
                    extracted_value="Mock Value",
                    message=f"{rule} validation {status.lower()}"
                )
                db.add(finding)
                
            score = (pass_count / len(rules)) * 100
            
            # Create a mock batch job for every 5th item
            if i % 5 == 0:
                batch = BatchJob(
                    batch_name=f"Bulk Scan {i}",
                    status=BatchJobStatus.DONE,
                    total_images=1,
                    processed_images=1,
                    failed_images=0,
                    avg_compliance_score=score
                )
                db.add(batch)
                db.flush()
                batch.created_at = created
                
                item = BatchItem(
                    batch_job_id=batch.id,
                    upload_id=upload.id,
                    analysis_id=analysis.id,
                    original_filename=upload.original_filename,
                    status="done",
                    compliance_score=score,
                    pass_count=pass_count,
                    fail_count=fail_count,
                    warn_count=warn_count
                )
                db.add(item)
                
        db.commit()
        print("Database seeded successfully with 30 mock analyses!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    seed_database()
