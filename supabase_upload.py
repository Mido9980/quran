#!/usr/bin/env python3
"""Upload the Quran app to a Supabase Storage bucket.
Usage: SUPABASE_URL=... SUPABASE_KEY=... BUCKET=quran python3 supabase_upload.py
"""
import os, mimetypes, urllib.request, json, sys

URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
KEY = os.environ.get('SUPABASE_KEY', '')
BUCKET = os.environ.get('BUCKET', 'quran')
ROOT = os.path.dirname(os.path.abspath(__file__))

if not URL or not KEY:
    sys.exit('Set SUPABASE_URL and SUPABASE_KEY')

def api(path, method='POST', data=None, headers=None, raw=None):
    h = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}
    if headers: h.update(headers)
    req = urllib.request.Request(f'{URL}{path}', method=method, data=raw if raw is not None else (json.dumps(data).encode() if data else None), headers=h)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode(errors='ignore')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors='ignore')

def ensure_bucket():
    st, body = api('/storage/v1/bucket', 'POST', {'id': BUCKET, 'name': BUCKET, 'public': True})
    print('bucket:', st, body[:120])

def upload_all():
    files = ['index.html', 'styles.css', 'app.js', 'data.js', 'manifest.json', 'sw.js', 'amiri.ttf',
             'icons/i192.png', 'icons/i512.png', 'icons/apple-touch-icon.png']
    for f in files:
        p = os.path.join(ROOT, f)
        if not os.path.exists(p):
            print('skip missing', f); continue
        ctype = mimetypes.guess_type(p)[0] or 'application/octet-stream'
        if f.endswith('.ttf'): ctype = 'font/ttf'
        if f.endswith('.js'): ctype = 'application/javascript'
        with open(p, 'rb') as fh:
            raw = fh.read()
        st, body = api(f'/storage/v1/object/{BUCKET}/{f}', 'POST',
                       headers={'Content-Type': ctype, 'x-upsert': 'true',
                                'cache-control': 'public, max-age=3600'}, raw=raw)
        print(f'{f}: {st} {body[:80]}')

ensure_bucket()
upload_all()
print('public base:', f'{URL}/storage/v1/object/public/{BUCKET}/index.html')
