import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk";
import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

const PRAYER_DEFINITIONS = [
  { key: "fajr", name: "Fajr", emoji: "🌅" },
  { key: "dhuhr", name: "Dhuhr", emoji: "☀️" },
  { key: "asr", name: "Asr", emoji: "🌤️" },
  { key: "maghrib", name: "Maghrib", emoji: "🌆" },
  { key: "isha", name: "Isha", emoji: "🌙" },
];

const DEFAULT_PRAYER_TIMES = {
  fajr: "05:00",
  dhuhr: "13:15",
  asr: "16:45",
  maghrib: "18:35",
  isha: "20:00",
};

export default class RemindMePreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings("org.gnome.shell.extensions.remindme");
    window.set_default_size(980, 720);
    window.set_size_request(820, 620);
    window.search_enabled = false;

    this._buildPrayerPage(window, settings);
    this._buildWaterPage(window, settings);
    this._buildBreakPage(window, settings);
    this._buildCustomRemindersPage(window, settings);
    this._buildAboutPage(window);
  }

  _buildPrayerPage(window, settings) {
    const prayerPage = new Adw.PreferencesPage({
      title: _("Prayer"),
      icon_name: "appointment-soon-symbolic",
    });
    window.add(prayerPage);

    const prayerGroup = new Adw.PreferencesGroup({
      title: _("Prayer Settings"),
    });
    prayerPage.add(prayerGroup);

    const prayerEnabledRow = new Adw.SwitchRow({
      title: _("Enable Prayer Reminders"),
      subtitle: _("Get notified for daily prayer times"),
    });
    settings.bind(
      "prayer-enabled",
      prayerEnabledRow,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );
    prayerGroup.add(prayerEnabledRow);

    prayerGroup.add(new Adw.ActionRow({
      title: _("Prayer List"),
      subtitle: _("🌅 Fajr • ☀️ Dhuhr • 🌤️ Asr • 🌆 Maghrib • 🌙 Isha"),
    }));

    const currentPrayerRow = new Adw.ActionRow({
      title: _("Current Prayer"),
      subtitle: _("Detecting..."),
    });
    prayerGroup.add(currentPrayerRow);

    const upcomingPrayerRow = new Adw.ActionRow({
      title: _("Upcoming Prayer"),
      subtitle: _("Detecting..."),
    });
    prayerGroup.add(upcomingPrayerRow);

    const prayerTimesGroup = new Adw.PreferencesGroup({
      title: _("Prayer Times"),
      description: _("Fixed times are shown below. Use Edit to change any prayer time."),
    });
    prayerPage.add(prayerTimesGroup);

    const editPrayerTimesButton = new Gtk.Button({
      label: _("Edit"),
      valign: Gtk.Align.CENTER,
    });
    editPrayerTimesButton.connect("clicked", () => {
      this._showPrayerTimesDialog(window, settings);
    });
    prayerTimesGroup.set_header_suffix(editPrayerTimesButton);

    const prayerRows = new Map();
    for (const prayer of PRAYER_DEFINITIONS) {
      const row = new Adw.ActionRow({
        title: `${prayer.emoji} ${_(prayer.name)}`,
        subtitle: "",
      });
      prayerTimesGroup.add(row);
      prayerRows.set(prayer.key, row);
    }

    const setPrayerControlsSensitive = () => {
      const enabled = prayerEnabledRow.active;
      currentPrayerRow.set_sensitive(enabled);
      upcomingPrayerRow.set_sensitive(enabled);
      editPrayerTimesButton.set_sensitive(enabled);
      for (const row of prayerRows.values())
        row.set_sensitive(enabled);
    };
    prayerEnabledRow.connect("notify::active", setPrayerControlsSensitive);
    setPrayerControlsSensitive();

    const refreshPrayerRows = () => {
      const prayerTimes = this._getPrayerTimes(settings);
      for (const prayer of PRAYER_DEFINITIONS) {
        const row = prayerRows.get(prayer.key);
        if (row)
          row.subtitle = prayerTimes[prayer.key];
      }

      const status = this._computePrayerStatus(prayerTimes);
      currentPrayerRow.subtitle = status.current;
      upcomingPrayerRow.subtitle = status.upcoming;
    };

    settings.connect("changed::prayer-times", refreshPrayerRows);
    refreshPrayerRows();

    const prayerStatusTimerId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      30,
      () => {
        refreshPrayerRows();
        return GLib.SOURCE_CONTINUE;
      },
    );
    window.connect("close-request", () => {
      GLib.Source.remove(prayerStatusTimerId);
      return false;
    });
  }

  _showPrayerTimesDialog(window, settings) {
    const currentTimes = this._getPrayerTimes(settings);
    const dialog = new Gtk.Dialog({
      title: _("Edit Prayer Times"),
      modal: true,
      transient_for: window,
      default_width: 460,
      default_height: 320,
      resizable: false,
    });
    const cancelButton = dialog.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
    cancelButton.add_css_class("flat");
    const saveButton = dialog.add_button(_("Save"), Gtk.ResponseType.OK);
    saveButton.add_css_class("suggested-action");
    dialog.set_default_response(Gtk.ResponseType.OK);

    const content = dialog.get_content_area();
    content.set_margin_top(12);
    content.set_margin_bottom(12);
    content.set_margin_start(12);
    content.set_margin_end(12);

    const grid = new Gtk.Grid({
      row_spacing: 12,
      column_spacing: 12,
      hexpand: true,
      vexpand: true,
    });
    content.append(grid);

    const entries = new Map();
    PRAYER_DEFINITIONS.forEach((prayer, index) => {
      grid.attach(
        new Gtk.Label({
          label: `${prayer.emoji} ${_(prayer.name)}`,
          halign: Gtk.Align.START,
        }),
        0,
        index,
        1,
        1,
      );

      const entry = new Gtk.Entry({
        text: currentTimes[prayer.key],
        placeholder_text: _("HH:MM"),
        hexpand: true,
      });
      grid.attach(entry, 1, index, 1, 1);
      entries.set(prayer.key, entry);
    });

    dialog.connect("response", (dlg, response) => {
      if (response === Gtk.ResponseType.OK) {
        const updated = {};
        for (const prayer of PRAYER_DEFINITIONS) {
          const value = entries.get(prayer.key)?.get_text().trim() ?? "";
          if (!this._isValidPrayerTime(value)) {
            this._showPrayerTimeError(window, prayer.name);
            return;
          }
          updated[prayer.key] = value;
        }
        this._setPrayerTimes(settings, updated);
      }
      dlg.destroy();
    });

    dialog.present();
  }

  _showPrayerTimeError(window, prayerName) {
    const errorDialog = new Gtk.MessageDialog({
      transient_for: window,
      modal: true,
      buttons: Gtk.ButtonsType.OK,
      message_type: Gtk.MessageType.ERROR,
      text: _("Invalid time for %s").format(_(prayerName)),
      secondary_text: _("Use HH:MM format, for example 05:00 or 18:35."),
    });
    errorDialog.connect("response", (dialog) => dialog.destroy());
    errorDialog.present();
  }

  _isValidPrayerTime(value) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
  }

  _getPrayerTimes(settings) {
    const raw = settings.get_string("prayer-times");
    if (!raw)
      return { ...DEFAULT_PRAYER_TIMES };

    try {
      const parsed = JSON.parse(raw);
      const times = { ...DEFAULT_PRAYER_TIMES };
      for (const prayer of PRAYER_DEFINITIONS) {
        const value = String(parsed?.[prayer.key] ?? "").trim();
        times[prayer.key] = this._isValidPrayerTime(value)
          ? value
          : DEFAULT_PRAYER_TIMES[prayer.key];
      }
      return times;
    } catch (e) {
      logError(e, "Invalid prayer-times JSON");
      return { ...DEFAULT_PRAYER_TIMES };
    }
  }

  _setPrayerTimes(settings, times) {
    settings.set_string("prayer-times", JSON.stringify(times));
  }

  _computePrayerStatus(prayerTimes) {
    const now = GLib.DateTime.new_now_local();
    const slots = PRAYER_DEFINITIONS.map((prayer) => ({
      ...prayer,
      time: prayerTimes[prayer.key],
      datetime: this._prayerDateTimeFromHHMM(prayerTimes[prayer.key], 0),
    })).filter((slot) => slot.datetime !== null);

    if (slots.length === 0) {
      return {
        current: _("No prayer times configured"),
        upcoming: _("No prayer times configured"),
      };
    }

    let upcoming = slots.find((slot) => now.compare(slot.datetime) < 0) ?? null;
    if (!upcoming) {
      const firstPrayer = PRAYER_DEFINITIONS[0];
      upcoming = {
        ...firstPrayer,
        time: prayerTimes[firstPrayer.key],
        datetime: this._prayerDateTimeFromHHMM(prayerTimes[firstPrayer.key], 1),
      };
    }

    let current = null;
    for (let i = slots.length - 1; i >= 0; i -= 1) {
      if (now.compare(slots[i].datetime) >= 0) {
        current = slots[i];
        break;
      }
    }
    if (!current)
      current = slots[slots.length - 1];

    return {
      current: `${current.emoji} ${_(current.name)} (${current.time})`,
      upcoming: `${upcoming.emoji} ${_(upcoming.name)} (${upcoming.time})`,
    };
  }

  _prayerDateTimeFromHHMM(time, dayOffset) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? "");
    if (!match)
      return null;

    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    const base = GLib.DateTime.new_now_local().add_days(dayOffset);
    return GLib.DateTime.new_local(
      base.get_year(),
      base.get_month(),
      base.get_day_of_month(),
      hours,
      minutes,
      0,
    );
  }

  _buildWaterPage(window, settings) {
    const waterPage = new Adw.PreferencesPage({
      title: _("Water"),
      icon_name: "emblem-shared-symbolic",
    });
    window.add(waterPage);

    const waterGroup = new Adw.PreferencesGroup({
      title: _("💧 Water Reminder Settings"),
      description: _("Stay hydrated with regular water reminders"),
    });
    waterPage.add(waterGroup);

    const waterEnabledRow = new Adw.SwitchRow({
      title: _("Enable Water Reminders"),
      subtitle: _("Get reminded to drink water"),
    });
    settings.bind(
      "water-enabled",
      waterEnabledRow,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );
    waterGroup.add(waterEnabledRow);

    const waterIntervalRow = new Adw.SpinRow({
      title: _("Reminder Interval"),
      subtitle: _("Frequency in minutes (1-1440)"),
      adjustment: new Gtk.Adjustment({
        lower: 1,
        upper: 1440,
        step_increment: 1,
        page_increment: 30,
      }),
    });
    settings.bind(
      "water-interval",
      waterIntervalRow,
      "value",
      Gio.SettingsBindFlags.DEFAULT,
    );
    waterGroup.add(waterIntervalRow);
  }

  _buildBreakPage(window, settings) {
    const breakPage = new Adw.PreferencesPage({
      title: _("Break"),
      icon_name: "preferences-system-time-symbolic",
    });
    window.add(breakPage);

    const breakGroup = new Adw.PreferencesGroup({
      title: _("⏸️ Break Reminder Settings"),
      description: _("Take regular breaks to stay productive"),
    });
    breakPage.add(breakGroup);

    const breakEnabledRow = new Adw.SwitchRow({
      title: _("Enable Break Reminders"),
      subtitle: _("Take regular breaks from work"),
    });
    settings.bind(
      "break-enabled",
      breakEnabledRow,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );
    breakGroup.add(breakEnabledRow);

    const breakIntervalRow = new Adw.SpinRow({
      title: _("Break Interval"),
      subtitle: _("Frequency in minutes (1-1440)"),
      adjustment: new Gtk.Adjustment({
        lower: 1,
        upper: 1440,
        step_increment: 1,
        page_increment: 15,
      }),
    });
    settings.bind(
      "break-interval",
      breakIntervalRow,
      "value",
      Gio.SettingsBindFlags.DEFAULT,
    );
    breakGroup.add(breakIntervalRow);

    const breakDurationRow = new Adw.SpinRow({
      title: _("Break Duration"),
      subtitle: _("How long your break should be (1-180 minutes)"),
      adjustment: new Gtk.Adjustment({
        lower: 1,
        upper: 180,
        step_increment: 1,
        page_increment: 5,
      }),
    });
    settings.bind(
      "break-duration",
      breakDurationRow,
      "value",
      Gio.SettingsBindFlags.DEFAULT,
    );
    breakGroup.add(breakDurationRow);
  }

  _buildCustomRemindersPage(window, settings) {
    const customPage = new Adw.PreferencesPage({
      title: _("Custom"),
      icon_name: "alarm-symbolic",
    });
    window.add(customPage);

    const customGroup = new Adw.PreferencesGroup({
      title: _("Custom Reminders"),
      description: _("Create your own reminders with custom text and intervals"),
    });
    customPage.add(customGroup);

    const addButton = new Gtk.Button({
      label: _("Add Reminder"),
      valign: Gtk.Align.CENTER,
    });
    addButton.connect("clicked", () => {
      this._showReminderDialog(window, null, (newReminder) => {
        const reminders = this._getCustomReminders(settings);
        reminders.push(newReminder);
        this._setCustomReminders(settings, reminders);
      });
    });
    customGroup.set_header_suffix(addButton);
    let dynamicRows = [];

    const renderReminders = () => {
      dynamicRows.forEach((row) => customGroup.remove(row));
      dynamicRows = [];

      const reminders = this._getCustomReminders(settings);
      if (reminders.length === 0) {
        const emptyRow = new Adw.ActionRow({
          title: _("No custom reminders yet"),
          subtitle: _("Use Add Reminder to create one."),
        });
        customGroup.add(emptyRow);
        dynamicRows.push(emptyRow);
        return;
      }

      reminders.forEach((reminder) => {
        const row = new Adw.ActionRow({
          title: reminder.title,
          subtitle: _("Every %d min • %s").format(
            reminder.interval,
            reminder.body,
          ),
        });

        const enabled = new Gtk.Switch({
          active: reminder.enabled,
          valign: Gtk.Align.CENTER,
        });
        enabled.connect("notify::active", () => {
          const updated = this._getCustomReminders(settings).map((item) => {
            if (item.id !== reminder.id)
              return item;
            return { ...item, enabled: enabled.get_active() };
          });
          this._setCustomReminders(settings, updated);
        });
        row.add_suffix(enabled);

        const editButton = new Gtk.Button({
          icon_name: "document-edit-symbolic",
          tooltip_text: _("Edit"),
          valign: Gtk.Align.CENTER,
        });
        editButton.connect("clicked", () => {
          this._showReminderDialog(window, reminder, (editedReminder) => {
            const updated = this._getCustomReminders(settings).map((item) =>
              item.id === reminder.id ? editedReminder : item,
            );
            this._setCustomReminders(settings, updated);
          });
        });
        row.add_suffix(editButton);

        const deleteButton = new Gtk.Button({
          icon_name: "user-trash-symbolic",
          tooltip_text: _("Delete"),
          valign: Gtk.Align.CENTER,
        });
        deleteButton.add_css_class("destructive-action");
        deleteButton.connect("clicked", () => {
          const updated = this
            ._getCustomReminders(settings)
            .filter((item) => item.id !== reminder.id);
          this._setCustomReminders(settings, updated);
        });
        row.add_suffix(deleteButton);

        customGroup.add(row);
        dynamicRows.push(row);
      });
    };

    settings.connect("changed::custom-reminders", renderReminders);
    renderReminders();
  }

  _showReminderDialog(window, current, onSave) {
    const dialog = new Gtk.Dialog({
      title: current ? _("Edit Custom Reminder") : _("Add Custom Reminder"),
      modal: true,
      transient_for: window,
      default_width: 460,
      default_height: 260,
      resizable: false,
    });
    const cancelButton = dialog.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
    cancelButton.add_css_class("flat");
    const saveButton = dialog.add_button(_("Save"), Gtk.ResponseType.OK);
    saveButton.add_css_class("suggested-action");
    dialog.set_default_response(Gtk.ResponseType.OK);

    const content = dialog.get_content_area();
    content.set_margin_top(12);
    content.set_margin_bottom(12);
    content.set_margin_start(12);
    content.set_margin_end(12);
    const grid = new Gtk.Grid({
      row_spacing: 12,
      column_spacing: 12,
      hexpand: true,
      vexpand: true,
    });
    content.append(grid);

    const titleEntry = new Gtk.Entry({
      text: current?.title ?? "",
      hexpand: true,
      placeholder_text: _("Reminder title"),
    });
    const bodyEntry = new Gtk.Entry({
      text: current?.body ?? "",
      hexpand: true,
      placeholder_text: _("Reminder message"),
    });
    const intervalSpin = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({
        lower: 1,
        upper: 1440,
        step_increment: 1,
        page_increment: 15,
      }),
      value: current?.interval ?? 60,
      numeric: true,
      hexpand: true,
    });
    const enabledSwitch = new Gtk.Switch({
      active: current?.enabled ?? true,
      valign: Gtk.Align.CENTER,
    });

    grid.attach(
      new Gtk.Label({ label: _("Title"), halign: Gtk.Align.START }),
      0,
      0,
      1,
      1,
    );
    grid.attach(titleEntry, 1, 0, 1, 1);

    grid.attach(
      new Gtk.Label({ label: _("Message"), halign: Gtk.Align.START }),
      0,
      1,
      1,
      1,
    );
    grid.attach(bodyEntry, 1, 1, 1, 1);

    grid.attach(
      new Gtk.Label({ label: _("Interval (min)"), halign: Gtk.Align.START }),
      0,
      2,
      1,
      1,
    );
    grid.attach(intervalSpin, 1, 2, 1, 1);

    grid.attach(
      new Gtk.Label({ label: _("Enabled"), halign: Gtk.Align.START }),
      0,
      3,
      1,
      1,
    );
    grid.attach(enabledSwitch, 1, 3, 1, 1);

    dialog.connect("response", (dlg, response) => {
      if (response === Gtk.ResponseType.OK) {
        const title = titleEntry.get_text().trim() || _("Custom Reminder");
        const body =
          bodyEntry.get_text().trim() || _("Time for your custom reminder.");
        const interval = Math.max(1, intervalSpin.get_value_as_int());

        onSave({
          id: current?.id ?? `${Date.now()}-${Math.random()}`,
          title,
          body,
          interval,
          enabled: enabledSwitch.get_active(),
        });
      }

      dlg.destroy();
    });

    dialog.present();
  }

  _getCustomReminders(settings) {
    const raw = settings.get_string("custom-reminders");
    if (!raw)
      return [];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed))
        return [];

      return parsed
        .filter((item) => typeof item === "object" && item !== null)
        .map((item) => ({
          id: String(item.id ?? `${Date.now()}-${Math.random()}`),
          title: String(item.title ?? _("Custom Reminder")),
          body: String(item.body ?? _("Time for your custom reminder.")),
          interval: Math.max(1, Number.parseInt(item.interval, 10) || 60),
          enabled: item.enabled !== false,
        }));
    } catch (e) {
      logError(e, "Invalid custom-reminders JSON");
      return [];
    }
  }

  _setCustomReminders(settings, reminders) {
    settings.set_string("custom-reminders", JSON.stringify(reminders));
  }

  _buildAboutPage(window) {
    const aboutPage = new Adw.PreferencesPage({
      title: _("About"),
      icon_name: "help-about-symbolic",
    });
    window.add(aboutPage);

    const metadata = this.metadata ?? {};
    const extensionName = metadata.name ?? "RemindMe";
    const description = String(metadata.description ?? "").trim();
    const version = this._formatVersion(metadata);
    const homepage = metadata.url ?? "";
    const maintainer = this._extractMaintainer(metadata, homepage);
    const releaseNotesText = this._extractReleaseNotes(metadata);

    const brandingGroup = new Adw.PreferencesGroup();
    aboutPage.add(brandingGroup);

    const brandingRow = new Adw.ActionRow({
      title: extensionName,
      subtitle: description || _("Prayer, Water, and Break reminders for GNOME Shell"),
      activatable: false,
      selectable: false,
    });

    const logoPath = GLib.build_filenamev([this.path, "assets", "icons", "4777604.png"]);
    const logo = GLib.file_test(logoPath, GLib.FileTest.EXISTS)
      ? new Gtk.Image({
          gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(logoPath) }),
          pixel_size: 56,
          valign: Gtk.Align.CENTER,
        })
      : new Gtk.Image({
          icon_name: "appointment-soon-symbolic",
          pixel_size: 56,
          valign: Gtk.Align.CENTER,
        });

    const versionLabel = new Gtk.Label({
      label: _("Version %s").format(version),
      valign: Gtk.Align.CENTER,
    });
    versionLabel.add_css_class("caption");
    versionLabel.add_css_class("dim-label");

    brandingRow.add_prefix(logo);
    brandingRow.add_suffix(versionLabel);
    brandingGroup.add(brandingRow);

    const detailsGroup = new Adw.PreferencesGroup();
    aboutPage.add(detailsGroup);
    detailsGroup.add(new Adw.ActionRow({
      title: _("Maintainer"),
      subtitle: maintainer,
    }));

    const releaseNotes = new Adw.ExpanderRow({
      title: _("Release notes"),
      subtitle: _("Current release"),
    });
    releaseNotes.add_row(new Adw.ActionRow({
      title: _("Current release"),
      subtitle: releaseNotesText,
    }));
    detailsGroup.add(releaseNotes);

    const linksGroup = new Adw.PreferencesGroup({
      title: _("Quick Links"),
    });
    aboutPage.add(linksGroup);

    if (homepage) {
      linksGroup.add(this._createLinkRow(
        _("Read me"),
        _("Project page"),
        homepage,
        "text-x-generic-symbolic",
      ));
      linksGroup.add(this._createLinkRow(
        _("Report an issue"),
        _("Issues"),
        `${homepage}/issues`,
        "tools-check-spelling-symbolic",
      ));
      linksGroup.add(this._createLinkRow(
        _("View source on GitHub"),
        _("Source code"),
        homepage,
        "web-browser-symbolic",
      ));
      linksGroup.add(this._createLinkRow(
        _("Contributors"),
        _("Contributor graph"),
        `${homepage}/graphs/contributors`,
        "system-users-symbolic",
      ));
    } else {
      linksGroup.add(new Adw.ActionRow({
        title: _("No external links configured"),
        subtitle: _("Set a project URL in metadata.json to show about links."),
      }));
    }
  }

  _createLinkRow(title, subtitle, url, iconName = "adw-external-link-symbolic") {
    const row = new Adw.ActionRow({
      title,
      subtitle,
      activatable: true,
    });

    row.add_prefix(new Gtk.Image({
      icon_name: iconName,
      valign: Gtk.Align.CENTER,
    }));
    const linkIcon = new Gtk.Image({
      icon_name: "adw-external-link-symbolic",
      valign: Gtk.Align.CENTER,
    });
    row.add_suffix(linkIcon);
    row.connect("activated", () => this._openUrl(url));
    return row;
  }

  _openUrl(url) {
    if (!url)
      return;

    try {
      Gio.AppInfo.launch_default_for_uri(url, null);
    } catch (e) {
      logError(e, `Failed to open URL: ${url}`);
    }
  }

  _extractMaintainerFromUrl(url) {
    if (!url)
      return this.metadata?.uuid ?? "Unknown";

    const match = url.match(/^https?:\/\/github\.com\/([^/]+)\/?/i);
    if (match?.[1])
      return match[1];

    return this.metadata?.uuid ?? "Unknown";
  }

  _extractMaintainer(metadata, homepage) {
    const developerName = String(
      metadata?.["developer-name"] ?? metadata?.developer_name ?? "",
    ).trim();
    if (developerName)
      return developerName;

    return this._extractMaintainerFromUrl(homepage);
  }

  _formatVersion(metadata) {
    const versionNumber = metadata?.version;
    const versionName = String(
      metadata?.["version-name"] ?? metadata?.version_name ?? "",
    ).trim();

    if (versionName && String(versionNumber ?? "").trim() && versionName !== String(versionNumber))
      return `${versionName} (${versionNumber})`;

    if (versionName)
      return versionName;

    if (versionNumber === 0 || versionNumber)
      return String(versionNumber);

    return "N/A";
  }

  _extractReleaseNotes(metadata) {
    const releaseNotes = String(
      metadata?.["release-notes"] ?? metadata?.release_notes ?? "",
    ).trim();
    if (releaseNotes)
      return releaseNotes;

    return _("Custom reminders with add/edit/delete, improved break controls, and tray menu actions.");
  }
}
