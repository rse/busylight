/*
**  busylight -- Control Kuando BusyLight through REST
**  Copyright (c) 2025 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under MIT license <https://spdx.org/licenses/MIT.html>
*/

/*  import external dependencies  */
import yargs          from "yargs"
import * as HAPI      from "@hapi/hapi"
import { Server }     from "@hapi/hapi"
import Inert          from "@hapi/inert"
import moment         from "moment"
import chalk          from "chalk"
import UUID           from "pure-uuid"
import USB            from "usb"

/*  import internal dependencies  */
import { BusyLight }  from "./busylight-api.js"
import pkg            from "./package.json" with { type: "json" }

/*  the default logging level  */
let logLevel = "INFO"

/*  the existing logging levels  */
const levels = [
    { name: "ERROR",   style: chalk.red.bold },
    { name: "WARNING", style: chalk.yellow.bold },
    { name: "INFO",    style: chalk.blue },
    { name: "DEBUG",   style: chalk.green }
]

/*  helper function for console logging  */
const log = (level: "ERROR" | "WARNING" | "INFO" | "DEBUG", msg: string, data = null) => {
    const levelThis = levels.findIndex((x) => x.name === level)
    const levelMax  = levels.findIndex((x) => x.name === logLevel)
    if (levelThis <= levelMax) {
        const timestamp = moment().format("YYYY-MM-DD hh:mm:ss.SSS")
        let line = `[${timestamp}]: ${levels[levelThis].style("[" + levels[levelThis].name + "]")}: ${msg}`
        if (data !== null)
            line += ` (${JSON.stringify(data)})`
        line += "\n"
        process.stdout.write(line)
    }
}

/*  establish asynchronous environment  */
;(async () => {
    /*  parse command-line arguments  */
    const args = await yargs()
        /* eslint @stylistic/indent: off */
        .usage(
            "Usage: $0 " +
            "[-h|--help] " +
            "[-v|--version] " +
            "[-l|--log-level <level>] " +
            "[-a|--http-addr <ip-address>] " +
            "[-p|--http-port <tcp-port>] " +
            "[-d|--device <device-name>:<device-serial>]"
        )
        .help("h").alias("h", "help").default("h", false)
            .describe("h", "show usage help")
        .boolean("v").alias("v", "version").default("v", false)
            .describe("v", "show program version information")
        .string("l").nargs("l", 1).alias("l", "log-level").default("l", "INFO")
            .describe("l", "level for console logging (\"ERROR\", \"WARNING\", \"INFO\", \"DEBUG\"")
        .string("a").nargs("a", 1).alias("a", "http-addr").default("a", "0.0.0.0")
            .describe("a", "HTTP listen IP address")
        .number("p").nargs("p", 1).alias("p", "http-port").default("p", 8765)
            .describe("p", "HTTP listen TCP port")
        .array("d").alias("d", "device").default("d", [])
            .describe("d", "device name mapping")
        .version(false)
        .strict()
        .showHelpOnFail(true)
        .demand(0)
        .parse(process.argv.slice(2))

    /*  short-circuit version request  */
    if (args.version) {
        process.stderr.write(`BusyLight ${pkg.version} <${pkg.homepage}>\n`)
        process.stderr.write(`Copyright (c) 2025 ${pkg.author.name} <${pkg.author.url}>\n`)
        process.stderr.write(`Licensed under ${pkg.license} <http://spdx.org/licenses/${pkg.license}.html>\n`)
        process.exit(0)
    }

    /*  configure logging  */
    logLevel = args.logLevel ?? "INFO"

    /*  indicate service startup  */
    log("INFO", `starting BusyLight ${pkg.version} <${pkg.homepage}>`)

    /*  central busylight device connections  */
    const busylight: { [ name: string ]: BusyLight } = {}

    /*  sanity check device id mappings  */
    if (typeof args.device === "object" && args.device instanceof Array && args.device.length > 0) {
        for (const spec of args.device) {
            const m = String(spec).match(/^(.+?):(.+)$/)
            if (m === null)
                throw new Error(`invalid device specification: ${spec}`)
        }
    }

    /*  global duration timer  */
    let timer: { [ device: string ]: ReturnType<typeof setTimeout> } = {}
    const timerStop = (device: string) => {
        if (timer[device] !== undefined) {
            clearTimeout(timer[device])
            delete timer[device]
        }
    }
    const timerStart = (device: string, delay: number, cb: () => void) => {
        timerStop(device)
        timer[device] = setTimeout(() => { cb(); delete timer[device] }, delay)
    }

    /*  global program interval  */
    let interval: { [ device: string ]: ReturnType<typeof setInterval> } = {}
    const intervalStop = (device: string, ) => {
        if (interval[device] !== undefined) {
            clearInterval(interval[device])
            delete interval[device]
        }
    }
    const intervalStart = (device: string, delay: number, cb: () => void) => {
        intervalStop(device)
        interval[device] = setInterval(cb, delay)
    }

    /*  determine unique identifier of device  */
    const deviceId = (serial: string) => {
        let id = ""
        if (typeof args.device === "object" && args.device instanceof Array && args.device.length > 0) {
            /*  identify device by configured id  */
            for (const spec of args.device) {
                const m = String(spec).match(/^(.+?):(.+)$/)
                if (m === null)
                    continue
                const [ , _id, _serial ] = m
                if (serial === m[2]) {
                    id = m[1]
                    break
                }
            }
        }
        if (id === "") {
            /*  fallback: identify device by serial number  */
            const uuid = new UUID(3, "ns:URL", `busylight:${serial}`)
            id = uuid.fold(3).map((d) => d.toString(16).padStart(2, "0").toUpperCase()).join("")
        }
        return id
    }

    /*  update busylight device connections  */
    const updateDevices = async () => {
        /*  determine current devices  */
        const devices = BusyLight.devices()

        /*  add new devices  */
        const found: { [ name: string ]: boolean } = {}
        for (const device of devices) {
            const id = deviceId(device.serialNumber)
            found[id] = true
            if (!busylight[id]) {
                log("INFO", `adding busylight device: id: ${id}, serial: ${device.serialNumber}, model: ${device.manufacturer} ${device.product}`)
                busylight[id] = new BusyLight(device)
                busylight[id].connect()
                busylight[id].off()
            }
        }

        /*  remove obsolete devices  */
        for (const id of Object.keys(busylight)) {
            if (!found[id]) {
                log("INFO", `removing busylight device: id: ${id}`)
                intervalStop(id)
                timerStop(id)
                await new Promise((resolve, reject) => setTimeout(resolve, 1000))
                delete busylight[id]
            }
        }
    }

    /*  initially update devices already once  */
    await updateDevices()

    /*  regularly update devices on USB device attach/detach events  */
    USB.usb.on("attach", (device) => { updateDevices() })
    USB.usb.on("detach", (device) => { updateDevices() })

    /*  internal program configuration  */
    type Program = {
        rgb:      number[],
        type:     string,
        duration: number,
        tone:     string,
        volume:   number
    }
    const changeProgram = (device: string, program: Program) => {
        const p = {
            red:    program.rgb[0],
            green:  program.rgb[1],
            blue:   program.rgb[2],
            on:     0,
            off:    0,
            audio:  false,
            tone:   -1,
            volume: 0,
            repeat: 10,
            cmd:    "jump",
            cmdv:   0
        }
        if (program.type === "steady") {
            p.on  = 10 * 10 /* 10s */
            p.off = 0
        }
        else if (program.type === "blink") {
            p.on  = 10 /* 1.0s */
            p.off = 10 /* 1.0s */
        }
        if (program.tone !== "" && program.volume > 0) {
            let toneId = busylight[device].tones().indexOf(program.tone)
            if (toneId === -1)
                toneId = 0
            const toneDuration = busylight[device].durations()[toneId]
            if (program.type === "steady") {
                p.on  = 10 * (toneDuration / 100)
                p.off = 0
            }
            else if (program.type === "blink") {
                p.on  = (toneDuration / 2) / 100
                p.off = (toneDuration / 2) / 100
            }
            p.audio  = true
            p.tone   = toneId
            p.volume = 1 + Math.round(6 * program.volume)
        }
        busylight[device].program([ p ])
        intervalStart(device, ((p.on + p.off) * 100) * p.repeat, () => {
            busylight[device].program([ p ])
        })
        timerStop(device)
        if (program.duration > 0) {
            timerStart(device, program.duration, () => {
                intervalStop(device)
                busylight[device].off()
            })
        }
    }
    const changeState = (device: string, state: string, type = "steady", duration = 0, audio = "audible") => {
        log("INFO", `change: device: ${device}, state: ${state}, type: ${type}, duration: ${duration === 0 ? "none" : duration}`)
        if (busylight[device] === undefined) {
            log("WARNING", `invalid requested device "${device}"`)
            return
        }
        if (type.match(/^(?:steady|blink)$/) === null) {
            log("WARNING", `invalid requested type "${type}"`)
            return
        }
        if (state === "off") {
            intervalStop(device)
            timerStop(device)
            busylight[device].off()
        }
        else if (state === "ok") {
            changeProgram(device, {
                rgb:       [ 0x00, 0x66, 0x00 ], /* GREEN */
                type:      type,
                duration:  duration,
                tone:      audio === "audible" ? "Instant Message 2" : "",
                volume:    audio === "audible" ? 0.5 : 0
            })
        }
        else if (state === "info1") {
            changeProgram(device, {
                rgb:       [ 0x00, 0x33, 0x99 ], /* BLUE */
                type:      type,
                duration:  duration,
                tone:      audio === "audible" ? "Instant Message 2" : "",
                volume:    audio === "audible" ? 0.5 : 0
            })
        }
        else if (state === "info2") {
            changeProgram(device, {
                rgb:       [ 0x66, 0x00, 0x66 ], /* PURPLE */
                type:      type,
                duration:  duration,
                tone:      audio === "audible" ? "Instant Message 2" : "",
                volume:    audio === "audible" ? 0.5 : 0
            })
        }
        else if (state === "info3") {
            changeProgram(device, {
                rgb:       [ 0x99, 0x99, 0x99 ], /* WHITE */
                type:      type,
                duration:  duration,
                tone:      audio === "audible" ? "Instant Message 2" : "",
                volume:    audio === "audible" ? 0.5 : 0
            })
        }
        else if (state === "warning") {
            changeProgram(device, {
                rgb:       [ 0x99, 0x33, 0x00 ], /* YELLOW */
                type:      type,
                duration:  duration,
                tone:      audio === "audible" ? "Quiet" : "",
                volume:    audio === "audible" ? 0.5 : 0
            })
        }
        else if (state === "error") {
            changeProgram(device, {
                rgb:       [ 0xcc, 0x00, 0x00 ], /* RED */
                type:      type,
                duration:  duration,
                tone:      audio === "audible" ? "Quiet" : "",
                volume:    audio === "audible" ? 1.0 : 0
            })
        }
        else
            log("WARNING", `invalid requested state "${state}"`)
    }

    /*  establish HTTP/REST service endpoints  */
    log("INFO", `starting REST API: http://${args.httpAddr}:${args.httpPort}` +
        `/<device>/{off,ok,info,warning,error}[/{steady,blink}[/{0,<duration>}[/quiet]]]`)
    const server = new Server({
        address: args.httpAddr,
        port:    args.httpPort
    })
    await server.register({ plugin: Inert })
    server.route({
        method: "GET",
        path:   "/",
        handler: {
            file: "./busylight.html"
        }
    })
    server.route({
        method: "GET",
        path:   "/devices",
        handler: async (req: HAPI.Request, h: HAPI.ResponseToolkit) => {
            const devices = Object.keys(busylight)
            return h.response(devices).code(200)
        }
    })
    server.route({
        method: "GET",
        path:   "/{device}/{state}",
        handler: async (req: HAPI.Request, h: HAPI.ResponseToolkit) => {
            const device = req.params.device
            const state  = req.params.state
            changeState(device, state)
            return h.response().code(204)
        }
    })
    server.route({
        method: "GET",
        path:   "/{device}/{state}/{type}",
        handler: async (req: HAPI.Request, h: HAPI.ResponseToolkit) => {
            const device = req.params.device
            const state  = req.params.state
            const type   = req.params.type
            changeState(device, state, type)
            return h.response().code(204)
        }
    })
    server.route({
        method: "GET",
        path:   "/{device}/{state}/{type}/{duration}",
        handler: async (req: HAPI.Request, h: HAPI.ResponseToolkit) => {
            const device   = req.params.device
            const state    = req.params.state
            const type     = req.params.type
            const duration = parseInt(req.params.duration)
            changeState(device, state, type, duration)
            return h.response().code(204)
        }
    })
    server.route({
        method: "GET",
        path:   "/{device}/{state}/{type}/{duration}/{audio}",
        handler: async (req: HAPI.Request, h: HAPI.ResponseToolkit) => {
            const device   = req.params.device
            const state    = req.params.state
            const type     = req.params.type
            const duration = parseInt(req.params.duration)
            const audio    = req.params.audio
            changeState(device, state, type, duration, audio)
            return h.response().code(204)
        }
    })
    await server.start()

    /*  graceful service shutdown procedure  */
    const shutdown = async (signal: string) => {
        log("WARNING", `received ${signal} signal -- shutting down service`)
        for (const device of Object.keys(busylight)) {
            log("INFO", `reset busylight device: ${device}`)
            busylight[device].off()
            busylight[device].disconnect()
            delete busylight[device]
        }
        await server.stop()
        log("INFO", "terminating process")
        process.exit(0)
    }
    process.on("SIGINT",  () => { shutdown("SIGINT")  })
    process.on("SIGTERM", () => { shutdown("SIGTERM") })
})().catch((err) => {
    /*  fatal process error handling  */
    log("ERROR", `fatal error: ${err}`)
    process.exit(1)
})

