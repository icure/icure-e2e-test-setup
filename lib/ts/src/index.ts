import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as util from 'util';
import axios from 'axios';
import { Api, DatabaseInitialisation, Group, Patient } from '@icure/api';
import uuid = require('uuid');

const standardEnv = {
  COUCHDB_PORT: '15984',
  AS_PORT: '16044',
  COUCHDB_USER: 'icure',
  COUCHDB_PASSWORD: 'icure',
  ...process.env,
}


export const retry = (fn: () => Promise<any>, retriesLeft = 10, interval = 2000): Promise<any> => {
  return fn().catch((err) => {
    if (retriesLeft > 0) {
      console.log('Retrying in ' + interval + 'ms', err)
      return new Promise((resolve) =>
        setTimeout(() => resolve(null), interval)
      ).then(() => retry(fn, retriesLeft - 1, interval * 2))
    } else {
      throw err;
    }
  })
}


function fullUrl(composeFile: string) {
  return composeFile.startsWith('https') ? composeFile : `https://raw.githubusercontent.com/icure-io/icure-e2e-test-setup/master/${composeFile}.yaml`
}

/**
 * Set up a full environment for the tests. This will download the docker-compose files and start the containers.
 *
 * The docker compose can embed extra files that will be extracted in the scratchDir (see docker-compose-cloud.yaml for an example)
 *
 *
 * @param scratchDir the directory where the docker-compose files will be downloaded
 * @param compose the docker-compose file to use. Can be a full url or a short name (e.g. docker-compose)
 * @param profiles the docker profiles that are going to be applied to the docker-compose file
 */
export const setup = async (scratchDir: string, compose: string, ...profiles: string[]) => {
  const composeFile = await download(scratchDir, fullUrl(compose))

  const composeFileContent = fs.readFileSync(composeFile, 'utf8')
  const dependencies = composeFileContent.split(/# => /).slice(1).reduce((files, s) => {
    const lines = s.split(/[\r\n]+# /)
    return { ...files, [lines[0]]: lines.slice(1) }
  }, {} as { [key: string]: string[] })

  Object.keys(dependencies).forEach((file) => {
    const filePath = path.join(scratchDir, file)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, dependencies[file].join('\n'))
  })

  try {
    const { stdout, stderr } = await util.promisify(exec)(`/usr/local/bin/docker compose -f '${composeFile}' ${profiles.map((p) => `--profile ${p}`).join(' ')} up -d`, {
      env: standardEnv,
    })
    console.log(`stdout: ${stdout}`)
    console.error(`stderr: ${stderr}`)
  } catch (e) {
    console.error(e)
  }
}

/**
 * Stop the containers launched by setup and destroy them
 *
 * @param scratchDir the directory where the docker-compose files will be downloaded
 * @param compose the docker-compose file to use. Can be a full url or a short name (e.g. docker-compose)
 * @param profiles the docker profiles that had been applied to the docker-compose file when it was launched by the setup command
 *
 */
export const cleanup = async (scratchDir: string, compose: string, ...profiles: string[]) => {
  try {
    const composeFile = await download(scratchDir, fullUrl(compose))
    const { stdout, stderr } = await util.promisify(exec)(`/usr/local/bin/docker compose -f '${composeFile}' ${profiles.map((p) => `--profile ${p}`).join(' ')} down`, { env: standardEnv })
    console.log(`stdout: ${stdout}`)
    console.error(`stderr: ${stderr}`)
  } catch (e) {
    console.error(e)
  }
}

async function download(scratchDir: string, url: string) {
  let fullPath = path.join(scratchDir, path.basename(url))
  const file = fs.createWriteStream(fullPath)
  return new Promise<string>((resolve, reject) => {
    https.get(url, function (response) {
      response.pipe(file)

      // after download completed close filestream
      file.on('finish', () => {
        file.close()
        console.log('Download Completed')
        resolve(fullPath)
      })

      file.on('error', (err) => {
        console.log('Download Failed')
        reject(err)
      })
    })
  })
}

/**
 * Initialise CouchDB and set the admin user and password
 *
 */
export const setupCouchDb = async (host: string, port: number) => {
  await retry(() =>
    axios.post(
      `http://${host}:${port}/_cluster_setup`,
      {
        action: 'enable_single_node',
        username: 'icure',
        password: 'icure',
        bind_address: '0.0.0.0',
        port: 5984,
        singlenode: true,
      },
      {
        auth: { username: 'icure', password: 'icure' },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  )
}


/**
 * Bootstrap the oss kraken with the minimal environment needed to run the tests
 *
 * @param userId The user id of the user that will be created
 * @param login The login of the user that will be created
 * @param passwordHash The password hash of the user that will be created (AES-256 encoded)
 * @param couchDbIp: the IP of the CouchDB instance to bootstrap
 * @param couchDbPort: the port of the CouchDB instance to boostrap
 */
export const bootstrapOssKraken = async (
  userId: string,
  login = 'john',
  passwordHash = '1796980233375ccd113c972d946b2c4a7892e4f69c60684cfa730150047f9c0b', //LetMeIn
  couchDbIp = '127.0.0.1',
  couchDbPort = 15984
) => {
  await retry( () =>
    axios
    .post(
      `http://${couchDbIp}:${couchDbPort}/icure-base`,
      {
        _id: userId,
        login: login,
        passwordHash: passwordHash,
        type: 'database',
        status: 'ACTIVE',
        java_type: 'org.taktik.icure.entities.User',
      },
      {
        auth: { username: 'icure', password: 'icure' },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    .catch((e) => {
      if (e.response.status !== 409) {
        throw e
      }
    })
  );
};

/**
 * Bootstrap the kraken with the minimal environment needed to run the tests, create other apps, users or databases.
 *
 * @param userId The user id of the user that will be created
 * @param login The login of the user that will be created
 * @param passwordHash The password hash of the user that will be created (AES-256 encoded)
 * @param groupId The group id of the master group that will be created
 * @param groupPassword The password of the master group that will be created
 * @param couchDbIp: the IP of the CouchDB instance to bootstrap
 * @param couchDbPort: the port of the CouchDB instance to boostrap
 */
export const bootstrapCloudKraken = async (
  userId: string,
  login = 'john',
  passwordHash = '1796980233375ccd113c972d946b2c4a7892e4f69c60684cfa730150047f9c0b', //LetMeIn
  groupId = 'xx',
  groupPassword = 'xx', // pragma: allowlist secret
  couchDbIp = '127.0.0.1',
  couchDbPort = 15984
) => {
  await axios
    .put(
      `http://${couchDbIp}:${couchDbPort}/icure-${groupId}-base`,
      {},
      {
        auth: { username: 'icure', password: 'icure' },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    .catch(() => {
      /* DB might already exist */
    })

  await axios
    .post(
      `http://${couchDbIp}:${couchDbPort}/icure-${groupId}-base`,
      {
        _id: userId,
        login: login,
        passwordHash: passwordHash,
        type: 'database',
        status: 'ACTIVE',
        java_type: 'org.taktik.icure.entities.User',
      },
      {
        auth: { username: 'icure', password: 'icure' },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    .catch((e) => {
      if (e.response.status !== 409) {
        throw e
      }
    })

  await retry(() =>
    axios
      .post(
        `http://${couchDbIp}:${couchDbPort}/icure-__-base`,
        {
          _id: `${groupId}:${userId}`,
          login: login,
          passwordHash: passwordHash, //LetMeIn
          type: 'database',
          status: 'ACTIVE',
          groupId: groupId,
          permissions: [
            {
              grants: [
                {
                  java_type:
                    'org.taktik.icure.entities.security.AlwaysPermissionItem',
                  type: 'ADMIN',
                },
              ],
            },
          ],
          java_type: 'org.taktik.icure.entities.User',
        },
        {
          auth: { username: 'icure', password: 'icure' },
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
      .catch((e) => {
        if (e.response.status !== 409) {
          throw e
        }
      })
  )

  await axios
    .post(
      `http://${couchDbIp}:${couchDbPort}/_users`,
      {
        _id: `org.couchdb.user:${groupId}`,
        name: groupId,
        roles: [],
        type: 'user',
        password: groupPassword,
      },
      {
        auth: { username: 'icure', password: 'icure' },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    .catch((e) => {
      if (e.response.status !== 409) {
        throw e
      }
    })
  await retry(() =>
    axios
      .post(
        `http://${couchDbIp}:${couchDbPort}/icure-__-config`,
        {
          _id: groupId,
          java_type: 'org.taktik.icure.entities.Group',
          name: groupId,
          password: groupPassword, //pragma: allowlist secret
          tags: [
            {
              id: 'IC-GROUP|root|1.0',
              type: 'IC-GROUP',
              code: 'root',
              version: '1.0',
            },
          ],
          rev_history: {},
          servers: [],
        },
        {
          auth: { username: 'icure', password: 'icure' },
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
      .catch((e) => {
        if (e.response.status !== 409) {
          throw e
        }
      })
  )
};

/**
 * Creates a group with a random ID and password using the IccApi
 *
 * @param adminLogin the login of an admin user
 * @param adminPassword the password of the user
 * @param groupId the id of the group to create
 * @param fetchImpl the implementation of the fetch function
 * @param host the Kraken API URL
 */
export const createGroup = async (
  adminLogin: string,
  adminPassword: string,
  groupId: string,
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  host = 'http://127.0.0.1:16044/rest/v1'
): Promise<Group> => {
  const api = await Api(host, adminLogin, adminPassword, undefined, fetchImpl);
  const groupName = groupId.substring(0,5);
  const groupPwd = uuid();
  return await api.groupApi.createGroup(
    groupId,
    groupName,
    groupPwd,
    undefined, undefined, undefined, undefined, undefined,
    new DatabaseInitialisation({
      users: [],
      healthcareParties: []
    }));
};

/**
 * Soft deletes a group using the IccApi
 *
 * @param adminLogin the login of an admin user
 * @param adminPassword the password of the user
 * @param groupId the id of the group to delete
 * @param fetchImpl the implementation of the fetch function
 * @param host the Kraken API URL
 */
export const softDeleteGroup = async (
  adminLogin: string,
  adminPassword: string,
  groupId: string,
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  host = 'http://127.0.0.1:16044/rest/v1'
): Promise<Group> => {
  const api = await Api(host, adminLogin, adminPassword, undefined, fetchImpl);
  return await api.groupApi.deleteGroup(groupId);
};

/**
 * Performs hard deletion of the databases of a group
 *
 * @param adminLogin a database admin login
 * @param adminPassword the admin user password
 * @param groupId the group to delete
 * @param couchDbUrl the couchDbUrl
 */
export const hardDeleteGroup = async (
  adminLogin: string,
  adminPassword: string,
  groupId: string,
  couchDbUrl = 'http://127.0.0.1:15984'
) => {
  await axios
    .delete(
      `${couchDbUrl}/icure-${groupId}-base`,
      {
        auth: { username: adminLogin, password: adminPassword },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

  await axios
    .delete(
      `${couchDbUrl}/icure-${groupId}-healthdata`,
      {
        auth: { username: adminLogin, password: adminPassword },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

  await axios
    .delete(
      `${couchDbUrl}/icure-${groupId}-patient`,
      {
        auth: { username: adminLogin, password: adminPassword },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
};
