import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import * as util from 'util'

const standardEnv = {
  COUCHDB_PORT: '15984',
  AS_PORT: '16044',
  COUCHDB_USER: 'icure',
  COUCHDB_PASSWORD: 'icure',
  ...process.env,
}

function fullUrl(composeFile: string) {
  return composeFile.startsWith('https') ? composeFile : `https://raw.githubusercontent.com/icure-io/icure-e2e-test-setup/master/${composeFile}.yaml`
}

export const setup = async (scratchDir: string, compose: string, ...profiles: string[]) => {
  const composeFile = await download(scratchDir, fullUrl(compose))
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
