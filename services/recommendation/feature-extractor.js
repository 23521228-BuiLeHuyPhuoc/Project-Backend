const seasons=['spring','summer','autumn','winter'];
const monthFormatter=new Intl.DateTimeFormat('en-US',{
  timeZone:'Asia/Ho_Chi_Minh',
  month:'numeric'
});

const clamp=(value,minimum=0,maximum=1)=>Math.min(
  maximum,
  Math.max(minimum,value)
);

const toFiniteNumber=value=>{
  const number=Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeText=value=>String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/đ/g,'d')
  .replace(/Đ/g,'D')
  .trim()
  .toLowerCase()
  .replace(/\s+/g,' ');

const getEntityKey=value=>{
  if(value===null || value===undefined){
    return '';
  }
  if(typeof value.toHexString==='function'){
    return normalizeText(value.toHexString());
  }
  if(Buffer.isBuffer(value)){
    return value.toString('hex');
  }
  if(typeof value==='object'){
    return getEntityKey(value._id || value.id || '');
  }
  return normalizeText(value);
};

const parseDuration=value=>{
  const text=normalizeText(value);
  if(!text){
    return 0;
  }

  const numberPattern='(\\d+(?:[.,]\\d+)?)';
  const daysMatch=text.match(new RegExp(
    `${numberPattern}\\s*(?:ngay|days?|n(?!ight))`,
    'i'
  ));
  const nightsMatch=text.match(new RegExp(
    `${numberPattern}\\s*(?:dem|nights?|d)`,
    'i'
  ));
  const hoursMatch=text.match(new RegExp(
    `${numberPattern}\\s*(?:gio|hours?|hrs?|h)`,
    'i'
  ));
  const parseMatch=match=>match
    ? Number(String(match[1]).replace(',','.'))
    : 0;
  const days=parseMatch(daysMatch);
  const nights=parseMatch(nightsMatch);
  const hours=parseMatch(hoursMatch);

  if(days>0){
    return days;
  }
  if(hours>0){
    return hours/24;
  }
  if(nights>0){
    return nights+1;
  }

  const fallback=text.match(/\d+(?:[.,]\d+)?/);
  return fallback ? Number(fallback[0].replace(',','.')) : 0;
};

const getDepartureSeason=value=>{
  if(!value){
    return '';
  }
  const date=value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime())){
    return '';
  }
  const month=Number(monthFormatter.format(date));
  if(month>=3 && month<=5){
    return 'spring';
  }
  if(month>=6 && month<=8){
    return 'summer';
  }
  if(month>=9 && month<=11){
    return 'autumn';
  }
  return 'winter';
};

const getTourPrice=tour=>{
  const salePrice=toFiniteNumber(tour && tour.priceNewAdult);
  if(salePrice!==null && salePrice>=0){
    return salePrice;
  }
  const regularPrice=toFiniteNumber(tour && tour.priceAdult);
  return regularPrice!==null && regularPrice>=0 ? regularPrice : 0;
};

const normalizeRange=(value,range)=>{
  if(!Number.isFinite(value) || range.maximum<=range.minimum){
    return 0;
  }
  return clamp((value-range.minimum)/(range.maximum-range.minimum));
};

const getRange=values=>{
  const validValues=values.filter(value=>Number.isFinite(value) && value>=0);
  if(!validValues.length){
    return {minimum:0,maximum:0};
  }
  return {
    minimum:Math.min(...validValues),
    maximum:Math.max(...validValues)
  };
};

const uniqueSorted=values=>[...new Set(values.filter(Boolean))].sort();

const cosineSimilarity=(firstVector,secondVector)=>{
  if(!Array.isArray(firstVector) || !Array.isArray(secondVector)){
    throw new TypeError('Cosine similarity expects two arrays.');
  }
  if(firstVector.length!==secondVector.length){
    throw new RangeError('Feature vectors must have the same length.');
  }

  let dotProduct=0;
  let firstMagnitude=0;
  let secondMagnitude=0;
  for(let index=0;index<firstVector.length;index+=1){
    const first=Number(firstVector[index]) || 0;
    const second=Number(secondVector[index]) || 0;
    dotProduct+=first*second;
    firstMagnitude+=first*first;
    secondMagnitude+=second*second;
  }
  if(firstMagnitude===0 || secondMagnitude===0){
    return 0;
  }
  return dotProduct/(Math.sqrt(firstMagnitude)*Math.sqrt(secondMagnitude));
};

class FeatureExtractor{
  constructor(){
    this.fitted=false;
    this.categories=[];
    this.locations=[];
    this.vehicles=[];
    this.priceRange={minimum:0,maximum:0};
    this.durationRange={minimum:0,maximum:0};
    this.maximumRatingCount=0;
    this.featureNames=[];
  }

  fit(tours){
    if(!Array.isArray(tours)){
      throw new TypeError('FeatureExtractor.fit expects an array of tours.');
    }

    this.categories=uniqueSorted(tours.map(tour=>getEntityKey(tour.category)));
    this.locations=uniqueSorted(tours.flatMap(tour=>
      Array.isArray(tour.locations)
        ? tour.locations.map(getEntityKey)
        : []
    ));
    this.vehicles=uniqueSorted(tours.map(tour=>normalizeText(tour.vehicle)));
    this.priceRange=getRange(tours.map(getTourPrice));
    this.durationRange=getRange(tours.map(tour=>parseDuration(tour.time)));
    this.maximumRatingCount=Math.max(
      0,
      ...tours.map(tour=>Math.max(0,toFiniteNumber(tour.ratingCount) || 0))
    );

    // This order is the contract shared by every downstream recommender.
    this.featureNames=[
      ...this.categories.map(category=>`category:${category}`),
      'price:normalized',
      ...this.locations.map(location=>`location:${location}`),
      'duration:normalized',
      ...this.vehicles.map(vehicle=>`vehicle:${vehicle}`),
      ...seasons.map(season=>`season:${season}`),
      'ratingAvg:normalized',
      'ratingCount:logNormalized'
    ];
    this.fitted=true;
    return this;
  }

  transform(tour){
    if(!this.fitted){
      throw new Error('FeatureExtractor must be fitted before transform.');
    }

    const category=getEntityKey(tour && tour.category);
    const locationSet=new Set(
      Array.isArray(tour && tour.locations)
        ? tour.locations.map(getEntityKey).filter(Boolean)
        : []
    );
    const vehicle=normalizeText(tour && tour.vehicle);
    const season=getDepartureSeason(tour && tour.departureDate);
    const ratingAvg=toFiniteNumber(tour && tour.ratingAvg) || 0;
    const ratingCount=Math.max(
      0,
      toFiniteNumber(tour && tour.ratingCount) || 0
    );
    const normalizedRatingCount=this.maximumRatingCount>0
      ? clamp(
        Math.log1p(ratingCount)/Math.log1p(this.maximumRatingCount)
      )
      : 0;

    return [
      ...this.categories.map(item=>item===category ? 1 : 0),
      normalizeRange(getTourPrice(tour),this.priceRange),
      ...this.locations.map(item=>locationSet.has(item) ? 1 : 0),
      normalizeRange(parseDuration(tour && tour.time),this.durationRange),
      ...this.vehicles.map(item=>item===vehicle ? 1 : 0),
      ...seasons.map(item=>item===season ? 1 : 0),
      clamp(ratingAvg/5),
      normalizedRatingCount
    ];
  }

  fitTransform(tours){
    this.fit(tours);
    return tours.map(tour=>this.transform(tour));
  }

  getMetadata(){
    if(!this.fitted){
      throw new Error('FeatureExtractor must be fitted before reading metadata.');
    }
    return {
      version:1,
      dimensions:this.featureNames.length,
      featureNames:[...this.featureNames],
      vocabularies:{
        categories:[...this.categories],
        locations:[...this.locations],
        vehicles:[...this.vehicles],
        seasons:[...seasons]
      },
      normalization:{
        price:{...this.priceRange},
        duration:{...this.durationRange},
        ratingAvg:{minimum:0,maximum:5},
        ratingCount:{maximum:this.maximumRatingCount,method:'log1p'}
      }
    };
  }
}

module.exports={
  FeatureExtractor,
  cosineSimilarity,
  getDepartureSeason,
  getTourPrice,
  normalizeText,
  parseDuration
};
