//
// Unit tests of Rest API retries
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
          spec: { containers: [{ env: [{ name: 'JOB', value: '{}' }] }] }
        }
      }
    }
  }
}

const jobsResponse = { body: { items: [job] } }
const jobsEmptyResponse = { body: { items: [] } }

const jobResponse = {

  name: 'job-1',
  labels: {},
  active: false,
  executor: undefined,
  lastSchedule: undefined,
  recur: undefined,
  request: undefined,
  type: undefined
}

const addJobReq = {

  body: {

    name: 'job-1',
    recur: { triggers: ['0/1 * * * *'] }
  }
}

const updateJobReq = {

  params: {

    jobId: 'job-1'
  },

  body: {

    recur: { triggers: ['0/1 * * * *'] }
  }
}

const reqParamsJobId = { params: { jobId: 'job-1' } }
const reqBodyUrl = { url: 'http://host.net' }

const jobCreated = { code: 201, message: 'Job created.' }
const jobUpdated = { code: 200, message: 'Job updated.' }
const jobDeleted = { code: 200, message: 'Job deleted.' }
const jobsDeleted = { code: 200, message: 'All jobs deleted.' }

const cannotGetJob = 'Cannot get job'
const getJobError = { code: 500, message: cannotGetJob }

const cannotGetJobs = 'Cannot get jobs'
const getJobsError = { code: 500, message: cannotGetJobs }

const cannotAddJob = 'Cannot add job'
const addJobError = { code: 500, message: `Failed to create cronjob, ${cannotAddJob}` }

const cannotUpdateJob = 'Cannot update job'
const updateJobError = { code: 500, message: `Failed to update cronjob, ${cannotUpdateJob}` }

const cannotDeleteJob = 'Cannot delete job'
const deleteJobError = { code: 500, message: cannotDeleteJob }

const cannotDeleteJobs = 'Cannot delete jobs'
const deleteJobsError = { code: 500, message: cannotDeleteJobs }

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

const apiStub = (numErrors, data, msg) => {
  stub = sinon.stub()

  for (let i = 0; i < numErrors; i++) {
    stub.onCall(i).throws(new Error(msg))
  }

  stub.onCall(numErrors).returns(data)

  return stub
}

const doTest = async (apiStubs, method, req, response) => {
  cronjobs = apiStubs

  const api = require(apiModName)

  const send = sinon.stub()
  const res = { status: code => ({ send }), send }

  await api[method](req, res)

  assert.equal(send.callCount, 1)
  assert.deepEqual(send.getCall(0).args[0], response)
}

const testDeleteError = async (numErrors, response) => {
  const deleteStub = apiStub(numErrors, { done: 'ok' }, cannotDeleteJob)
  const apiStubs = name => ({ delete: deleteStub })
  apiStubs.get = sinon.stub().returns(jobsResponse)

  await doTest(apiStubs, 'deleteJob', reqParamsJobId, response)
}

const testUpdateError = async (numErrors, response) => {
  const putStub = apiStub(numErrors, { done: 'ok' }, cannotUpdateJob)
  const apiStubs = name => ({ put: putStub })
  apiStubs.get = sinon.stub().returns(jobsResponse)

  await doTest(apiStubs, 'updateJob', updateJobReq, response)
}

const testAddError = async (numErrors, response) => {
  const apiStubs = {

    get: sinon.stub().returns(jobsEmptyResponse),
    post: apiStub(numErrors, { done: 'ok' }, cannotAddJob)
  }

  await doTest(apiStubs, 'addJob', addJobReq, response)
}

describe('API retries', function () {
  this.timeout(3000)

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

  it('get success', async () => {
    await doTest({ get: apiStub(1, jobsResponse, cannotGetJobs) }, 'getJob', reqParamsJobId, jobResponse)
  })

  it('get fail', async () => {
    await doTest({ get: apiStub(4, jobsResponse, cannotGetJob) }, 'getJob', reqParamsJobId, getJobError)
  })

  it('getAll success', async () => {
    await doTest({ get: apiStub(1, jobsResponse, cannotGetJobs) }, 'getAllJobs', reqBodyUrl, { 0: jobResponse })
  })

  it('getAll fail', async () => {
    await doTest({ get: apiStub(4, jobsResponse, cannotGetJobs) }, 'getAllJobs', reqBodyUrl, getJobsError)
  })

  it('add success - get retry', async () => {
    const apiStubs = {

      get: apiStub(1, jobsEmptyResponse, cannotGetJobs),
      post: sinon.stub().onCall(0).returns({ done: 'ok' })
    }

    await doTest(apiStubs, 'addJob', addJobReq, jobCreated)
  })

  it('add success - add retry', async () => {
    await testAddError(1, jobCreated)
  })

  it('add fail', async () => {
    await testAddError(4, addJobError)
  })

  it('update success - get retry', async () => {
    const apiStubs = name => ({ put: sinon.stub().onCall(0).returns({ done: 'ok' }) })
    apiStubs.get = apiStub(1, jobsResponse, cannotGetJob)

    await doTest(apiStubs, 'updateJob', updateJobReq, jobUpdated)
  })

  it('update success - add retry', async () => {
    const apiStubs = {

      get: sinon.stub().returns(jobsEmptyResponse),
      post: apiStub(1, { done: 'ok' }, cannotAddJob)
    }

    await doTest(apiStubs, 'updateJob', updateJobReq, jobCreated)
  })

  it('update success - update retry', async () => {
    await testUpdateError(1, jobUpdated)
  })

  it('update fail', async () => {
    await testUpdateError(4, updateJobError)
  })

  it('delete success - get retry', async () => {
    const apiStubs = name => ({ delete: sinon.stub().onCall(0).returns({ done: 'ok' }) })
    apiStubs.get = apiStub(1, jobsResponse, cannotGetJobs)

    await doTest(apiStubs, 'deleteJob', reqParamsJobId, jobDeleted)
  })

  it('delete success - delete retry', async () => {
    await testDeleteError(1, jobDeleted)
  })

  it('delete fail', async () => {
    await testDeleteError(4, deleteJobError)
  })

  it('deleteAll success', async () => {
    await doTest({ delete: apiStub(1, { done: 'ok' }, cannotDeleteJobs) }, 'deleteAllJobs', reqBodyUrl, jobsDeleted)
  })

  it('deleteAll fail', async () => {
    await doTest({ delete: apiStub(4, { done: 'ok' }, cannotDeleteJobs) }, 'deleteAllJobs', reqBodyUrl, deleteJobsError)
  })
})
