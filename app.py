#!/usr/bin/env python3
"""Developer helper menu for Arrow Escape.

Usage:
    python app.py        # interactive menu
    python app.py 3      # run a menu option directly
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ANDROID_DIR = ROOT / "android"
RELEASE_DIR = ROOT / "release"
RELEASE_APK = RELEASE_DIR / "app-release.apk"
APK_OUTPUT = ANDROID_DIR / "app" / "build" / "outputs" / "apk" / "release" / "app-release.apk"
IS_WINDOWS = os.name == "nt"
EMULATOR_BOOT_TIMEOUT_S = 180


class CommandError(RuntimeError):
    pass


def info(msg: str) -> None:
    print(f"\n==> {msg}")


def resolve_exe(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise CommandError(f"'{name}' was not found on PATH.")
    return path


def run(cmd: list[str], cwd: Path = ROOT, check: bool = True) -> int:
    print(f"$ {' '.join(cmd)}")
    try:
        code = subprocess.call([resolve_exe(cmd[0]), *cmd[1:]], cwd=cwd)
    except KeyboardInterrupt:
        return 130
    if check and code != 0:
        raise CommandError(f"Command failed with exit code {code}: {' '.join(cmd)}")
    return code


def android_sdk() -> Path:
    for var in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        value = os.environ.get(var)
        if value and Path(value).is_dir():
            return Path(value)
    if IS_WINDOWS and os.environ.get("LOCALAPPDATA"):
        default = Path(os.environ["LOCALAPPDATA"]) / "Android" / "Sdk"
    else:
        default = Path.home() / ("Library/Android/sdk" if sys.platform == "darwin" else "Android/Sdk")
    if default.is_dir():
        return default
    raise CommandError("Android SDK not found. Set ANDROID_HOME to your SDK path.")


def sdk_tool(subdir: str, name: str) -> str:
    exe = android_sdk() / subdir / (f"{name}.exe" if IS_WINDOWS else name)
    if not exe.exists():
        raise CommandError(f"{name} not found at {exe}")
    return str(exe)


def adb(*args: str) -> str:
    result = subprocess.run(
        [sdk_tool("platform-tools", "adb"), *args],
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def connected_devices() -> list[str]:
    lines = adb("devices").splitlines()[1:]
    return [line.split()[0] for line in lines if line.strip().endswith("device")]


def choose(prompt: str, items: list[str]) -> str:
    if len(items) == 1:
        return items[0]
    for i, item in enumerate(items, 1):
        print(f"  {i}. {item}")
    while True:
        answer = input(f"{prompt} [1-{len(items)}]: ").strip()
        if answer.isdigit() and 1 <= int(answer) <= len(items):
            return items[int(answer) - 1]
        print("Invalid choice.")


def ensure_emulator_running() -> None:
    if connected_devices():
        info(f"Using connected device(s): {', '.join(connected_devices())}")
        return

    emulator = sdk_tool("emulator", "emulator")
    avds = subprocess.run([emulator, "-list-avds"], capture_output=True, text=True).stdout.split()
    if not avds:
        raise CommandError("No Android emulators found. Create one in Android Studio > Device Manager.")

    avd = choose("Select emulator", avds)
    info(f"Booting emulator '{avd}'...")
    flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS if IS_WINDOWS else 0
    subprocess.Popen(
        [emulator, "-avd", avd],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=flags,
        start_new_session=not IS_WINDOWS,
    )

    adb("wait-for-device")
    deadline = time.time() + EMULATOR_BOOT_TIMEOUT_S
    while time.time() < deadline:
        if adb("shell", "getprop", "sys.boot_completed") == "1":
            info("Emulator is ready.")
            return
        time.sleep(2)
    raise CommandError(f"Emulator did not finish booting within {EMULATOR_BOOT_TIMEOUT_S}s.")


def latest_release_apk() -> Path:
    if not RELEASE_APK.exists():
        raise CommandError(f"No {RELEASE_APK.name} in release/. Build one first (option 3).")
    return RELEASE_APK


def android_package() -> str:
    try:
        config = json.loads((ROOT / "app.json").read_text(encoding="utf-8"))
        return config["expo"]["android"]["package"]
    except (OSError, KeyError, json.JSONDecodeError) as err:
        raise CommandError(f"Could not read expo.android.package from app.json ({err}).")


# ---------------------------------------------------------------- actions


def start_project() -> None:
    info("Starting Expo dev server (Ctrl+C to stop)...")
    run(["npx", "expo", "start"], check=False)


def start_in_emulator() -> None:
    ensure_emulator_running()
    info("Starting Expo dev server and opening on Android (Ctrl+C to stop)...")
    run(["npx", "expo", "start", "--android"], check=False)


def build_release_apk() -> None:
    info("Generating native Android project (expo prebuild)...")
    run(["npx", "expo", "prebuild", "--platform", "android"])

    info("Building release APK with Gradle (this can take several minutes)...")
    gradlew = str(ANDROID_DIR / ("gradlew.bat" if IS_WINDOWS else "gradlew"))
    run([gradlew, "assembleRelease"], cwd=ANDROID_DIR)

    if not APK_OUTPUT.exists():
        raise CommandError(f"Build finished but APK not found at {APK_OUTPUT}")

    RELEASE_DIR.mkdir(exist_ok=True)
    target = RELEASE_APK
    shutil.copy2(APK_OUTPUT, target)
    size_mb = target.stat().st_size / (1024 * 1024)
    info(f"APK copied to {target.relative_to(ROOT)} ({size_mb:.1f} MB)")


def install_latest_apk() -> None:
    apk = latest_release_apk()
    ensure_emulator_running()
    info(f"Installing {apk.name}...")
    output = adb("install", "-r", str(apk))
    print(output)
    if "Success" not in output:
        raise CommandError("APK install failed.")


def run_apk_in_emulator() -> None:
    install_latest_apk()
    package = android_package()
    info(f"Launching {package}...")
    output = adb("shell", "monkey", "-p", package, "-c", "android.intent.category.LAUNCHER", "1")
    if "Events injected: 1" not in output:
        print(output)
        raise CommandError(f"Could not launch {package}.")


def start_clear_cache() -> None:
    info("Starting Expo dev server with cleared Metro cache (Ctrl+C to stop)...")
    run(["npx", "expo", "start", "--clear"], check=False)


ACTIONS = {
    "1": ("Start the project (npx expo start)", start_project),
    "2": ("Start the project in Android emulator", start_in_emulator),
    "3": ("Build release .apk and copy to release/", build_release_apk),
    "4": ("Install latest release .apk on emulator/device", install_latest_apk),
    "5": ("Start the project with cleared cache", start_clear_cache),
    "6": ("Install and run release .apk in emulator", run_apk_in_emulator),
}


def run_action(key: str) -> None:
    label, action = ACTIONS[key]
    try:
        action()
    except CommandError as err:
        print(f"\n[error] {err}")
    except KeyboardInterrupt:
        print(f"\n[cancelled] {label}")


def menu() -> None:
    while True:
        print("\n=== Arrow Escape ===")
        for key, (label, _) in ACTIONS.items():
            print(f"  {key}. {label}")
        print("  0. Exit")
        try:
            choice = input("Select an option: ").strip()
        except (KeyboardInterrupt, EOFError):
            print()
            return
        if choice == "0":
            return
        if choice in ACTIONS:
            run_action(choice)
        else:
            print("Invalid option.")


def main() -> None:
    os.chdir(ROOT)
    if len(sys.argv) > 1:
        key = sys.argv[1]
        if key not in ACTIONS:
            sys.exit(f"Unknown option '{key}'. Valid: {', '.join(ACTIONS)}")
        run_action(key)
    else:
        menu()


if __name__ == "__main__":
    main()
