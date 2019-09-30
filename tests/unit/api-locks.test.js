//
// Unit tests of Rest API locks
//

const k8scli = require('kubernetes-client')
const assert = require('assert')
const sinon = require('sinon')

const apiModName = './../../src/rest-api.js'

const job = {

  metadata: { labels: { id0: 'Zjob-1Z' } },
  status: {},

  spec: {
    jobTemplate: {
      spec: {
        template: {
          spec: { enableServiceLinks: false, containers: [{ env: [{ name: 'JOB', value: '{}' }] }] }
        }
      }
    }
  }
}

const cronEveryMinute = '0/1 * * * *'
const cronEveryHour = '0 0/1 * * *'

const bodyKind = 'CronJob'

const addJobReq = {

  body: {

    name: 'job-1',
    recur: { triggers: [cronEveryMinute] }
  }
}

const updateJobReq = {

  params: {

    jobId: 'job-1'
  },

  body: {

    recur: { triggers: [cronEveryHour] }
  }
}

const deleteJobReq = { params: { jobId: 'job-1' } }

const jobCreated = { code: 201, message: 'Job created.' }
const jobUpdated = { code: 200, message: 'Job updated.' }
const jobDeleted = { code: 200, message: 'Job deleted.' }
const jobNotFound = { code: 404, message: 'Job not found.' }
const jobExists = { code: 409, message: 'Job with the same name already exists.' }

const jobSelector = { qs: { labelSelector: 'id0=Zjob-1Z' } }

const jobsResponse = { body: { items: [job] } }
const jobsEmptyResponse = { body: { items: [] } }

let cronjobs = {}

const stubApi = () => cronjobs

const batchApi = {

  apis: {
    batch: {
      v1beta1: {

        namespaces: namespace => ({ cronjobs: stubApi() })
      }
    }
  }
}

let getInCluster,
  kubeClient

describe('API locks', () => {
  before(() => {
    getInCluster = sinon.stub(k8scli.config, 'getInCluster').returns({})
    kubeClient = sinon.stub(k8scli, 'Client').returns(batchApi)
  })

  after(() => {
    getInCluster.restore()
    kubeClient.restore()
  })

  beforeEach(() => {
    delete require.cache[require.resolve(apiModName)]
  })

  it('add job', (done) => {
    const send = sinon.stub()
    const res = { status: code => ({ send }) }

    const get = sinon.stub()
    const post = sinon.stub().onCall(0).returns({ done: 'ok' })

    const finish = (value) => {
      assert.equal(get.callCount, 2)
      assert.deepEqual(get.getCall(0).args[0], jobSelector)
      assert.deepEqual(get.getCall(1).args[0], jobSelector)

      assert.equal(post.callCount, 1)
      assert.equal(post.getCall(0).args[0].body.kind, bodyKind)

      assert.equal(send.callCount, 2)
      assert.deepEqual(send.getCall(0).args[0], jobCreated)
      assert.deepEqual(send.getCall(1).args[0], jobExists)

      done()
    }

    const addJobAgain = (resolve) => {
      api.addJob(addJobReq, res).then(finish)
      resolve(jobsEmptyResponse)
    }

    get.onCall(0).returns(new Promise((resolve) => { setTimeout(() => { addJobAgain(resolve) }, 0) }))
    get.onCall(1).returns(jobsResponse)

    cronjobs = { get, post }

    const api = require(apiModName)

    api.addJob(addJobReq, res)
  })

  it('update job', (done) => {
    const send = sinon.stub()
    const res = { status: code => ({ send }) }

    const get = sinon.stub()
    const post = sinon.stub().onCall(0).returns({ done: 'ok' })
    const put = sinon.stub().onCall(0).returns({ done: 'ok' })

    const finish = (value) => {
      assert.equal(get.callCount, 2)
      assert.deepEqual(get.getCall(0).args[0], jobSelector)
      assert.deepEqual(get.getCall(1).args[0], jobSelector)

      assert.equal(post.callCount, 1)
      assert.equal(post.getCall(0).args[0].body.kind, bodyKind)

      assert.equal(put.callCount, 1)
      assert.equal(put.getCall(0).args[0].body.kind, bodyKind)
      assert.equal(put.getCall(0).args[0].body.spec.schedule, cronEveryHour)

      assert.equal(send.callCount, 2)
      assert.deepEqual(send.getCall(0).args[0], jobCreated)
      assert.deepEqual(send.getCall(1).args[0], jobUpdated)

      done()
    }

    const updateJobAgain = (resolve) => {
      api.updateJob(updateJobReq, res).then(finish)
      resolve(jobsEmptyResponse)
    }

    get.onCall(0).returns(new Promise((resolve) => { setTimeout(() => { updateJobAgain(resolve) }, 0) }))
    get.onCall(1).returns(jobsResponse)

    cronjobs = name => ({ put })
    cronjobs.get = get
    cronjobs.post = post

    const api = require(apiModName)

    api.updateJob(updateJobReq, res)
  })

  it('delete job', (done) => {
    const send = sinon.stub()
    const res = { status: code => ({ send }) }

    const get = sinon.stub()
    const _delete = sinon.stub().onCall(0).returns({ done: 'ok' })

    const finish = (value) => {
      assert.equal(get.callCount, 2)
      assert.deepEqual(get.getCall(0).args[0], jobSelector)
      assert.deepEqual(get.getCall(1).args[0], jobSelector)

      assert.equal(_delete.callCount, 1)

      assert.equal(send.callCount, 2)
      assert.deepEqual(send.getCall(0).args[0], jobDeleted)
      assert.deepEqual(send.getCall(1).args[0], jobNotFound)

      done()
    }

    const deleteJobAgain = (resolve) => {
      api.deleteJob(deleteJobReq, res).then(finish)
      resolve(jobsResponse)
    }

    get.onCall(0).returns(new Promise((resolve) => { setTimeout(() => { deleteJobAgain(resolve) }, 0) }))
    get.onCall(1).returns(jobsEmptyResponse)

    cronjobs = name => ({ delete: _delete })
    cronjobs.get = get

    const api = require(apiModName)

    api.deleteJob(deleteJobReq, res)
  })
})
