const contactForm=document.querySelector("[contact-form]");

if(contactForm){
  const submitButton=contactForm.querySelector('button[type="submit"]');
  const submitLabel=submitButton.querySelector("span");
  const messageElement=contactForm.querySelector("[contact-form-message]");

  contactForm.addEventListener("submit",async event=>{
    event.preventDefault();
    messageElement.hidden=true;
    messageElement.className="contact-form-message";

    if(!contactForm.checkValidity()){
      contactForm.reportValidity();
      return;
    }

    submitButton.disabled=true;
    submitLabel.textContent="Đang gửi...";

    try{
      const payload=Object.fromEntries(new FormData(contactForm).entries());
      const response=await fetch("/contact/message",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok || data.code!=="success"){
        throw new Error(data.message || "Không thể gửi liên hệ lúc này.");
      }

      messageElement.textContent=data.message;
      messageElement.classList.add("is-success");
      messageElement.hidden=false;
      contactForm.reset();
    }
    catch(error){
      messageElement.textContent=error.message || "Không thể kết nối tới máy chủ. Vui lòng thử lại!";
      messageElement.classList.add("is-error");
      messageElement.hidden=false;
    }
    finally{
      submitButton.disabled=false;
      submitLabel.textContent="Gửi liên hệ";
    }
  });
}
