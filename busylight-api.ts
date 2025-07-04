/*
**  This is derived from https://github.com/yaddran/busylight/blob/main/src/busylight.ts
**  It is ISC-licensed. It was changed by Dr. Ralf S. Engelschall in 2025 the following way:
**  - add "unclean" flag to "disconnect" method
**  - fix API typo: "intesity" -> "intensity"
**  - fix TypeScript problems
**  - provide EventEmitter functionality for emitting errors
*/

import { EventEmitter } from "node:events"
import * as HID         from "node-hid"

interface BusyLightDevice {
    vendorId: number
    productId: number
    path: string
    serialNumber: string
    manufacturer: string
    product: string
    release: number
    interface: number
    usagePage: number
    usage: number
}

type BusyLightDevices = Array<BusyLightDevice>

interface BusyLightStep {
    cmd: string
    cmdv: number
    repeat: number
    red: number
    green: number
    blue: number
    on: number
    off: number
    audio: boolean
    tone: number
    volume: number
}

type BusyLightSteps = Array<BusyLightStep>

interface BusyLightResponse {
    activity?: boolean
    product?: string
    customer?: string
    model?: string
    serial?: string
    manufacturer?: string
    date?: string
    software?: string
}

class BusyLight {
    private static KEEPALIVE_SEC = 5
    private static STEPS_COUNT = 7
    private static VENDORID = 0x27BB
    private static PRODUCTS = [0x3BCA, 0x3BCB, 0x3BCC, 0x3BCD, 0x3BCE, 0x3BCF]
    private eventEmitter: EventEmitter = new EventEmitter()

    private static CMDS = {
        keepalive:  0x80,
        bootloader: 0x40,
        reset:      0x20,
        jump:       0x10
    }

    private static DEVICE_NAME = {
        0x3BCA: 'Busylight Alpha model',
        0x3BCB: 'Busylight UC model',
        0x3BCC: 'Busylight UC model',
        0x3BCD: 'Busylight Omega model',
        0x3BCE: 'Busylight Alpha model 2',
        0x3BCF: 'Busylight Omega model 2'
    }

    private static TONE_LEN_11 = [
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

    private static TONE_LEN_12 = [
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

    private static TONE_LEN = {
        0x3BCA: BusyLight.TONE_LEN_11,
        0x3BCB: BusyLight.TONE_LEN_11,
        0x3BCC: BusyLight.TONE_LEN_11,
        0x3BCD: BusyLight.TONE_LEN_11,
        0x3BCE: BusyLight.TONE_LEN_11,
        0x3BCF: BusyLight.TONE_LEN_12
    }

    private static TONE_NAME_11 = [
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

    private static TONE_NAME_12 = [
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

    private static TONE_NAME = {
        0x3BCA: BusyLight.TONE_NAME_11,
        0x3BCB: BusyLight.TONE_NAME_11,
        0x3BCC: BusyLight.TONE_NAME_11,
        0x3BCD: BusyLight.TONE_NAME_11,
        0x3BCE: BusyLight.TONE_NAME_11,
        0x3BCF: BusyLight.TONE_NAME_12
    }

    private static KEEPALIVE: Array<number> = [
        0x8F, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x04, 0x04, 0x55, 0xFF, 0xFF, 0xFF, 0x00, 0x00
    ]

    private static OFF: Array<number> = [
        0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x04, 0x04, 0x55, 0xFF, 0xFF, 0xFF, 0x00, 0x00
    ]

    public static devices(): BusyLightDevices {
        const ds = HID.devices()
        const result: BusyLightDevices = []
        if (!Array.isArray(ds)) return []
        ds.forEach((d) => {
            if (d.vendorId !== this.VENDORID) return
            if (this.PRODUCTS.indexOf(d.productId) < 0) return
            result.push(d as BusyLightDevice)
        })
        return result
    }

    private _device: BusyLightDevice | null = null
    private _hid: any = null
    private _keepalive: any = null
    private _steps: Array<number> = BusyLight.OFF.concat([])
    private _response: Array<number> = []

    private _r: number = 0
    private _g: number = 0
    private _b: number = 0
    private _tone: number = -1
    private _volume: number = -1
    private _intensity: number = 100

    private _once_timer: any = null

    constructor(device: BusyLightDevice) {
        if (!device) return
        this._device = device
    }

    public onError (callback: (...args: any[]) => void) {
        this.eventEmitter.addListener("error", callback)
    }

    private _connect(): void {
        try {
            this._hid = new HID.HID(this._device!.path)
            this._hid.on('data', (data: Buffer) => {
                if (!data) return
                this._response = Array.from(data)
            })
            this._hid.on('error', (error: any) => {
                this.eventEmitter.emit("error", error)
            })
            this._send(this._steps)
        } catch (ignore) {
            this._hid = null
        }
    }

    private _keep_alive(): void {
        if (!this._device) return
        if (!this._hid) return this._connect()
        this._send(BusyLight.KEEPALIVE)
    }

    private _checksumed(data: Array<number>): Uint8Array {
        const bytes: Uint8Array = new Uint8Array(data.length + 1)
        bytes[0] = 0
        data.forEach((v, i) => {
            bytes[i + 1] = v & 0xFF
        })
        bytes[60] = 0xFF
        bytes[61] = 0xFF
        bytes[62] = 0xFF
        let cs = 0
        data.forEach((v, i) => {
            if (i > 62) return
            cs = cs + bytes[i]
        })
        bytes[63] = (cs >> 8) & 0xFF
        bytes[64] = cs & 0xFF
        return bytes
    }

    private _send(data: Array<number>): void {
        if (!this._hid) return
        try {
            this._hid.write(this._checksumed(data))
        } catch (ignore) {
            this._hid = null
        }
    }

    public connect(): boolean {
        if (!this._device) return false
        if (this._keepalive) return true
        this._keepalive = setInterval(this._keep_alive.bind(this), BusyLight.KEEPALIVE_SEC * 1000)
        this._keep_alive()
        return true
    }

    private _build_step(step: BusyLightStep, index: number): boolean {
        if (!step) return false
        if (index >= BusyLight.STEPS_COUNT) return false

        const si: number = index * 8

        if (!(BusyLight.CMDS as any)[step.cmd]) return false
        step.cmdv = step.cmdv & 0x0F
        this._steps[si + 0] = (BusyLight.CMDS as any)[step.cmd] | step.cmdv

        step.repeat = step.repeat & 0xFF
        this._steps[si + 1] = step.repeat

        step.red = step.red & 0xFF
        this._steps[si + 2] = step.red

        step.green = step.green & 0xFF
        this._steps[si + 3] = step.green

        step.blue = step.blue & 0xFF
        this._steps[si + 4] = step.blue

        step.on = step.on & 0xFF
        this._steps[si + 5] = step.on

        step.off = step.off & 0xFF
        this._steps[si + 6] = step.off

        this._steps[si + 7] = 0x00
        if (!step.audio) return true

        this._steps[si + 7] = 0x80
        if (step.tone < 0) return true
        if (step.volume <= 0) return true

        step.tone = step.tone & 0x0F
        step.volume = step.volume & 0x07
        this._steps[si + 7] = 0x80 | (step.tone << 3) | step.volume

        return true
    }

    public state(): string {
        let s: string = ''
        let c: string
        for (let i = 0; i < 8; i = i + 1) {
            for (let j = 0; j < 8; j = j + 1) {
                c = this._steps[i * 8 + j].toString(16)
                s = s + (c.length < 2 ? '0' : '') + c + ' '
            }
            s = s + '\n'
        }
        return s
    }

    private _build_steps(steps: BusyLightSteps): void {
        this._steps = BusyLight.OFF.concat([])
        if (!Array.isArray(steps)) return
        let step_index: number = 0
        steps.forEach((step: BusyLightStep) => {
            if (!this._build_step(step, step_index)) return
            step_index = step_index + 1
        })
    }

    public program(steps: BusyLightSteps): void {
        if (this._once_timer) clearTimeout(this._once_timer)
        this._once_timer = null
        this._send(BusyLight.OFF)
        this._build_steps(steps)
        this._send(this._steps)
    }

    public off(): void {
        if (this._once_timer) clearTimeout(this._once_timer)
        this._once_timer = null
        this._steps = BusyLight.OFF.concat([])
        this._send(this._steps)
    }

    public intensity(value: number): void {
        if (value < 0) value = 0
        if (value > 100) value = 100
        this._intensity = value
    }

    public light(color: string): boolean {
        if (!color) return false
        if (color.charAt(0) === '#') color = color.substring(1)
        if (color.length < 6) return false
        const r: number = parseInt(color.substring(0, 2), 16)
        const g: number = parseInt(color.substring(2, 4), 16)
        const b: number = parseInt(color.substring(4, 6), 16)
        if (isNaN(r)) return false
        if (isNaN(g)) return false
        if (isNaN(b)) return false
        this._r = Math.trunc(r * this._intensity / 100)
        this._g = Math.trunc(g * this._intensity / 100)
        this._b = Math.trunc(b * this._intensity / 100)
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
        }])
        this._send(this._steps)
        return true
    }

    public blink(color: string, on: number, off: number): boolean {
        if (!color) return false
        if (color.charAt(0) === '#') color = color.substring(1)
        if (color.length < 6) return false
        const r: number = parseInt(color.substring(0, 2), 16)
        const g: number = parseInt(color.substring(2, 4), 16)
        const b: number = parseInt(color.substring(4, 6), 16)
        if (isNaN(r)) return false
        if (isNaN(g)) return false
        if (isNaN(b)) return false
        this._r = Math.trunc(r * this._intensity / 100)
        this._g = Math.trunc(g * this._intensity / 100)
        this._b = Math.trunc(b * this._intensity / 100)
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
        }])
        this._send(this._steps)
        return true
    }

    public pulse(color: string): boolean {
        if (!color) return false
        if (color.charAt(0) === '#') color = color.substring(1)
        if (color.length < 6) return false
        const r: number = parseInt(color.substring(0, 2), 16)
        const g: number = parseInt(color.substring(2, 4), 16)
        const b: number = parseInt(color.substring(4, 6), 16)
        if (isNaN(r)) return false
        if (isNaN(g)) return false
        if (isNaN(b)) return false
        this._r = Math.trunc(r * this._intensity / 100)
        this._g = Math.trunc(g * this._intensity / 100)
        this._b = Math.trunc(b * this._intensity / 100)
        const steps: BusyLightSteps = []
        let step: number = 0

        for (let si = 1; si <= 4; si = si + 1) {
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
            })
            step = step + 1
        }
        for (let si = 5; si >= 2; si = si - 1) {
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
            })
            step = step + 1
        }

        this._build_steps(steps)
        this._send(this._steps)
        return true
    }

    public tone(tone: number, volume: number): boolean {
        if (this._once_timer) clearTimeout(this._once_timer)
        this._once_timer = null
        this._tone = tone
        this._volume = volume
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
        }])
        this._send(this._steps)
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
        }])
        this._send(this._steps)
        return true
    }

    public alert(tone: number, volume: number, color: string, blinkpulse: boolean = true, on: number = 4, off: number = 3) {
        this.tone(tone, volume)
        if (blinkpulse) return this.blink(color, on, off)
        this.pulse(color)
    }

    public once(tone: number, volume: number): number {
        if (!this._device) return -1
        if (!(BusyLight.TONE_LEN as any)[this._device.productId]) return -1
        if (!(BusyLight.TONE_LEN as any)[this._device.productId][tone]) return -1
        this.tone(tone, volume)
        this._once_timer = setTimeout(() => {
            this._once_timer = null
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
            }])
            this._send(this._steps)
        }, (BusyLight.TONE_LEN as any)[this._device.productId][tone])
        return (BusyLight.TONE_LEN as any)[this._device.productId][tone]
    }

    public tones(): Array<string> {
        if (!this._device) return []
        if (!(BusyLight.TONE_NAME as any)[this._device.productId]) return []
        return (BusyLight.TONE_NAME as any)[this._device.productId]
    }

    public durations(): Array<number> {
        if (!this._device) return []
        if (!(BusyLight.TONE_LEN as any)[this._device.productId]) return []
        return (BusyLight.TONE_LEN as any)[this._device.productId]
    }

    public device(): string {
        if (!this._device) return ''
        if (!(BusyLight.DEVICE_NAME as any)[this._device.productId]) return ''
        return (BusyLight.DEVICE_NAME as any)[this._device.productId]
    }

    public is(device: BusyLightDevice): boolean {
        if (!device) return false
        if (!this._device) return false
        return device.path === this._device.path
    }

    public disconnect(unclean = false): void {
        if (this._keepalive) clearInterval(this._keepalive)
        this._keepalive = null

        if (!unclean) {
            this._steps = BusyLight.OFF.concat([])
            this._send(this._steps)
        }
        if (this._hid) this._hid.close()
        this._hid = null
    }

    private _b2s(data: Array<number>, f: number, t: number): string {
        if (!Array.isArray(data)) return ''
        if (!data[f]) return ''
        if (!data[t]) return ''
        let result: string = ''
        for (let ci = f; ci <= t; ci = ci + 1)
            result = result + String.fromCharCode(data[ci])
        return result
    }

    public response(): BusyLightResponse {
        const response: BusyLightResponse = {}
        if (this._response.length === 0) return response
        response.activity = this._b2s(this._response, 0, 0) === '1'
        response.product = this._b2s(this._response, 1, 3) === '001' ? 'Busylight' : 'Kuando Box'
        response.customer = this._b2s(this._response, 4, 11)
        response.model = this._b2s(this._response, 12, 15)
        response.serial = this._b2s(this._response, 16, 23)
        response.manufacturer = this._b2s(this._response, 24, 31)
        response.date = this._b2s(this._response, 32, 39)
        response.software = this._b2s(this._response, 40, 45)
        return response
    }

}

export { type BusyLightDevice, type BusyLightDevices, type BusyLightStep, type BusyLightSteps, type BusyLightResponse, BusyLight }

