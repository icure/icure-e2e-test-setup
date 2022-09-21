import 'isomorphic-fetch';
import { setup, createGroup, bootstrapCloudKraken, cleanup, setupCouchDb } from '../src';
import uuid = require('uuid');
import { before } from 'mocha';
import { Api, ua2hex } from '@icure/api';
import {webcrypto} from 'crypto';
import { createHealthcareParty, createMasterHcp, MasterCredentials } from '../src/creation';
import { checkExistence } from './utils';

const groupId = uuid();
let masterCredentials: MasterCredentials;

describe("Test creation", function () {

  before( async function () {
    this.timeout(300000);
    await setup('test/scratch', process.env.KRAKEN_DOCKER_URL!);
    await setupCouchDb('127.0.0.1', 15984);
    const userId = uuid();
    await bootstrapCloudKraken(userId);
    await createGroup('john', 'LetMeIn', groupId, fetch);
    masterCredentials = await createMasterHcp(
      'john',
      'LetMeIn',
      groupId,
      fetch
    );
  })

  after( async function () {
    this.timeout(60000)
    await cleanup('test/scratch', process.env.KRAKEN_DOCKER_URL!);
  });

  it("Should be able to create a healthcare party", async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', 'john', 'LetMeIn', webcrypto as any, fetch);

    const { publicKey, privateKey } = await api.cryptoApi.RSA.generateKeyPair();
    const publicKeyHex = ua2hex(
      await api.cryptoApi.RSA.exportKey(publicKey, 'spki')
    );
    const authToken = uuid();

    const user = await createHealthcareParty(
      masterCredentials.login,
      masterCredentials.password,
      'test1@icure.com',
      authToken,
      publicKeyHex,
      fetch
    );

    await checkExistence('127.0.0.1', 15984, `icure-${groupId}-base`, user.healthcarePartyId!);
    await checkExistence('127.0.0.1', 15984, `icure-${groupId}-base`, user.id!);
  });

});
