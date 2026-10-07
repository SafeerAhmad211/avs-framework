import sys,glob
from PIL import Image, ImageDraw
out=sys.argv[1]; ts=sys.argv[2].split(',')
ims=[Image.open(f'{out}/t{t}.jpg').resize((640,360)) for t in ts]
cols=3; rows=(len(ims)+cols-1)//cols
sh=Image.new('RGB',(640*cols,360*rows))
for i,(im,t) in enumerate(zip(ims,ts)):
    d=ImageDraw.Draw(im); d.text((10,10),t,fill=(255,255,0)); sh.paste(im,((i%cols)*640,(i//cols)*360))
sh.save(f'{out}/sheet.jpg',quality=85)
