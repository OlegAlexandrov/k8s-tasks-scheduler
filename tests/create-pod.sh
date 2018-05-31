#!/bin/bash

#
# Create "k8s-tasks-scheduler" pod
#

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

export TAG=$( cat "$DIR"/../package.json | jq -r ".version" )
export FITNESSE_ROOT="$DIR"/FitNesseRoot
export FIXTURES="$DIR"/fixtures
export SOURCES=$( cd "$DIR"/../src && pwd )

if [ "$1" == "dev" ]; then

  export SOURCES_VOLUME_MOUNT="volumeMounts:
    - name: sources
      mountPath: /scheduler/src"
fi

POD_TEMPLATE="$DIR"/pod.yml
POD_TEMPLATE_TMP="$POD_TEMPLATE".tmp

envsubst < "$POD_TEMPLATE" > "$POD_TEMPLATE_TMP"

kubectl create -f $POD_TEMPLATE_TMP

rm "$POD_TEMPLATE_TMP"
