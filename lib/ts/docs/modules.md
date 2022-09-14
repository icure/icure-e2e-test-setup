[@icure/test-setup](README.md) / Exports

# @icure/test-setup

## Table of contents

### Functions

- [bootstrapCloudKraken](modules.md#bootstrapcloudkraken)
- [cleanup](modules.md#cleanup)
- [setup](modules.md#setup)
- [setupCouchDb](modules.md#setupcouchdb)

## Functions

### bootstrapCloudKraken

▸ **bootstrapCloudKraken**(`userId`, `login?`, `passwordHash?`, `groupId?`, `groupPassword?`): `Promise`<`void`\>

Bootstrap the kraken with the minimal environment needed to run the tests, create other apps, users or databases.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `userId` | `string` | `undefined` | The user id of the user that will be created |
| `login` | `string` | `'john'` | The login of the user that will be created |
| `passwordHash` | `string` | `'1796980233375ccd113c972d946b2c4a7892e4f69c60684cfa730150047f9c0b'` | The password hash of the user that will be created (AES-256 encoded) |
| `groupId` | `string` | `'xx'` | The group id of the master group that will be created |
| `groupPassword` | `string` | `'xx'` | The password of the master group that will be created |

#### Returns

`Promise`<`void`\>

#### Defined in

index.ts:144

___

### cleanup

▸ **cleanup**(`scratchDir`, `compose`, ...`profiles`): `Promise`<`void`\>

Stop the containers launched by setup and destroy them

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `scratchDir` | `string` | the directory where the docker-compose files will be downloaded |
| `compose` | `string` | the docker-compose file to use. Can be a full url or a short name (e.g. docker-compose) |
| `...profiles` | `string`[] | the docker profiles that had been applied to the docker-compose file when it was launched by the setup command |

#### Returns

`Promise`<`void`\>

#### Defined in

index.ts:76

___

### setup

▸ **setup**(`scratchDir`, `compose`, ...`profiles`): `Promise`<`void`\>

Setup a full environment for the tests. This will download the docker-compose files and start the containers.

The docker compose can embed extra files that will be extracted in the scratchDir (see docker-compose-cloud.yaml for an example)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `scratchDir` | `string` | the directory where the docker-compose files will be downloaded |
| `compose` | `string` | the docker-compose file to use. Can be a full url or a short name (e.g. docker-compose) |
| `...profiles` | `string`[] | the docker profiles that are going to be applied to the docker-compose file |

#### Returns

`Promise`<`void`\>

#### Defined in

index.ts:42

___

### setupCouchDb

▸ **setupCouchDb**(): `Promise`<`void`\>

Initialise CouchDB and set the admin user and password

#### Returns

`Promise`<`void`\>

#### Defined in

index.ts:113
