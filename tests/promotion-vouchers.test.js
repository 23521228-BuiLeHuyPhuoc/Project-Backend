const test=require('node:test');
const assert=require('node:assert/strict');
const {
  getPromotionBanners,
  getPromotionVoucherSeeds
}=require('../data/promotion-vouchers.data');

test('promotion banners map one-to-one to seeded vouchers',()=>{
  const banners=getPromotionBanners();
  const vouchers=getPromotionVoucherSeeds();
  const bannerCodes=banners.map(item=>item.code);
  const voucherCodes=vouchers.map(item=>item.code);

  assert.equal(banners.length,4);
  assert.deepEqual(bannerCodes,voucherCodes);
  assert.equal(new Set(bannerCodes).size,bannerCodes.length);
  assert.equal(new Set(banners.map(item=>item.image)).size,banners.length);

  for(const banner of banners){
    assert.match(banner.href,new RegExp(`code=${banner.code}`));
    assert.match(banner.href,new RegExp(`#voucher-${banner.code}$`));
    assert.ok(banner.alt);
    assert.ok(banner.discountLabel);
  }
});

test('promotion voucher seeds have valid discount conditions',()=>{
  for(const voucher of getPromotionVoucherSeeds()){
    assert.equal(voucher.status,'active');
    assert.equal(voucher.deleted,false);
    assert.ok(voucher.startAt instanceof Date);
    assert.ok(voucher.endAt instanceof Date);
    assert.ok(voucher.startAt<voucher.endAt);
    assert.ok(voucher.discountValue>0);
    assert.ok(voucher.minOrderValue>0);
    assert.ok(voucher.usageLimit>0);

    if(voucher.discountType==='percent'){
      assert.ok(voucher.discountValue<=100);
      assert.ok(voucher.maxDiscount>0);
    }
    else{
      assert.equal(voucher.discountType,'fixed');
      assert.equal(voucher.maxDiscount,0);
      assert.ok(voucher.discountValue<voucher.minOrderValue);
    }
  }
});
