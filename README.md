
<img src="https://raw.githubusercontent.com/rse/busylight/master/screenshot-device.png" width="150" align="right" alt=""/>

Busylight
=========

**Control Kuando Busylight through REST**

[![github (author stars)](https://img.shields.io/github/stars/rse?logo=github&label=author%20stars&color=%233377aa)](https://github.com/rse)
[![github (author followers)](https://img.shields.io/github/followers/rse?label=author%20followers&logo=github&color=%234477aa)](https://github.com/rse)

Abstract
--------

**Busylight** is a small REST service for controlling one or more of the neat
Plenom A/S [Kuando Busylight](https://busylight.com/) devices.
Internally it is based on a fork of the
[Busylight library](https://github.com/yaddran/busylight) (version 1.0.12 as of 2022)
in order to access the devices via USB from within Node.js. The **Busylight**
REST service is intended to be run on a small control host, like a [Raspberry Pi](https://www.raspberrypi.com/),
and accessed remotely from a control client like [Bitfocus Companion](https://bitfocus.io/companion).
For convenience reasons, a minimalistic Web UI is provided at the root path of the REST service
for interactively controlling the device.

![screenshot](screenshot-webui.png)

Installation
------------

```
$ git clone https://github.com/rse/busylight
$ make build
$ make install
$ make start
$ make logs
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
    /{off,ok,info1,info2,info3,warning,error}
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

Raspberry Pi 5 Setup
--------------------

Follow my [Raspi-Setup](https://github.com/rse/raspi-setup/) guide for setting
up your favorite Raspberry Pi device. Then
install the Busylight service with:

```
#   enter writable filesystem
sudo overlayfs-chroot
sudo -u studio bash

#   install Busylight service
cd $HOME
git clone https://github.com/rse/busylight
cd busylight
make build
make install
make start

#   exit writable filesystem
exit
exit
sudo reboot
```

You can later upgrade to the latest version at any time with:
  
```
#   enter writable filesystem
sudo overlayfs-chroot
sudo -u studio bash

#   upgrade Busylight service
cd $HOME
cd busylight
make upgrade

#   exit writable filesystem
exit
exit
sudo reboot
```

License
-------

Copyright &copy; 2025 Dr. Ralf S. Engelschall (http://engelschall.com/)<br/>
Licensed under [ISC](https://spdx.org/licenses/ISC)

