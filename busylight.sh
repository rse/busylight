#!/bin/sh
##
##  busylight -- Control Kuando BusyLight through REST
##  Copyright (c) 2025 Dr. Ralf S. Engelschall <rse@engelschall.com>
##  Licensed under MIT license <https://spdx.org/licenses/MIT.html>
##

#   determine base directory
case "$0" in
    /*  ) basedir=`echo $0 | sed -e 's;/[^/][^/]*$;;'` ;;
    */* ) basedir="`pwd`/`echo $0 | sed -e 's;/[^/][^/]*$;;'`" ;;
    * )
        OIFS=${IFS}; IFS=":"
        for dir in ${PATH}; do
            IFS=${OIFS}
            if [ -x "${dir}/$0" ]; then
                basedir=${dir}
                break
            fi
        done
        IFS=${OIFS}
        ;;
esac

#   pass-through execution
cd $basedir || exit $?
exec node busylight.js ${1+"$@"}

