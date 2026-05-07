import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

export class Notifier {
    constructor({ onSnooze = null, onDone = null, onNotification = null, soundFilePath = null, shouldPlaySound = null } = {}) {
        this._onSnooze = onSnooze;
        this._onDone = onDone;
        this._onNotification = onNotification;
        this._shouldPlaySound = shouldPlaySound;
        this._source = null;
        this._soundFile = soundFilePath ? Gio.File.new_for_path(soundFilePath) : null;
    }

    _ensureSource() {
        if (this._source)
            return this._source;

        this._source = new MessageTray.Source({
            title: 'RemindMe',
            icon: new Gio.ThemedIcon({ name: 'appointment-soon-symbolic' }),
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
            const notification = new MessageTray.Notification({
                source,
                title,
                body,
                iconName: iconName || 'appointment-soon-symbolic',
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

        const player = global.display?.get_sound_player?.();
        if (!player)
            return;

        try {
            if (this._soundFile?.query_exists(null)) {
                player.play_from_file(this._soundFile, 'Reminder notification', null);
                return;
            }
        } catch (e) {
            console.error('Error playing custom reminder sound:', e);
        }

        try {
            player.play_from_theme('message', 'Reminder notification', null);
        } catch (e) {
            console.error('Error playing fallback reminder sound:', e);
        }
    }

    destroy() {
        this._source?.destroy();
        this._source = null;
    }
}
