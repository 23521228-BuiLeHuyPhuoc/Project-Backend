const accountRequest=async(url,options={})=>{
  const response=await fetch(url,{
    ...options,
    headers:{
      "Content-Type":"application/json",
      ...(options.headers || {})
    }
  });
  const result=await response.json().catch(()=>({
    code:"error",
    message:"Phản hồi từ máy chủ không hợp lệ!"
  }));

  if(response.status===401 && result.redirect){
    window.location.href=result.redirect;
    return null;
  }
  return result;
};

const showAccountToast=(message,type="success")=>{
  const currentToast=document.querySelector(".account-toast");
  if(currentToast){
    currentToast.remove();
  }

  const toast=document.createElement("div");
  toast.className=`account-toast ${type}`;
  toast.innerHTML=`<i class="fa-solid ${type==="error" ? "fa-circle-exclamation" : "fa-circle-check"}"></i><span></span>`;
  toast.querySelector("span").textContent=message;
  document.body.appendChild(toast);
  window.setTimeout(()=>toast.remove(),3200);
};

const setAccountFormMessage=(form,message,type="error")=>{
  const element=form.querySelector("[data-form-message]");
  if(!element){
    return;
  }
  element.textContent=message;
  element.classList.toggle("success",type==="success");
  element.hidden=false;
};

const featuredVoucher=document.querySelector(".account-voucher-card.is-featured");
if(featuredVoucher){
  window.requestAnimationFrame(()=>{
    featuredVoucher.scrollIntoView({behavior:"smooth",block:"center"});
  });
}

document.querySelectorAll("[data-account-action]").forEach(button=>{
  button.addEventListener("click",async()=>{
    const confirmation=button.dataset.confirm;
    if(confirmation && !window.confirm(confirmation)){
      return;
    }

    button.disabled=true;
    try{
      const result=await accountRequest(button.dataset.accountAction,{
        method:button.dataset.method || "POST"
      });
      if(!result){
        return;
      }
      if(result.code!=="success"){
        showAccountToast(result.message || "Không thể thực hiện thao tác!","error");
        return;
      }

      if(result.message){
        showAccountToast(result.message);
      }
      window.setTimeout(()=>{
        window.location.href=result.redirect || window.location.href;
      },result.message ? 350 : 0);
    }
    catch(error){
      showAccountToast("Không thể kết nối đến máy chủ!","error");
    }
    finally{
      button.disabled=false;
    }
  });
});

document.querySelectorAll("[data-favorite-toggle]").forEach(button=>{
  button.addEventListener("click",async()=>{
    button.disabled=true;
    try{
      const result=await accountRequest(`/account/favorites/${button.dataset.favoriteToggle}/toggle`,{
        method:"POST"
      });
      if(!result){
        return;
      }
      if(result.code!=="success"){
        showAccountToast(result.message || "Không thể cập nhật yêu thích!","error");
        return;
      }

      button.classList.toggle("is-active",result.favorited);
      const icon=button.querySelector("i");
      if(icon){
        icon.className=result.favorited ? "fa-solid fa-heart" : "fa-regular fa-heart";
      }
      showAccountToast(result.message);

      if(!result.favorited && button.closest(".account-favorite-card")){
        window.setTimeout(()=>window.location.reload(),350);
      }
    }
    catch(error){
      showAccountToast("Không thể kết nối đến máy chủ!","error");
    }
    finally{
      button.disabled=false;
    }
  });
});

const accountProfileForm=document.querySelector("#account-profile-form");
if(accountProfileForm){
  accountProfileForm.addEventListener("submit",async event=>{
    event.preventDefault();
    const submitButton=accountProfileForm.querySelector('button[type="submit"]');
    const selectedValues=name=>Array.from(
      accountProfileForm.querySelectorAll(`input[name="${name}"]:checked`)
    ).map(input=>input.value);
    const budget=accountProfileForm.querySelector('input[name="budgetRange"]:checked');
    const data={
      fullName:accountProfileForm.fullName.value,
      phone:accountProfileForm.phone.value,
      email:accountProfileForm.email.value,
      tourTypes:selectedValues("tourTypes"),
      budgetRange:budget ? budget.value : "",
      locations:selectedValues("locations")
    };

    submitButton.disabled=true;
    try{
      const result=await accountRequest("/account/profile",{
        method:"PATCH",
        body:JSON.stringify(data)
      });
      if(!result){
        return;
      }
      if(result.code!=="success"){
        setAccountFormMessage(accountProfileForm,result.message || "Không thể cập nhật thông tin!");
        return;
      }
      showAccountToast(result.message);
      window.setTimeout(()=>window.location.href=result.redirect,400);
    }
    catch(error){
      setAccountFormMessage(accountProfileForm,"Không thể kết nối đến máy chủ!");
    }
    finally{
      submitButton.disabled=false;
    }
  });
}

document.querySelectorAll("[data-review-create]").forEach(form=>{
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const rating=form.querySelector('input[name="rating"]:checked');
    const comment=form.comment.value.trim();
    if(!rating){
      setAccountFormMessage(form,"Vui lòng chọn số sao đánh giá!");
      return;
    }
    if(comment.length<10){
      setAccountFormMessage(form,"Đánh giá cần có ít nhất 10 ký tự!");
      return;
    }

    const button=form.querySelector('button[type="submit"]');
    button.disabled=true;
    try{
      const result=await accountRequest("/account/reviews",{
        method:"POST",
        body:JSON.stringify({
          orderId:form.orderId.value,
          tourId:form.tourId.value,
          rating:Number(rating.value),
          comment
        })
      });
      if(!result || result.code!=="success"){
        setAccountFormMessage(form,result?.message || "Không thể gửi đánh giá!");
        return;
      }
      showAccountToast(result.message);
      window.setTimeout(()=>window.location.href=result.redirect,400);
    }
    catch(error){
      setAccountFormMessage(form,"Không thể kết nối đến máy chủ!");
    }
    finally{
      button.disabled=false;
    }
  });
});

document.querySelectorAll("[data-review-edit]").forEach(form=>{
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const rating=form.querySelector('input[name="rating"]:checked');
    const comment=form.comment.value.trim();
    if(!rating || comment.length<10){
      setAccountFormMessage(form,"Vui lòng chọn số sao và nhập ít nhất 10 ký tự!");
      return;
    }

    const button=form.querySelector('button[type="submit"]');
    button.disabled=true;
    try{
      const result=await accountRequest(`/account/reviews/${form.dataset.reviewEdit}`,{
        method:"PATCH",
        body:JSON.stringify({rating:Number(rating.value),comment})
      });
      if(!result || result.code!=="success"){
        setAccountFormMessage(form,result?.message || "Không thể cập nhật đánh giá!");
        return;
      }
      showAccountToast(result.message);
      window.setTimeout(()=>window.location.reload(),400);
    }
    catch(error){
      setAccountFormMessage(form,"Không thể kết nối đến máy chủ!");
    }
    finally{
      button.disabled=false;
    }
  });
});
