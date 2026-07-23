const Notification=require('../models/notification.model');

const createNotificationSafe=async payload=>{
  try{
    return await Notification.create(payload);
  }
  catch(error){
    console.error('Create notification error:',error.message);
    return null;
  }
};

module.exports={createNotificationSafe};
