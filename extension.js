import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import { SettingsManager } from './lib/settings.js';
import { Notifier } from './lib/notifier.js';
import { Scheduler } from './lib/scheduler.js';

const PRAYER_TEMPLATES = {
    fajr: { name: 'Fajr', emoji: '🌅' },
    dhuhr: { name: 'Dhuhr', emoji: '☀️' },
    asr: { name: 'Asr', emoji: '🌤️' },
    maghrib: { name: 'Maghrib', emoji: '🌆' },
    isha: { name: 'Isha', emoji: '🌙' },
};

const PRAYER_ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const DEFAULT_PRAYER_TIMES = {
    fajr: '05:00',
    dhuhr: '13:15',
    asr: '16:45',
    maghrib: '18:35',
    isha: '20:00',
};

const REMINDER_TEMPLATES = {
    water: { title: '💧 Water Reminder', body: 'Time to drink water and stay hydrated!' },
    break: { title: '⏸️ Break Reminder', body: 'Take a moment to stretch and rest your eyes!' },
    prayer: { title: '🕌 Prayer Time', body: "It's time for {prayer}" },
};

export default class RemindMeExtension extends Extension {
    enable() {
        this._settings = new SettingsManager(this.getSettings('org.gnome.shell.extensions.remindme'));
        const soundFilePath = GLib.build_filenamev([this.path, 'assets', 'sounds', 'iphone_alarm.mp3']);
        this._notifier = new Notifier({
            onSnooze: id => this._handleSnooze(id),
            onDone: id => this._handleDone(id),
            onNotification: () => this._markNotificationUnread(),
            soundFilePath,
            shouldPlaySound: () => this._settings?.getBoolean('notification-sound') ?? true,
        });
        this._scheduler = new Scheduler(this._notifier);

        this._setupIndicator();

        this._updateReminders();

        this._settingsHandlers = [
            this._settings.connect('prayer-enabled', () => this._updateReminders()),
            this._settings.connect('prayer-times', () => this._updateReminders()),
            this._settings.connect('water-enabled', () => this._updateReminders()),
            this._settings.connect('break-enabled', () => this._updateReminders()),
            this._settings.connect('water-interval', () => this._updateReminders()),
            this._settings.connect('break-interval', () => this._updateReminders()),
            this._settings.connect('break-duration', () => this._updateReminders()),
            this._settings.connect('custom-reminders', () => this._updateReminders()),
        ];

        this._scheduler.start();
        this._indicatorRefreshId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
            this._updateIndicatorStatus();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        this._scheduler?.stop();
        this._notifier?.destroy();

        if (this._indicatorRefreshId) {
            GLib.Source.remove(this._indicatorRefreshId);
            this._indicatorRefreshId = null;
        }

        if (this._settingsHandlers) {
            this._settingsHandlers.forEach(h => this._settings.disconnect(h));
            this._settingsHandlers = null;
        }

        if (this._indicator) {
            try {
                this._indicator.destroy();
            } catch (e) {
                // Ignore errors while shutting down
            }
            this._indicator = null;
        }

        this._settings = null;
        this._notifier = null;
        this._scheduler = null;
    }

    _setupIndicator() {
        try {
            if (this._indicator)
                return;

            this._indicator = new PanelMenu.Button(0.5, 'RemindMe', false);

            const iconPath = GLib.build_filenamev([this.path, 'assets', 'icons', '4777604.png']);
            const fileIcon = Gio.icon_new_for_string(iconPath);
            this._mainIcon = new St.Icon({
                gicon: fileIcon,
                fallback_icon_name: 'appointment-soon-symbolic',
                style_class: 'system-status-icon',
                icon_size: 20,
            });
            this._reminderDot = new St.Widget({
                visible: false,
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.START,
                style: 'background-color: #facc15; min-width: 7px; min-height: 7px; border-radius: 99px; border: 1px solid rgba(0, 0, 0, 0.35); margin-top: 1px;',
            });

            this._iconContainer = new St.Widget({
                layout_manager: new Clutter.BinLayout(),
                x_expand: false,
                y_expand: false,
            });
            this._iconContainer.add_child(this._mainIcon);
            this._iconContainer.add_child(this._reminderDot);

            this._indicator.add_child(this._iconContainer);
            this._panelText = new St.Label({
                text: _('No events'),
                style_class: 'panel-label',
            });
            this._panelText.set_style('max-width: 220px; padding-left: 6px;');
            this._indicator.add_child(this._panelText);

            this._buildIndicatorMenu();
            this._indicator.menu.connect('open-state-changed', (_menu, isOpen) => {
                if (isOpen)
                    this._markNotificationRead();
            });
            Main.panel.addToStatusArea(this.uuid, this._indicator);
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

        this._upcomingReminderItem = new PopupMenu.PopupMenuItem(_('Upcoming reminder: none'), {
            reactive: false,
        });
        this._indicator.menu.addMenuItem(this._upcomingReminderItem);

        this._currentPrayerItem = new PopupMenu.PopupMenuItem(_('Current prayer: not available'), {
            reactive: false,
        });
        this._indicator.menu.addMenuItem(this._currentPrayerItem);

        this._upcomingPrayerItem = new PopupMenu.PopupMenuItem(_('Next prayer: not available'), {
            reactive: false,
        });
        this._indicator.menu.addMenuItem(this._upcomingPrayerItem);

        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const openPrefsItem = new PopupMenu.PopupMenuItem(_('Open Preferences'));
        openPrefsItem.connect('activate', () => this.openPreferences());
        this._indicator.menu.addMenuItem(openPrefsItem);

        const reloadItem = new PopupMenu.PopupMenuItem(_('Reload Reminders'));
        reloadItem.connect('activate', () => this._updateReminders());
        this._indicator.menu.addMenuItem(reloadItem);
    }

    _handleSnooze(id) {
        const nextTrigger = GLib.DateTime.new_now_local().add_minutes(15);
        const reminder = this._scheduler._reminders.get(id);
        if (reminder)
            reminder.nextTrigger = nextTrigger;

        this._updateIndicatorStatus();
    }

    _handleDone(id) {
        const reminder = this._scheduler._reminders.get(id);
        if (reminder && reminder.recalculate)
            reminder.nextTrigger = reminder.recalculate();

        this._updateIndicatorStatus();
    }

    _formatPrayerName(key) {
        const prayer = PRAYER_TEMPLATES[key];
        if (!prayer)
            return key;

        return `${prayer.emoji} ${prayer.name}`;
    }

    _getPrayerTimes() {
        const raw = this._settings.getString('prayer-times');
        if (!raw)
            return { ...DEFAULT_PRAYER_TIMES };

        try {
            const parsed = JSON.parse(raw);
            const times = { ...DEFAULT_PRAYER_TIMES };
            for (const prayer of PRAYER_ORDER) {
                const value = String(parsed?.[prayer] ?? '').trim();
                times[prayer] = this._isValidPrayerTime(value)
                    ? value
                    : DEFAULT_PRAYER_TIMES[prayer];
            }
            return times;
        } catch (e) {
            console.error('Invalid prayer-times JSON:', e);
            return { ...DEFAULT_PRAYER_TIMES };
        }
    }

    _isValidPrayerTime(value) {
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
    }

    _buildPrayerDateTime(prayerTimes, prayerKey, dayOffset = 0) {
        const time = prayerTimes[prayerKey] ?? '';
        const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
        if (!match)
            return null;

        const hours = Number.parseInt(match[1], 10);
        const minutes = Number.parseInt(match[2], 10);
        const date = GLib.DateTime.new_now_local().add_days(dayOffset);
        return GLib.DateTime.new_local(
            date.get_year(),
            date.get_month(),
            date.get_day_of_month(),
            hours,
            minutes,
            0,
        );
    }

    _getPrayerStatus() {
        const now = GLib.DateTime.new_now_local();
        const prayerTimes = this._getPrayerTimes();
        const entries = PRAYER_ORDER.map(key => ({
            key,
            time: prayerTimes[key],
            datetime: this._buildPrayerDateTime(prayerTimes, key, 0),
        })).filter(entry => entry.datetime !== null);

        if (entries.length === 0)
            return null;

        let upcoming = entries.find(entry => now.compare(entry.datetime) < 0) ?? null;
        if (!upcoming) {
            const first = PRAYER_ORDER[0];
            upcoming = {
                key: first,
                time: prayerTimes[first],
                datetime: this._buildPrayerDateTime(prayerTimes, first, 1),
            };
        }

        let current = null;
        for (let i = entries.length - 1; i >= 0; i -= 1) {
            if (now.compare(entries[i].datetime) >= 0) {
                current = entries[i];
                break;
            }
        }
        if (!current)
            current = entries[entries.length - 1];

        return { current, upcoming };
    }

    _formatTime(dateTime) {
        if (!dateTime)
            return '--:--';

        return dateTime.format('%R');
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
        if (!this._statusItem || !this._upcomingReminderItem || !this._currentPrayerItem || !this._upcomingPrayerItem)
            return;

        const reminders = [...this._scheduler.getReminders().entries()]
            .map(([id, reminder]) => ({ id, ...reminder }));

        if (reminders.length === 0) {
            this._statusItem.label.text = _('No reminders scheduled');
            this._upcomingReminderItem.label.text = _('Upcoming reminder: none');
            this._setPanelText(_('No events'));
        } else {
            const next = reminders
                .filter(reminder => reminder.nextTrigger)
                .sort((a, b) => a.nextTrigger.compare(b.nextTrigger))[0];

            this._statusItem.label.text = _('%d active reminders').format(reminders.length);
            if (next) {
                this._upcomingReminderItem.label.text = `${_('Upcoming reminder')}: ${next.title} (${this._formatTime(next.nextTrigger)})`;
                this._setPanelText(`${next.title}`);
            } else {
                this._upcomingReminderItem.label.text = _('Upcoming reminder: none');
                this._setPanelText(_('No events'));
            }
        }

        if (!this._settings.getBoolean('prayer-enabled')) {
            this._currentPrayerItem.label.text = _('Current prayer: disabled');
            this._upcomingPrayerItem.label.text = _('Next prayer: disabled');
            return;
        }

        const prayerStatus = this._getPrayerStatus();
        if (!prayerStatus) {
            this._currentPrayerItem.label.text = _('Current prayer: not available');
            this._upcomingPrayerItem.label.text = _('Next prayer: not available');
            return;
        }

        this._currentPrayerItem.label.text = `${_('Current prayer')}: ${this._formatPrayerName(prayerStatus.current.key)} (${prayerStatus.current.time})`;
        this._upcomingPrayerItem.label.text = `${_('Next prayer')}: ${this._formatPrayerName(prayerStatus.upcoming.key)} (${prayerStatus.upcoming.time})`;
    }

    _updateReminders() {
        this._scheduler.clearReminders();

        if (this._settings.getBoolean('prayer-enabled')) {
            const getNextPrayer = () => {
                const status = this._getPrayerStatus();
                if (!status)
                    return { next: null, key: '' };

                return { next: status.upcoming.datetime, key: status.upcoming.key };
            };

            const initial = getNextPrayer();
            const prayerReminder = {
                title: REMINDER_TEMPLATES.prayer.title,
                body: `It's time for ${this._formatPrayerName(initial.key)} prayer`,
                nextTrigger: initial.next,
                recalculate: () => {
                    const nextPrayer = getNextPrayer();
                    prayerReminder.body = `It's time for ${this._formatPrayerName(nextPrayer.key)} prayer`;
                    return nextPrayer.next;
                },
                icon: 'appointment-soon-symbolic',
            };

            this._scheduler.setReminder('prayer', prayerReminder);
        }

        if (this._settings.getBoolean('water-enabled')) {
            const interval = Math.max(1, this._settings.getInt('water-interval'));
            const recalculate = () => GLib.DateTime.new_now_local().add_minutes(interval);

            this._scheduler.setReminder('water', {
                title: REMINDER_TEMPLATES.water.title,
                body: REMINDER_TEMPLATES.water.body,
                nextTrigger: recalculate(),
                recalculate,
                icon: 'water-symbolic',
            });
        }

        if (this._settings.getBoolean('break-enabled')) {
            const interval = Math.max(1, this._settings.getInt('break-interval'));
            const breakDuration = Math.max(1, this._settings.getInt('break-duration'));
            const recalculate = () => GLib.DateTime.new_now_local().add_minutes(interval);

            this._scheduler.setReminder('break', {
                title: REMINDER_TEMPLATES.break.title,
                body: _('Take a %d minute break to stretch and rest your eyes!').format(breakDuration),
                nextTrigger: recalculate(),
                recalculate,
                icon: 'timer-symbolic',
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

        this._scheduler.tickNow();
        this._updateIndicatorStatus();
    }

    _setPanelText(text) {
        if (!this._panelText)
            return;

        this._panelText.text = text && text.length ? text : _('No events');
    }

    _setReminderDotVisible(visible) {
        if (!this._reminderDot)
            return;

        this._reminderDot.visible = Boolean(visible);
    }

    _markNotificationUnread() {
        this._setReminderDotVisible(true);
    }

    _markNotificationRead() {
        this._setReminderDotVisible(false);
    }
}
