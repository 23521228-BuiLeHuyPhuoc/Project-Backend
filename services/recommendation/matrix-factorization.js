const MODEL_VERSION=1;
const EPSILON=1e-12;

const defaultOptions={
  algorithm:'als',
  factors:10,
  iterations:20,
  regularization:0.1,
  confidenceAlpha:0,
  tolerance:1e-4,
  seed:42,
  clampPredictions:true,
  svdPowerIterations:100,
  svdTolerance:1e-8
};

const getId=value=>{
  if(value===null || value===undefined){
    return '';
  }
  if(typeof value.toHexString==='function'){
    return value.toHexString();
  }
  if(Buffer.isBuffer(value)){
    return value.toString('hex');
  }
  if(typeof value==='object'){
    return getId(value._id || value.id || '');
  }
  return String(value);
};

const normalizeInteger=(value,fallback,minimum=1)=>{
  const number=Number.parseInt(value,10);
  return Number.isInteger(number) && number>=minimum ? number : fallback;
};

const normalizeNumber=(value,fallback,minimum=0)=>{
  const number=Number(value);
  return Number.isFinite(number) && number>=minimum ? number : fallback;
};

const normalizeOptions=options=>{
  const algorithm=String(options.algorithm || defaultOptions.algorithm)
    .toLowerCase();
  if(!['als','svd'].includes(algorithm)){
    throw new RangeError('algorithm must be either "als" or "svd".');
  }
  return {
    algorithm,
    factors:normalizeInteger(options.factors,defaultOptions.factors),
    iterations:normalizeInteger(options.iterations,defaultOptions.iterations),
    regularization:normalizeNumber(
      options.regularization,
      defaultOptions.regularization,
      EPSILON
    ),
    confidenceAlpha:normalizeNumber(
      options.confidenceAlpha,
      defaultOptions.confidenceAlpha
    ),
    tolerance:normalizeNumber(options.tolerance,defaultOptions.tolerance),
    seed:normalizeInteger(options.seed,defaultOptions.seed,0),
    clampPredictions:options.clampPredictions===undefined
      ? defaultOptions.clampPredictions
      : Boolean(options.clampPredictions),
    svdPowerIterations:normalizeInteger(
      options.svdPowerIterations,
      defaultOptions.svdPowerIterations
    ),
    svdTolerance:normalizeNumber(
      options.svdTolerance,
      defaultOptions.svdTolerance
    )
  };
};

const validateMatrixData=matrixData=>{
  if(!matrixData || !Array.isArray(matrixData.shape)
    || matrixData.shape.length!==2){
    throw new TypeError('matrixData.shape must contain user and tour counts.');
  }
  const [userCount,tourCount]=matrixData.shape;
  if(!Number.isInteger(userCount) || userCount<0
    || !Number.isInteger(tourCount) || tourCount<0){
    throw new RangeError('Matrix dimensions must be non-negative integers.');
  }
  if(!Array.isArray(matrixData.userIds)
    || matrixData.userIds.length!==userCount
    || !Array.isArray(matrixData.tourIds)
    || matrixData.tourIds.length!==tourCount){
    throw new RangeError('Matrix IDs must match matrix dimensions.');
  }

  const matrix=matrixData.matrix || {};
  const {rowPointers,columnIndices,values}=matrix;
  if(!Array.isArray(rowPointers)
    || rowPointers.length!==userCount+1
    || !Array.isArray(columnIndices)
    || !Array.isArray(values)
    || columnIndices.length!==values.length){
    throw new TypeError('matrixData.matrix must be a valid CSR matrix.');
  }
  if(rowPointers[0]!==0 || rowPointers[userCount]!==values.length){
    throw new RangeError('CSR row pointers do not match stored values.');
  }
  for(let row=0;row<userCount;row+=1){
    if(!Number.isInteger(rowPointers[row])
      || rowPointers[row]<0
      || rowPointers[row]>rowPointers[row+1]){
      throw new RangeError('CSR row pointers must be ordered integers.');
    }
  }
  columnIndices.forEach((column,index)=>{
    if(!Number.isInteger(column) || column<0 || column>=tourCount){
      throw new RangeError(`Invalid tour column at value index ${index}.`);
    }
    if(!Number.isFinite(Number(values[index]))){
      throw new TypeError(`Invalid matrix value at index ${index}.`);
    }
  });
};

const createRandom=seed=>{
  let state=seed>>>0;
  return ()=>{
    state+=0x6D2B79F5;
    let value=state;
    value=Math.imul(value^(value>>>15),value|1);
    value^=value+Math.imul(value^(value>>>7),value|61);
    return ((value^(value>>>14))>>>0)/4294967296;
  };
};

const createFactorMatrix=(rows,columns,random,scale=0.1)=>
  Array.from({length:rows},()=>
    Array.from({length:columns},()=>(random()-0.5)*2*scale));

const dot=(first,second)=>{
  let total=0;
  for(let index=0;index<first.length;index+=1){
    total+=first[index]*second[index];
  }
  return total;
};

const vectorNorm=vector=>Math.sqrt(dot(vector,vector));

const normalizeVector=vector=>{
  const norm=vectorNorm(vector);
  return norm>EPSILON
    ? vector.map(value=>value/norm)
    : null;
};

const solveLinearSystem=(matrix,values)=>{
  const size=values.length;
  if(matrix.length!==size || matrix.some(row=>row.length!==size)){
    throw new RangeError('Linear system dimensions do not match.');
  }
  const coefficients=matrix.map((row,index)=>[
    ...row,
    values[index]
  ]);

  for(let column=0;column<size;column+=1){
    let pivotRow=column;
    for(let row=column+1;row<size;row+=1){
      if(Math.abs(coefficients[row][column])
        >Math.abs(coefficients[pivotRow][column])){
        pivotRow=row;
      }
    }
    if(Math.abs(coefficients[pivotRow][column])<EPSILON){
      return Array(size).fill(0);
    }
    if(pivotRow!==column){
      [coefficients[column],coefficients[pivotRow]]=[
        coefficients[pivotRow],
        coefficients[column]
      ];
    }

    const pivot=coefficients[column][column];
    for(let row=column+1;row<size;row+=1){
      const multiplier=coefficients[row][column]/pivot;
      if(Math.abs(multiplier)<EPSILON){
        continue;
      }
      for(let current=column;current<=size;current+=1){
        coefficients[row][current]-=
          multiplier*coefficients[column][current];
      }
    }
  }

  const solution=Array(size).fill(0);
  for(let row=size-1;row>=0;row-=1){
    let remainder=coefficients[row][size];
    for(let column=row+1;column<size;column+=1){
      remainder-=coefficients[row][column]*solution[column];
    }
    solution[row]=remainder/coefficients[row][row];
  }
  return solution;
};

const buildSparseEntries=matrixData=>{
  const [userCount,tourCount]=matrixData.shape;
  const byUser=Array.from({length:userCount},()=>[]);
  const byTour=Array.from({length:tourCount},()=>[]);
  const observed=[];
  const {rowPointers,columnIndices,values}=matrixData.matrix;

  for(let user=0;user<userCount;user+=1){
    for(let index=rowPointers[user];index<rowPointers[user+1];index+=1){
      const tour=columnIndices[index];
      const value=Number(values[index]);
      const entry={user,tour,value};
      byUser[user].push(entry);
      byTour[tour].push(entry);
      observed.push(entry);
    }
  }
  return {byUser,byTour,observed};
};

const solveFactor=(entries,otherFactors,options,getOtherIndex)=>{
  const factors=options.factors;
  if(!entries.length){
    return Array(factors).fill(0);
  }
  const coefficients=Array.from({length:factors},()=>
    Array(factors).fill(0));
  const values=Array(factors).fill(0);
  const regularization=options.regularization*entries.length;

  for(let factor=0;factor<factors;factor+=1){
    coefficients[factor][factor]=regularization;
  }
  entries.forEach(entry=>{
    const other=otherFactors[getOtherIndex(entry)];
    const confidence=1+options.confidenceAlpha*Math.abs(entry.value);
    for(let row=0;row<factors;row+=1){
      values[row]+=confidence*entry.value*other[row];
      for(let column=0;column<factors;column+=1){
        coefficients[row][column]+=
          confidence*other[row]*other[column];
      }
    }
  });
  return solveLinearSystem(coefficients,values);
};

const calculateObservedRmse=(entries,userFactors,tourFactors)=>{
  if(!entries.length){
    return 0;
  }
  const squaredError=entries.reduce((total,entry)=>{
    const prediction=dot(
      userFactors[entry.user],
      tourFactors[entry.tour]
    );
    const difference=entry.value-prediction;
    return total+difference*difference;
  },0);
  return Math.sqrt(squaredError/entries.length);
};

const trainALS=(matrixData,rawOptions={})=>{
  validateMatrixData(matrixData);
  const options=normalizeOptions({...rawOptions,algorithm:'als'});
  const [userCount,tourCount]=matrixData.shape;
  const random=createRandom(options.seed);
  let userFactors=createFactorMatrix(
    userCount,
    options.factors,
    random
  );
  let tourFactors=createFactorMatrix(
    tourCount,
    options.factors,
    random
  );
  const entries=buildSparseEntries(matrixData);
  const history=[];
  let previousRmse=Infinity;

  for(let iteration=1;iteration<=options.iterations;iteration+=1){
    userFactors=entries.byUser.map(userEntries=>solveFactor(
      userEntries,
      tourFactors,
      options,
      entry=>entry.tour
    ));
    tourFactors=entries.byTour.map(tourEntries=>solveFactor(
      tourEntries,
      userFactors,
      options,
      entry=>entry.user
    ));
    const rmse=calculateObservedRmse(
      entries.observed,
      userFactors,
      tourFactors
    );
    if(!Number.isFinite(rmse)){
      throw new Error('ALS training produced a non-finite error.');
    }
    history.push({iteration,rmse});
    if(Math.abs(previousRmse-rmse)<=options.tolerance){
      break;
    }
    previousRmse=rmse;
  }

  return {
    algorithm:'als',
    userFactors,
    tourFactors,
    history,
    rmse:history.length ? history[history.length-1].rmse : 0,
    iterationsRun:history.length
  };
};

const createDenseMatrix=matrixData=>{
  const [userCount,tourCount]=matrixData.shape;
  const dense=Array.from({length:userCount},()=>Array(tourCount).fill(0));
  const {rowPointers,columnIndices,values}=matrixData.matrix;
  for(let user=0;user<userCount;user+=1){
    for(let index=rowPointers[user];index<rowPointers[user+1];index+=1){
      dense[user][columnIndices[index]]=Number(values[index]);
    }
  }
  return dense;
};

const multiplyMatrixVector=(matrix,vector)=>matrix.map(row=>dot(row,vector));

const multiplyTransposeVector=(matrix,vector)=>{
  const columns=matrix.length ? matrix[0].length : 0;
  const result=Array(columns).fill(0);
  matrix.forEach((row,rowIndex)=>{
    for(let column=0;column<columns;column+=1){
      result[column]+=row[column]*vector[rowIndex];
    }
  });
  return result;
};

const trainSVD=(matrixData,rawOptions={})=>{
  validateMatrixData(matrixData);
  const options=normalizeOptions({...rawOptions,algorithm:'svd'});
  const [userCount,tourCount]=matrixData.shape;
  const maximumFactors=Math.min(options.factors,userCount,tourCount);
  const random=createRandom(options.seed);
  const residual=createDenseMatrix(matrixData);
  const userFactors=Array.from({length:userCount},()=>[]);
  const tourFactors=Array.from({length:tourCount},()=>[]);
  const singularValues=[];

  for(let factor=0;factor<maximumFactors;factor+=1){
    let right=normalizeVector(
      Array.from({length:tourCount},()=>random()-0.5)
    );
    if(!right){
      break;
    }

    for(let iteration=0;
      iteration<options.svdPowerIterations;
      iteration+=1){
      const left=normalizeVector(multiplyMatrixVector(residual,right));
      if(!left){
        right=null;
        break;
      }
      const nextRight=normalizeVector(
        multiplyTransposeVector(residual,left)
      );
      if(!nextRight){
        right=null;
        break;
      }
      const alignment=Math.abs(dot(right,nextRight));
      right=nextRight;
      if(1-alignment<=options.svdTolerance){
        break;
      }
    }
    if(!right){
      break;
    }

    const projected=multiplyMatrixVector(residual,right);
    const singularValue=vectorNorm(projected);
    if(singularValue<=EPSILON){
      break;
    }
    const left=projected.map(value=>value/singularValue);
    const factorScale=Math.sqrt(singularValue);
    userFactors.forEach((row,user)=>{
      row.push(left[user]*factorScale);
    });
    tourFactors.forEach((row,tour)=>{
      row.push(right[tour]*factorScale);
    });
    singularValues.push(singularValue);

    for(let user=0;user<userCount;user+=1){
      for(let tour=0;tour<tourCount;tour+=1){
        residual[user][tour]-=
          singularValue*left[user]*right[tour];
      }
    }
  }

  const entries=buildSparseEntries(matrixData).observed;
  const rmse=calculateObservedRmse(entries,userFactors,tourFactors);
  return {
    algorithm:'svd',
    userFactors,
    tourFactors,
    singularValues,
    history:[{iteration:1,rmse}],
    rmse,
    iterationsRun:1
  };
};

const cloneFactorMatrix=(matrix,expectedRows,name)=>{
  if(!Array.isArray(matrix) || matrix.length!==expectedRows){
    throw new RangeError(`${name} row count does not match model IDs.`);
  }
  const factors=matrix.length ? matrix[0].length : 0;
  if(matrix.some(row=>!Array.isArray(row)
    || row.length!==factors
    || row.some(value=>!Number.isFinite(value)))){
    throw new TypeError(`${name} must contain finite rectangular vectors.`);
  }
  return matrix.map(row=>[...row]);
};

class MatrixFactorization{
  constructor(options={}){
    this.options=normalizeOptions(options);
    this.algorithm=this.options.algorithm;
    this.trained=false;
    this.userIds=[];
    this.tourIds=[];
    this.userIndex={};
    this.tourIndex={};
    this.userFactors=[];
    this.tourFactors=[];
    this.trainingHistory=[];
    this.stats=null;
    this.maxValue=0;
    this.trainedAt=null;
  }

  fit(matrixData){
    validateMatrixData(matrixData);
    const result=this.algorithm==='svd'
      ? trainSVD(matrixData,this.options)
      : trainALS(matrixData,this.options);
    this.userIds=matrixData.userIds.map(getId);
    this.tourIds=matrixData.tourIds.map(getId);
    this.userIndex=Object.fromEntries(
      this.userIds.map((id,index)=>[id,index])
    );
    this.tourIndex=Object.fromEntries(
      this.tourIds.map((id,index)=>[id,index])
    );
    this.userFactors=result.userFactors;
    this.tourFactors=result.tourFactors;
    this.trainingHistory=result.history;
    this.maxValue=matrixData.matrix.values.reduce(
      (maximum,value)=>Math.max(maximum,Number(value) || 0),
      0
    );
    this.trainedAt=new Date().toISOString();
    this.stats={
      algorithm:result.algorithm,
      shape:[...matrixData.shape],
      factors:this.userFactors.length
        ? this.userFactors[0].length
        : this.tourFactors.length
          ? this.tourFactors[0].length
          : 0,
      observations:matrixData.matrix.values.length,
      iterationsRun:result.iterationsRun,
      rmse:result.rmse,
      singularValues:result.singularValues || null
    };
    this.trained=true;
    return this;
  }

  train(matrixData){
    return this.fit(matrixData);
  }

  ensureTrained(){
    if(!this.trained){
      throw new Error('Matrix factorization model has not been trained.');
    }
  }

  rawPredictByIndex(userIndex,tourIndex){
    this.ensureTrained();
    if(!Number.isInteger(userIndex)
      || userIndex<0
      || userIndex>=this.userFactors.length
      || !Number.isInteger(tourIndex)
      || tourIndex<0
      || tourIndex>=this.tourFactors.length){
      return null;
    }
    return dot(this.userFactors[userIndex],this.tourFactors[tourIndex]);
  }

  predictByIndex(userIndex,tourIndex,options={}){
    const prediction=this.rawPredictByIndex(userIndex,tourIndex);
    if(prediction===null){
      return null;
    }
    const shouldClamp=options.clamp===undefined
      ? this.options.clampPredictions
      : Boolean(options.clamp);
    if(!shouldClamp){
      return prediction;
    }
    return Math.min(this.maxValue,Math.max(0,prediction));
  }

  predict(userId,tourId,options={}){
    this.ensureTrained();
    const userIndex=this.userIndex[getId(userId)];
    const tourIndex=this.tourIndex[getId(tourId)];
    if(userIndex===undefined || tourIndex===undefined){
      return null;
    }
    return this.predictByIndex(userIndex,tourIndex,options);
  }

  predictForUser(userId,options={}){
    this.ensureTrained();
    const userIndex=this.userIndex[getId(userId)];
    if(userIndex===undefined){
      return [];
    }
    const limit=normalizeInteger(options.limit,this.tourIds.length);
    const results=this.tourIds.map((tourId,tourIndex)=>({
      tourId,
      tourIndex,
      score:this.predictByIndex(userIndex,tourIndex,options)
    }));
    if(options.sort!==false){
      results.sort((first,second)=>
        second.score-first.score
        || first.tourId.localeCompare(second.tourId));
    }
    return results.slice(0,Math.min(limit,results.length));
  }

  getMetadata(){
    return {
      trained:this.trained,
      trainedAt:this.trainedAt,
      options:{...this.options},
      stats:this.stats ? {...this.stats} : null
    };
  }

  toJSON(){
    this.ensureTrained();
    return {
      version:MODEL_VERSION,
      algorithm:this.algorithm,
      options:{...this.options},
      trainedAt:this.trainedAt,
      maxValue:this.maxValue,
      userIds:[...this.userIds],
      tourIds:[...this.tourIds],
      userFactors:this.userFactors.map(row=>[...row]),
      tourFactors:this.tourFactors.map(row=>[...row]),
      trainingHistory:this.trainingHistory.map(entry=>({...entry})),
      stats:this.stats ? {...this.stats} : null
    };
  }

  static fromJSON(value){
    const data=typeof value==='string' ? JSON.parse(value) : value;
    if(!data || data.version!==MODEL_VERSION
      || !Array.isArray(data.userIds)
      || !Array.isArray(data.tourIds)){
      throw new TypeError('Invalid matrix factorization model data.');
    }
    const model=new MatrixFactorization({
      ...(data.options || {}),
      algorithm:data.algorithm
    });
    model.userIds=data.userIds.map(getId);
    model.tourIds=data.tourIds.map(getId);
    model.userFactors=cloneFactorMatrix(
      data.userFactors,
      model.userIds.length,
      'userFactors'
    );
    model.tourFactors=cloneFactorMatrix(
      data.tourFactors,
      model.tourIds.length,
      'tourFactors'
    );
    const userFactorCount=model.userFactors.length
      ? model.userFactors[0].length
      : null;
    const tourFactorCount=model.tourFactors.length
      ? model.tourFactors[0].length
      : null;
    if(userFactorCount!==null && tourFactorCount!==null
      && userFactorCount!==tourFactorCount){
      throw new RangeError('User and tour factor dimensions do not match.');
    }
    model.userIndex=Object.fromEntries(
      model.userIds.map((id,index)=>[id,index])
    );
    model.tourIndex=Object.fromEntries(
      model.tourIds.map((id,index)=>[id,index])
    );
    model.maxValue=normalizeNumber(data.maxValue,0);
    model.trainedAt=data.trainedAt || null;
    model.trainingHistory=Array.isArray(data.trainingHistory)
      ? data.trainingHistory.map(entry=>({...entry}))
      : [];
    model.stats=data.stats ? {...data.stats} : null;
    model.trained=true;
    return model;
  }
}

const compareFactorizationAlgorithms=(matrixData,options={})=>{
  const als=new MatrixFactorization({...options,algorithm:'als'})
    .fit(matrixData);
  const svd=new MatrixFactorization({...options,algorithm:'svd'})
    .fit(matrixData);
  return {
    als,
    svd,
    metrics:{
      als:als.getMetadata().stats,
      svd:svd.getMetadata().stats
    }
  };
};

module.exports={
  MatrixFactorization,
  calculateObservedRmse,
  compareFactorizationAlgorithms,
  solveLinearSystem,
  trainALS,
  trainSVD,
  validateMatrixData
};
