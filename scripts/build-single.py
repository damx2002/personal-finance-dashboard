"""Rebuild the standalone HTML from the maintained HTML, CSS and JS files."""
from pathlib import Path
root = Path(__file__).resolve().parent.parent
import re
html = (root / 'index.html').read_text()
html = re.sub(r'(style\.css|app\.js|summary\.js|v3-core\.js|stress-core\.js|health-analysis\.js|scenario-core\.js|scenario-ui\.js|pwa\.js)\?[^\"]*', r'\1', html)
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>' + (root / 'style.css').read_text() + '</style>')
scripts = ['v3-core.js', 'stress-core.js', 'scenario-core.js', 'health-analysis.js', 'app.js', 'summary.js', 'scenario-ui.js', 'pwa.js']
for script in scripts:
    html = html.replace(f'<script src="{script}" defer></script>', '')
html = html.replace('</body>', ''.join('<script>' + (root / script).read_text() + '</script>' for script in scripts) + '</body>')
(root / 'dashboard.html').write_text(html)
print('Built dashboard.html')

# Version service-worker cache whenever any shipped static resource changes.
import hashlib
assets = ['index.html', 'dashboard.html', 'style.css', *scripts, 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png']
digest = hashlib.sha256(b''.join((root / name).read_bytes() for name in assets)).hexdigest()[:16]
worker = root / 'service-worker.js'
worker.write_text(re.sub(r"const RELEASE='[^']+';", f"const RELEASE='v41-{digest}';", worker.read_text()))
print('Static cache release:', digest)
