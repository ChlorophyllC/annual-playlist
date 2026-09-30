#!/usr/bin/env python3
from PIL import Image
import os

# 创建输出目录
os.makedirs('materials/flowers', exist_ok=True)
os.makedirs('materials/frames', exist_ok=True)

# 处理花卉素材 (1024x1536)
# 尝试3列x4行的布局
img1 = Image.open('materials/spring-material-1.png')
cols1, rows1 = 3, 4
cell_w1 = img1.size[0] // cols1
cell_h1 = img1.size[1] // rows1

print(f"Splitting material 1 (flowers): {cols1}x{rows1} grid, each cell {cell_w1}x{cell_h1}")

for row in range(rows1):
    for col in range(cols1):
        left = col * cell_w1
        top = row * cell_h1
        right = left + cell_w1
        bottom = top + cell_h1

        cell = img1.crop((left, top, right, bottom))

        # 检查是否主要是透明的（空白单元格）
        if cell.mode == 'RGBA':
            alpha = cell.split()[-1]
            if alpha.getextrema()[1] > 10:  # 有足够的不透明像素
                idx = row * cols1 + col + 1
                cell.save(f'materials/flowers/flower-{idx:02d}.png')
                print(f"  Saved flower-{idx:02d}.png")

# 处理相纸/便签素材 (2048x2048)
# 尝试4列x4行的布局
img2 = Image.open('materials/spring-material-2.png')
cols2, rows2 = 4, 4
cell_w2 = img2.size[0] // cols2
cell_h2 = img2.size[1] // rows2

print(f"\nSplitting material 2 (frames): {cols2}x{rows2} grid, each cell {cell_w2}x{cell_h2}")

for row in range(rows2):
    for col in range(cols2):
        left = col * cell_w2
        top = row * cell_h2
        right = left + cell_w2
        bottom = top + cell_h2

        cell = img2.crop((left, top, right, bottom))

        # 检查是否主要是透明的（空白单元格）
        if cell.mode == 'RGBA':
            alpha = cell.split()[-1]
            if alpha.getextrema()[1] > 10:  # 有足够的不透明像素
                idx = row * cols2 + col + 1
                cell.save(f'materials/frames/frame-{idx:02d}.png')
                print(f"  Saved frame-{idx:02d}.png")

print("\nDone! Check materials/flowers/ and materials/frames/")
