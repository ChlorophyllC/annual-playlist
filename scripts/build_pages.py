"""Create a static-only publish artifact; never publish server or credentials."""
from pathlib import Path
import shutil
root = Path(__file__).resolve().parent.parent
out = root / 'dist'
out.mkdir(exist_ok=True)
files = ['index.html','styles.css','assets.js','themes.js','albums.js','sorting.js','design.js','app.js','export.js','text-export.js','manual.js','project.js','sample-playlist.json','LEGAL.md','LICENSE','README.md']
for name in files:
    shutil.copyfile(root / name, out / name)
(out / '.nojekyll').touch()
print('Static Pages artifact:', out)
