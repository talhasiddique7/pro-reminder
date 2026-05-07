import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

const NotificationPolicy = GObject.registerClass(
class NotificationPolicy extends MessageTray.NotificationPolicy {
    get enable() {
        return true;
    }

    get enableSound() {
        return true;
    }

    get showBanners() {
        return true;
    }

    get forceExpanded() {
        return false;
    }

    get showInLockScreen() {
        return false;
    }

    get detailsInLockScreen() {
        return false;
    }

    store() {
    }
});

export class Notifier {
    constructor({ onSnooze = null, onDone = null } = {}) {
        this._onSnooze = onSnooze;
        this._onDone = onDone;
        this._source = null;
    }

    _ensureSource() {
        if (this._source)
            return this._source;

        this._source = new MessageTray.Source({
            title: 'RemindMe',
            icon: new Gio.ThemedIcon({ name: 'appointment-soon-symbolic' }),
            policy: new NotificationPolicy(),
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

            source.addNotification(notification);
        } catch (e) {
            console.error('Error showing notification:', e);
        }
    }

    destroy() {
        this._source?.destroy();
        this._source = null;
    }
}
