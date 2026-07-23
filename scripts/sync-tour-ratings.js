require('dotenv').config();
const mongoose=require('mongoose');
const database=require('../config/database');
const {rebuildTourRatings}=require('../helpers/tour-rating.helper');

const run=async()=>{
  try{
    await database.connect();
    const result=await rebuildTourRatings();
    console.log(`Synchronized ratings for ${result.toursUpdated} tours.`);
  }
  catch(error){
    console.error('Unable to synchronize tour ratings:',error.message);
    process.exitCode=1;
  }
  finally{
    await mongoose.disconnect();
  }
};

run();
