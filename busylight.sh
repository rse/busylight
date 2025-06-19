#!/bin/sh

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

