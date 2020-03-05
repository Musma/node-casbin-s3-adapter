import * as assert from 'assert'
import * as aws from 'aws-sdk'
import * as casbin from 'casbin'
import S3Adapter from '.'

const MODEL = `
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && \
    (r.obj == p.obj || p.obj == '*') && \
    (r.act == p.act || p.act == '*')
`

describe('S3Adapter', () => {
  const S3 = new aws.S3({
    endpoint: 'http://localhost:4572'
  })
  const Bucket = 'casbin.musma.net'

  describe('Head', () => {
    beforeAll(async done => {
      try {
        await S3.createBucket({
          Bucket,
          ObjectLockEnabledForBucket: true
        }).promise()
      } catch (e) {
        console.log((e as aws.AWSError).message)
        assert.fail('LocalStack 의심됨')
      }
      done()
    })

    describe('Body', () => {
      it('#listObjects', async (done) => {
        const { Contents = [] } = await S3.listObjects({
          Bucket
        }).promise()
        expect(Contents.length).toBeGreaterThanOrEqual(0)
        done()
      })

      describe('초기화 관련', () => {
        it('맨 처음 S3버킷에 policy 파일이 없어도 초기화되어야 한다. (그냥 빈 파일 취급한다.)', async done => {
          const model = casbin.newModelFromString(MODEL)
          const adapter = await S3Adapter.init({
            S3,
            Bucket
          })
          try {
            const enforcer = new casbin.Enforcer()
            await enforcer.initWithModelAndAdapter(model, adapter)
          } catch (e) {
            assert.fail(e.message)
          }
          done()
        })
      })

      it('#addPolicy', async done => {
        const model = casbin.newModelFromString(MODEL)
        const adapter = await S3Adapter.init({
          S3,
          Bucket
        })
        const enforcer = new casbin.Enforcer()
        await enforcer.initWithModelAndAdapter(model, adapter)

        const resultBefore = await enforcer.enforce('Administrator', '*', 'iam:CreateGroup')
        expect(resultBefore).toBe(false)

        const added = await enforcer.addPolicy('Administrator', '*', 'iam:CreateGroup')
        expect(added).toBe(true)

        const resultAfter = await enforcer.enforce('Administrator', '*', 'iam:CreateGroup')
        expect(resultAfter).toBe(true)
        done()
      })

      it('#removePolicy', async done => {
        const model = casbin.newModelFromString(MODEL)
        const adapter = await S3Adapter.init({
          S3,
          Bucket
        })
        const enforcer = new casbin.Enforcer()
        await enforcer.initWithModelAndAdapter(model, adapter)

        const resultBefore = await enforcer.enforce('Administrator', '*', 'iam:CreateGroup')
        expect(resultBefore).toBe(true)

        const rmoved = await enforcer.removePolicy('Administrator', '*', 'iam:CreateGroup')
        expect(rmoved).toBe(true)

        const resultAfter = await enforcer.enforce('Administrator', '*', 'iam:CreateGroup')
        expect(resultAfter).toBe(false)

        done()
      })
    })
  })
})
