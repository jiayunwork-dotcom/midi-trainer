from PIL import Image
import os
import struct

def resize_image(input_path, output_path, size):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    img.save(output_path, "PNG")
    print(f"Generated: {output_path}")

def generate_ico(input_path, output_path, sizes=[16, 32, 48, 64, 128, 256]):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    
    images = []
    for size in sizes:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        images.append(resized)
    
    images[0].save(output_path, format="ICO", sizes=[(s, s) for s in sizes])
    print(f"Generated: {output_path}")

def generate_icns(input_path, output_path, sizes=[16, 32, 64, 128, 256, 512]):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    
    with open(output_path, "wb") as f:
        icon_entries = []
        total_size = 8
        
        size_map = {
            16: (b"icp4", 16),
            32: (b"icp5", 32),
            64: (b"icp6", 64),
            128: (b"ic07", 128),
            256: (b"ic08", 256),
            512: (b"ic09", 512),
        }
        
        for size in sizes:
            if size not in size_map:
                continue
            
            tag, s = size_map[size]
            resized = img.resize((s, s), Image.Resampling.LANCZOS)
            
            import io
            png_buffer = io.BytesIO()
            resized.save(png_buffer, format="PNG")
            png_data = png_buffer.getvalue()
            
            entry_size = 8 + len(png_data)
            icon_entries.append((tag, png_data))
            total_size += entry_size
        
        f.write(b"icns")
        f.write(struct.pack(">I", total_size))
        
        for tag, data in icon_entries:
            f.write(tag)
            f.write(struct.pack(">I", 8 + len(data)))
            f.write(data)
    
    print(f"Generated: {output_path}")

def main():
    icons_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(icons_dir, "icon_512.png")
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found!")
        return
    
    resize_image(input_file, os.path.join(icons_dir, "32x32.png"), 32)
    resize_image(input_file, os.path.join(icons_dir, "128x128.png"), 128)
    resize_image(input_file, os.path.join(icons_dir, "128x128@2x.png"), 256)
    resize_image(input_file, os.path.join(icons_dir, "icon.png"), 512)
    
    generate_ico(input_file, os.path.join(icons_dir, "icon.ico"))
    generate_icns(input_file, os.path.join(icons_dir, "icon.icns"))
    
    print("\nAll icons generated successfully!")

if __name__ == "__main__":
    main()
