#!/usr/bin/env python3
"""Minimal static file server for the resume editor preview."""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)  # do this before anything reads the (inaccessible) start cwd

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 4173

if __name__ == "__main__":
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), SimpleHTTPRequestHandler)
    print(f"Serving {ROOT} at http://127.0.0.1:{PORT}")
    httpd.serve_forever()
