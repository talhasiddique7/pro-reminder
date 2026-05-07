#!/usr/bin/env bash
set -euo pipefail

UUID="reminder-pro@talhasiddique7"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
OLD_UUID="reminder-pro@user.github.io"

cd "$(dirname "$0")"

# Build/install current working copy
make install

# Keep gsettings list aligned with current UUID
current_enabled="$(gsettings get org.gnome.shell enabled-extensions)"
updated_enabled="$(printf '%s' "$current_enabled" | sed "s/$OLD_UUID/$UUID/g")"
if [[ "$current_enabled" != "$updated_enabled" ]]; then
  gsettings set org.gnome.shell enabled-extensions "$updated_enabled"
fi

# Reload extension safely
if gnome-extensions list | grep -qx "$UUID"; then
  if gnome-extensions list --enabled | grep -qx "$UUID"; then
    gnome-extensions disable "$UUID"
  fi
  gnome-extensions enable "$UUID"
else
  printf "\nExtension %s is installed but not indexed in this session.\n" "$UUID"
  printf "Log out and log back in, then run ./reload.sh again.\n"
fi

printf "\nReloaded %s from %s\n" "$UUID" "$EXT_DIR"
printf "Recent GNOME Shell logs:\n"
journalctl --user -n 50 -o cat | grep -Ei "gnome-shell|reminder-pro|$UUID" || true
