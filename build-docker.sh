#!/bin/bash

mvn clean

docker build -t bigconnect/bigconnect-explorer:4.2.2 .
