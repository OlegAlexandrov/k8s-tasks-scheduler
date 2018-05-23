#!/bin/bash 

#
# Create "k8s-tasks-scheduler" pod
#

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

kubectl create -f $DIR/pod.yml
