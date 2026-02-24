const cloudinary=require('cloudinary').v2;
require('dotenv').config();
const{CloudinaryStorage}=require('multer-storage-cloudinary');
cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.API_SECRET_KEY// Click 'View API Keys' above to copy your API secret
    });
module.exports.storage=new CloudinaryStorage({
    cloudinary:cloudinary,
});