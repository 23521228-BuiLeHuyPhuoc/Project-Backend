// Menu Mobile
const buttonMenuMobile = document.querySelector(".header .inner-menu-mobile");
if(buttonMenuMobile) {
  const menu = document.querySelector(".header .inner-menu");

  // Click vào button mở menu
  buttonMenuMobile.addEventListener("click", () => {
    menu.classList.add("active");
  });

  // Click vào overlay đóng menu
  const overlay = menu.querySelector(".inner-overlay");
  if(overlay) {
    overlay.addEventListener("click", () => {
      menu.classList.remove("active");
    });
  }

  // Click vào icon down mở sub menu
  const listButtonSubMenu = menu.querySelectorAll("ul > li > i");
  listButtonSubMenu.forEach(button => {
    button.addEventListener("click", () => {
      button.parentNode.classList.toggle("active");
    })
  });
}
// End Menu Mobile

// Box Address Section 1
const boxAddressSection1 = document.querySelector(".section-1 .inner-form .inner-box.inner-address");
if(boxAddressSection1) {
  // Ẩn/hiện box suggest
  const input = boxAddressSection1.querySelector(".inner-input");

  input.addEventListener("focus", () => {
    boxAddressSection1.classList.add("active");
  })

  input.addEventListener("blur", () => {
    boxAddressSection1.classList.remove("active");
  })

  // Sự kiện click vào từng item
  const listItem = boxAddressSection1.querySelectorAll(".inner-suggest-list .inner-item");
  listItem.forEach(item => {
    item.addEventListener("mousedown", () => {
      const title = item.querySelector(".inner-item-title").innerHTML.trim();
      if(title) {
        input.value = title;
      }
    })
  })
}
// End Box Address Section 1

// Box User Section 1
const boxUserSection1 = document.querySelector(".section-1 .inner-form .inner-box.inner-user");
if(boxUserSection1) {
  // Hiện box quantity
  const input = boxUserSection1.querySelector(".inner-input");

  input.addEventListener("focus", () => {
    boxUserSection1.classList.add("active");
  })

  // Ẩn box quantity
  document.addEventListener("click", (event) => {
    // Kiểm tra nếu click không nằm trong khối `.inner-box.inner-user`
    if (!boxUserSection1.contains(event.target)) {
      boxUserSection1.classList.remove("active");
    }
  });

  // Thêm số lượng vào ô input
  const updateQuantityInput = () => {
    const listBoxNumber = boxUserSection1.querySelectorAll(".inner-count .inner-number");
    const listNumber = [];
    listBoxNumber.forEach(boxNumber => {
      const number = parseInt(boxNumber.innerHTML.trim());
      listNumber.push(number);
    })
    const value = `NL: ${listNumber[0]}, TE: ${listNumber[1]}, EB: ${listNumber[2]}`;
    input.value = value;
  }

  // Bắt sự kiện click nút up
  const listButtonUp = boxUserSection1.querySelectorAll(".inner-count .inner-up");
  listButtonUp.forEach(button => {
    button.addEventListener("click", () => {
      const parent = button.parentNode;
      const boxNumber = parent.querySelector(".inner-number");
      const number = parseInt(boxNumber.innerHTML.trim());
      const numberUpdate = number + 1;
      boxNumber.innerHTML = numberUpdate;
      updateQuantityInput();
    })
  })

  // Bắt sự kiện click nút down
  const listButtonDown = boxUserSection1.querySelectorAll(".inner-count .inner-down");
  listButtonDown.forEach(button => {
    button.addEventListener("click", () => {
      const parent = button.parentNode;
      const boxNumber = parent.querySelector(".inner-number");
      const number = parseInt(boxNumber.innerHTML.trim());
      if(number > 0) {
        const numberUpdate = number - 1;
        boxNumber.innerHTML = numberUpdate;
        updateQuantityInput();
      }
    })
  })
}
// End Box User Section 1

// Clock Expire
const clockExpire = document.querySelector("[clock-expire]");
if(clockExpire) {
  const expireDateTimeString = clockExpire.getAttribute("clock-expire");

  // Chuyển đổi chuỗi thời gian thành đối tượng Date
  const expireDateTime = new Date(expireDateTimeString);

  // Hàm cập nhật đồng hồ
  const updateClock = () => {
    const now = new Date();
    const remainingTime = expireDateTime - now; // quy về đơn vị mili giây
    
    if (remainingTime > 0) {
      const days = Math.floor(remainingTime / (24 * 60 * 60 * 1000));
      // Tính số ngày, 24 * 60 * 60 * 1000 Tích của các số này = số mili giây trong 1 ngày

      const hours = Math.floor((remainingTime / (60 * 60 * 1000)) % 24);
      // Tính số giờ, 60 * 60 * 1000 Chia remainingTime cho giá trị này để nhận được tổng số giờ.
      // % 24 Lấy phần dư khi chia tổng số giờ cho 24 để chỉ lấy số giờ còn lại trong ngày.

      const minutes = Math.floor((remainingTime / (60 * 1000)) % 60);
      // Tính số phút, 60 * 1000 Chia remainingTime cho giá trị này để nhận được tổng số phút.
      // % 60 Lấy phần dư khi chia tổng số phút cho 60 để chỉ lấy số phút còn lại trong giờ.

      const seconds = Math.floor((remainingTime / 1000) % 60);
      // Tính số giây, 1000 Chia remainingTime cho giá trị này để nhận được tổng số giây.
      // % 60 Lấy phần dư khi chia tổng số giây cho 60 để chỉ lấy số giây còn lại trong phút.

      // Cập nhật giá trị vào thẻ span
      const listBoxNumber = clockExpire.querySelectorAll('.inner-number');
      listBoxNumber[0].innerHTML = `${days}`.padStart(2, '0');
      listBoxNumber[1].innerHTML = `${hours}`.padStart(2, '0');
      listBoxNumber[2].innerHTML = `${minutes}`.padStart(2, '0');
      listBoxNumber[3].innerHTML = `${seconds}`.padStart(2, '0');
    } else {
      // Khi hết thời gian, dừng đồng hồ
      clearInterval(intervalClock);
    }
  }

  // Gọi hàm cập nhật đồng hồ mỗi giây
  const intervalClock = setInterval(updateClock, 1000);
}
// End Clock Expire

// Box Filter
const buttonFilterMobile = document.querySelector(".section-9 .inner-filter-mobile");
if(buttonFilterMobile) {
  const boxLeft = document.querySelector(".section-9 .inner-left");
  buttonFilterMobile.addEventListener("click", () => {
    boxLeft.classList.add("active");
  })

  const overlay = document.querySelector(".section-9 .inner-left .inner-overlay");
  overlay.addEventListener("click", () => {
    boxLeft.classList.remove("active");
  })
}
// End Box Filter

// Box Tour Info
const boxTourInfo = document.querySelector(".box-tour-info");
if(boxTourInfo) {
  const buttonReadMore = boxTourInfo.querySelector(".inner-read-more button");
  buttonReadMore.addEventListener("click", () => {
    boxTourInfo.classList.add("active");
  })

  new Viewer(boxTourInfo);
}
// End Box Tour Info

// Khởi tạo AOS
AOS.init();
// Hết Khởi tạo AOS

// Swiper Section 2
const swiperSection2 = document.querySelector(".swiper-section-2");
if(swiperSection2) {
  new Swiper('.swiper-section-2', {
    slidesPerView: 1,
    spaceBetween: 20,
    autoplay: {
      delay: 4000,
    },
    loop: true,
    breakpoints: {
      992: {
        slidesPerView: 2,
      },
      1200: {
        slidesPerView: 3,
      },
    },
  });
}
// End Swiper Section 2

// Swiper Section 3
const swiperSection3 = document.querySelector(".swiper-section-3");
if(swiperSection3) {
  new Swiper('.swiper-section-3', {
    slidesPerView: 1,
    spaceBetween: 20,
    autoplay: {
      delay: 4000,
    },
    loop: true,
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
    breakpoints: {
      576: {
        slidesPerView: 2,
      },
      992: {
        slidesPerView: 3,
      },
    },
  });
}
// End Swiper Section 3

// Swiper Box Images
const boxImages = document.querySelector(".box-images");
if(boxImages) {
  const swiperBoxImagesThumb = new Swiper(".swiper-box-images-thumb", {
    spaceBetween: 5,
    slidesPerView: 4,
    breakpoints: {
      576: {
        spaceBetween: 10,
      },
    },
  });

  const swiperBoxImagesMain = new Swiper(".swiper-box-images-main", {
    spaceBetween: 0,
    thumbs: {
      swiper: swiperBoxImagesThumb,
    },
  });
}
// End Swiper Box Images

// Zoom Box Images Main
const boxImagesMain = document.querySelector(".box-images .inner-images-main");
if(boxImagesMain) {
  new Viewer(boxImagesMain);
}
// End Zoom Box Images Main

// Box Tour Schedule
const boxTourSchedule = document.querySelector(".box-tour-schedule");
if(boxTourSchedule) {
  new Viewer(boxTourSchedule);
}
// End Box Tour Schedule

// Email Form
const emailForm = document.querySelector("#email-form");
if(emailForm) {
  const validation = new JustValidate('#email-form');

  validation
    .addField('#email-input', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập email của bạn!',
      },
      {
        rule: 'email',
        errorMessage: 'Email không đúng định dạng!',
      },
    ])
    .onSuccess((event) => {
      const email = event.target.email.value;
      fetch(`/contact/create`,{
        method:"POST",
         headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        email:email
      })
      }).then(res=>res.json())
      .then(data=>{
        if(data.code=="success")
        {
          window.location.reload();
        }
        if(data.code=="error")
        {
          alert(data.message);
        }
      })
      







    })
  ;
}
// End Email Form

// Coupon Form
const couponForm = document.querySelector("#coupon-form");
if(couponForm) {
  const validation = new JustValidate('#coupon-form');

  validation
    .onSuccess((event) => {
      const coupon = event.target.coupon.value;
      console.log(coupon);
    })
  ;
}
// End Email Form

// Order Form
const orderForm = document.querySelector("#order-form");
if(orderForm) {
  const validation = new JustValidate('#order-form');

  validation
    .addField('#full-name-input', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập họ tên!'
      },
      {
        rule: 'minLength',
        value: 5,
        errorMessage: 'Họ tên phải có ít nhất 5 ký tự!',
      },
      {
        rule: 'maxLength',
        value: 50,
        errorMessage: 'Họ tên không được vượt quá 50 ký tự!',
      },
    ])
    .addField('#phone-input', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập số điện thoại!'
      },
      {
        rule: 'customRegexp',
        value: /(84|0[3|5|7|8|9])+([0-9]{8})\b/g,
        errorMessage: 'Số điện thoại không đúng định dạng!'
      },
    ])
    .onSuccess(async(event) => {
      const fullName = event.target.fullName.value;
      const phone = event.target.phone.value;
      const note = event.target.note.value;
      const method = event.target.method.value;
      const submitButton=event.target.querySelector('button[type="submit"]');
      submitButton.disabled=true;

      try{
        const response=await fetch(`/order/create`,{
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body:JSON.stringify({
            fullName,
            phone,
            note,
            paymentMethod:method
          })
        });
        const data=await response.json();
        if(response.status===401 && data.redirect){
          window.location.href=data.redirect;
          return;
        }
        if(data.code!=="success"){
          alert(data.message || "Không thể đặt tour lúc này!");
          return;
        }

        if(method==="zalopay"){
          window.location.href=`/order/payment-zalopay/${data.orderId}`;
        }
        else if(method==="vnpay"){
          window.location.href=`/order/payment-vnpay/${data.orderId}`;
        }
        else{
          window.location.href=`/order/success?orderId=${data.orderId}`;
        }
      }
      catch(error){
        alert("Không thể kết nối đến máy chủ!");
      }
      finally{
        submitButton.disabled=false;
      }
    })
  ;

  // List Input Method
  const listInputMethod = orderForm.querySelectorAll("input[name='method']");
  const elementInfoBank = orderForm.querySelector(".inner-info-bank");

  listInputMethod.forEach(inputMethod => {
    inputMethod.addEventListener("change", () => {
      if (inputMethod.value == "bank") {
        elementInfoBank.classList.add("active");
      } else {
        elementInfoBank.classList.remove("active");
      }
    })
  })
  // End List Input Method
}
// End Order Form
//Box Filter
const boxFilter=document.querySelector(".box-filter");
if(boxFilter)
{
  const url=new URL(window.location.origin+'/search');
const applyFilterCategorySearch=boxFilter.querySelector("[apply-filter-category-search]");
if(applyFilterCategorySearch){
  applyFilterCategorySearch.addEventListener("click",()=>{
  const locationFrom=boxFilter.querySelector("select[name='locationFrom']").value;
  const locationTo=boxFilter.querySelector("select[name='locationTo']").value;
  const departureDate=boxFilter.querySelector("input[name='departureDate']").value;
  const stockAdult=boxFilter.querySelector("input[name='stockAdult']").value;
  const stockChildren=boxFilter.querySelector("input[name='stockChildren']").value;
  const stockBaby=boxFilter.querySelector("input[name='stockBaby']").value;
  const priceRange=boxFilter.querySelector("select[name='priceRange']").value;
  if(locationFrom){
    url.searchParams.set("locationFrom",locationFrom);

  }
  else{
    url.searchParams.delete("locationFrom");
  }
  if(locationTo){
    url.searchParams.set("locationTo",locationTo);
  }
  else{
    url.searchParams.delete("locationTo");
  }
  if(departureDate){
    url.searchParams.set("departureDate",departureDate);
  }
  else{
    url.searchParams.delete("departureDate");
  }
  if(stockAdult){
    url.searchParams.set("stockAdult",stockAdult);
  }
  else{
    url.searchParams.delete("stockAdult");
  }
  if(stockChildren)
  {
    url.searchParams.set("stockChildren",stockChildren);
  }
  else{
    url.searchParams.delete("stockChildren");
  }
  if(stockBaby)
  {
    url.searchParams.set("stockBaby",stockBaby);
  }
  else{
    url.searchParams.delete("stockBaby");
  }
  if(priceRange)
  {
    url.searchParams.set("price",priceRange);
  }
  else{
    url.searchParams.delete("price");
  }
  window.location.href=url.href;




})
}



}

//End Box Filter
//Form Search
const formSearch=document.querySelector("[form-search]");
if(formSearch)
{
  formSearch.addEventListener("submit",(event)=>{
    event.preventDefault();
    const locationTo=formSearch.querySelector("input[name='locationTo']").value;
    const url=new URL(window.location.origin+'/search');
  if(locationTo){
    url.searchParams.set("locationTo",locationTo);
  }
  else{
    url.searchParams.delete("locationTo");
  }
  const stockAdult=parseInt(formSearch.querySelector("[stock-adult]").innerHTML);
  const stockChildren=parseInt(formSearch.querySelector("[stock-children]").innerHTML);
  const stockBaby=parseInt(formSearch.querySelector("[stock-baby]").innerHTML);
  if(stockAdult){
    url.searchParams.set("stockAdult",stockAdult);
  }
  else if(!stockAdult||stockAdult=="0"){
    url.searchParams.delete("stockAdult");
  }
  if(stockChildren){
    url.searchParams.set("stockChildren",stockChildren);
  }
  else if(!stockChildren||stockChildren=="0"){
    url.searchParams.delete("stockChildren");
  }
  if(stockBaby){
    url.searchParams.set("stockBaby",stockBaby);
  }
  else if(!stockBaby||stockBaby=="0"){
    url.searchParams.delete("stockBaby");
  }
  const departureDate=formSearch.querySelector("input[name='departureDate']").value;
  if(departureDate){
    url.searchParams.set("departureDate",departureDate);
  }
  else{
    url.searchParams.delete("departureDate");
  }
  window.location.href=url.href;


  })
}






//End form search
//Box Tour Detail
const boxTourDetail=document.querySelector(".box-tour-detail");
if(boxTourDetail)
{
const inputStockAdult=document.querySelector("[input-stock-adult]");
const inputStockChildren=document.querySelector("[input-stock-children]");
const inputStockBaby=document.querySelector("[input-stock-baby]");
//function chung
const drawBoxDetail=()=>{
  const quantityAdult=parseInt(inputStockAdult.value);
  const quantityChildren=parseInt(inputStockChildren.value);
  const quantityBaby=parseInt(inputStockBaby.value);
  const stockAdult=document.querySelector("[stock-adult]");
  const stockChildren=document.querySelector("[stock-children]");
  const stockBaby=document.querySelector("[stock-baby]");
  stockAdult.innerHTML=quantityAdult;
  stockChildren.innerHTML=quantityChildren;
  stockBaby.innerHTML=quantityBaby;
  const priceAdult=parseInt(inputStockAdult.getAttribute("price"));
  const priceChildren=parseInt(inputStockChildren.getAttribute("price"));
  const priceBaby=parseInt(inputStockBaby.getAttribute("price"));
  const totalPrice=quantityAdult*priceAdult+quantityChildren*priceChildren+quantityBaby*priceBaby;
  const elementTotalPrice=boxTourDetail.querySelector("[total-price]");
  elementTotalPrice.innerHTML=totalPrice.toLocaleString("vi-VN");
  }

inputStockAdult.addEventListener("change",drawBoxDetail);
inputStockChildren.addEventListener("change",drawBoxDetail);
inputStockBaby.addEventListener("change",drawBoxDetail);
const buttonAddToCart=boxTourDetail.querySelector(".inner-button-add-cart");
buttonAddToCart.addEventListener("click",async()=>{
  if(buttonAddToCart.dataset.authenticated!=="true"){
    window.location.href=`/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
    return;
  }

  const tourId=buttonAddToCart.getAttribute("tour-id");
  const quantityAdult=parseInt(inputStockAdult.value);
  const quantityChildren=parseInt(inputStockChildren.value);
  const quantityBaby=parseInt(inputStockBaby.value);
  const locationFrom=boxTourDetail.querySelector("[location-from]").value;
  if(!(quantityAdult>0||quantityChildren>0||quantityBaby>0)){
    alert("Vui lòng chọn ít nhất một hành khách!");
    return;
  }

  buttonAddToCart.disabled=true;
  try{
    const response=await fetch('/cart/add',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        tourId,
        locationFrom,
        quantityAdult,
        quantityChildren,
        quantityBaby
      })
    });
    const result=await response.json();
    if(response.status===401 && result.redirect){
      window.location.href=result.redirect;
      return;
    }
    if(result.code!=="success"){
      alert(result.message || "Không thể thêm tour vào giỏ hàng!");
      return;
    }
    window.location.href=result.redirect || '/cart';
  }
  catch(error){
    alert("Không thể kết nối đến máy chủ!");
  }
  finally{
    buttonAddToCart.disabled=false;
  }
});

}

//End Box Tour Detail
// Page Cart
const pageCart=document.querySelector("[page-cart]");
if(pageCart){
  const cartRequest=async(url,options={})=>{
    const response=await fetch(url,{
      ...options,
      headers:{
        'Content-Type':'application/json',
        ...(options.headers || {})
      }
    });
    const result=await response.json();
    if(response.status===401 && result.redirect){
      window.location.href=result.redirect;
      return null;
    }
    if(result.code!=="success"){
      throw new Error(result.message || "Không thể cập nhật giỏ hàng!");
    }
    return result;
  };

  document.querySelectorAll('[data-cart-quantity]').forEach(input=>{
    input.addEventListener('change',async()=>{
      const value=Number(input.value);
      input.disabled=true;
      try{
        await cartRequest(`/cart/items/${input.dataset.cartItemId}`,{
          method:'PATCH',
          body:JSON.stringify({[input.dataset.cartQuantity]:value})
        });
        window.location.reload();
      }
      catch(error){
        alert(error.message);
        window.location.reload();
      }
    });
  });

  document.querySelectorAll('[data-cart-checked]').forEach(checkbox=>{
    checkbox.addEventListener('change',async()=>{
      checkbox.disabled=true;
      try{
        await cartRequest(`/cart/items/${checkbox.dataset.cartChecked}`,{
          method:'PATCH',
          body:JSON.stringify({checked:checkbox.checked})
        });
        window.location.reload();
      }
      catch(error){
        alert(error.message);
        window.location.reload();
      }
    });
  });

  document.querySelectorAll('[data-cart-delete]').forEach(button=>{
    button.addEventListener('click',async()=>{
      if(!window.confirm('Bạn muốn xóa tour này khỏi giỏ hàng?')){
        return;
      }
      button.disabled=true;
      try{
        await cartRequest(`/cart/items/${button.dataset.cartDelete}`,{method:'DELETE'});
        window.location.reload();
      }
      catch(error){
        alert(error.message);
        button.disabled=false;
      }
    });
  });
}
// End Page Cart

// Client auth menu
const userMenuTrigger=document.querySelector("[user-menu-trigger]");
if(userMenuTrigger){
  const userMenu=userMenuTrigger.closest(".inner-user-menu");
  userMenuTrigger.addEventListener("click",event=>{
    event.stopPropagation();
    userMenu.classList.toggle("active");
  });
  document.addEventListener("click",event=>{
    if(!userMenu.contains(event.target)){
      userMenu.classList.remove("active");
    }
  });
}

// Show or hide password
const passwordToggleList=document.querySelectorAll("[password-toggle]");
passwordToggleList.forEach(button=>{
  button.addEventListener("click",()=>{
    const input=button.parentElement.querySelector("input");
    const icon=button.querySelector("i");
    const isHidden=input.type==="password";
    input.type=isHidden ? "text" : "password";
    icon.classList.toggle("fa-eye",!isHidden);
    icon.classList.toggle("fa-eye-slash",isHidden);
    button.setAttribute("aria-label",isHidden ? "Ẩn mật khẩu" : "Hiện mật khẩu");
  });
});

const showClientAuthMessage=(form,message)=>{
  const messageElement=form.querySelector("[auth-message]");
  messageElement.textContent=message;
  messageElement.hidden=false;
};

const submitClientAuth=async(form,url,data)=>{
  const button=form.querySelector(".inner-submit");
  const messageElement=form.querySelector("[auth-message]");
  button.disabled=true;
  messageElement.hidden=true;

  try{
    const response=await fetch(url,{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify(data)
    });
    const result=await response.json();

    if(result.code==="success"){
      window.location.href=result.redirect;
      return;
    }
    showClientAuthMessage(form,result.message || "Có lỗi xảy ra, vui lòng thử lại!");
  }
  catch(error){
    showClientAuthMessage(form,"Không thể kết nối đến máy chủ, vui lòng thử lại!");
  }
  finally{
    button.disabled=false;
  }
};

// Client login form
const clientLoginForm=document.querySelector("#client-login-form");
if(clientLoginForm){
  const validation=new JustValidate("#client-login-form");
  validation
    .addField("#login-email",[
      {
        rule:"required",
        errorMessage:"Vui lòng nhập email!"
      },
      {
        rule:"email",
        errorMessage:"Email không đúng định dạng!"
      }
    ])
    .addField("#login-password",[
      {
        rule:"required",
        errorMessage:"Vui lòng nhập mật khẩu!"
      }
    ])
    .onSuccess(event=>{
      submitClientAuth(clientLoginForm,"/auth/login",{
        email:event.target.email.value,
        password:event.target.password.value,
        rememberPassword:event.target.rememberPassword.checked,
        returnTo:event.target.returnTo.value
      });
    });
}

// Client register form
const clientRegisterForm=document.querySelector("#client-register-form");
if(clientRegisterForm){
  const validation=new JustValidate("#client-register-form");
  validation
    .addField("#register-full-name",[
      {
        rule:"required",
        errorMessage:"Vui lòng nhập họ tên!"
      },
      {
        rule:"minLength",
        value:2,
        errorMessage:"Họ tên phải có ít nhất 2 ký tự!"
      }
    ])
    .addField("#register-phone",[
      {
        validator:value=>{
          if(!value){
            return true;
          }
          return /^(?:\+84|0)\d{8,10}$/.test(value.replace(/[\s.-]/g,""));
        },
        errorMessage:"Số điện thoại không đúng định dạng!"
      }
    ])
    .addField("#register-email",[
      {
        rule:"required",
        errorMessage:"Vui lòng nhập email!"
      },
      {
        rule:"email",
        errorMessage:"Email không đúng định dạng!"
      }
    ])
    .addField("#register-password",[
      {
        rule:"required",
        errorMessage:"Vui lòng nhập mật khẩu!"
      },
      {
        validator:value=>value.length>=8,
        errorMessage:"Mật khẩu phải có ít nhất 8 ký tự!"
      },
      {
        validator:value=>/[A-Z]/.test(value),
        errorMessage:"Mật khẩu phải có ít nhất một chữ hoa!"
      },
      {
        validator:value=>/[a-z]/.test(value),
        errorMessage:"Mật khẩu phải có ít nhất một chữ thường!"
      },
      {
        validator:value=>/[0-9]/.test(value),
        errorMessage:"Mật khẩu phải có ít nhất một chữ số!"
      },
      {
        validator:value=>/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(value),
        errorMessage:"Mật khẩu phải có ít nhất một ký tự đặc biệt!"
      }
    ])
    .addField("#register-confirm-password",[
      {
        rule:"required",
        errorMessage:"Vui lòng nhập lại mật khẩu!"
      },
      {
        validator:(value,fields)=>value===fields["#register-password"].elem.value,
        errorMessage:"Mật khẩu nhập lại không khớp!"
      }
    ])
    .addField("#register-agree",[
      {
        rule:"required",
        errorMessage:"Bạn cần đồng ý với điều khoản sử dụng!"
      }
    ])
    .onSuccess(event=>{
      const checkedValues=name=>Array.from(
        clientRegisterForm.querySelectorAll(`input[name="${name}"]:checked`)
      ).map(input=>input.value);
      const selectedBudget=clientRegisterForm.querySelector('input[name="budgetRange"]:checked');

      submitClientAuth(clientRegisterForm,"/auth/register",{
        fullName:event.target.fullName.value,
        phone:event.target.phone.value,
        email:event.target.email.value,
        password:event.target.password.value,
        confirmPassword:event.target.confirmPassword.value,
        tourTypes:checkedValues("tourTypes"),
        budgetRange:selectedBudget ? selectedBudget.value : "",
        locations:checkedValues("locations"),
        agree:event.target.agree.checked
      });
    });
}

// Client forgot password form
const clientForgotPasswordForm=document.querySelector("#client-forgot-password-form");
if(clientForgotPasswordForm){
  const validation=new JustValidate("#client-forgot-password-form");
  validation
    .addField("#forgot-password-email",[
      {
        rule:"required",
        errorMessage:"Vui lòng nhập email!"
      },
      {
        rule:"email",
        errorMessage:"Email không đúng định dạng!"
      }
    ])
    .onSuccess(event=>{
      submitClientAuth(clientForgotPasswordForm,"/auth/forgot-password",{
        email:event.target.email.value
      });
    });
}

// Client OTP form
const clientOtpPasswordForm=document.querySelector("#client-otp-password-form");
if(clientOtpPasswordForm){
  const otpInput=clientOtpPasswordForm.querySelector("#otp-password-code");
  otpInput.addEventListener("input",()=>{
    otpInput.value=otpInput.value.replace(/\D/g,"").slice(0,6);
  });

  const validation=new JustValidate("#client-otp-password-form");
  validation
    .addField("#otp-password-code",[
      {
        rule:"required",
        errorMessage:"Vui lòng nhập mã OTP!"
      },
      {
        validator:value=>/^\d{6}$/.test(value),
        errorMessage:"Mã OTP phải gồm đúng 6 chữ số!"
      }
    ])
    .onSuccess(event=>{
      submitClientAuth(clientOtpPasswordForm,"/auth/otp-password",{
        email:event.target.email.value,
        otp:event.target.otp.value
      });
    });
}

// Client reset password form
const clientResetPasswordForm=document.querySelector("#client-reset-password-form");
if(clientResetPasswordForm){
  const validation=new JustValidate("#client-reset-password-form");
  validation
    .addField("#reset-password-new",[
      {
        rule:"required",
        errorMessage:"Vui lòng nhập mật khẩu!"
      },
      {
        validator:value=>value.length>=8,
        errorMessage:"Mật khẩu phải có ít nhất 8 ký tự!"
      },
      {
        validator:value=>/[A-Z]/.test(value),
        errorMessage:"Mật khẩu phải có ít nhất một chữ hoa!"
      },
      {
        validator:value=>/[a-z]/.test(value),
        errorMessage:"Mật khẩu phải có ít nhất một chữ thường!"
      },
      {
        validator:value=>/[0-9]/.test(value),
        errorMessage:"Mật khẩu phải có ít nhất một chữ số!"
      },
      {
        validator:value=>/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(value),
        errorMessage:"Mật khẩu phải có ít nhất một ký tự đặc biệt!"
      }
    ])
    .addField("#reset-password-confirm",[
      {
        rule:"required",
        errorMessage:"Vui lòng nhập lại mật khẩu!"
      },
      {
        validator:(value,fields)=>value===fields["#reset-password-new"].elem.value,
        errorMessage:"Mật khẩu nhập lại không khớp!"
      }
    ])
    .onSuccess(event=>{
      submitClientAuth(clientResetPasswordForm,"/auth/reset-password",{
        password:event.target.password.value,
        confirmPassword:event.target.confirmPassword.value
      });
    });
}
