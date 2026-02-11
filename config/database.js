const mongoose=require('mongoose');
module.exports.connect=async()=>{

try{ 
    await  mongoose.connect(process.env.DATABASE)
    console.log("Database connected successfully");
}
catch(error){
    console.log(error);
}

}
