#!/usr/bin/env python3
from PIL import Image
import sys, os

def make_transparent(input_path, output_path, threshold=240):
    """Convert white background to transparent."""
    img = Image.open(input_path).convert('RGBA')
    data = img.getdata()
    new_data = []
    for item in data:
        r, g, b, a = item
        # If pixel is close to white, set alpha to 0
        if r > threshold and g > threshold and b > threshold:
            new_data.append((r, g, b, 0))
        else:
            new_data.append(item)
    img.putdata(new_data)
    img.save(output_path, 'PNG')
    print(f'Saved transparent logo to {output_path}')

def resize_icons(base_img, sizes, output_dir, prefix='ahoy_launcher'):
    """Generate resized icons."""
    os.makedirs(output_dir, exist_ok=True)
    for size in sizes:
        out = base_img.resize((size, size), Image.Resampling.LANCZOS)
        out_path = os.path.join(output_dir, f'{prefix}_{size}.png')
        out.save(out_path, 'PNG')
        print(f'  {size}x{size} -> {out_path}')

if __name__ == '__main__':
    input_png = 'goodahoy.png'
    if not os.path.exists(input_png):
        print('Input logo not found')
        sys.exit(1)
    # Transparent version
    transparent_png = 'goodahoy_transparent.png'
    make_transparent(input_png, transparent_png, threshold=245)
    # Android sizes (density-specific)
    android_sizes = {
        'mdpi': 48,
        'hdpi': 72,
        'xhdpi': 96,
        'xxhdpi': 144,
        'xxxhdpi': 192,
    }
    img = Image.open(transparent_png).convert('RGBA')
    for density, size in android_sizes.items():
        dir_path = f'android_icons/mipmap-{density}'
        resize_icons(img, [size], dir_path, prefix='ahoy_launcher')
        # round version (same icon, will be masked by system)
        resize_icons(img, [size], dir_path, prefix='ahoy_launcher_round')
    print('Android icons generated in android_icons/')
    # Windows .ico (multiple sizes)
    ico_sizes = [16, 32, 48, 64, 128, 256]
    ico_images = []
    for sz in ico_sizes:
        ico_images.append(img.resize((sz, sz), Image.Resampling.LANCZOS))
    ico_images[0].save('ahoy.ico', format='ICO', sizes=[(sz, sz) for sz in ico_sizes])
    print('Windows .ico saved as ahoy.ico')
    # iOS/macOS icon set (just one size for demo)
    ios_dir = 'ios_icons/AppIcon.appiconset'
    os.makedirs(ios_dir, exist_ok=True)
    ios_sizes = [1024, 180, 120, 87, 80, 60, 58, 40, 29, 20]
    for sz in ios_sizes:
        out = img.resize((sz, sz), Image.Resampling.LANCZOS)
        out.save(os.path.join(ios_dir, f'icon_{sz}.png'), 'PNG')
    print('iOS/macOS icons saved in ios_icons/')