const assert=require('node:assert/strict');
const Module=require('node:module');
const test=require('node:test');

test('serverless entrypoint does not import the TensorFlow browser package',()=>{
  const originalResolveFilename=Module._resolveFilename;
  const previousSessionSecret=process.env.SESSION_SECRET;
  const previousVercel=process.env.VERCEL;
  process.env.SESSION_SECRET='serverless-entrypoint-test-secret';
  process.env.VERCEL='1';
  Module._resolveFilename=function(request,...args){
    if(String(request).startsWith('@tensorflow/tfjs')){
      throw new Error(
        'TensorFlow.js must not be imported by the serverless entrypoint.'
      );
    }
    return originalResolveFilename.call(this,request,...args);
  };

  try{
    assert.doesNotThrow(()=>require('../../api/index'));
  }finally{
    Module._resolveFilename=originalResolveFilename;
    if(previousSessionSecret===undefined){
      delete process.env.SESSION_SECRET;
    }else{
      process.env.SESSION_SECRET=previousSessionSecret;
    }
    if(previousVercel===undefined){
      delete process.env.VERCEL;
    }else{
      process.env.VERCEL=previousVercel;
    }
  }
});
