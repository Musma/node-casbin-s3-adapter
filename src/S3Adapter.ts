import * as casbin from 'casbin'
import * as aws from 'aws-sdk'
import { boundMethod } from 'autobind-decorator'

export interface S3AdapterProps {
  /**
   * S3 버킷 이름
   */
  Bucket: aws.S3.BucketName

  /**
   * @default new aws.S3()
   */
  S3?: aws.S3

  /**
   * @default DEFAULT_POLICY_FILENAME
   */
  policyFileName?: string
}

const DEFAULT_POLICY_FILENAME = 'policies.csv'

export class S3Adapter implements casbin.Adapter {
  public static async init (props: S3AdapterProps): Promise<S3Adapter> {
    const instance = new S3Adapter(props)
    await instance.init()
    return instance
  }

  protected readonly S3: aws.S3
  protected readonly Bucket: aws.S3.BucketName
  protected readonly Key: aws.S3.ObjectKey

  protected constructor (props: S3AdapterProps) {
    this.S3 = props.S3 || new aws.S3()
    this.Bucket = props.Bucket
    this.Key = props.policyFileName || DEFAULT_POLICY_FILENAME
  }

  @boundMethod
  public async loadPolicy (model: casbin.Model): Promise<void> {
    model.clearPolicy()

    try {
      const readPolicies = async (): Promise<string[]> => {
        try {
          const { Body = '' } = await this.S3.getObject({ Bucket: this.Bucket, Key: this.Key }).promise()
          return String(Body).split('\n')
        } catch (e) {
          if ((e as aws.AWSError).code === 'NoSuchKey') {
            return []
          } else {
            throw e
          }
        }
      }

      const lines = await readPolicies()
      for (const line of lines) {
        casbin.Helper.loadPolicyLine(line, model)
      }
    } catch (e) {
      if ((e as aws.AWSError).code === 'NoSuchKey') {
        await this.S3.putObject({
          Bucket: this.Bucket,
          Key: this.Key
        }).promise()
      } else {
        throw e
      }
    }
  }

  @boundMethod
  public async savePolicy (model: casbin.Model): Promise<boolean> {
    try {
      const lines = []
      for (const key of model.model.keys()) {
        const astMap = model.model.get(key) || new Map<string, casbin.Assertion>()
        for (const [ptype, ast] of astMap) {
          for (const rule of ast.policy) {
            const line = `${ptype},${rule.join()}`
            lines.push(line)
          }
        }
      }
      await this.S3.putObject({
        Bucket: this.Bucket,
        Key: this.Key,
        Body: lines.join('\n')
      }).promise()
      return true
    } catch (e) {
      if ((e as aws.AWSError).code === 'NoSuchKey') {
      } else {
        console.error(e.message)
      }
      return false
    }
  }

  @boundMethod
  public async addPolicy (sec: string, ptype: string, rule: string[]): Promise<void> {
    const readPolicies = async (): Promise<string[]> => {
      try {
        const { Body = '' } = await this.S3.getObject({ Bucket: this.Bucket, Key: this.Key }).promise()
        return String(Body).split('\n')
      } catch (e) {
        if ((e as aws.AWSError).code === 'NoSuchKey') {
          return []
        } else {
          throw e
        }
      }
    }

    const lines = await readPolicies()
    console.log(lines)
    const Body = [...lines, `${ptype},${rule.join()}`].join('\n')

    await this.S3.putObject({
      Bucket: this.Bucket,
      Key: this.Key,
      Body
    }).promise()
  }

  @boundMethod
  public async removePolicy (sec: string, ptype: string, rule: string[]): Promise<void> {
    try {
      const readPolicies = async (): Promise<string[]> => {
        try {
          const { Body = '' } = await this.S3.getObject({ Bucket: this.Bucket, Key: this.Key }).promise()
          return String(Body).split('\n')
        } catch (e) {
          if ((e as aws.AWSError).code === 'NoSuchKey') {
            return []
          } else {
            throw e
          }
        }
      }

      const lines = await readPolicies()
      console.log(lines)
      const line = `${ptype},${rule.join()}`
      const deletelineResult = lines.filter(_ => _ !== line).join('\n')
      this.S3.putObject({
        Bucket: this.Bucket,
        Key: this.Key,
        Body: deletelineResult
      }).promise()
    } catch (e) {
      if ((e as aws.AWSError).code === 'NoSuchKey') {
      } else {
        throw e
      }
    }
  }

  @boundMethod
  public async removeFilteredPolicy (sec: string, ptype: string, fieldIndex: number, ...fieldValues: string[]): Promise<void> {
    throw new Error('Method not implemented.')
  }

  @boundMethod
  protected async init (): Promise<void> {
    try {
      // Bucket 있는지 검사
      await this.S3.headBucket({ Bucket: this.Bucket }).promise()
    } catch (e) {
      if ((e as aws.AWSError)) {
        console.error(e.message)
      }
      throw e
    }
  }

  @boundMethod
  protected async createOrReplaceBucket (Bucket: string): Promise<void> {
    try {
      await this.S3.deleteBucket({
        Bucket
      }).promise()

      await this.S3.createBucket({
        Bucket,
        ObjectLockEnabledForBucket: true
      }).promise()
    } catch (e) {

    }
  }
}
