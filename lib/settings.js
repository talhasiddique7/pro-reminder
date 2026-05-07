import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class SettingsManager {
    constructor(settings) {
        this._settings = settings;
    }

    get(key) {
        return this._settings.get_value(key).recursive_unpack();
    }

    set(key, value) {
        const variant = new GLib.Variant(this._settings.get_settings_schema().get_key(key).get_value_type().dup_string(), value);
        this._settings.set_value(key, variant);
    }

    getBoolean(key) {
        return this._settings.get_boolean(key);
    }

    setBoolean(key, value) {
        this._settings.set_boolean(key, value);
    }

    getInt(key) {
        return this._settings.get_int(key);
    }

    setInt(key, value) {
        this._settings.set_int(key, value);
    }

    getDouble(key) {
        return this._settings.get_double(key);
    }

    setDouble(key, value) {
        this._settings.set_double(key, value);
    }

    getString(key) {
        return this._settings.get_string(key);
    }

    setString(key, value) {
        this._settings.set_string(key, value);
    }

    connect(key, callback) {
        return this._settings.connect(`changed::${key}`, callback);
    }

    disconnect(handlerId) {
        this._settings.disconnect(handlerId);
    }
}
