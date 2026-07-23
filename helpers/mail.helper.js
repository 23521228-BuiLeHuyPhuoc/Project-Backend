const nodemailer=require('nodemailer');
module.exports.sendMail=async(email,subject,content)=>{
    const transporter=nodemailer.createTransport({
        host:'smtp.gmail.com',
        port:587,
        secure:process.env.EMAIL_SECURE =='true'?true :false,
        connectionTimeout:10000,
        greetingTimeout:10000,
        socketTimeout:20000,
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
    try{
        const info=await transporter.sendMail(mailOptions);
        console.log('Email sent: '+info.response);
        return {success:true,info};
    }
    catch(error){
        console.error('Email send failed: '+error.message);
        return {success:false,error};
    }
}
