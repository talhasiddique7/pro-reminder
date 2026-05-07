import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

export class Notifier {
    constructor({ onSnooze = null, onDone = null, onNotification = null, soundFilePath = null, appIconPath = null, shouldPlaySound = null } = {}) {
        this._onSnooze = onSnooze;
        this._onDone = onDone;
        this._onNotification = onNotification;
        this._shouldPlaySound = shouldPlaySound;
        this._source = null;
        this._soundFile = soundFilePath ? Gio.File.new_for_path(soundFilePath) : null;
        this._appIcon = null;

        try {
            if (appIconPath) {
                const iconFile = Gio.File.new_for_path(appIconPath);
                if (iconFile.query_exists(null))
                    this._appIcon = new Gio.FileIcon({ file: iconFile });
            }
        } catch (e) {
            console.error('Error loading notification app icon:', e);
        }
    }

    _ensureSource() {
        if (this._source)
            return this._source;

        this._source = new MessageTray.Source({
            title: 'RemindMe',
            icon: this._appIcon ?? new Gio.ThemedIcon({ name: 'alarm-symbolic' }),
        });
        this._source.connect('destroy', () => {
            this._source = null;
        });
        Main.messageTray.add(this._source);
        return this._source;
    }

    show(id, title, body, iconName = 'appointment-soon-symbolic') {
        try {
            const source = this._ensureSource();
            const gicon = new Gio.ThemedIcon({ name: iconName || 'alarm-symbolic' });
            const notification = new MessageTray.Notification({
                source,
                title,
                body,
                gicon,
                urgency: MessageTray.Urgency.NORMAL,
            });

            notification.addAction('Snooze 15m', () => {
                this._onSnooze?.(id);
            });
            notification.addAction('Done', () => {
                this._onDone?.(id);
            });

            this._playNotificationSound();
            source.addNotification(notification);
            this._onNotification?.(id);
        } catch (e) {
            console.error('Error showing notification:', e);
        }
    }

    _playNotificationSound() {
        if (typeof this._shouldPlaySound === 'function' && !this._shouldPlaySound())
            return;

        const player = global.display?.get_sound_player?.() ?? global.get_sound_player?.();

        try {
            if (this._soundFile?.query_exists(null)) {
                if (player) {
                    player.play_from_file(this._soundFile, 'Reminder notification', null);
                    return;
                }

                if (typeof global.play_sound_file === 'function') {
                    global.play_sound_file(0, this._soundFile.get_path(), 'Reminder notification', null);
                    return;
                }
            }
        } catch (e) {
            console.error('Error playing custom reminder sound:', e);
        }

        if (!player)
            return;

        try {
            player.play_from_theme('alarm-clock-elapsed', 'Reminder notification', null);
        } catch (e) {
            try {
                player.play_from_theme('message', 'Reminder notification', null);
            } catch (fallbackError) {
                console.error('Error playing fallback reminder sound:', fallbackError);
            }
        }
    }

    destroy() {
        this._source?.destroy();
        this._source = null;
    }
}
