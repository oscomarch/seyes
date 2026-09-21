from PIL import Image, ImageDraw, ImageFont

S = 1024                      # master size
PAD = int(S * 0.085)          # macOS icons float inside their canvas
BOX = S - 2 * PAD
R = int(BOX * 0.2237)         # Big Sur squircle-ish corner radius

PAPER      = (247, 245, 239, 255)   # --paper  #f7f5ef
INK        = ( 23,  17,  11, 255)   # --ink    #17110b
RULING     = ( 70, 105, 160)        # --ruling  blue
MARGIN     = (170,  70,  60)        # --margin-line  rust
EDGE       = (195, 186, 168, 255)   # --rule-strong

img = Image.new('RGBA', (S, S), (0, 0, 0, 0))

# The sheet itself.
sheet = Image.new('RGBA', (BOX, BOX), (0, 0, 0, 0))
sd = ImageDraw.Draw(sheet)
sd.rounded_rectangle([0, 0, BOX - 1, BOX - 1], radius=R, fill=PAPER)

# Séyès ruling: fine blue grid, stronger horizontal every fourth line.
rules = Image.new('RGBA', (BOX, BOX), (0, 0, 0, 0))
rd = ImageDraw.Draw(rules)
step = BOX // 11
for i in range(1, 12):                     # horizontals
    y = i * step
    strong = (i % 4 == 0)
    rd.line([(0, y), (BOX, y)], fill=RULING + (70 if strong else 34,),
            width=5 if strong else 3)
for i in range(1, 12):                     # verticals
    x = i * step
    rd.line([(x, 0), (x, BOX)], fill=RULING + (26,), width=3)

# The rust margin line, the thing that makes the paper French.
margin_x = int(BOX * 0.235)
rd.line([(margin_x, 0), (margin_x, BOX)], fill=MARGIN + (205,), width=9)

# Clip the ruling to the rounded sheet.
mask = Image.new('L', (BOX, BOX), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, BOX - 1, BOX - 1], radius=R, fill=255)
sheet.paste(rules, (0, 0), Image.composite(rules.split()[3], Image.new('L', (BOX, BOX), 0), mask))

# A hairline edge so the sheet reads as paper on a light desktop.
sd.rounded_rectangle([0, 0, BOX - 1, BOX - 1], radius=R, outline=EDGE, width=3)

# The S, sitting in the writing area to the right of the margin.
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Courier New Bold.ttf', int(BOX * 0.62))
sd2 = ImageDraw.Draw(sheet)
box = sd2.textbbox((0, 0), 'S', font=font)
w, h = box[2] - box[0], box[3] - box[1]
sd2.text((margin_x + int(BOX * 0.105) - box[0], (BOX - h) // 2 - box[1]), 'S', font=font, fill=INK)

img.paste(sheet, (PAD, PAD), sheet)
img.save('icon_1024.png')
print('wrote icon_1024.png')
