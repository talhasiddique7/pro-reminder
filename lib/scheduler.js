import GLib from 'gi://GLib';

export class Scheduler {
    constructor(notifier) {
        this._notifier = notifier;
        this._timerId = null;
        this._reminders = new Map();
    }

    start() {
        if (this._timerId) return;
        
        // Tick every 15 seconds to keep reminder timing responsive.
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 15, () => {
            this._tick();
            return GLib.SOURCE_CONTINUE;
        });
        
        // Initial tick
        this._tick();
    }

    stop() {
        if (this._timerId) {
            GLib.Source.remove(this._timerId);
            this._timerId = null;
        }
    }

    /**
     * @param {string} id Unique ID for the reminder
     * @param {Object} reminder 
     * @param {string} reminder.title
     * @param {string} reminder.body
     * @param {string} [reminder.icon] Icon name (optional)
     * @param {GLib.DateTime} reminder.nextTrigger
     * @param {Function} reminder.recalculate Function to call after trigger to set nextTrigger
     */
    setReminder(id, reminder) {
        this._reminders.set(id, reminder);
    }

    removeReminder(id) {
        this._reminders.delete(id);
    }

    clearReminders() {
        this._reminders.clear();
    }

    getReminders() {
        return this._reminders;
    }

    tickNow() {
        this._tick();
    }

    _tick() {
        const now = GLib.DateTime.new_now_local();
        
        for (const [id, reminder] of this._reminders) {
            if (!reminder.nextTrigger) continue;

            if (now.compare(reminder.nextTrigger) >= 0) {
                const icon = reminder.icon || 'appointment-soon-symbolic';
                this._notifier.show(id, reminder.title, reminder.body, icon);
                
                if (typeof reminder.recalculate === 'function') {
                    reminder.nextTrigger = reminder.recalculate();
                } else {
                    // If no recalculate, remove it or set nextTrigger to null
                    reminder.nextTrigger = null;
                }
            }
        }
    }
}
