# -*- mode: python ; coding: utf-8 -*-
#
# PyInstaller spec for GOG Downloader portable Windows app.
#
# Build with:  pyinstaller launcher.spec --noconfirm
# Output:      dist\GOG-Downloader\GOG-Downloader.exe
#
import os

block_cipher = None

a = Analysis(
    ["launcher.py"],
    # Make backend/ importable during dependency analysis
    pathex=[os.path.join(SPECPATH, "backend")],
    binaries=[],
    datas=[
        # Bundle the pre-built React app
        (os.path.join(SPECPATH, "frontend", "dist"), "frontend/dist"),
    ],
    hiddenimports=[
        # uvicorn uses dynamic imports for its loop / protocol backends
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        # pystray backend selection on Windows
        "pystray._win32",
        # FastAPI / starlette internals
        "starlette.routing",
        "starlette.staticfiles",
        "starlette.middleware.cors",
        # multipart form parsing
        "multipart",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="GOG-Downloader",
    icon=os.path.join(SPECPATH, "assets", "app.ico"),
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,        # No terminal window — tray-app only
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="GOG-Downloader",
)
