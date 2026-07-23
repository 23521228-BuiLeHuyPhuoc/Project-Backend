const Favorite=require('../../models/favorite.model');
const Order=require('../../models/order.model');
const Review=require('../../models/review.model');
const Tour=require('../../models/tour.model');
const User=require('../../models/user.model');
const UserInteraction=require('../../models/user-interaction.model');

const defaultModels={
  Favorite,
  Order,
  Review,
  Tour,
  User,
  UserInteraction
};

const priorities={
  interaction:1,
  favorite:2,
  order:3,
  review:4
};

const interactionWeights={
  view:1,
  click_recommendation:2.5,
  cart_add:3
};

const executeLean=(query,selection='')=>{
  let current=query;
  if(selection && current && typeof current.select==='function'){
    current=current.select(selection);
  }
  return current && typeof current.lean==='function'
    ? current.lean()
    : current;
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

const uniqueSortedIds=records=>[...new Set((records || [])
  .map(record=>getId(record && record._id))
  .filter(Boolean))].sort();

const clampRating=value=>{
  const rating=Number(value);
  return Number.isFinite(rating)
    ? Math.min(5,Math.max(1,rating))
    : 1;
};

const createIndex=ids=>Object.fromEntries(ids.map((id,index)=>[id,index]));

const buildMatrixFromRecords=records=>{
  const userIds=uniqueSortedIds(records.users);
  const tourIds=uniqueSortedIds(records.tours);
  const userIndex=createIndex(userIds);
  const tourIndex=createIndex(tourIds);
  const signals=new Map();
  const processingStats={
    processedSignals:0,
    ignoredSignals:0,
    overriddenSignals:0
  };

  const recordSignal=({userId,tourId,value,priority,source})=>{
    processingStats.processedSignals+=1;
    const userKey=getId(userId);
    const tourKey=getId(tourId);
    const row=userIndex[userKey];
    const column=tourIndex[tourKey];
    const numericValue=Number(value);
    if(row===undefined
      || column===undefined
      || !Number.isFinite(numericValue)
      || numericValue<=0){
      processingStats.ignoredSignals+=1;
      return;
    }

    const key=`${row}:${column}`;
    const existing=signals.get(key);
    const shouldReplace=!existing
      || priority>existing.priority
      || (priority===existing.priority && numericValue>existing.value);
    if(!shouldReplace){
      processingStats.ignoredSignals+=1;
      return;
    }
    if(existing){
      processingStats.overriddenSignals+=1;
    }
    signals.set(key,{
      row,
      column,
      value:numericValue,
      priority,
      source
    });
  };

  (records.interactions || []).forEach(interaction=>{
    const weight=interactionWeights[interaction.type];
    recordSignal({
      userId:interaction.userId,
      tourId:interaction.tourId,
      value:weight,
      priority:priorities.interaction,
      source:`interaction:${interaction.type}`
    });
  });

  (records.favorites || []).forEach(favorite=>{
    recordSignal({
      userId:favorite.userId,
      tourId:favorite.tourId,
      value:2,
      priority:priorities.favorite,
      source:'favorite'
    });
  });

  (records.orders || []).forEach(order=>{
    (Array.isArray(order.items) ? order.items : []).forEach(item=>{
      recordSignal({
        userId:order.userId,
        tourId:item && item.tourId,
        value:5,
        priority:priorities.order,
        source:'order'
      });
    });
  });

  (records.reviews || []).forEach(review=>{
    recordSignal({
      userId:review.userId,
      tourId:review.tourId,
      value:clampRating(review.rating),
      priority:priorities.review,
      source:'review'
    });
  });

  const rows=Array.from({length:userIds.length},()=>[]);
  signals.forEach(signal=>{
    rows[signal.row].push(signal);
  });
  rows.forEach(row=>row.sort((first,second)=>first.column-second.column));

  const rowPointers=[0];
  const columnIndices=[];
  const values=[];
  const sources=[];
  const sourceCounts={};
  const toursWithSignals=new Set();
  let usersWithSignals=0;

  rows.forEach(row=>{
    if(row.length){
      usersWithSignals+=1;
    }
    row.forEach(signal=>{
      columnIndices.push(signal.column);
      values.push(signal.value);
      sources.push(signal.source);
      toursWithSignals.add(signal.column);
      sourceCounts[signal.source]=(sourceCounts[signal.source] || 0)+1;
    });
    rowPointers.push(columnIndices.length);
  });

  const totalCells=userIds.length*tourIds.length;
  const nonZero=values.length;
  const density=totalCells>0 ? nonZero/totalCells : 0;

  return {
    version:1,
    format:'csr',
    generatedAt:new Date().toISOString(),
    shape:[userIds.length,tourIds.length],
    userIds,
    tourIds,
    userIndex,
    tourIndex,
    matrix:{
      rowPointers,
      columnIndices,
      values,
      sources
    },
    stats:{
      ...processingStats,
      totalCells,
      nonZero,
      density,
      sparsity:totalCells>0 ? 1-density : 1,
      usersWithSignals,
      toursWithSignals:toursWithSignals.size,
      sourceCounts
    }
  };
};

const getMatrixValue=(matrixData,userId,tourId)=>{
  const row=matrixData.userIndex[getId(userId)];
  const column=matrixData.tourIndex[getId(tourId)];
  if(row===undefined || column===undefined){
    return 0;
  }

  const {rowPointers,columnIndices,values}=matrixData.matrix;
  let start=rowPointers[row];
  let end=rowPointers[row+1]-1;
  while(start<=end){
    const middle=Math.floor((start+end)/2);
    const currentColumn=columnIndices[middle];
    if(currentColumn===column){
      return values[middle];
    }
    if(currentColumn<column){
      start=middle+1;
    }
    else{
      end=middle-1;
    }
  }
  return 0;
};

const getUserSparseVector=(matrixData,userId)=>{
  const row=matrixData.userIndex[getId(userId)];
  if(row===undefined){
    return [];
  }
  const {rowPointers,columnIndices,values,sources}=matrixData.matrix;
  const entries=[];
  for(let index=rowPointers[row];index<rowPointers[row+1];index+=1){
    const column=columnIndices[index];
    entries.push({
      tourId:matrixData.tourIds[column],
      tourIndex:column,
      value:values[index],
      source:sources[index]
    });
  }
  return entries;
};

const toDenseMatrix=matrixData=>{
  const [userCount,tourCount]=matrixData.shape;
  const dense=Array.from({length:userCount},()=>Array(tourCount).fill(0));
  const {rowPointers,columnIndices,values}=matrixData.matrix;
  for(let row=0;row<userCount;row+=1){
    for(let index=rowPointers[row];index<rowPointers[row+1];index+=1){
      dense[row][columnIndices[index]]=values[index];
    }
  }
  return dense;
};

class MatrixBuilder{
  constructor(options={}){
    this.models={...defaultModels,...(options.models || {})};
  }

  async build(){
    const [users,tours,reviews,orders,favorites,interactions]=await Promise.all([
      executeLean(this.models.User.find({
        status:'active',
        deleted:false
      }),'_id'),
      executeLean(this.models.Tour.find({deleted:false}),'_id'),
      executeLean(this.models.Review.find({deleted:false}),
        'userId tourId rating'),
      executeLean(this.models.Order.find({
        userId:{$ne:null},
        status:'completed',
        deleted:false
      }),'userId items.tourId'),
      executeLean(this.models.Favorite.find({}),'userId tourId'),
      executeLean(this.models.UserInteraction.find({
        userId:{$ne:null},
        tourId:{$ne:null},
        type:{$in:Object.keys(interactionWeights)}
      }),'userId tourId type')
    ]);

    return buildMatrixFromRecords({
      users,
      tours,
      reviews,
      orders,
      favorites,
      interactions
    });
  }
}

module.exports={
  MatrixBuilder,
  buildMatrixFromRecords,
  getMatrixValue,
  getUserSparseVector,
  toDenseMatrix
};
