import { createCustomRunner, initEnv } from "nx-remotecache-custom"
import { S3 } from "@aws-sdk/client-s3"
import { fromIni } from "@aws-sdk/credential-provider-ini"
import getStream from "get-stream"
import Stream from "stream"

const ENV_ACCESS_KEY_ID = "NX_CACHE_S3_ACCESS_KEY_ID"
const ENV_SECRET_ACCESS_KEY = "NX_CACHE_S3_SECRET_ACCESS_KEY"
const ENV_SESSION_TOKEN = "NX_CACHE_S3_SESSION_TOKEN"
const ENV_PROFILE = "NX_CACHE_S3_PROFILE"
const ENV_BUCKET = "NX_CACHE_S3_BUCKET"
const ENV_PREFIX = "NX_CACHE_S3_PREFIX"
const ENV_ENDPOINT = "NX_CACHE_S3_ENDPOINT"
const ENV_REGION = "NX_CACHE_S3_REGION"

const getEnv = (key: string) => process.env[key]

interface S3Options {
  bucket?: string
  prefix?: string
  endpoint?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
  profile?: string
}

export default createCustomRunner<S3Options>(async (options) => {
  initEnv(options)

  const s3Storage = new S3({
    endpoint: getEnv(ENV_ENDPOINT) ?? options.endpoint,
    region: getEnv(ENV_REGION) ?? options.region,
    credentials: getCredentials(options),
  })

  const bucket = getEnv(ENV_BUCKET) ?? options.bucket

  const prefix = getEnv(ENV_PREFIX) ?? options.prefix ?? ""

  return {
    name: "S3",
    fileExists: async (filename) => {
      try {
        const result = await s3Storage.headObject({
          /* eslint-disable @typescript-eslint/naming-convention */
          Bucket: bucket,
          Key: `${prefix}${filename}`,
          /* eslint-enable @typescript-eslint/naming-convention */
        })
        return !!result
      } catch (error: any) {
        if (error.name === "NotFound") {
          return false
        } else {
          throw error
        }
      }
    },
    retrieveFile: async (filename) => {
      const result = await s3Storage.getObject({
        /* eslint-disable @typescript-eslint/naming-convention */
        Bucket: bucket,
        Key: `${prefix}${filename}`,
        /* eslint-enable @typescript-eslint/naming-convention */
      })
      return getStream.buffer(result.Body as Stream)
    },
    storeFile: async (filename, buffer) =>
      await s3Storage.putObject({
        /* eslint-disable @typescript-eslint/naming-convention */
        Bucket: bucket,
        Key: `${prefix}${filename}`,
        Body: buffer,
        /* eslint-enable @typescript-eslint/naming-convention */
      }),
  }
})

function getCredentials(options: S3Options) {
  const accessKeyId = getEnv(ENV_ACCESS_KEY_ID) ?? options.accessKeyId
  const secretAccessKey =
    getEnv(ENV_SECRET_ACCESS_KEY) ?? options.secretAccessKey
  const sessionToken = getEnv(ENV_SESSION_TOKEN) ?? options.sessionToken
  const profile = getEnv(ENV_PROFILE) ?? options.profile

  if (accessKeyId && secretAccessKey) {
    return {
      accessKeyId,
      secretAccessKey,
      sessionToken,
    }
  }
  if (profile) {
    return fromIni({ profile })
  }
  return undefined
}
