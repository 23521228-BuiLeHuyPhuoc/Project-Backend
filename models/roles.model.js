const mongoose=require("mongoose");
const slug=require('mongoose-slug-updater');
mongoose.plugin(slug);
const schema = new mongoose.Schema(
  {
    name: String,
    description: String,
    permissions: Array,
    createdBy: String,
    updatedBy: String,
    slug:{
            type:String,
            slug:"name",
            unique:true
        },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedBy: String,
    deletedAt: Date
  },
  {
    timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
  }
);
const Role=mongoose.model("Role",schema,"roles");
module.exports=Role;