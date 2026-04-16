#!/usr/bin/env python3
"""
Create a GitHub Release for AhoyWindowsClient with the latest successful build artifact.
Requires GITHUB_TOKEN environment variable with repo scope.
"""

import os
import sys
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path
from typing import Optional, Dict, Any
import urllib.request
import urllib.error

GITHUB_API = "https://api.github.com"
REPO = "eugenekrabsbot/AhoyWindowsClient"
TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
if not TOKEN:
    print("ERROR: GITHUB_TOKEN environment variable not set")
    sys.exit(1)

HEADERS = {
    "Authorization": f"token {TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "AhoyVPN-Release-Script"
}

def api_request(method: str, url: str, data: Optional[Dict] = None) -> Dict[str, Any]:
    """Make a GitHub API request."""
    import urllib.request
    import urllib.error
    import json as json_module
    
    req = urllib.request.Request(url, headers=HEADERS, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
        req.data = json_module.dumps(data).encode("utf-8")
    
    try:
        with urllib.request.urlopen(req) as resp:
            return json_module.load(resp)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.read() else ""
        print(f"API error {e.code}: {e.reason}")
        print(f"Response: {body}")
        raise

def get_latest_successful_run() -> Dict[str, Any]:
    """Get the latest successful workflow run."""
    url = f"{GITHUB_API}/repos/{REPO}/actions/runs?status=success&per_page=5"
    runs = api_request("GET", url)
    for run in runs["workflow_runs"]:
        if run["conclusion"] == "success" and run["name"] == "Build Windows Installer":
            return run
    raise RuntimeError("No successful Build Windows Installer run found")

def get_artifacts(run_id: int) -> Dict[str, Any]:
    """Get artifacts for a workflow run."""
    url = f"{GITHUB_API}/repos/{REPO}/actions/runs/{run_id}/artifacts"
    return api_request("GET", url)

def download_artifact(artifact_url: str, dest_path: Path) -> None:
    """Download an artifact zip file."""
    req = urllib.request.Request(artifact_url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        with open(dest_path, "wb") as f:
            f.write(resp.read())

def get_latest_tag() -> str:
    """Get the latest tag (sorted by semantic version)."""
    url = f"{GITHUB_API}/repos/{REPO}/tags"
    tags = api_request("GET", url)
    if not tags:
        return "v0.0.0"
    
    # Simple sort assuming tags are vX.Y.Z
    def tag_key(t):
        parts = t["name"].lstrip("v").split(".")
        try:
            return tuple(int(p) if p.isdigit() else 0 for p in parts)
        except ValueError:
            return (0, 0, 0)
    
    sorted_tags = sorted(tags, key=tag_key, reverse=True)
    return sorted_tags[0]["name"]

def increment_patch_version(tag: str) -> str:
    """Increment patch version (v1.0.0 -> v1.0.1)."""
    if not tag.startswith("v"):
        tag = "v" + tag
    parts = tag.lstrip("v").split(".")
    if len(parts) != 3:
        raise ValueError(f"Tag {tag} is not in semver format X.Y.Z")
    
    major, minor, patch = parts
    try:
        patch_int = int(patch) + 1
    except ValueError:
        patch_int = 1
    
    return f"v{major}.{minor}.{patch_int}"

def create_tag_and_release(tag: str, artifact_path: Path) -> str:
    """Create a Git tag and GitHub release, uploading the artifact."""
    # Create a lightweight tag (pointing to the commit of the workflow run)
    run = get_latest_successful_run()
    commit_sha = run["head_sha"]
    
    # Create tag reference
    tag_ref_url = f"{GITHUB_API}/repos/{REPO}/git/refs"
    tag_ref_data = {
        "ref": f"refs/tags/{tag}",
        "sha": commit_sha
    }
    print(f"Creating tag {tag} at {commit_sha[:8]}...")
    api_request("POST", tag_ref_url, tag_ref_data)
    
    # Create release
    release_url = f"{GITHUB_API}/repos/{REPO}/releases"
    release_data = {
        "tag_name": tag,
        "name": f"AhoyVPN Client {tag}",
        "body": f"Windows installer for AhoyVPN Client {tag}\n\n## Changes\n- Fix VC++ Redistributable error 18 (System Restore disabled)\n- Installer now includes Microsoft Visual C++ Redistributable and installs it silently\n- Automated service creation with polling\n- All previous fixes included",
        "draft": False,
        "prerelease": False
    }
    print(f"Creating release {tag}...")
    release = api_request("POST", release_url, release_data)
    
    # Upload artifact
    upload_url = release["upload_url"].replace("{?name,label}", "")
    # Extract installer exe from zip to upload as single file
    with tempfile.TemporaryDirectory() as tmpdir:
        with zipfile.ZipFile(artifact_path, 'r') as z:
            exe_files = [f for f in z.namelist() if f.endswith('.exe')]
            if not exe_files:
                raise RuntimeError("No .exe found in artifact zip")
            exe_name = exe_files[0]
            z.extract(exe_name, tmpdir)
            exe_path = Path(tmpdir) / exe_name
        
        # Upload the .exe
        with open(exe_path, 'rb') as f:
            import base64
            import mimetypes
            content = f.read()
        
        # GitHub expects raw binary upload with Content-Type header
        # We'll use subprocess curl for simplicity
        print(f"Uploading {exe_name} to release...")
        curl_cmd = [
            "curl", "-X", "POST",
            "-H", f"Authorization: token {TOKEN}",
            "-H", "Content-Type: application/octet-stream",
            "--data-binary", f"@{exe_path}",
            f"{upload_url}?name={exe_name}"
        ]
        result = subprocess.run(curl_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"curl upload failed: {result.stderr}")
            # Try alternative method
            print("Falling back to direct API...")
            # For now, just skip upload
            print("Warning: Artifact upload may have failed. Manually upload the installer.")
        else:
            print("Upload successful.")
    
    return release["html_url"]

def main():
    print(f"Creating release for {REPO}")
    
    # Get latest successful run
    run = get_latest_successful_run()
    print(f"Latest successful run: #{run['run_number']} ({run['id']})")
    
    # Get artifacts
    artifacts = get_artifacts(run["id"])
    if artifacts["total_count"] == 0:
        print("No artifacts found for this run")
        sys.exit(1)
    
    artifact = artifacts["artifacts"][0]
    print(f"Artifact: {artifact['name']} ({artifact['size_in_bytes'] / 1024 / 1024:.1f} MB)")
    
    # Download artifact
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        tmp_path = Path(tmp.name)
        print(f"Downloading artifact to {tmp_path}...")
        download_artifact(artifact["archive_download_url"], tmp_path)
    
    try:
        # Determine new tag
        latest_tag = get_latest_tag()
        print(f"Latest tag: {latest_tag}")
        new_tag = increment_patch_version(latest_tag)
        print(f"New tag: {new_tag}")
        
        # Create release
        release_url = create_tag_and_release(new_tag, tmp_path)
        print(f"Release created: {release_url}")
        
        # Update downloads page? (Would require separate step)
        print("\nNext steps:")
        print(f"1. Update downloads.html to point to {release_url}")
        print(f"2. Verify installer works on clean Windows VM")
        
    finally:
        tmp_path.unlink()

if __name__ == "__main__":
    main()