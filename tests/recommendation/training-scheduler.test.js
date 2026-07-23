const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const test=require('node:test');
const {MatrixFactorization}=require(
  '../../services/recommendation/matrix-factorization'
);
const {
  RecommendationTrainingScheduler,
  calculateModelMetrics
}=require('../../services/recommendation/training-scheduler');

const matrixData={
  version:1,
  format:'csr',
  generatedAt:'2026-07-23T00:00:00.000Z',
  shape:[2,2],
  userIds:['user-1','user-2'],
  tourIds:['tour-1','tour-2'],
  userIndex:{'user-1':0,'user-2':1},
  tourIndex:{'tour-1':0,'tour-2':1},
  matrix:{
    rowPointers:[0,2,4],
    columnIndices:[0,1,0,1],
    values:[5,1,4,1],
    sources:['review','view','review','view']
  },
  stats:{nonZero:4}
};

const createFactorization=()=>new MatrixFactorization({
  algorithm:'als',
  factors:2,
  iterations:60,
  regularization:0.001,
  tolerance:1e-8,
  seed:7
}).fit(matrixData);

const silentLogger={
  info(){},
  warn(){},
  error(){}
};

const createFakeEngine=(factorization=createFactorization())=>{
  let trainCount=0;
  let restoreCount=0;
  return {
    collaborative:{matrixData,factorization},
    async train(){
      trainCount+=1;
      return this;
    },
    async restore(restoredMatrix,restoredFactorization){
      restoreCount+=1;
      this.collaborative={
        matrixData:restoredMatrix,
        factorization:restoredFactorization
      };
      return this;
    },
    getTrainCount:()=>trainCount,
    getRestoreCount:()=>restoreCount
  };
};

test('training metrics include RMSE, MAE, and Precision@K',()=>{
  const metrics=calculateModelMetrics(
    matrixData,
    createFactorization(),
    {precisionK:1}
  );

  assert.ok(metrics.rmse<0.01);
  assert.ok(metrics.mae<0.01);
  assert.equal(metrics.precisionAtK,1);
  assert.equal(metrics.precisionK,1);
  assert.equal(metrics.observations,4);
  assert.equal(metrics.usersEvaluated,2);
});

test('saved model restores without retraining at startup',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'recommender-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const modelPath=path.join(directory,'model.json');
  const now=()=>new Date('2026-07-23T00:00:00.000Z');
  const firstEngine=createFakeEngine();
  const firstScheduler=new RecommendationTrainingScheduler({
    engine:firstEngine,
    models:{
      UserInteraction:{countDocuments:()=>Promise.resolve(12)}
    },
    modelPath,
    now,
    precisionK:1,
    logger:silentLogger
  });
  await firstScheduler.train('test');
  const artifact=JSON.parse(await fs.readFile(modelPath,'utf8'));

  assert.equal(artifact.version,1);
  assert.equal(artifact.lastInteractionCount,12);
  assert.equal(artifact.lastReason,'test');
  assert.ok(Number.isFinite(artifact.metrics.rmse));

  let timerCleared=false;
  const secondEngine=createFakeEngine();
  const secondScheduler=new RecommendationTrainingScheduler({
    engine:secondEngine,
    models:{
      UserInteraction:{countDocuments:()=>Promise.resolve(12)}
    },
    modelPath,
    now,
    intervalMs:60*60*1000,
    logger:silentLogger,
    setInterval:()=>({unref(){}}),
    clearInterval:()=>{
      timerCleared=true;
    }
  });
  await Promise.all([secondScheduler.start(),secondScheduler.start()]);

  assert.equal(secondEngine.getRestoreCount(),1);
  assert.equal(secondEngine.getTrainCount(),0);
  assert.equal(secondScheduler.getStatus().running,true);
  assert.equal(
    secondEngine.collaborative.factorization.predict('user-1','tour-1'),
    firstEngine.collaborative.factorization.predict('user-1','tour-1')
  );
  secondScheduler.stop();
  assert.equal(timerCleared,true);
});

test('new interaction threshold triggers one locked retraining',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'recommender-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  let interactionCount=2;
  const engine=createFakeEngine();
  const scheduler=new RecommendationTrainingScheduler({
    engine,
    models:{
      UserInteraction:{
        countDocuments:()=>Promise.resolve(interactionCount)
      }
    },
    modelPath:path.join(directory,'model.json'),
    now:()=>new Date('2026-07-23T00:00:00.000Z'),
    interactionThreshold:5,
    precisionK:1,
    logger:silentLogger
  });
  await scheduler.train('initial');
  interactionCount=7;
  const reasons=await Promise.all([
    scheduler.checkForRetraining(),
    scheduler.checkForRetraining()
  ]);

  assert.deepEqual(reasons,[
    'interaction_threshold',
    'interaction_threshold'
  ]);
  assert.equal(engine.getTrainCount(),2);
  assert.equal(scheduler.getStatus().lastInteractionCount,7);
  assert.equal(scheduler.getStatus().lastReason,'interaction_threshold');
});

test('stale models trigger scheduled retraining',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'recommender-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  let currentTime=new Date('2026-07-23T00:00:00.000Z');
  const engine=createFakeEngine();
  const scheduler=new RecommendationTrainingScheduler({
    engine,
    models:{
      UserInteraction:{countDocuments:()=>Promise.resolve(1)}
    },
    modelPath:path.join(directory,'model.json'),
    now:()=>currentTime,
    intervalMs:1000,
    interactionThreshold:100,
    precisionK:1,
    logger:silentLogger
  });
  await scheduler.train('initial');
  currentTime=new Date('2026-07-23T00:00:02.000Z');

  assert.equal(await scheduler.checkForRetraining(),'scheduled_interval');
  assert.equal(engine.getTrainCount(),2);
  assert.equal(scheduler.getStatus().lastReason,'scheduled_interval');
});
