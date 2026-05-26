# Installing spec-kit CLI without Admin Rights (Windows)

## Problem

Running `uv tool install` on a managed Windows machine (no Developer Mode, no admin) fails
because uv creates symlink shims by default — and Windows blocks symlink creation without
elevated privileges.

## Fix: Set uv link-mode to copy

### Option A — One-time (current session only)

```powershell
$env:UV_LINK_MODE = "copy"
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z
```

### Option B — Permanent (recommended)

Create or edit `%APPDATA%\uv\uv.toml`:

```toml
link-mode = "copy"
```

Then install normally — no env var prefix needed:

```powershell
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z
```

## Why this works

uv normally creates symlink shims in its bin directory (`%APPDATA%\uv\bin\`).
Windows requires either admin rights or Developer Mode to create symlinks.
Setting `link-mode = "copy"` tells uv to copy the binary instead — no symlinks, no UAC prompt.

## Notes

- `%APPDATA%\uv\uv.toml` is the user-level uv config — no admin needed to write it
- This setting applies to all `uv tool install` commands, not just spec-kit
- If uv itself is installed under `C:\Program Files\`, reinstall it to user scope to avoid
  other permission issues: `winget install astral-sh.uv` (run without admin)
