const CAMPAIGN_START_AT='2026-06-01T00:00:00.000Z';
const CAMPAIGN_END_AT='2027-05-31T23:59:59.999Z';

const promotionVoucherCampaigns=[
  {
    code:'NAMDU100K',
    image:'/assets/images/banner-1.png',
    alt:'Tour đảo Nam Du - Rạch Giá và Phú Quốc',
    discountLabel:'Giảm 100.000đ',
    voucher:{
      title:'Ưu đãi tour đảo Nam Du',
      description:'Giảm trực tiếp 100.000đ cho đơn tour từ 1.000.000đ.',
      discountType:'fixed',
      discountValue:100000,
      minOrderValue:1000000,
      maxDiscount:0,
      usageLimit:500
    }
  },
  {
    code:'BACAU8',
    image:'/assets/images/banner-2.png',
    alt:'Khám phá Bắc Âu mùa hè',
    discountLabel:'Giảm 8%',
    voucher:{
      title:'Ưu đãi hành trình Bắc Âu',
      description:'Giảm 8% tối đa 2.000.000đ cho đơn tour từ 20.000.000đ.',
      discountType:'percent',
      discountValue:8,
      minOrderValue:20000000,
      maxDiscount:2000000,
      usageLimit:250
    }
  },
  {
    code:'TAYAU10',
    image:'/assets/images/banner-3.png',
    alt:'Hành trình thanh xuân khám phá Tây Âu',
    discountLabel:'Giảm 10%',
    voucher:{
      title:'Ưu đãi hành trình Tây Âu',
      description:'Giảm 10% tối đa 4.000.000đ cho đơn tour từ 30.000.000đ.',
      discountType:'percent',
      discountValue:10,
      minOrderValue:30000000,
      maxDiscount:4000000,
      usageLimit:200
    }
  },
  {
    code:'VIETNAM300K',
    image:'/assets/images/banner-8.png',
    alt:'Du lịch Việt Nam mùa hè',
    discountLabel:'Giảm 300.000đ',
    voucher:{
      title:'Ưu đãi tour trong nước',
      description:'Giảm trực tiếp 300.000đ cho đơn tour trong nước từ 5.000.000đ.',
      discountType:'fixed',
      discountValue:300000,
      minOrderValue:5000000,
      maxDiscount:0,
      usageLimit:500
    }
  }
];

const getPromotionBanners=()=>promotionVoucherCampaigns.map(campaign=>({
  code:campaign.code,
  image:campaign.image,
  alt:campaign.alt,
  discountLabel:campaign.discountLabel,
  href:`/account/vouchers?code=${encodeURIComponent(campaign.code)}#voucher-${encodeURIComponent(campaign.code)}`
}));

const getPromotionVoucherSeeds=()=>promotionVoucherCampaigns.map(campaign=>({
  code:campaign.code,
  ...campaign.voucher,
  startAt:new Date(CAMPAIGN_START_AT),
  endAt:new Date(CAMPAIGN_END_AT),
  status:'active',
  deleted:false
}));

module.exports={
  getPromotionBanners,
  getPromotionVoucherSeeds,
  promotionVoucherCampaigns
};
