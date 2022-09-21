import { bootstrapOssKraken, retry, setup } from '../src';
import { checkCouchDbStarted } from './utils';
import { bootstrapCloudKraken, cleanup, setupCouchDb } from '../dist';
import uuid = require('uuid');
import axios from 'axios';
import { expect } from 'chai';

async function checkDocumentExists(host: string, port: number, db: string, objectId: string) {
  await retry(async () => {
    const {
      status: status,
    } = await axios.get(
      `http://${host}:${port}/${db}/${objectId}`,
      {
        auth: { username: 'icure', password: 'icure' },
        headers: {
          'Content-Type': 'application/json',
        },
      });
    expect(status).to.equal(200)
  });
}

describe("Test initialization", () => {

  it("Should be able to initialize the OSS Kraken", async () => {
    await setup('test/scratch', process.env.OSS_DOCKER_URL!);
    await checkCouchDbStarted();
    await setupCouchDb('127.0.0.1', 15984);
    const userId = uuid();
    await bootstrapOssKraken(userId);
    await checkDocumentExists('127.0.0.1', 15984, 'icure-base', userId);
    await cleanup('test/scratch', process.env.OSS_DOCKER_URL!);
  });

  it("Should be able to initialize the Kraken", async () => {
    await setup('test/scratch', process.env.KRAKEN_DOCKER_URL!);
    await checkCouchDbStarted();
    await setupCouchDb('127.0.0.1', 15984);
    const userId = uuid();
    const groupId = "xx"
    await bootstrapCloudKraken(userId);
    await checkDocumentExists('127.0.0.1', 15984, 'icure-xx-base', userId);
    await checkDocumentExists('127.0.0.1', 15984, 'icure-__-base', `${groupId}:${userId}`);
    await checkDocumentExists('127.0.0.1', 15984, '_users', `org.couchdb.user:${groupId}`);
    await checkDocumentExists('127.0.0.1', 15984, 'icure-__-config', groupId);
    await cleanup('test/scratch', process.env.KRAKEN_DOCKER_URL!);
  });

});
