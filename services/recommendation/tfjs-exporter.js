const MODEL_VERSION=1;

const featureDefinitions=[
  {
    name:'baseScore',
    description:'Normalized score produced by the server Hybrid Engine.'
  },
  {
    name:'sessionAffinity',
    description:'Affinity with tour types viewed during the current session.'
  },
  {
    name:'outdoorMorning',
    description:'Outdoor tour boost during morning hours.'
  },
  {
    name:'cityEvening',
    description:'City tour boost during evening hours.'
  },
  {
    name:'shortMobile',
    description:'Short tour boost on mobile devices.'
  },
  {
    name:'longDesktop',
    description:'Long tour boost on desktop devices.'
  },
  {
    name:'popularityScore',
    description:'Normalized server popularity component.'
  },
  {
    name:'ratingScore',
    description:'Tour average rating normalized to the range zero to one.'
  }
];

const defaultKernelWeights=[0.72,0.22,0.1,0.1,0.08,0.04,0.08,0.05];
const defaultBias=0;

const createWeightsBuffer=(kernelWeights,bias)=>{
  const values=[...kernelWeights,bias];
  const buffer=Buffer.alloc(values.length*4);
  values.forEach((value,index)=>{
    buffer.writeFloatLE(value,index*4);
  });
  return buffer;
};

const createModelJson=({weightsPath,kernelWeights,bias})=>({
  format:'layers-model',
  generatedBy:'project1-contextual-recommender',
  convertedBy:null,
  modelTopology:{
    keras_version:'2.15.0',
    backend:'tensorflow',
    model_config:{
      class_name:'Sequential',
      config:{
        name:'contextual_recommender',
        layers:[
          {
            class_name:'InputLayer',
            config:{
              batch_input_shape:[null,featureDefinitions.length],
              dtype:'float32',
              sparse:false,
              ragged:false,
              name:'context_input'
            }
          },
          {
            class_name:'Dense',
            config:{
              name:'context_score',
              trainable:false,
              dtype:'float32',
              units:1,
              activation:'linear',
              use_bias:true,
              kernel_initializer:{class_name:'Zeros',config:{}},
              bias_initializer:{class_name:'Zeros',config:{}},
              kernel_regularizer:null,
              bias_regularizer:null,
              activity_regularizer:null,
              kernel_constraint:null,
              bias_constraint:null
            }
          }
        ]
      }
    },
    training_config:null
  },
  weightsManifest:[
    {
      paths:[weightsPath],
      weights:[
        {
          name:'context_score/kernel',
          shape:[featureDefinitions.length,1],
          dtype:'float32'
        },
        {
          name:'context_score/bias',
          shape:[1],
          dtype:'float32'
        }
      ]
    }
  ],
  userDefinedMetadata:{
    modelVersion:MODEL_VERSION,
    featureNames:featureDefinitions.map(feature=>feature.name),
    kernelWeights,
    bias
  }
});

const createTfjsModelArtifact=(options={})=>{
  const kernelWeights=Array.isArray(options.kernelWeights)
    && options.kernelWeights.length===featureDefinitions.length
    && options.kernelWeights.every(Number.isFinite)
    ? [...options.kernelWeights]
    : [...defaultKernelWeights];
  const bias=Number.isFinite(options.bias) ? options.bias : defaultBias;
  const weightsPath=options.weightsPath || 'model/weights.bin';
  const weightsEndpoint=options.weightsEndpoint
    || '/api/recommendation/model/weights.bin';
  return {
    modelJson:createModelJson({weightsPath,kernelWeights,bias}),
    weights:createWeightsBuffer(kernelWeights,bias),
    metadata:{
      version:MODEL_VERSION,
      format:'layers-model',
      trainedAt:options.trainedAt || null,
      featureDefinitions:featureDefinitions.map(feature=>({...feature})),
      featureNames:featureDefinitions.map(feature=>feature.name),
      kernelWeights,
      bias,
      normalization:{
        inputRange:[0,1],
        outputRange:[0,1],
        outputClamp:true
      },
      contextRules:{
        morningHours:[5,12],
        eveningHours:[18,24],
        shortTourMaximumDays:3,
        longTourMinimumDays:5,
        sessionAffinityThreshold:3
      },
      endpoints:{
        model:'/api/recommendation/model',
        weights:weightsEndpoint,
        metadata:'/api/recommendation/metadata'
      },
      privacy:{
        exportsUserFactors:false,
        exportsTourFactors:false,
        description:'Only generic contextual re-ranking weights are public.'
      }
    }
  };
};

module.exports={
  createTfjsModelArtifact,
  defaultKernelWeights,
  featureDefinitions
};
