
Busylight
=========

**Control Kuando Busylight through REST**

[![github (author stars)](https://img.shields.io/github/stars/rse?logo=github&label=author%20stars&color=%233377aa)](https://github.com/rse)
[![github (author followers)](https://img.shields.io/github/followers/rse?label=author%20followers&logo=github&color=%234477aa)](https://git

Abstract
--------

**Busylight** is a small REST service for controlling the neat
[Kuando Busylight](https://busylight.com/) devices from Plenom A/S.
It is internally is based on a fork of the 
[Busylight library](https://github.com/yaddran/busylight) in version 1.0.12 from 2022
in order to access the devices via USB.

Installation
------------

```
$ git clone https://github.com/rse/busylight
$ make build
$ make install 
$ make start
```

Usage
-----

```
node busylight.js
    [-h|--help]
    [-v|--version]
    [-l|--log-level <level>]
    [-a|--http-addr <ip-address>]
    [-p|--http-port <tcp-port>]
    [-d|--device <device-name>:<device-serial>]
```

```
http://<ip-address>:<tcp-port>
    /<device-name>
    /{off,ok,info,warning,error}
    [/{steady,blink}
    [/{0,<duration>}
    [/quiet]]]
```

Example
-------

```
$ node busylight.js \
  -l INFO -a 0.0.0.0 -p 8080 \
  -d foo:382492FF000051FF24FFFFFF2802FFFF7002FFFF \
  -d bar:453092FF004071FF08FFFFFF8102FFFF9202FFFF
```

```
curl http://127.0.0.1:8080/foo/warning/blink/4000
```

License
-------

Copyright &copy; 2025 Dr. Ralf S. Engelschall (http://engelschall.com/)<br/>
Licensed under [ISC](https://spdx.org/licenses/ISC)

