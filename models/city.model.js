const mongoose=require("mongoose");
const city=new mongoose.Schema({
    name: String
})
const cityModel=mongoose.model("City",city,"cities");
module.exports=cityModel;