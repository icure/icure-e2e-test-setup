## Introduction

This directory contains the source code for the TypeScript library used to setup and cleanup the test environment.
The library is published on npmjs.com as [@icure/test-setup](https://www.npmjs.com/package/@icure/test-setup).

In order to use the library, you need to add it to your project as a dev dependency:

```bash
yarn add @icure/test-setup --dev
```

## Usage

The library exposes 4 functions:

### setup

Setup a full environment for the tests. This will download the docker-compose files and start the containers.
The docker compose can embed extra files that will be extracted in the scratchDir (see docker-compose-cloud.yaml for an example).

```typescript
import { setup } from '@icure/test-setup';

await setup('test/scratchDir', 'docker-compose');
```

### cleanup

Stop the containers launched by setup and destroy them

```typescript
import { cleanup } from '@icure/test-setup';

await cleanup('test/scratchDir', 'docker-compose');
```

### setupCouchDb

When freshly launched, couchdb is not ready to accept connections and is not configured. This function will wait until couchdb is ready to accept connections and calls the cluster_setup endpoint on CouchDb to configure it in single node mode.

```typescript
import { setupCouchDb } from '@icure/test-setup';

await setupCouchDb();
```

### bootstrapCloudKraken

If you choose to use the cloud version of kraken, you need to bootstrap it before you can use it.
This function will wait until kraken is ready to accept connections and create the basic database objects that are absolutely necessary:

* One groupId with its associated database
* One user setup as admin of the group

```typescript
import { bootstrapCloudKraken } from '@icure/test-setup';

await bootstrapCloudKraken("1234")
```

## Full example

```typescript
import { setup, cleanup, setupCouchDb, bootstrapCloudKraken } from '@icure/test-setup';

describe('My test suite', () => {
  beforeAll(async () => {
    await setup('test/scratchDir', 'docker-compose-cloud');
    await setupCouchDb();
    await bootstrapCloudKraken("1234");
  });

  afterAll(async () => {
    await cleanup('test/scratchDir', 'docker-compose-cloud');
  });

  it('should do something', () => {
    // ...
  });
});
```

## Reference

### Functions

- [setup](README.md#setup)
- [setupCouchDb](README.md#setupcouchdb)
- [bootstrapCloudKraken](README.md#bootstrapcloudkraken)
- [cleanup](README.md#cleanup)

## Functions

### bootstrapCloudKraken

▸ **bootstrapCloudKraken**(`userId`, `login?`, `passwordHash?`, `groupId?`, `groupPassword?`): `Promise`<`void`>

Bootstrap the kraken with the minimal environment needed to run the tests, create other apps, users or databases.

#### Parameters

| Name            | Type     | Default value | Description                                                          |
|:----------------|:---------|:--------------|:---------------------------------------------------------------------|
| `userId`        | `string` | `undefined`   | The user id of the user that will be created                         |
| `login`         | `string` | `'john'`      | The login of the user that will be created                           |
| `passwordHash`  | `string` | `'179...c0b'` | The password hash of the user that will be created (AES-256 encoded) |
| `groupId`       | `string` | `'xx'`        | The group id of the master group that will be created                |
| `groupPassword` | `string` | `'xx'`        | The password of the master group that will be created                |

#### Returns

`Promise`<`void`>

#### Defined in

index.ts:144

___

### cleanup

▸ **cleanup**(`scratchDir`, `compose`, `...profiles`): `Promise`<`void`>

Stop the containers launched by setup and destroy them

#### Parameters

| Name          | Type       | Description                                                                                                    |
|:--------------|:-----------|:---------------------------------------------------------------------------------------------------------------|
| `scratchDir`  | `string`   | the directory where the docker-compose files will be downloaded                                                |
| `compose`     | `string`   | the docker-compose file to use. Can be a full url or a short name (e.g. docker-compose)                        |
| `...profiles` | `string`[] | the docker profiles that had been applied to the docker-compose file when it was launched by the setup command |

#### Returns

`Promise`<`void`>

#### Defined in

index.ts:76

___

### setup

▸ **setup**(`scratchDir`, `compose`, `...profiles`): `Promise`<`void`>

Setup a full environment for the tests. This will download the docker-compose files and start the containers.

The docker compose can embed extra files that will be extracted in the scratchDir (see docker-compose-cloud.yaml for an example)

#### Parameters

| Name          | Type       | Description                                                                             |
|:--------------|:-----------|:----------------------------------------------------------------------------------------|
| `scratchDir`  | `string`   | the directory where the docker-compose files will be downloaded                         |
| `compose`     | `string`   | the docker-compose file to use. Can be a full url or a short name (e.g. docker-compose) |
| `...profiles` | `string`[] | the docker profiles that are going to be applied to the docker-compose file             |

#### Returns

`Promise`<`void`>

#### Defined in

index.ts:42

___

### setupCouchDb

▸ **setupCouchDb**(): `Promise`<`void`>

Initialise CouchDB and set the admin user and password

#### Returns

`Promise`<`void`>

#### Defined in

index.ts:113
