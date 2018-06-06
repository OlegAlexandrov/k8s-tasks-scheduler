//
// Unit tests of Rest API locks
//

const k8scli = require( "kubernetes-client" );
const assert = require( "assert" );
const sinon = require( "sinon" );


const apiModName =  "./../../src/rest-api.js";

let cronjobs = {};

const stubApi = () => { return cronjobs; }

const batchApiDefault = {

  apis: {
    batch: {
      v1beta1: {

        namespaces: ( namespace ) => { return { cronjobs: stubApi() } }
      }
    }
  }
}

const cronEveryMinute = "0/1 * * * *";

const addJobReq = {

  body: {

    name: "job-1",
    recur: { triggers: [ cronEveryMinute ] }
  }
}

let getInCluster, kubeClient;


const requireApiMod = ( apiStub ) => {

  kubeClient = sinon.stub( k8scli, "Client" ).returns( apiStub );
  return require( apiModName );
}

const testBatchApi = ( name ) => {

  const get = sinon.stub().returns( { namespaces: () => {} } );
  const batchApi = { apis: { batch: {} } };
  batchApi.apis.batch[ name ] = {};
  sinon.stub( batchApi.apis.batch, name ).get( get );

  requireApiMod( batchApi );

  assert.ok( get.called );
}

const testApiVersion = ( version ) => {

  requireApiMod( batchApiDefault );

  assert.equal( kubeClient.getCall( 0 ).args[ 0 ].version, version );
}

const testNamespace = ( name ) => {

  const namespaces = sinon.stub();
  const batchApi = { apis: { batch: { v1beta1: { namespaces: namespaces } } } };

  requireApiMod( batchApi );

  assert.equal( namespaces.getCall( 0 ).args[ 0 ], name );
}

const testExecutor = async ( name ) => {

  const res = { status: ( code ) => { return { send: sinon.stub() } } };

  const get = sinon.stub().onCall( 0 ).returns( { body: { items: [] } } );
  const post = sinon.stub().onCall( 0 ).returns( { done: "ok" } );

  cronjobs = { get: get, post: post };

  const api = requireApiMod( batchApiDefault );

  await api.addJob.action( addJobReq, res );

  assert.equal( post.getCall( 0 ).args[ 0 ].body.spec.jobTemplate.spec.template.spec.containers[ 0 ].image, name );
}

describe( "API env", () => {

  before( () => {

    getInCluster = sinon.stub( k8scli.config, "getInCluster" ).returns( {} );
  });

  after( () => {

    getInCluster.restore();
  });

  beforeEach( () => {

    delete process.env[ "NAMESPACE" ];
    delete process.env[ "EXECUTOR_IMAGE" ];
    delete process.env[ "K8S_API_VERSION" ];
    delete process.env[ "K8S_BATCH_API" ];

    delete require.cache[ require.resolve( apiModName ) ];
  });

  afterEach( () => {

    kubeClient.restore();
  });

  it( "api version default", () => {

    testApiVersion( "1.8" );
  });

  it( "api version custom", () => {

    const apiVersion = "CustomApiVersion";
    process.env[ "K8S_API_VERSION" ] = apiVersion;

    testApiVersion( apiVersion );
  });

  it( "batch api default", () => {

    testBatchApi( "v1beta1" );
  });

  it( "batch api custom", () => {

    const apiName = "CustomApiName";
    process.env[ "K8S_BATCH_API" ] = apiName;

    testBatchApi( apiName );
  });

  it( "namespace default", () => {

    testNamespace( "default" );
  });

  it( "namespace custom", () => {

    const namaspaceName = "CustomNamespace";
    process.env[ "NAMESPACE" ] = namaspaceName;

    testNamespace( namaspaceName );
  });

  it( "executor image default", async () => {

    await testExecutor( "busybox" );
  });

  it( "executor image custom", async () => {

    const executorName = "CustomExecutor";
    process.env[ "EXECUTOR_IMAGE" ] = executorName;

    await testExecutor( executorName );
  });
});
