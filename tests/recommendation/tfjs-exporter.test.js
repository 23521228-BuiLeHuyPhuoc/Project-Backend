const assert=require('node:assert/strict');
const test=require('node:test');
const {
  createTfjsModelArtifact,
  defaultKernelWeights,
  featureDefinitions
}=require('../../services/recommendation/tfjs-exporter');

test('TFJS artifact contains a loadable layers-model manifest',()=>{
  const artifact=createTfjsModelArtifact({
    trainedAt:'2026-07-23T00:00:00.000Z'
  });
  const topology=artifact.modelJson.modelTopology.model_config;
  const manifest=artifact.modelJson.weightsManifest[0];

  assert.equal(artifact.modelJson.format,'layers-model');
  assert.equal(topology.class_name,'Sequential');
  assert.deepEqual(
    topology.config.layers[0].config.batch_input_shape,
    [null,featureDefinitions.length]
  );
  assert.equal(topology.config.layers[1].config.units,1);
  assert.deepEqual(manifest.paths,[
    'model/weights.bin'
  ]);
  assert.deepEqual(manifest.weights.map(weight=>weight.shape),[
    [featureDefinitions.length,1],
    [1]
  ]);
  assert.equal(artifact.metadata.trainedAt,'2026-07-23T00:00:00.000Z');
  assert.equal(artifact.metadata.privacy.exportsUserFactors,false);
});

test('binary weights match metadata in little-endian float32 order',()=>{
  const artifact=createTfjsModelArtifact();
  const values=Array.from(
    {length:defaultKernelWeights.length+1},
    (_,index)=>artifact.weights.readFloatLE(index*4)
  );

  assert.equal(artifact.weights.length,(defaultKernelWeights.length+1)*4);
  defaultKernelWeights.forEach((weight,index)=>{
    assert.ok(Math.abs(values[index]-weight)<1e-6);
  });
  assert.equal(values[values.length-1],0);
});

test('custom contextual weights are exported consistently',()=>{
  const kernelWeights=featureDefinitions.map((_,index)=>index/10);
  const artifact=createTfjsModelArtifact({kernelWeights,bias:0.25});

  assert.deepEqual(
    artifact.modelJson.userDefinedMetadata.kernelWeights,
    kernelWeights
  );
  assert.equal(artifact.metadata.bias,0.25);
  assert.ok(Math.abs(
    artifact.weights.readFloatLE(kernelWeights.length*4)-0.25
  )<1e-6);
});
