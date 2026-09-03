from PIL import Image, ImageDraw, ImageFont
import os

def create_sample(path, title, lines):
    # Create a white image
    img = Image.new('RGB', (800, 400), color='white')
    d = ImageDraw.Draw(img)
    
    # Try to load a font, otherwise use default
    try:
        title_font = ImageFont.truetype("arial.ttf", 40)
        body_font = ImageFont.truetype("arial.ttf", 24)
    except:
        title_font = None
        body_font = None

    # Draw title
    d.text((40, 40), title, fill=(0,0,0), font=title_font)
    
    # Draw a line
    d.line([(40, 100), (760, 100)], fill=(0,0,0), width=3)
    
    # Draw body lines
    y = 130
    for line in lines:
        d.text((40, y), line, fill=(0,0,0), font=body_font)
        y += 40

    img.save(path)

if __name__ == "__main__":
    out_dir = r"c:\Users\hp\Documents\antigravity project\lm-compliance-checker\frontend\public\samples"
    os.makedirs(out_dir, exist_ok=True)
    
    # Sample 1: Perfect Compliance
    lines1 = [
        "Net Weight: 500 g",
        "MRP Rs. 150 (Inclusive of all taxes)",
        "Manufactured by: Perfect Foods Pvt. Ltd.",
        "123 Quality Street, Mumbai, 400001",
        "Mfg. Date: 01/2025",
        "Customer Care: 1800-111-2222 or support@perfectfoods.com"
    ]
    create_sample(os.path.join(out_dir, "sample_1_perfect.png"), "Premium Whole Wheat Biscuits", lines1)

    # Sample 2: Missing MRP and Date
    lines2 = [
        "Net Volume: 1 L",
        "Price: 50", 
        "Made by: Shoddy Drinks Inc.",
        "Some street, Delhi", 
        "Best Before: 6 months from manufacture", 
        "Contact: www.shoddydrinks.com"
    ]
    create_sample(os.path.join(out_dir, "sample_2_failed.png"), "Fizzy Orange Cola", lines2)
    print("Samples generated successfully.")
