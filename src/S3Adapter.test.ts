import * as aws from 'aws-sdk'

describe('S3Adapter', () => {
  const S3 = new aws.S3({
    endpoint: 'http://localhost:4572'
  })
  const Bucket = 'casbin.musma.net'

  describe('Head', () => {
    beforeAll(async done => {
      await S3.createBucket({
        Bucket,
        ObjectLockEnabledForBucket: true
      }).promise()
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
    })

    afterAll(async done => {
      await S3.deleteBucket({
        Bucket
      }).promise()
      done()
    })
  })
})
