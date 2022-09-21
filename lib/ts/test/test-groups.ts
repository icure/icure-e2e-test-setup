import 'isomorphic-fetch';
import { setup, createGroup, softDeleteGroup, hardDeleteGroup, bootstrapCloudKraken, cleanup, setupCouchDb } from '../src';
import { checkAbsence, checkCouchDbStarted, checkExistence } from './utils';
import uuid = require('uuid');
import { expect } from 'chai';
import { before } from 'mocha';

describe("Test groups", function () {

  before( async function () {
    this.timeout(60000);
    await setup('test/scratch', process.env.KRAKEN_DOCKER_URL!);
    await checkCouchDbStarted();
    await setupCouchDb('127.0.0.1', 15984);
    const userId = uuid();
    await bootstrapCloudKraken(userId);
  })

  after( async function () {
    this.timeout(60000)
    await cleanup('test/scratch', process.env.KRAKEN_DOCKER_URL!);
  });

  it("Should be able to create a group and soft delete it", async () => {
    const group = await createGroup('john', 'LetMeIn', uuid(), fetch);
    await checkExistence('127.0.0.1', 15984, `icure-${group.id}-healthdata`)
    await checkExistence('127.0.0.1', 15984, `icure-${group.id}-patient`)
    await checkExistence('127.0.0.1', 15984, `icure-${group.id}-base`)
    const deletedGroup = await softDeleteGroup('john', 'LetMeIn', group.id!, fetch);
    expect(!!deletedGroup.deletionDate).to.eq(true);
  });

  it("Should be able to create a group and hard delete it", async () => {
    const group = await createGroup('john', 'LetMeIn', uuid(), fetch);
    await checkExistence('127.0.0.1', 15984, `icure-${group.id}-healthdata`)
    await checkExistence('127.0.0.1', 15984, `icure-${group.id}-patient`)
    await checkExistence('127.0.0.1', 15984, `icure-${group.id}-base`)
    await hardDeleteGroup('icure', 'icure', group.id!);
    await checkAbsence('127.0.0.1', 15984, `icure-${group.id}-healthdata`)
    await checkAbsence('127.0.0.1', 15984, `icure-${group.id}-patient`)
    await checkAbsence('127.0.0.1', 15984, `icure-${group.id}-base`)
  });

});
