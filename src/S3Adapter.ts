import * as casbin from 'casbin'
import * as aws from 'aws-sdk'
import { boundMethod } from 'autobind-decorator'

export class S3Adapter implements casbin.Adapter {
  // eslint-disable-next-line no-useless-constructor
  constructor (protected readonly s3: aws.S3) {}

  @boundMethod
  public async loadPolicy (model: casbin.Model): Promise<void> {
    casbin.Helper.loadPolicyLine('', model)
  }

  @boundMethod
  public async savePolicy (model: casbin.Model): Promise<boolean> {
    const astMap = model.model.get('p')
    if (!astMap) {
      return false
    }

    return true
  }

  @boundMethod
  public async addPolicy (sec: string, ptype: string, rule: string[]): Promise<void> {
    throw new Error('Method not implemented.')
  }

  @boundMethod
  public async removePolicy (sec: string, ptype: string, rule: string[]): Promise<void> {
    throw new Error('Method not implemented.')
  }

  @boundMethod
  public async removeFilteredPolicy (sec: string, ptype: string, fieldIndex: number, ...fieldValues: string[]): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
