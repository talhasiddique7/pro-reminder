import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// Time formatter utility
class TimeFormatter {
  static formatTime(value) {
    // Remove non-digits
    let cleaned = value.replace(/\D/g, "");

    // Handle leading zeros for hours
    if (cleaned.length >= 2) {
      let hours = parseInt(cleaned.substring(0, 2));
      if (hours > 23) cleaned = "23" + cleaned.substring(2);
    }

    // Handle minutes
    if (cleaned.length >= 4) {
      let minutes = parseInt(cleaned.substring(2, 4));
      if (minutes > 59)
        cleaned = cleaned.substring(0, 2) + "59" + cleaned.substring(4);
    }

    // Format as HH:MM
    if (cleaned.length === 1) return cleaned;
    if (cleaned.length === 2) return cleaned + ":";
    if (cleaned.length >= 3)
      return cleaned.substring(0, 2) + ":" + cleaned.substring(2, 4);
    return cleaned;
  }

  static parseTime(timeStr) {
    const parts = timeStr.split(":");
    if (parts.length === 2) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return { hours, minutes };
      }
    }
    return null;
  }
}

export default class RemindMePreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings("org.gnome.shell.extensions.remindme");

    // --- Prayer Page ---
    const prayerPage = new Adw.PreferencesPage({
      title: _("Prayer"),
      icon_name: "appointment-soon-symbolic",
    });
    window.add(prayerPage);

    const prayerGroup = new Adw.PreferencesGroup({
      title: _("Prayer Settings"),
    });
    prayerPage.add(prayerGroup);

    // Prayer Enabled
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

    // Prayer Calculation Method
    const prayerTemplateRow = new Adw.ComboRow({
      title: _("Prayer Calculation Method"),
      subtitle: _("Select your region's calculation method"),
    });
    const prayerMethodOptions = [
      { key: "MWL", label: _("Muslim World League") },
      { key: "ISNA", label: _("Islamic Society of North America") },
      { key: "Karachi", label: _("Karachi") },
      { key: "Egypt", label: _("Egyptian General Authority") },
      { key: "Makkah", label: _("Umm al-Qura, Makkah") },
      { key: "Tehran", label: _("Tehran") },
      { key: "Jafari", label: _("Jafari") },
    ];
    const methodModel = new Gtk.StringList();
    prayerMethodOptions.forEach((option) => methodModel.append(option.label));
    prayerTemplateRow.set_model(methodModel);

    const getMethodIndex = () => {
      const key = settings.get_string("prayer-method");
      const index = prayerMethodOptions.findIndex((option) => option.key === key);
      return index >= 0 ? index : 0;
    };

    prayerTemplateRow.set_selected(getMethodIndex());
    settings.connect("changed::prayer-method", () => {
      prayerTemplateRow.set_selected(getMethodIndex());
    });
    prayerTemplateRow.connect("notify::selected", () => {
      const selected = prayerTemplateRow.get_selected();
      if (selected >= prayerMethodOptions.length) return;

      const selectedKey = prayerMethodOptions[selected].key;
      if (settings.get_string("prayer-method") !== selectedKey)
        settings.set_string("prayer-method", selectedKey);
    });

    prayerGroup.add(prayerTemplateRow);

    // Prayer Times Info
    const prayerInfoRow = new Adw.ActionRow({
      title: _("Prayer Times"),
      subtitle: _("🌅 Fajr • ☀️ Dhuhr • 🌤️ Asr • 🌆 Maghrib • 🌙 Isha"),
    });
    prayerGroup.add(prayerInfoRow);

    // Latitude
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
    prayerGroup.add(latRow);

    // Longitude
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
    prayerGroup.add(lonRow);

    // --- Water Page ---
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
      subtitle: _("Frequency in minutes (15-300)"),
      adjustment: new Gtk.Adjustment({
        lower: 15,
        upper: 300,
        step_increment: 5,
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

    // --- Break Page ---
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
      subtitle: _("Frequency in minutes (15-120)"),
      adjustment: new Gtk.Adjustment({
        lower: 15,
        upper: 120,
        step_increment: 5,
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
  }
}
