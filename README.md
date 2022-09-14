## Introduction

This directory contains the docker compose files used to prepare a test environment for the integration tests.

## Docker compose files

* docker-compose.yaml: the default docker compose file. It contains the minimum to run the integration tests.
* docker-compose-cloud.yaml: the docker compose file to run the integration tests against a cloud environment.

## Docker profiles

The docker compose files can be used with different profiles. The profiles are used to select the right docker containers to start.
For example, the mock profile can be used to start the optional mock container that simulates the msg-gw server.

## How to use

The docker compose files can be used in two ways:

* directly with docker compose: `docker compose -f docker-compose.yaml up -d`
* with the test-setup library: `test-setup setup <scratchDir> <compose>` or in typescript: `await setup(<scratchDir>, <compose>, <profiles>)`

## How to add a new docker compose file

Add the docker compose file in this directory. You can use the docker-compose-cloud.yaml as a template. We make heavy use of the docker compose environment variables to configure the containers.
For each usage of an environment variable, add a default value in the docker-compose.yaml file.
