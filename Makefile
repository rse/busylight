##
##  busylight -- Control Kuando BusyLight through REST
##  Copyright (c) 2025 Dr. Ralf S. Engelschall <rse@engelschall.com>
##  Licensed under MIT license <https://spdx.org/licenses/MIT.html>
##

all: build

bootstrap:
	if [ ! -d node_modules ]; then npm install; fi

build: bootstrap
	npx tsc --project tsconfig.json

clean:
	-rm -f busylight-api.js busylight.js busylight.service

distclean: clean
	-rm -rf node_modules package-lock.json

install:
	sed -e "s;@basedir@;`pwd`;g" <busylight.service.in >busylight.service && \
	sudo systemctl enable ./busylight.service

uninstall:
	sudo systemctl disable busylight.service

start:
	sudo systemctl start --no-pager --no-block busylight.service

restart:
	sudo systemctl restart --no-pager --no-block busylight.service

stop:
	sudo systemctl stop busylight.service

logs:
	journalctl -f -u busylight

seal:
	sudo raspi-config nonint enable_overlayfs
	sudo raspi-config nonint enable_bootro

unseal:
	sudo raspi-config nonint disable_overlayfs
	sudo raspi-config nonint disable_bootro

