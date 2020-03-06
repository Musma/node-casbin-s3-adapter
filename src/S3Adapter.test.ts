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
  const Key = 'policies.csv'

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

      it('#addPolicy-1', async done => {
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

        const rmoved = await enforcer.removePolicy('Administrator', '*', 'iam:CreateGroup')
        expect(rmoved).toBe(true)

        done()
      })

      it('#addPolicy-2(동일 한 Policy 것을 두 번 넣었을 때)', async done => {
        const model = casbin.newModelFromString(MODEL)
        const adapter = await S3Adapter.init({
          S3,
          Bucket
        })
        const enforcer = new casbin.Enforcer()
        await enforcer.initWithModelAndAdapter(model, adapter)

        const resultBefore = await enforcer.enforce('Administrator', '*', 'iam:CreateGroup')
        expect(resultBefore).toBe(false)

        let added = await enforcer.addPolicy('Administrator', '*', 'iam:CreateGroup')
        expect(added).toBe(true)

        added = await enforcer.addPolicy('Administrator', '*', 'iam:CreateGroup')
        expect(added).toBe(false)

        const rmoved = await enforcer.removePolicy('Administrator', '*', 'iam:CreateGroup')
        expect(rmoved).toBe(true)

        done()
      })

      it('#removePolicy-1', async done => {
        const model = casbin.newModelFromString(MODEL)
        const adapter = await S3Adapter.init({
          S3,
          Bucket
        })
        const enforcer = new casbin.Enforcer()
        await enforcer.initWithModelAndAdapter(model, adapter)

        const added = await enforcer.addPolicy('Administrator', '*', 'iam:CreateGroup')
        expect(added).toBe(true)

        const rmoved = await enforcer.removePolicy('Administrator', '*', 'iam:CreateGroup')
        expect(rmoved).toBe(true)

        const resultAfter = await enforcer.enforce('Administrator', '*', 'iam:CreateGroup')
        expect(resultAfter).toBe(false)

        done()
      })

      it('#removePolicy-2(존재하지 않는 Policy 지웠을 때)', async done => {
        const model = casbin.newModelFromString(MODEL)
        const adapter = await S3Adapter.init({
          S3,
          Bucket
        })
        const enforcer = new casbin.Enforcer()
        await enforcer.initWithModelAndAdapter(model, adapter)

        const resultBefore = await enforcer.enforce('Administrator', '*', 'iam:CreateGroup')
        expect(resultBefore).toBe(false)

        done()
      })
    })

    describe('두개의 Policy 추가 후 원하는 것만 지우는 테스트', () => {
      it('#addRemovePolicy', async done => {
        const model = casbin.newModelFromString(MODEL)
        const adapter = await S3Adapter.init({
          S3,
          Bucket
        })
        const enforcer = new casbin.Enforcer()
        await enforcer.initWithModelAndAdapter(model, adapter)

        let resultBefore = await enforcer.enforce('Administrator', '*', 'iam:RemoveUserFromGroup')
        expect(resultBefore).toBe(false)

        let added = await enforcer.addPolicy('Administrator', '*', 'iam:RemoveUserFromGroup')
        expect(added).toBe(true)

        resultBefore = await enforcer.enforce('Administrator', '*', 'iam:PutGroupPolicy')
        expect(resultBefore).toBe(false)

        added = await enforcer.addPolicy('Administrator', '*', 'iam:PutGroupPolicy')
        expect(added).toBe(true)

        let rmoved = await enforcer.removePolicy('Administrator', '*', 'iam:RemoveUserFromGroup')
        expect(rmoved).toBe(true)

        let removeResult = await enforcer.enforce('Administrator', '*', 'iam:RemoveUserFromGroup')
        expect(removeResult).toBe(false)

        removeResult = await enforcer.enforce('Administrator', '*', 'iam:PutGroupPolicy')
        expect(removeResult).toBe(true)

        rmoved = await enforcer.removePolicy('Administrator', '*', 'iam:PutGroupPolicy')
        expect(rmoved).toBe(true)

        removeResult = await enforcer.enforce('Administrator', '*', 'iam:PutGroupPolicy')
        expect(removeResult).toBe(false)

        done()
      })

      it(`
         |#removeFilteredPolicy
         |테스트 용도로 Shop 값을 2개를 넣고 해당 값을 filter 해서 삭제 후
         |결과를 확인한다
         |`.replace(/^[^|]*\|/gm, ''), async done => {
        const model = casbin.newModelFromString(MODEL)
        const adapter = await S3Adapter.init({
          S3,
          Bucket
        })
        const enforcer = new casbin.Enforcer()
        await enforcer.initWithModelAndAdapter(model, adapter)

        await enforcer.addPolicy('Shop', '*', 'rfid:AttachRfidTagToSpool')
        await enforcer.addPolicy('Shop', '*', 'rfid:DetachRfidTagFromSpool')

        const removeResult3 = await enforcer.enforce('Shop', '*', 'rfid:AttachRfidTagToSpool')
        expect(removeResult3).toBe(true)
        const removeResult4 = await enforcer.enforce('Shop', '*', 'rfid:DetachRfidTagFromSpool')
        expect(removeResult4).toBe(true)

        const removeFilteredResult = await enforcer.removeFilteredPolicy(0, 'Shop')
        expect(removeFilteredResult).toBe(true)

        const removeResult1 = await enforcer.enforce('Shop', '*', 'rfid:AttachRfidTagToSpool')
        expect(removeResult1).toBe(false)

        const removeResult2 = await enforcer.enforce('Shop', '*', 'rfid:DetachRfidTagFromSpool')
        expect(removeResult2).toBe(false)

        done()
      })
    })
  })
  afterAll(async done => {
    await S3.deleteObject({
      Bucket,
      Key
    }).promise()
    done()
  })
})
