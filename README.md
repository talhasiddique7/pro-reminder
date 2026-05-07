# Reminder Pro

Professional GNOME Shell extension for daily reminders: prayer times, hydration, focused work breaks, and user-defined custom reminders.

## Overview

Reminder Pro adds a panel indicator and notification workflow to help you stay consistent throughout the day. It is designed for GNOME Shell and supports modern GNOME versions listed in `metadata.json`.

## Screenshots

### Panel Indicator

![Reminder Pro panel indicator](assets/screenshots/Screenshot%20From%202026-05-07%2022-18-50.png)

### Preferences Window

![Reminder Pro preferences window](assets/screenshots/Screenshot%20From%202026-05-07%2022-19-08.png)

## Key Features

- Prayer reminders with editable HH:MM times for Fajr, Dhuhr, Asr, Maghrib, and Isha.
- Water reminders with configurable interval.
- Break reminders with configurable interval and break duration.
- Custom reminders with add, edit, delete, enable, and disable controls.
- Message tray notifications with quick actions:
  - `Snooze 15m`
  - `Done`
- Optional reminder sound toggle.
- Panel indicator menu showing:
  - Active reminder count
  - Upcoming reminder
  - Current prayer
  - Next prayer
- Visual unread dot on the panel icon for unseen notifications.

## How It Works

1. GNOME loads the extension through `extension.js`.
2. On `enable()`:
   - Settings are loaded via `SettingsManager`.
   - Notification service is prepared via `Notifier`.
   - A scheduler loop is started via `Scheduler`.
   - The panel indicator and menu are created.
3. `_updateReminders()` rebuilds all active reminders from current settings.
4. `Scheduler` checks reminders every 15 seconds.
5. When a reminder is due, `Notifier.show()` sends a GNOME notification.
6. Notification actions call back into the extension:
   - `Snooze 15m` pushes the reminder forward by 15 minutes.
   - `Done` recalculates the next occurrence.
7. Indicator status refreshes every 30 seconds to keep menu text accurate.

## Architecture

### Runtime Modules

- `extension.js`
  - Main entrypoint and lifecycle (`enable`, `disable`).
  - Builds panel indicator, menu actions, and reminder status text.
  - Translates settings into scheduled reminders.
- `lib/scheduler.js`
  - In-memory reminder registry (`Map`).
  - Time loop and trigger execution.
  - Reminder rescheduling via `recalculate` callbacks.
- `lib/notifier.js`
  - GNOME MessageTray integration.
  - Notification actions and optional sound playback.
- `lib/settings.js`
  - Typed wrapper around `Gio.Settings` (`getBoolean`, `getInt`, `getString`, etc.).
- `prefs.js`
  - Adwaita preferences UI for Prayer, Water, Break, Custom, and About pages.

### Supporting Module

- `lib/adhan-port.js`
  - Prayer calculation engine (Adhan-style implementation).
  - Present in the repository for calculation workflows.
  - Current reminder flow uses fixed prayer times from settings (`prayer-times`).

## Core Functions

### `extension.js` (Main runtime)

- `enable()`: Initializes settings, notifier, scheduler, panel UI, and periodic refresh timers.
- `disable()`: Stops timers, disconnects settings listeners, and cleans up UI/notification state.
- `_updateReminders()`: Rebuilds prayer/water/break/custom reminder objects and pushes them into `Scheduler`.
- `_getPrayerStatus()`: Computes current and next prayer from configured HH:MM times.
- `_handleSnooze(id)`: Defers the selected reminder by 15 minutes.
- `_handleDone(id)`: Recalculates the selected reminder's next trigger.
- `_updateIndicatorStatus()`: Syncs panel and menu text with current runtime state.

### `lib/scheduler.js` (Trigger engine)

- `start()`: Starts 15-second polling loop.
- `setReminder(id, reminder)`: Registers or updates a reminder in memory.
- `clearReminders()`: Clears all active reminders before rebuild.
- `tickNow()`: Performs immediate due-check pass.
- `_tick()`: Fires due reminders and recalculates their next trigger.

### `lib/notifier.js` (Notification delivery)

- `show(id, title, body, iconName)`: Sends GNOME notification with action buttons.
- `_playNotificationSound()`: Plays optional custom/default sound.
- `destroy()`: Tears down message tray source.

### `prefs.js` (Preferences UI)

- `fillPreferencesWindow(window)`: Builds all pages in the settings window.
- `_buildPrayerPage/_buildWaterPage/_buildBreakPage/_buildCustomRemindersPage()`: Creates domain-specific settings UIs.
- `_showPrayerTimesDialog()`: Validates and saves prayer HH:MM values.
- `_showReminderDialog()`: Adds/edits custom reminders.
- `_getCustomReminders()`: Parses and normalizes custom reminder JSON.

## Settings Schema

The extension uses `org.gnome.shell.extensions.remindme`.

| Key | Type | Default | Purpose |
|---|---|---|---|
| `prayer-enabled` | boolean | `true` | Enable prayer reminders |
| `prayer-method` | string | `MWL` | Prayer calculation method metadata |
| `prayer-template` | string | `5-prayers` | Prayer template metadata |
| `prayer-lat` | double | `0.0` | Latitude metadata |
| `prayer-lon` | double | `0.0` | Longitude metadata |
| `prayer-times` | string(JSON) | fixed HH:MM set | Prayer schedule source |
| `water-enabled` | boolean | `true` | Enable water reminders |
| `water-interval` | int | `60` | Minutes between water reminders |
| `water-start` | int | `8` | Start hour metadata |
| `water-end` | int | `22` | End hour metadata |
| `break-enabled` | boolean | `true` | Enable break reminders |
| `break-interval` | int | `25` | Minutes between break reminders |
| `break-duration` | int | `5` | Break length in minutes |
| `custom-reminders` | string(JSON) | `[]` | Custom reminder list |
| `notification-sound` | boolean | `true` | Enable notification sound |
| `last-update` | int64 | `0` | Internal timestamp metadata |

## Installation (Local Development)

### Prerequisites

- GNOME Shell (supported versions declared in `metadata.json`)
- `gnome-extensions` CLI
- `glib-compile-schemas`
- `make`

### Install

```bash
make install
```

This installs the extension to:

```bash
~/.local/share/gnome-shell/extensions/reminder-pro@talhasiddique7
```

### Reload Quickly During Development

```bash
./reload.sh
```

The script:

- Reinstalls the extension.
- Aligns legacy UUID references.
- Disables and re-enables the extension.
- Prints recent GNOME Shell logs relevant to Reminder Pro.

## Packaging

```bash
make pack
```

Output is written to `./build/`.

## Repository Structure

```text
.
├── extension.js
├── prefs.js
├── metadata.json
├── lib/
│   ├── notifier.js
│   ├── scheduler.js
│   ├── settings.js
│   └── adhan-port.js
├── schemas/
│   └── org.gnome.shell.extensions.remindme.gschema.xml
├── assets/icons/
└── reload.sh
```

## Troubleshooting

- Extension not visible after install:
  - Log out/in once, then run `./reload.sh`.
- Reminder settings changed but behavior did not update:
  - Use menu action `Reload Reminders` or run `./reload.sh`.
- Check logs:

```bash
journalctl --user -n 100 -o cat | grep -Ei "gnome-shell|reminder-pro|reminder-pro@talhasiddique7"
```

## Development Notes

- The scheduler is event-loop based, not cron-based.
- Reminder triggers are in local system time.
- Prayer reminder timing currently depends on configured `prayer-times` values.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
