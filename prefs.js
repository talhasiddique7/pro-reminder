import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class RemindMePreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings("org.gnome.shell.extensions.remindme");

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
      title: _("Prayer Times"),
      subtitle: _("🌅 Fajr • ☀️ Dhuhr • 🌤️ Asr • 🌆 Maghrib • 🌙 Isha"),
    }));

    const latRow = new Adw.SpinRow({
      title: _("Latitude"),
      subtitle: _("Location latitude (-90 to 90)"),
      adjustment: new Gtk.Adjustment({
        lower: -90,
        upper: 90,
        step_increment: 0.0001,
        page_increment: 1,
      }),
      digits: 4,
    });
    settings.bind("prayer-lat", latRow, "value", Gio.SettingsBindFlags.DEFAULT);
    prayerEnabledRow.bind_property(
      "active",
      latRow,
      "sensitive",
      GObject.BindingFlags.SYNC_CREATE,
    );
    prayerGroup.add(latRow);

    const lonRow = new Adw.SpinRow({
      title: _("Longitude"),
      subtitle: _("Location longitude (-180 to 180)"),
      adjustment: new Gtk.Adjustment({
        lower: -180,
        upper: 180,
        step_increment: 0.0001,
        page_increment: 1,
      }),
      digits: 4,
    });
    settings.bind("prayer-lon", lonRow, "value", Gio.SettingsBindFlags.DEFAULT);
    prayerEnabledRow.bind_property(
      "active",
      lonRow,
      "sensitive",
      GObject.BindingFlags.SYNC_CREATE,
    );
    prayerGroup.add(lonRow);
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
    const version = metadata.version ?? "N/A";
    const homepage = metadata.url ?? "";
    const maintainer = this._extractMaintainerFromUrl(homepage);

    const infoGroup = new Adw.PreferencesGroup({
      title: extensionName,
      description: _("Maintained by %s").format(maintainer),
    });
    aboutPage.add(infoGroup);

    const iconRow = new Adw.ActionRow({
      title: extensionName,
      subtitle: _("Official icon"),
    });

    const iconPath = GLib.build_filenamev([this.path, "assets", "icons", "4777604.png"]);
    const iconImage = Gtk.Image.new_from_file(iconPath);
    iconImage.set_pixel_size(36);
    iconImage.set_valign(Gtk.Align.CENTER);
    iconRow.add_prefix(iconImage);
    infoGroup.add(iconRow);

    infoGroup.add(new Adw.ActionRow({
      title: _("Version"),
      subtitle: `${version}`,
    }));

    const releaseNotes = new Adw.ExpanderRow({
      title: _("Release notes"),
      subtitle: _("Current release"),
    });
    releaseNotes.add_row(new Adw.ActionRow({
      title: _("Current release"),
      subtitle: _("Custom reminders with add/edit/delete, improved break controls, and tray menu actions."),
    }));
    infoGroup.add(releaseNotes);

    const linksGroup = new Adw.PreferencesGroup({
      title: _("Links"),
    });
    aboutPage.add(linksGroup);

    if (homepage) {
      linksGroup.add(this._createLinkRow(_("Extension listing"), _("Open"), homepage));
      linksGroup.add(this._createLinkRow(_("Source code"), _("GitHub"), homepage));
      linksGroup.add(this._createLinkRow(_("Report an issue"), _("Issues"), `${homepage}/issues`));
      linksGroup.add(this._createLinkRow(_("Contributors"), _("Contributor graph"), `${homepage}/graphs/contributors`));
    } else {
      linksGroup.add(new Adw.ActionRow({
        title: _("No external links configured"),
        subtitle: _("Set a project URL in metadata.json to show about links."),
      }));
    }
  }

  _createLinkRow(title, subtitle, url) {
    const row = new Adw.ActionRow({
      title,
      subtitle,
      activatable: true,
    });

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
}
