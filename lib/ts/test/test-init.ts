import { bootstrapOssKraken, setup, bootstrapCloudKraken, cleanup, setupCouchDb } from '../src';
import { checkCouchDbStarted, checkExistence } from './utils';
import uuid = require('uuid');

describe("Test initialization", () => {

  it("Should be able to initialize the OSS Kraken", async () => {
    await setup('test/scratch', process.env.OSS_DOCKER_URL!);
    await checkCouchDbStarted();
    await setupCouchDb('127.0.0.1', 15984);
    const userId = uuid();
    await bootstrapOssKraken(userId);
    await checkExistence('127.0.0.1', 15984, 'icure-base', userId);
    await cleanup('test/scratch', process.env.OSS_DOCKER_URL!);
  });

  it("Should be able to initialize the Kraken", async () => {
    await setup('test/scratch', process.env.KRAKEN_DOCKER_URL!);
    await checkCouchDbStarted();
    await setupCouchDb('127.0.0.1', 15984);
    const userId = uuid();
    const groupId = "xx"
    await bootstrapCloudKraken(userId);
    await checkExistence('127.0.0.1', 15984, 'icure-xx-base', userId);
    await checkExistence('127.0.0.1', 15984, 'icure-__-base', `${groupId}:${userId}`);
    await checkExistence('127.0.0.1', 15984, '_users', `org.couchdb.user:${groupId}`);
    await checkExistence('127.0.0.1', 15984, 'icure-__-config', groupId);
    await cleanup('test/scratch', process.env.KRAKEN_DOCKER_URL!);
  });

});
