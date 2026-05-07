import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import { SettingsManager } from './lib/settings.js';
import { Notifier } from './lib/notifier.js';
import { Scheduler } from './lib/scheduler.js';
import { PrayerEngine } from './lib/adhan-port.js';

// Prayer template definitions with emojis
const PRAYER_TEMPLATES = {
    fajr: { name: 'Fajr', emoji: '🌅', offset: 0 },
    dhuhr: { name: 'Dhuhr', emoji: '☀️', offset: 1 },
    asr: { name: 'Asr', emoji: '🌤️', offset: 2 },
    maghrib: { name: 'Maghrib', emoji: '🌆', offset: 3 },
    isha: { name: 'Isha', emoji: '🌙', offset: 4 },
};

const REMINDER_TEMPLATES = {
    water: { title: '💧 Water Reminder', body: 'Time to drink water and stay hydrated!' },
    break: { title: '⏸️ Break Reminder', body: 'Take a moment to stretch and rest your eyes!' },
    prayer: { title: '🕌 Prayer Time', body: 'It\'s time for {prayer}' },
};

export default class RemindMeExtension extends Extension {
    enable() {
        this._settings = new SettingsManager(this.getSettings('org.gnome.shell.extensions.remindme'));
        this._notifier = new Notifier({
            onSnooze: id => this._handleSnooze(id),
            onDone: id => this._handleDone(id),
        });
        this._scheduler = new Scheduler(this._notifier);
        
        this._setupIndicator();
        
        // Initial setup of reminders
        this._updateReminders();
        
        // Listen for setting changes
        this._settingsHandlers = [
            this._settings.connect('prayer-enabled', () => this._updateReminders()),
            this._settings.connect('water-enabled', () => this._updateReminders()),
            this._settings.connect('break-enabled', () => this._updateReminders()),
            this._settings.connect('prayer-lat', () => this._updateReminders()),
            this._settings.connect('prayer-lon', () => this._updateReminders()),
            this._settings.connect('prayer-method', () => this._updateReminders()),
            this._settings.connect('water-interval', () => this._updateReminders()),
            this._settings.connect('break-interval', () => this._updateReminders()),
            this._settings.connect('break-duration', () => this._updateReminders()),
            this._settings.connect('prayer-template', () => this._updateReminders()),
            this._settings.connect('custom-reminders', () => this._updateReminders()),
        ];

        this._scheduler.start();
    }

    disable() {
        this._scheduler?.stop();
        this._notifier?.destroy();
        
        if (this._settingsHandlers) {
            this._settingsHandlers.forEach(h => this._settings.disconnect(h));
            this._settingsHandlers = null;
        }

        if (this._indicator) {
            try {
                this._indicator.destroy();
            } catch (e) {
                // Ignore errors
            }
            this._indicator = null;
        }
        
        this._settings = null;
        this._notifier = null;
        this._scheduler = null;
    }

    _setupIndicator() {
        try {
            if (!this._indicator) {
                this._indicator = new PanelMenu.Button(0.5, 'RemindMe', false);
                const icon = new St.Icon({
                    icon_name: 'appointment-soon-symbolic',
                    style_class: 'system-status-icon',
                });
                this._indicator.add_child(icon);
                this._buildIndicatorMenu();
                Main.panel.addToStatusArea(this.uuid, this._indicator);
            }
        } catch (e) {
            console.error('Error setting up indicator:', e);
        }
    }

    _buildIndicatorMenu() {
        this._indicator.menu.removeAll();

        this._statusItem = new PopupMenu.PopupMenuItem(_('No reminders scheduled'), {
            reactive: false,
        });
        this._indicator.menu.addMenuItem(this._statusItem);
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const openPrefsItem = new PopupMenu.PopupMenuItem(_('Open Preferences'));
        openPrefsItem.connect('activate', () => this.openPreferences());
        this._indicator.menu.addMenuItem(openPrefsItem);

        const reloadItem = new PopupMenu.PopupMenuItem(_('Reload Reminders'));
        reloadItem.connect('activate', () => this._updateReminders());
        this._indicator.menu.addMenuItem(reloadItem);
    }

    _handleSnooze(id) {
        console.log(`Snoozing reminder: ${id}`);
        // Add 15 minutes to the next trigger
        const nextTrigger = GLib.DateTime.new_now_local().add_minutes(15);
        const reminder = this._scheduler._reminders.get(id);
        if (reminder) {
            reminder.nextTrigger = nextTrigger;
        }
    }

    _handleDone(id) {
        console.log(`Reminder done: ${id}`);
        // Recalculate next trigger normally
        const reminder = this._scheduler._reminders.get(id);
        if (reminder && reminder.recalculate) {
            reminder.nextTrigger = reminder.recalculate();
        }
    }

    _formatPrayerName(name) {
        const lower = name.toLowerCase();
        const template = PRAYER_TEMPLATES[lower];
        if (template) {
            return `${template.emoji} ${template.name}`;
        }
        return name;
    }

    _getCustomReminders() {
        const raw = this._settings.getString('custom-reminders');
        if (!raw)
            return [];

        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed))
                return [];

            return parsed
                .filter(item => typeof item === 'object' && item !== null)
                .map(item => ({
                    id: String(item.id ?? `${Date.now()}-${Math.random()}`),
                    title: String(item.title ?? _('Custom Reminder')).trim(),
                    body: String(item.body ?? _('Time for your custom reminder.')).trim(),
                    interval: Math.max(1, Number.parseInt(item.interval, 10) || 60),
                    enabled: item.enabled !== false,
                }));
        } catch (e) {
            console.error('Invalid custom-reminders JSON:', e);
            return [];
        }
    }

    _updateIndicatorStatus() {
        if (!this._statusItem)
            return;

        const reminders = [...this._scheduler.getReminders().values()];
        if (reminders.length === 0) {
            this._statusItem.label.text = _('No reminders scheduled');
            return;
        }

        const next = reminders
            .filter(r => r.nextTrigger)
            .sort((a, b) => a.nextTrigger.compare(b.nextTrigger))[0];

        if (!next) {
            this._statusItem.label.text = _('No upcoming reminders');
            return;
        }

        this._statusItem.label.text = _('%d active reminders').format(reminders.length);
    }

    _updateReminders() {
        this._scheduler.clearReminders();

        // Prayer Reminders
        if (this._settings.getBoolean('prayer-enabled')) {
            const lat = this._settings.getDouble('prayer-lat');
            const lon = this._settings.getDouble('prayer-lon');
            const method = this._settings.getString('prayer-method');
            const engine = new PrayerEngine(lat, lon, method);
            
            const schedulePrayer = () => {
                const times = engine.getTimes();
                const now = GLib.DateTime.new_now_local();
                
                // Find next prayer
                let next = null;
                let nextName = '';
                
                for (const [name, date] of Object.entries(times)) {
                    const gdate = GLib.DateTime.new_from_unix_local(date.getTime() / 1000);
                    if (now.compare(gdate) < 0) {
                        if (!next || gdate.compare(next) < 0) {
                            next = gdate;
                            nextName = name;
                        }
                    }
                }

                // If all prayers passed, get tomorrow's
                if (!next) {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowTimes = engine.getTimes(tomorrow);
                    const first = Object.entries(tomorrowTimes).reduce((a, b) => a[1] < b[1] ? a : b);
                    next = GLib.DateTime.new_from_unix_local(first[1].getTime() / 1000);
                    nextName = first[0];
                }

                return { next, name: nextName };
            };

            const initial = schedulePrayer();
            const formattedName = this._formatPrayerName(initial.name);
            this._scheduler.setReminder('prayer', {
                title: REMINDER_TEMPLATES.prayer.title,
                body: `It's time for ${formattedName} prayer`,
                nextTrigger: initial.next,
                recalculate: () => {
                    const { next, name } = schedulePrayer();
                    const formatted = this._formatPrayerName(name);
                    this._notifier.show('prayer', REMINDER_TEMPLATES.prayer.title, 
                        `It's time for ${formatted} prayer`);
                    return next;
                }
            });
        }

        // Water Reminders
        if (this._settings.getBoolean('water-enabled')) {
            const interval = Math.max(1, this._settings.getInt('water-interval'));
            const recalculate = () => GLib.DateTime.new_now_local().add_minutes(interval);
            
            this._scheduler.setReminder('water', {
                title: REMINDER_TEMPLATES.water.title,
                body: REMINDER_TEMPLATES.water.body,
                nextTrigger: recalculate(),
                recalculate,
                icon: 'water-symbolic'
            });
        }

        // Break Reminders
        if (this._settings.getBoolean('break-enabled')) {
            const interval = Math.max(1, this._settings.getInt('break-interval'));
            const breakDuration = Math.max(1, this._settings.getInt('break-duration'));
            const recalculate = () => GLib.DateTime.new_now_local().add_minutes(interval);

            this._scheduler.setReminder('break', {
                title: REMINDER_TEMPLATES.break.title,
                body: _('Take a %d minute break to stretch and rest your eyes!').format(breakDuration),
                nextTrigger: recalculate(),
                recalculate,
                icon: 'timer-symbolic'
            });
        }

        for (const reminder of this._getCustomReminders()) {
            if (!reminder.enabled)
                continue;

            const interval = Math.max(1, reminder.interval);
            const recalculate = () => GLib.DateTime.new_now_local().add_minutes(interval);
            const id = `custom:${reminder.id}`;

            this._scheduler.setReminder(id, {
                title: reminder.title || _('Custom Reminder'),
                body: reminder.body || _('Time for your custom reminder.'),
                nextTrigger: recalculate(),
                recalculate,
                icon: 'alarm-symbolic',
            });
        }

        this._updateIndicatorStatus();
    }
}
