##
##  busylight -- Control Kuando BusyLight through REST
##  Copyright (c) 2025 Dr. Ralf S. Engelschall <rse@engelschall.com>
##  Licensed under MIT license <https://spdx.org/licenses/MIT.html>
##

OS = `uname -s`

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
	@echo "++ installing service"; \
	if [ "${OS}" = "Linux" ]; then \
	    sed -e "s;@basedir@;`pwd`;g" <busylight.service.in >busylight.service; \
	    sudo systemctl enable ./busylight.service; \
	elif [ "${OS}" = "Darwin" ]; then \
	    sed -e "s;@basedir@;`pwd`;g" <busylight.plist.in >busylight.plist; \
	    cp busylight.plist $$HOME/Library/LaunchAgents/com.engelschall.busylight.plist; \
	    launchctl load -w $$HOME/Library/LaunchAgents/com.engelschall.busylight.plist; \
	fi

uninstall:
	@echo "++ uninstalling service"; \
	if [ "${OS}" = "Linux" ]; then \
	    sudo systemctl disable busylight.service; \
	elif [ "${OS}" = "Darwin" ]; then \
	    launchctl unload -w $$HOME/Library/LaunchAgents/com.engelschall.busylight.plist; \
	    rm -f $$HOME/Library/LaunchAgents/com.engelschall.busylight.plist; \
	fi

start:
	@echo "++ starting service"; \
	if [ "${OS}" = "Linux" ]; then \
	    sudo systemctl start --no-pager --no-block busylight.service; \
	elif [ "${OS}" = "Darwin" ]; then \
	    launchctl start com.engelschall.busylight; \
	fi

restart:
	@echo "++ restarting service"; \
	if [ "${OS}" = "Linux" ]; then \
	    sudo systemctl restart --no-pager --no-block busylight.service; \
	elif [ "${OS}" = "Darwin" ]; then \
	    launchctl stop  com.engelschall.busylight; \
	    launchctl start com.engelschall.busylight; \
	fi

stop:
	@echo "++ stopping service"; \
	if [ "${OS}" = "Linux" ]; then \
	    sudo systemctl stop busylight.service; \
	elif [ "${OS}" = "Darwin" ]; then \
	    launchctl stop com.engelschall.busylight; \
	fi

logs:
	@echo "++ showing logs of service"; \
	if [ "${OS}" = "Linux" ]; then \
	    journalctl -f -u busylight; \
	elif [ "${OS}" = "Darwin" ]; then \
	    tail -f busylight.log; \
	fi

seal:
	sudo raspi-config nonint enable_bootro
	sudo raspi-config nonint enable_overlayfs

unseal:
	sudo raspi-config nonint disable_bootro
	sudo raspi-config nonint disable_overlayfs

upgrade:
	$(MAKE) $(MFLAGS) --no-print-directory stop uninstall distclean
	git reset HEAD --hard && git pull
	$(MAKE) $(MFLAGS) --no-print-directory build install start

