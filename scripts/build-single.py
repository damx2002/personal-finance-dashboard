"""Rebuild the standalone HTML from the maintained HTML, CSS and JS files."""
from pathlib import Path
root = Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>' + (root / 'style.css').read_text() + '</style>')
html = html.replace('<script src="app.js" defer></script>', '')
html = html.replace('<script src="summary.js" defer></script>', '')
html = html.replace('</body>', '<script>' + (root / 'app.js').read_text() + '</script><script>' + (root / 'summary.js').read_text() + '</script></body>')
(root / 'dashboard.html').write_text(html)
print('Built dashboard.html')
