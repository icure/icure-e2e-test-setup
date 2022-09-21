import 'isomorphic-fetch';
import { setup, setUpGroup } from '../src';
import { checkCouchDbStarted, checkExistence } from './utils';
import { bootstrapCloudKraken, cleanup, setupCouchDb } from '../dist';
import uuid = require('uuid');

describe("Test groups", () => {

  it("Should be able to create a group", async () => {
    await setup('test/scratch', process.env.KRAKEN_DOCKER_URL!);
    await checkCouchDbStarted();
    await setupCouchDb('127.0.0.1', 15984);
    const userId = uuid();
    await bootstrapCloudKraken(userId);
    const group = await setUpGroup('john', 'LetMeIn', fetch);
    await checkExistence('127.0.0.1', 15984, `icure-${group.id}-healthdata`)
    await checkExistence('127.0.0.1', 15984, `icure-${group.id}-patient`)
    await checkExistence('127.0.0.1', 15984, `icure-${group.id}-base`)
    await cleanup('test/scratch', process.env.KRAKEN_DOCKER_URL!);
  }).timeout(60000);

});
