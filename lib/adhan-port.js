/**
 * lib/adhan-port.js
 * A minimal port of adhan-js for GNOME Shell (GJS).
 * Calculates prayer times based on latitude, longitude, and date.
 */

export const CalculationMethod = {
    MWL: { fajr: 18, isha: 17 },
    ISNA: { fajr: 15, isha: 15 },
    Egypt: { fajr: 19.5, isha: 17.5 },
    Makkah: { fajr: 18.5, isha: 0, ishaInterval: 90 }, // Isha is 90 min after Maghrib
    Karachi: { fajr: 18, isha: 18 },
    Tehran: { fajr: 17.7, isha: 14, maghrib: 4.5, midnight: 'Jafari' },
    Jafari: { fajr: 16, isha: 14, maghrib: 4, midnight: 'Jafari' },
};

export class PrayerEngine {
    constructor(lat, lon, method = 'MWL') {
        this.lat = lat;
        this.lon = lon;
        this.method = CalculationMethod[method] || CalculationMethod.MWL;
    }

    getTimes(date = new Date()) {
        const jDate = this._julianDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
        const times = this._computeTimes(jDate);
        return this._adjustTimes(times, date);
    }

    _julianDate(year, month, day) {
        if (month <= 2) {
            year -= 1;
            month += 12;
        }
        const A = Math.floor(year / 100);
        const B = 2 - A + Math.floor(A / 4);
        return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
    }

    _computeTimes(jDate) {
        const d = jDate - 2451545.0;
        const g = (357.529 + 0.98560028 * d) % 360;
        const q = (280.459 + 0.98564736 * d) % 360;
        const L = (q + 1.915 * Math.sin(this._rad(g)) + 0.020 * Math.sin(this._rad(2 * g))) % 360;
        const e = 23.439 - 0.00000036 * d;
        
        const RA = this._deg(Math.atan2(Math.cos(this._rad(e)) * Math.sin(this._rad(L)), Math.cos(this._rad(L)))) / 15;
        const eqt = q / 15 - this._fixHour(RA);
        const decl = this._deg(Math.asin(Math.sin(this._rad(e)) * Math.sin(this._rad(L))));
        
        const noon = this._fixHour(12 - eqt);
        const utcNnoon = noon - this.lon / 15;

        const fajr = utcNnoon - this._hourAngle(this.method.fajr, decl) / 15;
        const sunrise = utcNnoon - this._hourAngle(0.833, decl) / 15;
        const dhuhr = utcNnoon;
        const asr = utcNnoon + this._asrAngle(1, decl) / 15;
        const sunset = utcNnoon + this._hourAngle(0.833, decl) / 15;
        const maghrib = this.method.maghrib 
            ? utcNnoon + this._hourAngle(this.method.maghrib, decl) / 15
            : sunset;
        const isha = this.method.ishaInterval
            ? sunset + this.method.ishaInterval / 60
            : utcNnoon + this._hourAngle(this.method.isha, decl) / 15;

        return { fajr, sunrise, dhuhr, asr, sunset, maghrib, isha };
    }

    _hourAngle(angle, decl) {
        const val = (Math.sin(this._rad(-angle)) - Math.sin(this._rad(this.lat)) * Math.sin(this._rad(decl))) /
                    (Math.cos(this._rad(this.lat)) * Math.cos(this._rad(decl)));
        return this._deg(Math.acos(Math.max(-1, Math.min(1, val))));
    }

    _asrAngle(factor, decl) {
        const val = Math.tan(this._rad(Math.abs(this.lat - decl)));
        const angle = this._deg(Math.atan(1 / (factor + val)));
        return this._hourAngle(angle, decl);
    }

    _adjustTimes(times, date) {
        const offset = date.getTimezoneOffset() / 60;
        const result = {};
        for (const [key, value] of Object.entries(times)) {
            const time = value - offset;
            const hours = Math.floor(time);
            const minutes = Math.floor((time - hours) * 60);
            const d = new Date(date);
            d.setHours(hours, minutes, 0, 0);
            result[key] = d;
        }
        return result;
    }

    _rad(deg) { return deg * Math.PI / 180; }
    _deg(rad) { return rad * 180 / Math.PI; }
    _fixHour(h) { return (h + 24) % 24; }
}
