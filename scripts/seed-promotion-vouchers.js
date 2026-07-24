require('dotenv').config();
const mongoose=require('mongoose');
const database=require('../config/database');
const Voucher=require('../models/voucher.model');
const {getPromotionVoucherSeeds}=require('../data/promotion-vouchers.data');

const seedPromotionVouchers=async()=>{
  const vouchers=getPromotionVoucherSeeds();

  if(process.argv.includes('--dry-run')){
    console.log(JSON.stringify(vouchers,null,2));
    return;
  }

  await database.connect();
  const results=await Promise.all(vouchers.map(voucher=>Voucher.updateOne(
    {code:voucher.code,deleted:false},
    {
      $set:{...voucher,updatedBy:'seed:promotion-vouchers'},
      $setOnInsert:{usedCount:0,createdBy:'seed:promotion-vouchers'}
    },
    {upsert:true}
  )));

  const inserted=results.reduce((total,result)=>total+Number(result.upsertedCount || 0),0);
  const updated=results.reduce((total,result)=>total+Number(result.modifiedCount || 0),0);
  console.log(`Seeded ${vouchers.length} promotion vouchers (${inserted} inserted, ${updated} updated).`);
};

seedPromotionVouchers()
  .catch(error=>{
    console.error('Unable to seed promotion vouchers:',error.message);
    process.exitCode=1;
  })
  .finally(async()=>{
    await mongoose.disconnect();
  });
