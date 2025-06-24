/*
**  This is derived from https://github.com/yaddran/busylight/blob/main/src/busylight.ts
**  It is ISC-licensed. It was changed by Dr. Ralf S. Engelschall in 2025 the following way:
**  - add "unclean" flag to "disconnect" method
**  - fix API typo: "intesity" -> "intensity"
**  - fix TypeScript problems
*/
import * as HID from "node-hid";
var BusyLight = /** @class */ (function () {
    function BusyLight(device) {
        Object.defineProperty(this, "_device", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_hid", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_keepalive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_steps", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: BusyLight.OFF.concat([])
        });
        Object.defineProperty(this, "_response", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "_r", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_g", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_b", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_tone", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: -1
        });
        Object.defineProperty(this, "_volume", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: -1
        });
        Object.defineProperty(this, "_intensity", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 100
        });
        Object.defineProperty(this, "_once_timer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        if (!device)
            return;
        this._device = device;
    }
    Object.defineProperty(BusyLight, "devices", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function () {
            var _this = this;
            var ds = HID.devices();
            var result = [];
            if (!Array.isArray(ds))
                return [];
            ds.forEach(function (d) {
                if (d.vendorId !== _this.VENDORID)
                    return;
                if (_this.PRODUCTS.indexOf(d.productId) < 0)
                    return;
                result.push(d);
            });
            return result;
        }
    });
    Object.defineProperty(BusyLight.prototype, "_connect", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function () {
            var _this = this;
            try {
                this._hid = new HID.HID(this._device.path);
                this._hid.on('data', function (data) {
                    if (!data)
                        return;
                    _this._response = Array.from(data);
                });
                this._send(this._steps);
            }
            catch (ignore) {
                this._hid = null;
            }
        }
    });
    Object.defineProperty(BusyLight.prototype, "_keep_alive", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function () {
            if (!this._device)
                return;
            if (!this._hid)
                return this._connect();
            this._send(BusyLight.KEEPALIVE);
        }
    });
    Object.defineProperty(BusyLight.prototype, "_checksumed", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (data) {
            var bytes = new Uint8Array(data.length + 1);
            bytes[0] = 0;
            data.forEach(function (v, i) {
                bytes[i + 1] = v & 0xFF;
            });
            bytes[60] = 0xFF;
            bytes[61] = 0xFF;
            bytes[62] = 0xFF;
            var cs = 0;
            data.forEach(function (v, i) {
                if (i > 62)
                    return;
                cs = cs + bytes[i];
            });
            bytes[63] = (cs >> 8) & 0xFF;
            bytes[64] = cs & 0xFF;
            return bytes;
        }
    });
    Object.defineProperty(BusyLight.prototype, "_send", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (data) {
            if (!this._hid)
                return;
            try {
                this._hid.write(this._checksumed(data));
            }
            catch (ignore) {
                this._hid = null;
            }
        }
    });
    Object.defineProperty(BusyLight.prototype, "connect", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function () {
            if (!this._device)
                return false;
            if (this._keepalive)
                return true;
            this._keepalive = setInterval(this._keep_alive.bind(this), BusyLight.KEEPALIVE_SEC * 1000);
            this._keep_alive();
            return true;
        }
    });
    Object.defineProperty(BusyLight.prototype, "_build_step", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (step, index) {
            if (!step)
                return false;
            if (index >= BusyLight.STEPS_COUNT)
                return false;
            var si = index * 8;
            if (!BusyLight.CMDS[step.cmd])
                return false;
            step.cmdv = step.cmdv & 0x0F;
            this._steps[si + 0] = BusyLight.CMDS[step.cmd] | step.cmdv;
            step.repeat = step.repeat & 0xFF;
            this._steps[si + 1] = step.repeat;
            step.red = step.red & 0xFF;
            this._steps[si + 2] = step.red;
            step.green = step.green & 0xFF;
            this._steps[si + 3] = step.green;
            step.blue = step.blue & 0xFF;
            this._steps[si + 4] = step.blue;
            step.on = step.on & 0xFF;
            this._steps[si + 5] = step.on;
            step.off = step.off & 0xFF;
            this._steps[si + 6] = step.off;
            this._steps[si + 7] = 0x00;
            if (!step.audio)
                return true;
            this._steps[si + 7] = 0x80;
            if (step.tone < 0)
                return true;
            if (step.volume <= 0)
                return true;
            step.tone = step.tone & 0x0F;
            step.volume = step.volume & 0x07;
            this._steps[si + 7] = 0x80 | (step.tone << 3) | step.volume;
            return true;
        }
    });
    Object.defineProperty(BusyLight.prototype, "state", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function () {
            var s = '';
            var c;
            for (var i = 0; i < 8; i = i + 1) {
                for (var j = 0; j < 8; j = j + 1) {
                    c = this._steps[i * 8 + j].toString(16);
                    s = s + (c.length < 2 ? '0' : '') + c + ' ';
                }
                s = s + '\n';
            }
            return s;
        }
    });
    Object.defineProperty(BusyLight.prototype, "_build_steps", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (steps) {
            var _this = this;
            this._steps = BusyLight.OFF.concat([]);
            if (!Array.isArray(steps))
                return;
            var step_index = 0;
            steps.forEach(function (step) {
                if (!_this._build_step(step, step_index))
                    return;
                step_index = step_index + 1;
            });
        }
    });
    Object.defineProperty(BusyLight.prototype, "program", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (steps) {
            if (this._once_timer)
                clearTimeout(this._once_timer);
            this._once_timer = null;
            this._send(BusyLight.OFF);
            this._build_steps(steps);
            this._send(this._steps);
        }
    });
    Object.defineProperty(BusyLight.prototype, "off", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function () {
            if (this._once_timer)
                clearTimeout(this._once_timer);
            this._once_timer = null;
            this._steps = BusyLight.OFF.concat([]);
            this._send(this._steps);
        }
    });
    Object.defineProperty(BusyLight.prototype, "intensity", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (value) {
            if (value < 0)
                value = 0;
            if (value > 100)
                value = 100;
            this._intensity = value;
        }
    });
    Object.defineProperty(BusyLight.prototype, "light", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (color) {
            if (!color)
                return false;
            if (color.charAt(0) === '#')
                color = color.substring(1);
            if (color.length < 6)
                return false;
            var r = parseInt(color.substring(0, 2), 16);
            var g = parseInt(color.substring(2, 4), 16);
            var b = parseInt(color.substring(4, 6), 16);
            if (isNaN(r))
                return false;
            if (isNaN(g))
                return false;
            if (isNaN(b))
                return false;
            this._r = Math.trunc(r * this._intensity / 100);
            this._g = Math.trunc(g * this._intensity / 100);
            this._b = Math.trunc(b * this._intensity / 100);
            this._build_steps([{
                    cmd: 'jump',
                    cmdv: 0,
                    repeat: 0,
                    red: this._r,
                    green: this._g,
                    blue: this._b,
                    on: 0xff,
                    off: 0x00,
                    audio: false,
                    tone: 0,
                    volume: 0
                }]);
            this._send(this._steps);
            return true;
        }
    });
    Object.defineProperty(BusyLight.prototype, "blink", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (color, on, off) {
            if (!color)
                return false;
            if (color.charAt(0) === '#')
                color = color.substring(1);
            if (color.length < 6)
                return false;
            var r = parseInt(color.substring(0, 2), 16);
            var g = parseInt(color.substring(2, 4), 16);
            var b = parseInt(color.substring(4, 6), 16);
            if (isNaN(r))
                return false;
            if (isNaN(g))
                return false;
            if (isNaN(b))
                return false;
            this._r = Math.trunc(r * this._intensity / 100);
            this._g = Math.trunc(g * this._intensity / 100);
            this._b = Math.trunc(b * this._intensity / 100);
            this._build_steps([{
                    cmd: 'jump',
                    cmdv: 0,
                    repeat: 0,
                    red: this._r,
                    green: this._g,
                    blue: this._b,
                    on: on,
                    off: off,
                    audio: false,
                    tone: 0,
                    volume: 0
                }]);
            this._send(this._steps);
            return true;
        }
    });
    Object.defineProperty(BusyLight.prototype, "pulse", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (color) {
            if (!color)
                return false;
            if (color.charAt(0) === '#')
                color = color.substring(1);
            if (color.length < 6)
                return false;
            var r = parseInt(color.substring(0, 2), 16);
            var g = parseInt(color.substring(2, 4), 16);
            var b = parseInt(color.substring(4, 6), 16);
            if (isNaN(r))
                return false;
            if (isNaN(g))
                return false;
            if (isNaN(b))
                return false;
            this._r = Math.trunc(r * this._intensity / 100);
            this._g = Math.trunc(g * this._intensity / 100);
            this._b = Math.trunc(b * this._intensity / 100);
            var steps = [];
            var step = 0;
            for (var si = 1; si <= 4; si = si + 1) {
                steps.push({
                    cmd: 'jump',
                    cmdv: step < 6 ? step + 1 : 0,
                    repeat: 0,
                    red: Math.trunc(si * this._r / 4),
                    green: Math.trunc(si * this._g / 4),
                    blue: Math.trunc(si * this._b / 4),
                    on: 0x01,
                    off: 0x00,
                    audio: false,
                    tone: 0,
                    volume: 0
                });
                step = step + 1;
            }
            for (var si = 5; si >= 2; si = si - 1) {
                steps.push({
                    cmd: 'jump',
                    cmdv: step < 6 ? step + 1 : 0,
                    repeat: 0,
                    red: Math.trunc(si * this._r / 7),
                    green: Math.trunc(si * this._g / 7),
                    blue: Math.trunc(si * this._b / 7),
                    on: 0x01,
                    off: 0x00,
                    audio: false,
                    tone: 0,
                    volume: 0
                });
                step = step + 1;
            }
            this._build_steps(steps);
            this._send(this._steps);
            return true;
        }
    });
    Object.defineProperty(BusyLight.prototype, "tone", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (tone, volume) {
            if (this._once_timer)
                clearTimeout(this._once_timer);
            this._once_timer = null;
            this._tone = tone;
            this._volume = volume;
            this._build_steps([{
                    cmd: 'jump',
                    cmdv: 0,
                    repeat: 0,
                    red: this._r,
                    green: this._g,
                    blue: this._b,
                    on: 0x00,
                    off: 0x00,
                    audio: true,
                    tone: -1,
                    volume: -1
                }]);
            this._send(this._steps);
            this._build_steps([{
                    cmd: 'jump',
                    cmdv: 0,
                    repeat: 0,
                    red: this._r,
                    green: this._g,
                    blue: this._b,
                    on: 0xff,
                    off: 0x00,
                    audio: true,
                    tone: this._tone,
                    volume: this._volume
                }]);
            this._send(this._steps);
            return true;
        }
    });
    Object.defineProperty(BusyLight.prototype, "alert", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (tone, volume, color, blinkpulse, on, off) {
            if (blinkpulse === void 0) { blinkpulse = true; }
            if (on === void 0) { on = 4; }
            if (off === void 0) { off = 3; }
            this.tone(tone, volume);
            if (blinkpulse)
                return this.blink(color, on, off);
            this.pulse(color);
        }
    });
    Object.defineProperty(BusyLight.prototype, "once", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (tone, volume) {
            var _this = this;
            if (!this._device)
                return -1;
            if (!BusyLight.TONE_LEN[this._device.productId])
                return -1;
            if (!BusyLight.TONE_LEN[this._device.productId][tone])
                return -1;
            this.tone(tone, volume);
            this._once_timer = setTimeout(function () {
                _this._once_timer = null;
                _this._build_steps([{
                        cmd: 'jump',
                        cmdv: 0,
                        repeat: 0,
                        red: _this._r,
                        green: _this._g,
                        blue: _this._b,
                        on: 0x00,
                        off: 0x00,
                        audio: true,
                        tone: -1,
                        volume: -1
                    }]);
                _this._send(_this._steps);
            }, BusyLight.TONE_LEN[this._device.productId][tone]);
            return BusyLight.TONE_LEN[this._device.productId][tone];
        }
    });
    Object.defineProperty(BusyLight.prototype, "tones", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function () {
            if (!this._device)
                return [];
            if (!BusyLight.TONE_NAME[this._device.productId])
                return [];
            return BusyLight.TONE_NAME[this._device.productId];
        }
    });
    Object.defineProperty(BusyLight.prototype, "durations", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function () {
            if (!this._device)
                return [];
            if (!BusyLight.TONE_LEN[this._device.productId])
                return [];
            return BusyLight.TONE_LEN[this._device.productId];
        }
    });
    Object.defineProperty(BusyLight.prototype, "device", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function () {
            if (!this._device)
                return '';
            if (!BusyLight.DEVICE_NAME[this._device.productId])
                return '';
            return BusyLight.DEVICE_NAME[this._device.productId];
        }
    });
    Object.defineProperty(BusyLight.prototype, "is", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (device) {
            if (!device)
                return false;
            if (!this._device)
                return false;
            return device.path === this._device.path;
        }
    });
    Object.defineProperty(BusyLight.prototype, "disconnect", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (unclean) {
            if (unclean === void 0) { unclean = false; }
            if (this._keepalive)
                clearInterval(this._keepalive);
            this._keepalive = null;
            if (!unclean) {
                this._steps = BusyLight.OFF.concat([]);
                this._send(this._steps);
            }
            if (this._hid)
                this._hid.close();
            this._hid = null;
        }
    });
    Object.defineProperty(BusyLight.prototype, "_b2s", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (data, f, t) {
            if (!Array.isArray(data))
                return '';
            if (!data[f])
                return '';
            if (!data[t])
                return '';
            var result = '';
            for (var ci = f; ci <= t; ci = ci + 1)
                result = result + String.fromCharCode(data[ci]);
            return result;
        }
    });
    Object.defineProperty(BusyLight.prototype, "response", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function () {
            var response = {};
            if (this._response.length === 0)
                return response;
            response.activity = this._b2s(this._response, 0, 0) === '1';
            response.product = this._b2s(this._response, 1, 3) === '001' ? 'Busylight' : 'Kuando Box';
            response.customer = this._b2s(this._response, 4, 11);
            response.model = this._b2s(this._response, 12, 15);
            response.serial = this._b2s(this._response, 16, 23);
            response.manufacturer = this._b2s(this._response, 24, 31);
            response.date = this._b2s(this._response, 32, 39);
            response.software = this._b2s(this._response, 40, 45);
            return response;
        }
    });
    Object.defineProperty(BusyLight, "KEEPALIVE_SEC", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: 5
    });
    Object.defineProperty(BusyLight, "STEPS_COUNT", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: 7
    });
    Object.defineProperty(BusyLight, "VENDORID", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: 0x27BB
    });
    Object.defineProperty(BusyLight, "PRODUCTS", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: [0x3BCA, 0x3BCB, 0x3BCC, 0x3BCD, 0x3BCE, 0x3BCF]
    });
    Object.defineProperty(BusyLight, "CMDS", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: {
            keepalive: 0x80,
            bootloader: 0x40,
            reset: 0x20,
            jump: 0x10
        }
    });
    Object.defineProperty(BusyLight, "DEVICE_NAME", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: {
            0x3BCA: 'Busylight Alpha model',
            0x3BCB: 'Busylight UC model',
            0x3BCC: 'Busylight UC model',
            0x3BCD: 'Busylight Omega model',
            0x3BCE: 'Busylight Alpha model 2',
            0x3BCF: 'Busylight Omega model 2'
        }
    });
    Object.defineProperty(BusyLight, "TONE_LEN_11", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: [
            5700,
            2400,
            2400,
            3000,
            4500,
            3900,
            3500,
            2200,
            2200,
            2000,
            2000
        ]
    });
    Object.defineProperty(BusyLight, "TONE_LEN_12", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: [
            5700,
            2400,
            2400,
            3000,
            4500,
            3900,
            3500,
            2200,
            2200,
            2000,
            2000,
            2400
        ]
    });
    Object.defineProperty(BusyLight, "TONE_LEN", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: {
            0x3BCA: BusyLight.TONE_LEN_11,
            0x3BCB: BusyLight.TONE_LEN_11,
            0x3BCC: BusyLight.TONE_LEN_11,
            0x3BCD: BusyLight.TONE_LEN_11,
            0x3BCE: BusyLight.TONE_LEN_11,
            0x3BCF: BusyLight.TONE_LEN_12
        }
    });
    Object.defineProperty(BusyLight, "TONE_NAME_11", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: [
            'Twinkling',
            'Open Office',
            'Quiet',
            'Funky',
            'Fairy Tale',
            'Kuando Train',
            'Telephone Nordic',
            'Telephone Original',
            'Telephone Pick Me Up',
            'Instant Message 1',
            'Instant Message 2'
        ]
    });
    Object.defineProperty(BusyLight, "TONE_NAME_12", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: [
            'Twinkling',
            'Open Office',
            'Quiet',
            'Funky',
            'Fairy Tale',
            'Kuando Train',
            'Telephone Nordic',
            'Telephone Original',
            'Telephone Pick Me Up',
            'Instant Message 1',
            'Instant Message 2',
            'Instant Message 3'
        ]
    });
    Object.defineProperty(BusyLight, "TONE_NAME", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: {
            0x3BCA: BusyLight.TONE_NAME_11,
            0x3BCB: BusyLight.TONE_NAME_11,
            0x3BCC: BusyLight.TONE_NAME_11,
            0x3BCD: BusyLight.TONE_NAME_11,
            0x3BCE: BusyLight.TONE_NAME_11,
            0x3BCF: BusyLight.TONE_NAME_12
        }
    });
    Object.defineProperty(BusyLight, "KEEPALIVE", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: [
            0x8F, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x04, 0x04, 0x55, 0xFF, 0xFF, 0xFF, 0x00, 0x00
        ]
    });
    Object.defineProperty(BusyLight, "OFF", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: [
            0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x04, 0x04, 0x55, 0xFF, 0xFF, 0xFF, 0x00, 0x00
        ]
    });
    return BusyLight;
}());
export { BusyLight };
