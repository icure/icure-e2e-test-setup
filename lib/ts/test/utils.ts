import { retry } from '../src';
import axios from 'axios';
import { expect } from 'chai';

export async function checkCouchDbStarted() {
  await retry(async () => {
    const {
      data: { couchdb },
      status,
    } = await axios.get('http://127.0.0.1:15984')
    expect(status).to.equal(200)
    expect(couchdb).to.equal('Welcome')
  })
}

export async function checkExistence(host: string, port: number, db: string, objectId = '') {
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

export async function checkAbsence(host: string, port: number, db: string, objectId = '') {
  axios.get(
    `http://${host}:${port}/${db}/${objectId}`,
    {
      auth: { username: 'icure', password: 'icure' },
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch( (error) => {
      expect(error.response.status).to.eq(404);
  });
}
