//
// Implementation of Rest API calls
//

const _ = require('underscore')
const uuid = require('uuid/v4')
const url = require('url')
const semaphore = require('semaphore-async-await')
const retry = require('async-retry')

const kubeClient = require('kubernetes-client').Client
const kubeConfig = require('kubernetes-client').config

const logger = require('./logger.js')

const namespace = process.env.NAMESPACE || 'default'
const executor_image = process.env.EXECUTOR_IMAGE || 'busybox'
const k8s_api_version = process.env.K8S_API_VERSION || '1.8'
const k8s_batch_api = process.env.K8S_BATCH_API || 'v1beta1'

logger.info(`Namespace: ${namespace}`)
logger.info(`Executor image: ${executor_image}`)
logger.info(`k8s api version: ${k8s_api_version}`)
logger.info(`k8s batch api: ${k8s_batch_api}`)

const k8sBatchApi = (new kubeClient({ config: kubeConfig.getInCluster(), version: k8s_api_version })).apis.batch[k8s_batch_api]
const batchApi = k8sBatchApi.namespaces(namespace)

const retCodes = {

  200: { code: 200, message: 'Ok.' },
  '200u': { code: 200, message: 'Job updated.' },
  '200d': { code: 200, message: 'Job deleted.' },
  '200a': { code: 200, message: 'All jobs deleted.' },
  201: { code: 201, message: 'Job created.' },
  400: { code: 400, message: 'Invalid request body.' },
  404: { code: 404, message: 'Job not found.' },
  409: { code: 409, message: 'Job with the same name already exists.' },
  500: { code: 500, message: 'Internal error.' }
}

const jobEnvName = 'JOB'

const retryOptions = {
  retries: 3, factor: 1, minTimeout: 500, maxTimeout: 500
}

const lock = new semaphore.Lock()

const retCode500 = msg => ({ code: 500, message: msg })

const IsRecurValid = recur => typeof recur !== 'undefined' &&
    Object.prototype.toString.call(recur.triggers) === '[object Array]' &&
    recur.triggers.length > 0 &&
    recur.triggers[0]

const fixCronExpression = expr => expr.split(' ').slice(0, 5).join(' ')

const jobIds = (jobId) => {
  const len = 48
  const ids = {}

  for (let i = 0, off = 0; off < jobId.length; off += len, i++) {
    ids[`id${i}`] = `Z${jobId.substr(off, len)}Z`
  }

  return ids
}

const isId = id => (new RegExp('^id\\d+$', 'g')).test(id)

const jobName = (labels) => {
  let name = ''

  labelsList = _.map(labels, (value, key) => ({ name: key, value }))

  _.sortBy(_.filter(labelsList, label => isId(label.name)), 'name').forEach((label) => {
    name += label.value.slice(1).slice(0, -1)
  })

  return name
}

const jobLabels = labels => _.omit(labels, (value, key) => isId(key))

const splitLongLabel = (name, value) => {
  if (value.length > 61) { // 63 (max length)  - 2 (for 'Z')
    return _.map(
      _.range(
        Math.ceil(value.length / 61)
      ), idx => [`${name}${idx}`, `Z${value.substring(61 * idx, 61 * idx + 61)}Z`]
    )
  } return [[name, `Z${value}Z`]]
}
const cleanLabel = label => label.replace(/^Z|Z$/g, '')
const sanitizeLabels = labels => _.object(_.flatten(_.map(_.keys(labels), key => splitLongLabel(key, labels[key])), true))
const cleanLabels = labels => _.object(_.map(_.keys(labels), key => [key, cleanLabel(labels[key])]))

const combineLongLabels = (labels) => {
  let processedKeys = []
  return _.object(_.map(_.keys(labels), (key) => {
    if (processedKeys.includes(key)) {
      return []
    }
    if (key.match(/\d+$/)) {
      const realLabelName = /(.*)\d+$/g.exec(key)[1]
      const re = `^${realLabelName}\\d+$`
      const curLabelsGroup = _.pick(labels, (value, key) => (new RegExp(re, 'g')).test(key))
      processedKeys = _.union(processedKeys, _.keys(curLabelsGroup))
      return [realLabelName, _.values(curLabelsGroup).join('')]
    }
    return [key, labels[key]]
  }))
}

const labelSelector = (labels) => {
  let selector = ''

  Object.entries(labels).forEach((label) => {
    if (!_.isEmpty(selector)) { selector += ',' }
    if (isId(label[0])) {
      selector += `${label[0]}=${label[1]}`
    } else {
      _.each(splitLongLabel(label[0], label[1]), (item) => {
        selector += `${item[0]}=${item[1]},`
      })
      selector = selector.slice(0, -1)
    }
  })

  return selector
}

const jobQuerySelector = (reqUrl) => {
  const { query } = url.parse(reqUrl, true)
  return _.isEmpty(query) ? undefined : jobSelector(query)
}

const jobIdSelector = jobId => jobSelector(jobIds(jobId))

const jobSelector = (labels) => {
  const selector = { qs: { labelSelector: labelSelector(labels) } }
  logger.info('job selector: %j', selector)
  return selector
}

const findEnv = (env, name) => _.find(env, item => item.name == name)

const cronJob = (name, reqBody) => {
  const executor = (!_.isEmpty(reqBody.executor) && !_.isEmpty(reqBody.executor.image)) ? reqBody.executor.image : executor_image
  const args = (!_.isEmpty(reqBody.executor) && !_.isEmpty(reqBody.executor.args)) ? reqBody.executor.args : []

  const job = {

    kind: 'CronJob',

    metadata: {

      name: name || uuid(),
      labels: _.extend({}, jobIds(reqBody.name), _.isObject(reqBody.labels) ? sanitizeLabels(reqBody.labels) : {}),
      finalizers: ['foregroundDeletion']
    },

    spec: {

      schedule: reqBody.recur.triggers[0],
      successfulJobsHistoryLimit: 1,
      failedJobsHistoryLimit: 1,

      jobTemplate: {
        spec: {
          template: {
            spec: {
              enableServiceLinks: false,
              containers: [{

                name: 'executor',
                image: executor,
                args,
                imagePullPolicy: 'IfNotPresent',

                env: [{

                  name: jobEnvName,
                  value: JSON.stringify(reqBody)
                }]
              }],

              restartPolicy: 'OnFailure'
            }
          }
        }
      }
    }
  }

  logger.info('cronjob: %j', job)

  return job
}

const doRetry = async func => await retry(

  async () => await func(),

  _.extend({}, retryOptions, {
    onRetry: (err) => {
      logger.error('attempt failed:', err)
    }
  })
)

const doLock = async (func) => {
  await lock.acquire()

  try {
    await func()
  } finally {
    lock.release()
  }
}

const doAddJob = async (reqBody, res) => {
  try {
    const job = await doRetry(async () => await batchApi.cronjobs.post({ body: cronJob(undefined, reqBody) }))

    logger.info('job created: %j', job)
    res.status(201).send(retCodes['201'])
  } catch (err) {
    const msg = 'Failed to create cronjob'

    logger.error(`${msg}:`, err)
    res.status(500).send(retCode500(`${msg}, ${err.message}`))
  }
}

const doUpdateJob = async (name, reqBody, res) => {
  try {
    const job = await doRetry(async () => await batchApi.cronjobs(name).put({ body: cronJob(name, reqBody) }))

    logger.info('job updated: %j', job)
    res.status(200).send(retCodes['200u'])
  } catch (err) {
    const msg = 'Failed to update cronjob'

    logger.error(`${msg}:`, err)
    res.status(500).send(retCode500(`${msg}, ${err.message}`))
  }
}

const prepareJob = async (reqBody, jobId) => {
  if (reqBody.recur.start) { reqBody.recur.start = new Date(reqBody.recur.start) }
  if (reqBody.recur.end) { reqBody.recur.end = new Date(reqBody.recur.end) }

  reqBody.recur.triggers[0] = fixCronExpression(reqBody.recur.triggers[0])

  const jobs = await doRetry(async () => await batchApi.cronjobs.get(jobIdSelector(jobId)))

  logger.info('jobs found: %j', jobs.body.items)

  return jobs.body.items
}

const fillJob = (job) => {
  const jobData = JSON.parse(findEnv(job.spec.jobTemplate.spec.template.spec.containers[0].env, jobEnvName).value)

  const data = {

    name: jobName(job.metadata.labels),
    type: jobData.type,
    labels: combineLongLabels(cleanLabels(jobLabels(job.metadata.labels))),
    request: jobData.request,
    recur: jobData.recur,
    executor: jobData.executor,
    active: !_.isEmpty(job.status.active),
    lastSchedule: job.status.lastScheduleTime
  }

  return data
}

exports.getJob = async (req, res) => {
  try {
    logger.info('getJob: %s', req.params.jobId)

    const jobs = await doRetry(async () => await batchApi.cronjobs.get(jobIdSelector(req.params.jobId)))

    logger.info('getJob, jobs found: %j', jobs)

    const { items } = jobs.body

    if (!_.isEmpty(items)) {
      const data = fillJob(items[0])

      logger.info('getJob result: %j', data)
      res.send(data)
    } else {
      logger.error('getJob: job not found')
      res.status(404).send(retCodes['404'])
    }
  } catch (err) {
    logger.error('getJob error:', err)
    res.status(500).send(retCode500(err.message))
  }
}

exports.getAllJobs = async (req, res) => {
  try {
    logger.info('getAllJobs')

    const jobs = await doRetry(async () => await batchApi.cronjobs.get(jobQuerySelector(req.url)))

    logger.info('getAllJobs, jobs found: %j', jobs)

    const data = []

    jobs.body.items.forEach((job) => {
      data.push(fillJob(job))
    })

    logger.info('getAllJobs result: %j', data)
    res.send(data)
  } catch (err) {
    logger.error('getAllJobs error:', err)
    res.status(500).send(retCode500(err.message))
  }
}

exports.addJob = async (req, res) => {
  logger.info('addJob: %j', req.body)

  if (_.isEmpty(req.body) || !req.body.name || !IsRecurValid(req.body.recur)) {
    logger.error('addJob error: %s', retCodes['400'].message)
    res.status(400).send(retCodes['400'])
  } else {
    try {
      await doLock(async () => {
        const items = await prepareJob(req.body, req.body.name)

        if (!_.isEmpty(items)) {
          logger.error(`addJob, ${retCodes['409'].message}: %j`, items[0])
          res.status(409).send(retCodes['409'])
        } else {
          await doAddJob(req.body, res)
        }
      })
    } catch (err) {
      logger.error('addJob error:', err)
      res.status(500).send(retCode500(err.message))
    }
  }
}

exports.updateJob = async (req, res) => {
  logger.info('updateJob: %j', req.body)

  if (_.isEmpty(req.body) || !req.params.jobId || !IsRecurValid(req.body.recur)) {
    logger.error('updateJob error: %s', retCodes['400'].message)
    res.status(400).send(retCodes['400'])
  } else {
    try {
      await doLock(async () => {
        req.body.name = req.params.jobId
        const items = await prepareJob(req.body, req.params.jobId)

        if (!_.isEmpty(items)) {
          await doUpdateJob(items[0].metadata.name, req.body, res)
        } else {
          await doAddJob(req.body, res)
        }
      })
    } catch (err) {
      logger.error('updateJob error:', err)
      res.status(500).send(retCode500(err.message))
    }
  }
}

exports.deleteJob = async (req, res) => {
  try {
    logger.info('deleteJob: %s', req.params.jobId)

    await doLock(async () => {
      const jobs = await doRetry(async () => await batchApi.cronjobs.get(jobIdSelector(req.params.jobId)))

      const { items } = jobs.body

      if (!_.isEmpty(items)) {
        const ret = await doRetry(async () => await batchApi.cronjobs(items[0].metadata.name).delete())

        logger.info('deleteJob result: %j', ret)
        res.status(200).send(retCodes['200d'])
      } else {
        logger.error('deleteJob: job not found')
        res.status(404).send(retCodes['404'])
      }
    })
  } catch (err) {
    logger.error('deleteJob error:', err)
    res.status(500).send(retCode500(err.message))
  }
}

exports.deleteAllJobs = async (req, res) => {
  try {
    logger.info('deleteAllJobs')

    const ret = await doRetry(async () => await batchApi.cronjobs.delete(jobQuerySelector(req.url)))

    logger.info('deleteAllJobs result: %j', ret)
    res.status(200).send(retCodes['200a'])
  } catch (err) {
    logger.error('deleteAllJobs error:', err)
    res.status(500).send(retCode500(err.message))
  }
}
