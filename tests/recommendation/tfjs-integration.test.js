const assert=require('node:assert/strict');
const http=require('node:http');
const test=require('node:test');
const tf=require('@tensorflow/tfjs');
const {
  TourRecommendationEngine
}=require('../../public/assets/js/recommendation-engine');
const {
  createTfjsModelArtifact,
  featureDefinitions
}=require('../../services/recommendation/tfjs-exporter');

const listen=server=>new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{
    server.off('error',reject);
    resolve(server.address());
  });
});

const close=server=>new Promise((resolve,reject)=>{
  server.close(error=>error ? reject(error) : resolve());
});

test('client loads the exported model and runs TensorFlow.js inference',async t=>{
  const kernelWeights=featureDefinitions.map((_,index)=>
    index===0 ? 0.5 : index===1 ? 0.25 : 0
  );
  const artifact=createTfjsModelArtifact({kernelWeights,bias:0.1});
  const requests=[];
  const server=http.createServer((req,res)=>{
    requests.push(req.url);
    if(req.url==='/api/recommendation/model'){
      res.setHeader('Content-Type','application/json');
      return res.end(JSON.stringify(artifact.modelJson));
    }
    if(req.url==='/api/recommendation/model/weights.bin'){
      res.setHeader('Content-Type','application/octet-stream');
      return res.end(artifact.weights);
    }
    if(req.url==='/api/recommendation/metadata'){
      res.setHeader('Content-Type','application/json');
      return res.end(JSON.stringify(artifact.metadata));
    }
    res.statusCode=404;
    return res.end();
  });
  const address=await listen(server);
  t.after(async()=>{
    await close(server);
  });
  const baseUrl=`http://127.0.0.1:${address.port}/api/recommendation`;
  const engine=new TourRecommendationEngine({
    tf,
    fetch:globalThis.fetch,
    storage:null,
    modelUrl:`${baseUrl}/model`,
    metadataUrl:`${baseUrl}/metadata`
  });

  await engine.load();
  t.after(()=>{
    if(engine.model){
      engine.model.dispose();
    }
  });
  const scores=await engine.predictVectors([
    [1,0,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,0]
  ]);
  const status=engine.getRuntimeStatus();

  assert.ok(Math.abs(scores[0]-0.6)<1e-6);
  assert.ok(Math.abs(scores[1]-0.35)<1e-6);
  assert.equal(status.mode,'tensorflow');
  assert.equal(status.tensorflowAvailable,true);
  assert.equal(status.modelLoaded,true);
  assert.ok(status.backend);
  assert.deepEqual(requests,[
    '/api/recommendation/metadata',
    '/api/recommendation/model',
    '/api/recommendation/model/weights.bin'
  ]);
});

test('client reports JavaScript fallback when TensorFlow is unavailable',async()=>{
  const engine=new TourRecommendationEngine({
    tf:null,
    fetch:null,
    storage:null
  });

  await engine.load();

  assert.deepEqual(engine.getRuntimeStatus(),{
    mode:'javascript-fallback',
    tensorflowAvailable:false,
    modelLoaded:false,
    backend:null,
    error:'TensorFlow.js runtime is unavailable.'
  });
});
