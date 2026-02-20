const nodemailer=require('nodemailer');
module.exports.sendMail=async(email,subject,content)=>{
    const transporter=nodemailer.createTransport({
        host:'smtp.gmail.com',
        port:587,
        secure:false,
        auth:{
            user:process.env.EMAIL_USERNAME,
            pass:process.env.EMAIL_PASSWORD 
        }
    })
    const mailOptions={
        from:process.env.EMAIL_USERNAME,
        to:email,
        subject:subject,
        html:content
    }
    transporter.sendMail(mailOptions,(error,info)=>{
        if(error){
            console.log(error);
        }else{
            console.log('Email sent: '+info.response);
        }
    })
}