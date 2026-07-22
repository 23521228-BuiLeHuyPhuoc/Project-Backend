// Login Form
const loginForm = document.querySelector("#login-form");
if(loginForm) {
  const validation = new JustValidate('#login-form');

  validation
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập email của bạn!',
      },
      {
        rule: 'email',
        errorMessage: 'Email không đúng định dạng!',
      },
    ])
    .addField('#password', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập mật khẩu!',
      },
      {
        validator: (value) => value.length >= 8,
        errorMessage: 'Mật khẩu phải chứa ít nhất 8 ký tự!',
      },
      {
        validator: (value) => /[A-Z]/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một chữ cái in hoa!',
      },
      {
        validator: (value) => /[a-z]/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một chữ cái thường!',
      },
      {
        validator: (value) => /\d/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một chữ số!',
      },
      {
        validator: (value) => /[@$!%*?&]/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một ký tự đặc biệt!',
      },
    ])
    .onSuccess((event) => {
      const email = event.target.email.value;
      const password = event.target.password.value;
      const rememberPassword = event.target.rememberPassword.checked;
      
      const dataFinal={
        email : email,
        password : password,
        rememberPassword : rememberPassword
      }
      fetch(`/${pathAdmin}/account/login`,{
        method:'POST',
        headers: {
          "Content-Type":"application/json"
        },
        body: JSON.stringify(dataFinal)
      })
      .then(res=>res.json())
      .then(data=>{
      if(data.code=="error"){
        alert(data.message);
      }
      
      if(data.code=="success"){
        window.location.href="/admin/dashboard";
      }
      })


    })
  ;
}
const togglePassword = document.querySelector("#toggle-password");
const passwordInput = document.querySelector("#password");

if(togglePassword && passwordInput) {
  togglePassword.addEventListener("click", function() {
    const isHidden = passwordInput.type === "password";

    passwordInput.type = isHidden ? "text" : "password";
    togglePassword.classList.toggle("fa-eye", !isHidden);
    togglePassword.classList.toggle("fa-eye-slash", isHidden);
  });
}
// End Login Form

// Forgot Password Form
const forgotPasswordForm = document.querySelector("#forgot-password-form");
if(forgotPasswordForm) {
  const validation = new JustValidate('#forgot-password-form');

  validation
    .addField('#email', [
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
      const email = document.querySelector("#email").value;
      const dataFinal={
        email:email
      }

      fetch(`/${pathAdmin}/account/forgot-password`,{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body: JSON.stringify(dataFinal)
      })
      .then(res=>res.json())
      .then(data=>{
        alert(data.message);
        if(data.code=="success"){
          window.location.href=`/${pathAdmin}/account/otp-password?email=${email}`;
        }
      })
    })
  ;
}
// End Forgot Password Form

// OTP Password Form
const otpPasswordForm = document.querySelector("#otp-password-form");
if(otpPasswordForm) {
  const validation = new JustValidate('#otp-password-form');

  validation
    .addField('#otp', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập mã OTP!',
      },
    ])
    .onSuccess((event) => {
      const otp = event.target.otp.value;
      const urlParams=new URLSearchParams(window.location.search);
      const email=urlParams.get("email");
      const dataFinal={
        
        email:email,
        otp:otp
      }
      fetch(`/${pathAdmin}/account/otp-password`,{
        method:"POST",
        headers: {
          "Content-Type":"application/json"
        },
        body:JSON.stringify(dataFinal)
      })
      .then(res=>res.json())
      .then(data=>{
        if(data.code=="error")
        {
          alert(data.message);
        }
        if(data.code=="success"){
          alert(data.message);
        window.location.href=`/${pathAdmin}/account/reset-password`
        }
      })
    })
  ;
}
// End OTP Password Form

// Reset Password Form
const resetPasswordForm = document.querySelector("#reset-password-form");
if(resetPasswordForm) {
  const validation = new JustValidate('#reset-password-form');

  validation
    .addField('#password', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập mật khẩu!',
      },
      {
        validator: (value) => value.length >= 8,
        errorMessage: 'Mật khẩu phải chứa ít nhất 8 ký tự!',
      },
      {
        validator: (value) => /[A-Z]/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một chữ cái in hoa!',
      },
      {
        validator: (value) => /[a-z]/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một chữ cái thường!',
      },
      {
        validator: (value) => /\d/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một chữ số!',
      },
      {
        validator: (value) => /[@$!%*?&]/.test(value),
        errorMessage: 'Mật khẩu phải chứa ít nhất một ký tự đặc biệt!',
      },
    ])
    .addField('#confirm-password', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng xác nhận mật khẩu!',
      },
      {
        validator: (value, fields) => {
          const password = fields['#password'].elem.value;
          return value == password;
        },
        errorMessage: 'Mật khẩu xác nhận không khớp!',
      }
    ])
    .onSuccess((event) => {
      const dataFinal={
        password: event.target.password.value
      }
      fetch(`/${pathAdmin}/account/reset-password`,{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body: JSON.stringify(dataFinal)
      })
      .then(res=>res.json())
      .then(data=>{
        if(data.code=="error"){
          alert(data.message);
        }
        if(data.code=="success"){
          alert(data.message);
          window.location.href=`/${pathAdmin}/account/login`;
        }
      })

    })
  ;
}
// End Reset Password Form
