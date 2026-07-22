// Menu Mobile
const buttonMenuMobile = document.querySelector(".header .inner-button-menu");
if(buttonMenuMobile) {
  const sider = document.querySelector(".sider");
  const siderOverlay = document.querySelector(".sider-overlay");

  buttonMenuMobile.addEventListener("click", () => {
    sider.classList.add("active");
    siderOverlay.classList.add("active");
  })

  siderOverlay.addEventListener("click", () => {
    sider.classList.remove("active");
    siderOverlay.classList.remove("active");
  })
}
// End Menu Mobile

// Schedule Section 8
const scheduleSection8 = document.querySelector(".section-8 .inner-schedule");
if(scheduleSection8) {
  const buttonCreate = scheduleSection8.querySelector(".inner-schedule-create");
  const listItem = scheduleSection8.querySelector(".inner-schedule-list");

  // Tạo mới
  if(buttonCreate) {
    buttonCreate.addEventListener("click", () => {
      const firstItem = listItem.querySelector(".inner-schedule-item");
      const cloneItem = firstItem.cloneNode(true);
      cloneItem.querySelector(".inner-schedule-head input").value = "";

      const body = cloneItem.querySelector(".inner-schedule-body");
      const id = `mce_${Date.now()}`;
      body.innerHTML = `<textarea textarea-mce id="${id}"></textarea>`;

      listItem.appendChild(cloneItem);

      initTinyMCE(`#${id}`);
    })
  }

  listItem.addEventListener("click", (event) => {
    // Đóng/mở item
    if(event.target.closest('.inner-more')) {
      const parentItem = event.target.closest('.inner-schedule-item');
      if (parentItem) {
        parentItem.classList.toggle('hidden');
      }
    }

    // Xóa item
    if(event.target.closest('.inner-remove')) {
      const parentItem = event.target.closest('.inner-schedule-item');
      const totalItem = listItem.querySelectorAll(".inner-schedule-item").length;
      if (parentItem && totalItem > 1) {
        parentItem.remove();
      }
    }
  })

  // Sắp xếp
  new Sortable(listItem, {
    animation: 150, // Thêm hiệu ứng mượt mà
    handle: ".inner-move", // Chỉ cho phép kéo bằng class .inner-move
    onStart: (event) => {
      const textarea = event.item.querySelector("[textarea-mce]");
      const id = textarea.id;
      tinymce.get(id).remove();
    },
    onEnd: (event) => {
      const textarea = event.item.querySelector("[textarea-mce]");
      const id = textarea.id;
      initTinyMCE(`#${id}`);
    }
  });
}
// End Schedule Section 8

// Filepond Image
const listFilepondImage = document.querySelectorAll("[filepond-image]");
let filePond = {};
if(listFilepondImage.length > 0) {
  listFilepondImage.forEach(filepondImage => {
    FilePond.registerPlugin(FilePondPluginImagePreview);
    FilePond.registerPlugin(FilePondPluginFileValidateType);

    let files = null;
    const elementImageDefault = filepondImage.closest("[image-default]");
    if(elementImageDefault) {
      const imageDefault = elementImageDefault.getAttribute("image-default");
      if(imageDefault) {
        files = [
          {
            source: imageDefault, // Đường dẫn ảnh
          },
        ]
      }
    }

    filePond[filepondImage.name] = FilePond.create(filepondImage, {
      labelIdle: '+',
      files: files
    });
  });
}
// End Filepond Image

// Biểu đồ doanh thu
const revenueChart = document.querySelector("#revenue-chart");
let revenueChartInstance = null;

if(revenueChart) {
  const now = new Date();
  drawChart(now);
}

const inputDate = document.querySelector('.section-2 .inner-filter input[type="month"]');

if(inputDate){
  inputDate.addEventListener("change",()=>{
    const now = new Date(inputDate.value);
    drawChart(now);
  })
}
// Hết Biểu đồ doanh thu
function drawChart(now) {
  // Lấy ngày hiện tại
  // const now = new Date();

  // Lấy tháng và năm hiện tại
  const currentMonth = now.getMonth() + 1; // getMonth() trả về giá trị từ 0 đến 11, nên cần +1
  const currentYear = now.getFullYear();

  // Tạo một đối tượng Date mới cho tháng trước
  // Nếu hiện tại là tháng 1 thì new Date(currentYear, 0 - 1, 1) sẽ tự động chuyển thành tháng 12 của năm trước.
  const previousMonthDate = new Date(currentYear, now.getMonth() - 1, 1);

  // Lấy tháng và năm từ đối tượng previousMonthDate
  const previousMonth = previousMonthDate.getMonth() + 1;
  const previousYear = previousMonthDate.getFullYear();

  // Lấy ra tổng số ngày
  const daysInMonthCurrent = new Date(currentYear, currentMonth, 0).getDate();
  const daysInMonthPrevious = new Date(previousYear, previousMonth, 0).getDate();
  const days = daysInMonthCurrent > daysInMonthPrevious ? daysInMonthCurrent : daysInMonthPrevious;
  const arrayDay = [];
  for(let i = 1; i <= days; i++) {
    arrayDay.push(i);
  }
  const dataFinal = {
    currentMonth: currentMonth,
    currentYear: currentYear,
    previousMonth: previousMonth,
    previousYear: previousYear,
    arrayDay: arrayDay
  };
  fetch(`/${pathAdmin}/dashboard/revenue-chart`, {
    method: "POST",
    headers: {
    "Content-Type": "application/json"
    }
    ,body:JSON.stringify(dataFinal)
  }).then(res => res.json())
  .then(data => {
    if(data.code=="success")
    {
      if(revenueChartInstance) {
        revenueChartInstance.destroy();
      }

      revenueChartInstance = new Chart(revenueChart, {
    type: 'line',
    data: {
      labels: arrayDay,
      datasets: [
        {
           label: `Tháng ${currentMonth}/${currentYear}`, // Nhãn của dataset
          data: data.dataMonthCurrent, // Dữ liệu
          borderColor: '#4379EE', // Màu viền
          borderWidth: 1.5, // Độ dày của đường
        },
        {
          label: `Tháng ${previousMonth}/${previousYear}`, // Nhãn của dataset
          data: data.dataMonthPrevious, // Dữ liệu
          borderColor: '#EF3826', // Màu viền
          borderWidth: 1.5, // Độ dày của đường
        }
      ]
    },
    options: {
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Ngày'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Doanh thu (VND)'
          }
        }
      },
      maintainAspectRatio: false, // Không giữ tỷ lệ khung hình mặc định
    }
  });
    }
    if(data.code=="error")
    {
      alert(data.message);
    }
  })
}

// Category Create Form
const categoryCreateForm = document.querySelector("#category-create-form");
if(categoryCreateForm) {
  const validation = new JustValidate('#category-create-form');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên danh mục!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const parent = event.target.parent.value;
      const position = event.target.position.value;
      const status = event.target.status.value;
      const avatars = filePond.avatar.getFiles();
      let avatar = null;
      if(avatars.length > 0) {
        avatar = avatars[0].file;
      }
      const description = tinymce.get("description").getContent();
      
      //Tạo FormData 
      const formData=new FormData();
      formData.append("name",name);
      formData.append("parent",parent);
      formData.append("position",position);
      formData.append("status",status);
      formData.append("avatar",avatar);
      formData.append("description",description);
      fetch(`/${pathAdmin}/category/create`,{
        method:"POST",
        body:formData
      })
      .then(res=>res.json())
      .then(data=>{
        if(data.code==="success"){
          alert("Tạo danh mục thành công");
          window.location.href=`/${pathAdmin}/category/list`;
        }else{
          alert(data.message);
        }
      })
    })
  ;
}
// End Category Create Form

// Tour Create Form
const tourCreateForm = document.querySelector("#tour-create-form");
if(tourCreateForm) {
  const validation = new JustValidate('#tour-create-form');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên tour!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const category = event.target.category.value;
      const position = event.target.position.value;
      const status = event.target.status.value;
      const avatars = filePond.avatar.getFiles();
      let avatar = null;
      if(avatars.length > 0) {
        avatar = avatars[0].file;
      }
      const priceAdult = event.target.priceAdult.value;
      const priceChildren = event.target.priceChildren.value;
      const priceBaby = event.target.priceBaby.value;
      const priceNewAdult = event.target.priceNewAdult.value;
      const priceNewChildren = event.target.priceNewChildren.value;
      const priceNewBaby = event.target.priceNewBaby.value;
      const stockAdult = event.target.stockAdult.value;
      const stockChildren = event.target.stockChildren.value;
      const stockBaby = event.target.stockBaby.value;
      const locations = [];
      const time = event.target.time.value;
      const vehicle = event.target.vehicle.value;
      const departureDate = event.target.departureDate.value;
      const information = tinymce.get("information").getContent();
      const schedules = [];

      // locations
      const listElementLocation = tourCreateForm.querySelectorAll('input[name="locations"]:checked');
      listElementLocation.forEach(input => {
        locations.push(input.value);
      });
      // End locations

      // schedules
      const listElementScheduleItem = tourCreateForm.querySelectorAll('.inner-schedule-item');
      listElementScheduleItem.forEach(scheduleItem => {
        const input = scheduleItem.querySelector("input");
        const title = input.value;

        const textarea = scheduleItem.querySelector("textarea");
        const idTextarea = textarea.id;
        const description = tinymce.get(idTextarea).getContent();

        schedules.push({
          title: title,
          description: description
        });
      });
      // End schedules
      const formData=new FormData();
      formData.append("name",name);
      formData.append("category",category);
      formData.append("position",position);
      formData.append("status",status);
      formData.append("avatar",avatar);
      formData.append("priceAdult",priceAdult);
      formData.append("priceChildren",priceChildren);
      formData.append("priceBaby",priceBaby);
      formData.append("priceNewAdult",priceNewAdult);
      formData.append("priceNewChildren",priceNewChildren);
      formData.append("priceNewBaby",priceNewBaby);
      formData.append("stockAdult",stockAdult);
      formData.append("stockChildren",stockChildren);
      formData.append("stockBaby",stockBaby);
      formData.append("locations",JSON.stringify(locations));
      formData.append("time",time);
      formData.append("vehicle",vehicle);
      formData.append("departureDate",departureDate);
      formData.append("information",information);
      formData.append("schedules",JSON.stringify(schedules));
      // images
      if(filePondMulti.images.getFiles().length > 0) {
        filePondMulti.images.getFiles().forEach(item => {
          formData.append("images", item.file);
        })
      }
      // End images

      fetch(`/${pathAdmin}/tour/create`,{
        method:"POST",
        body:formData
      })
      .then(res=>res.json())
      .then(data=>{
        if(data.code=="error")
        {
          alert(data.message);
        }
        if(data.code=="success")
        {
          window.location.reload();
        }
      })


    })
  ;
}
// End Tour Create Form
//Tour Edit 
const tourEditForm = document.querySelector("#tour-edit-form");
if(tourEditForm) {
  const validation = new JustValidate('#tour-edit-form');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên tour!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const category = event.target.category.value;
      const position = event.target.position.value;
      const status = event.target.status.value;
      const avatars = filePond.avatar.getFiles();
      let avatar = null;
      if(avatars.length > 0) {
        avatar = avatars[0].file;
      }
      const priceAdult = event.target.priceAdult.value;
      const priceChildren = event.target.priceChildren.value;
      const priceBaby = event.target.priceBaby.value;
      const priceNewAdult = event.target.priceNewAdult.value;
      const priceNewChildren = event.target.priceNewChildren.value;
      const priceNewBaby = event.target.priceNewBaby.value;
      const stockAdult = event.target.stockAdult.value;
      const stockChildren = event.target.stockChildren.value;
      const stockBaby = event.target.stockBaby.value;
      const locations = [];
      const time = event.target.time.value;
      const vehicle = event.target.vehicle.value;
      const departureDate = event.target.departureDate.value;
      const information = tinymce.get("information").getContent();
      const schedules = [];

      // locations
      const listElementLocation = tourEditForm.querySelectorAll('input[name="locations"]:checked');
      listElementLocation.forEach(input => {
        locations.push(input.value);
      });
      // End locations
      //
      const idTour=document.querySelector("[data-id]").getAttribute("data-id");
      // schedules
      const listElementScheduleItem = tourEditForm.querySelectorAll('.inner-schedule-item');
      listElementScheduleItem.forEach(scheduleItem => {
        const input = scheduleItem.querySelector("input");
        const title = input.value;

        const textarea = scheduleItem.querySelector("textarea");
        const idTextarea = textarea.id;
        const description = tinymce.get(idTextarea).getContent();

        schedules.push({
          title: title,
          description: description
        });
      });
      // End schedules
      const formData=new FormData();
      formData.append("name",name);
      formData.append("category",category);
      formData.append("position",position);
      formData.append("status",status);
      formData.append("avatar",avatar);
      formData.append("priceAdult",priceAdult);
      formData.append("priceChildren",priceChildren);
      formData.append("priceBaby",priceBaby);
      formData.append("priceNewAdult",priceNewAdult);
      formData.append("priceNewChildren",priceNewChildren);
      formData.append("priceNewBaby",priceNewBaby);
      formData.append("stockAdult",stockAdult);
      formData.append("stockChildren",stockChildren);
      formData.append("stockBaby",stockBaby);
      formData.append("locations",JSON.stringify(locations));
      formData.append("time",time);
      formData.append("vehicle",vehicle);
      formData.append("departureDate",departureDate);
      formData.append("information",information);
      formData.append("schedules",JSON.stringify(schedules));
      if(filePondMulti.images.getFiles().length > 0) {
        filePondMulti.images.getFiles().forEach(item => {
          formData.append("images", item.file);
        })
      }

      fetch(`/${pathAdmin}/tour/edit/${idTour}`,{
        method:"PATCH",
        body:formData
      })
      .then(res=>res.json())
      .then(data=>{
        if(data.code=="error")
        {
          alert(data.message);
        }
        if(data.code=="success")
        {
          window.location.reload();
        }
      })
    })
  ;
}


//End Tour Edit

// Order Edit Form
const orderEditForm = document.querySelector("#order-edit-form");
if(orderEditForm) {
  const validation = new JustValidate('#order-edit-form');

  validation
    .addField('#fullName', [
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
    .addField('#phone', [
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
    .onSuccess((event) => {
      const id = event.target.querySelector("#id")?.value;
      if(!id) {
        alert("Không tìm thấy mã đơn hàng để cập nhật");
        return;
      }
      const fullName = event.target.fullName.value;
      const phone = event.target.phone.value;
      const note = event.target.note.value;
      const paymentMethod = event.target.paymentMethod.value;
      const paymentStatus = event.target.paymentStatus.value;
      const status = event.target.status.value;
      fetch(`/${pathAdmin}/order/edit/${id}`,{
        method:"PATCH",
        headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        fullName:fullName,
        phone:phone,
        note:note,
        paymentMethod:paymentMethod,
        paymentStatus:paymentStatus,
        status:status
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
// End Order Edit Form

// Setting Website Info Form
const settingWebsiteInfoForm = document.querySelector("#setting-website-info-form");
if(settingWebsiteInfoForm) {
  const validation = new JustValidate('#setting-website-info-form');

  validation
    .addField('#websiteName', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên website!'
      },
    ])
    .addField('#email', [
      {
        rule: 'email',
        errorMessage: 'Email không đúng định dạng!',
      },
    ])
    .onSuccess((event) => {
      const websiteName = event.target.websiteName.value;
      const phone = event.target.phone.value;
      const email = event.target.email.value;
      const address = event.target.address.value;
      const logos = filePond.logo.getFiles();
      let logo = null;
      if(logos.length > 0 && logos[0].file) {
        logo = logos[0].file;
        const elementImageDefault = event.target.logo.closest("[image-default]");
        const imageDefault = elementImageDefault.getAttribute("image-default");
        if(imageDefault && imageDefault.includes(logo.name)) {
          logo = null;
        }
      }
      const favicons = filePond.favicon.getFiles();
      let favicon = null;
      if(favicons.length > 0 && favicons[0].file) {
        favicon = favicons[0].file;
        const elementImageDefault = event.target.favicon.closest("[image-default]");
        const imageDefault = elementImageDefault.getAttribute("image-default");
        if(imageDefault && imageDefault.includes(favicon.name)) {
          favicon = null;
        }
      }


      console.log(websiteName);
      console.log(phone);
      console.log(email);
      console.log(address);
      console.log(logo);
      console.log(favicon);
      //Tạo FormData
      const formData=new FormData();
      formData.append("websiteName",websiteName);
      formData.append("phone",phone);
      formData.append("email",email);
      formData.append("address",address);
      if(logo) formData.append("logo",logo);
      if(favicon) formData.append("favicon",favicon);
      fetch(`/${pathAdmin}/setting/website-info`,{
        method:"PATCH",
        body:formData
      }).then(res=>res.json())
      .then(data=>{
        if(data.code=="error")
        {
          alert(data.message);
        }
        if(data.code=="success")
        {
          window.location.reload();
        }
      })

    })
  ;
}
// End Setting Website Info Form

// Setting Account Admin Create Form
const settingAccountAdminCreateForm = document.querySelector("#setting-account-admin-create-form");
if(settingAccountAdminCreateForm) {
  const validation = new JustValidate('#setting-account-admin-create-form');

  validation
    .addField('#fullName', [
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
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập email!'
      },
      {
        rule: 'email',
        errorMessage: 'Email không đúng định dạng!',
      },
    ])
    .addField('#phone', [
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
    .addField('#positionCompany', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập chức vụ!'
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
      const fullName = event.target.fullName.value;
      const email = event.target.email.value;
      const phone = event.target.phone.value;
      const role = event.target.role.value;
      const positionCompany = event.target.positionCompany.value;
      const status = event.target.status.value;
      const password = event.target.password.value;
      const avatars = filePond.avatar.getFiles();
      let avatar = null;
      if(avatars.length > 0) {
        avatar = avatars[0].file;
      }

      console.log(fullName);
      console.log(email);
      console.log(phone);
      console.log(role);
      console.log(positionCompany);
      console.log(status);
      console.log(password);
      console.log(avatar);
      const formData=new FormData();
      formData.append("fullName",fullName);
      formData.append("email",email);
      formData.append("phone",phone);
      formData.append("role",role);
      formData.append("positionCompany",positionCompany);
      formData.append("status",status);
      formData.append("password",password);
      formData.append("avatar",avatar);
      fetch(`/${pathAdmin}/setting/account-admin/create`,{
        method:"POST",
        body:formData
      }).then(res=>res.json())
      .then(data=>{
        if(data.code=="error")        {
          alert(data.message);
        }
        if(data.code=="success")        {
          window.location.href=`/${pathAdmin}/setting/account-admin/list`;
        }
      })
    })
  ;
}
// End Setting Account Admin Create Form
// Setting Account Admin Edit Form
const settingAccountAdminEditForm = document.querySelector("#setting-account-admin-edit-form");
if(settingAccountAdminEditForm) {
  const validation = new JustValidate('#setting-account-admin-edit-form');

  validation
    .addField('#fullName', [
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
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập email!'
      },
      {
        rule: 'email',
        errorMessage: 'Email không đúng định dạng!',
      },
    ])
    .addField('#phone', [
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
    .addField('#positionCompany', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập chức vụ!'
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
      const fullName = event.target.fullName.value;
      const email = event.target.email.value;
      const phone = event.target.phone.value;
      const role = event.target.role.value;
      const positionCompany = event.target.positionCompany.value;
      const status = event.target.status.value;
      const password = event.target.password.value;
      const avatars = filePond.avatar.getFiles();
      const id=document.querySelector("[account-id]").getAttribute("account-id");
      let avatar = null;
      if(avatars.length > 0) {
        avatar = avatars[0].file;
      }

      console.log(fullName);
      console.log(email);
      console.log(phone);
      console.log(role);
      console.log(positionCompany);
      console.log(status);
      console.log(password);
      console.log(avatar);
      const formData=new FormData();
      formData.append("fullName",fullName);
      formData.append("email",email);
      formData.append("phone",phone);
      formData.append("role",role);
      formData.append("positionCompany",positionCompany);
      formData.append("status",status);
      formData.append("password",password);
      formData.append("avatar",avatar);
      fetch(`/${pathAdmin}/setting/account-admin/edit/${id}`,{
        method:"PATCH",
        body:formData
      }).then(res=>res.json())
      .then(data=>{
        if(data.code=="error")        {
          alert(data.message);
        }
        if(data.code=="success")        {
          window.location.href=`/${pathAdmin}/setting/account-admin/list`;
        }
      })
    })
  ;
}
//End account admin edit form
//Account Admin change status
//Check all
const settingAccountAdminCheckall=document.querySelector("[setting-account-admin-checkall]");
if(settingAccountAdminCheckall)
{
  settingAccountAdminCheckall.addEventListener("click",()=>{
      const settingAccountAdminCheck=document.querySelectorAll("[setting-account-admin-check]");
    settingAccountAdminCheck.forEach((item)=>{
            item.checked=settingAccountAdminCheckall.checked;
    })
  })
}
//Change status
const settingAccountAdminApply=document.querySelector("[setting-account-admin-apply]");
if(settingAccountAdminApply){
  settingAccountAdminApply.addEventListener("click",()=>{
    const settingAccountAdminChangeStatus=document.querySelector("[setting-account-admin-change-status]").value;
    const settingAccountAdminChecked=document.querySelectorAll("[setting-account-admin-check]:checked");
    
    fetch(`/${pathAdmin}/setting/account-admin/change-status`,{
      method:"PATCH",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        status:settingAccountAdminChangeStatus,
        idList:Array.from(settingAccountAdminChecked).map(item=>item.value)
         
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
}

//End account admin change status
//Account Admin filter
const filterAccountAdminStatus=document.querySelector("[filter-account-admin-status]");
if(filterAccountAdminStatus){
  const url=new URL(window.location.href);
  filterAccountAdminStatus.addEventListener("change",()=>{
    
    const status=filterAccountAdminStatus.value;
    if(status)
    {
    url.searchParams.set("status",status);
  }
  else{
    url.searchParams.delete("status");
  }
  window.location.href=url.href;
})
  const filterStatus=url.searchParams.get("status");
  if(filterStatus)
  {
    filterAccountAdminStatus.value=filterStatus;
  }
}
const filterAccountAdminFromDate= document.querySelector("[filter-account-admin-fromDate]");
if(filterAccountAdminFromDate)
{
  const url=new URL(window.location.href);
  filterAccountAdminFromDate.addEventListener("change",()=>{
    
    const dateFrom=filterAccountAdminFromDate.value;
    if(dateFrom)
    {
      url.searchParams.set("fromDate",dateFrom);
    }
    else{
      url.searchParams.delete("fromDate");
    }
window.location.href=url.href;
  })
  const filterFromDate=url.searchParams.get("fromDate");
  if(filterFromDate)
  {
    filterAccountAdminFromDate.value=filterFromDate;
  }
}
const filterAccountAdminToDate= document.querySelector("[filter-account-admin-toDate]");
if(filterAccountAdminToDate)
{
  const url=new URL(window.location.href);
  filterAccountAdminToDate.addEventListener("change",()=>{
    
    const dateTo=filterAccountAdminToDate.value;
    if(dateTo)
    {
      url.searchParams.set("toDate",dateTo);
    }
    else{
      url.searchParams.delete("toDate");
    }
window.location.href=url.href;
  })
  const filterToDate=url.searchParams.get("toDate");
  if(filterToDate)
  {
    filterAccountAdminToDate.value=filterToDate;
  }
}
//Nhóm quyền filter
const filterAccountAdminRole=document.querySelector('[filter-account-admin-role]')
if(filterAccountAdminRole)
{
  const url=new URL(window.location.href);
  filterAccountAdminRole.addEventListener("change",()=>{
    const role =filterAccountAdminRole.value;
    
    if(role)
    {
      url.searchParams.set("role",role);
    }
    else{
      url.searchParams.delete("role");
    }
    window.location.href=url.href
  })
  const rolefilter=url.searchParams.get("role");
  if(rolefilter)
  {
    filterAccountAdminRole.value=rolefilter
  }
}
// Filepond Image Multi
const listFilepondImageMulti = document.querySelectorAll("[filepond-image-multi]");
let filePondMulti = {};
if(listFilepondImageMulti.length > 0) {
  listFilepondImageMulti.forEach(filepondImage => {
    FilePond.registerPlugin(FilePondPluginImagePreview);
    FilePond.registerPlugin(FilePondPluginFileValidateType);

    let files = null;
    const elementListImageDefault = filepondImage.closest("[list-image-default]");
    if(elementListImageDefault) {
      const rawListImageDefault = elementListImageDefault.getAttribute("list-image-default");
      if(rawListImageDefault) {
        let listImageDefault = [];
        try {
          const parsed = JSON.parse(rawListImageDefault);
          if(Array.isArray(parsed)) {
            listImageDefault = parsed;
          } else if(typeof parsed === "string") {
            listImageDefault = parsed.includes(",") ? parsed.split(",") : [parsed];
          }
        } catch (e) {
          listImageDefault = rawListImageDefault.includes(",") ? rawListImageDefault.split(",") : [rawListImageDefault];
        }

        listImageDefault = listImageDefault
          .map(item => {
            if(typeof item === "string") {
              return item.trim();
            }
            if(item && typeof item === "object") {
              if(typeof item.path === "string") {
                return item.path.trim();
              }
              if(typeof item.url === "string") {
                return item.url.trim();
              }
              if(typeof item.secure_url === "string") {
                return item.secure_url.trim();
              }
            }
            return "";
          })
          .filter(Boolean);

        if(listImageDefault.length > 0) {
          files = listImageDefault.map(image => ({
            source: image,
            options: {
              type: "local"
            }
          }));
        }
      }
    }

    filePondMulti[filepondImage.name] = FilePond.create(filepondImage, {
      labelIdle: '+',
      files: files,
      server: {
        load: (source, load, error, progress, abort) => {
          const request = new XMLHttpRequest();
          request.open("GET", source);
          request.responseType = "blob";
          request.onload = () => {
            if(request.status >= 200 && request.status < 300) {
              load(request.response);
            } else {
              error("Could not load image");
            }
          };
          request.onerror = () => error("Could not load image");
          request.send();

          return {
            abort: () => {
              request.abort();
              abort();
            }
          };
        }
      }
    });
  });
}
// End Filepond Image Multi

//End Account Admin Filter
//xoá filter
const deleteFilterAccountAdmin=document.querySelector("[delete-setting-filter-account-admin]");
if(deleteFilterAccountAdmin)
{
  deleteFilterAccountAdmin.addEventListener("click",()=>{
    window.location.href=`/${pathAdmin}/setting/account-admin/list`;
    
  })
}
//hết xoá filter
// Setting Role Create Form
const settingRoleCreateForm = document.querySelector("#setting-role-create-form");
if(settingRoleCreateForm) {
  const validation = new JustValidate('#setting-role-create-form');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên nhóm quyền!'
      },
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const description = event.target.description.value;
      const permissions = [];

      // permissions
      const listElementPermission = settingRoleCreateForm.querySelectorAll('input[name="permissions"]:checked');
      listElementPermission.forEach(input => {
        permissions.push(input.value);
      });
      // End permissions

      console.log(name);
      console.log(description);
      console.log(permissions);
      const dataFinal={
        name:name,
        description:description,
        permissions:permissions
      }
      fetch(`/${pathAdmin}/setting/role/create`,{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify(dataFinal)
      }).then(res=>res.json())
      .then(data=>{
        if(data.code=="error"){
          alert(data.message);
        }
        if(data.code=="success"){
          window.location.href=`/${pathAdmin}/setting/role/list`;
        }
      })
    })
  
}
// End Setting Role Create Form
//Setting edit role form
const settingRoleEditForm = document.querySelector("#setting-role-edit-form");
if(settingRoleEditForm) {
  const validation = new JustValidate('#setting-role-edit-form');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên nhóm quyền!'
      },
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const description = event.target.description.value;
      const permissions = [];
      const id=event.target.id.value;

      // permissions
      const listElementPermission = settingRoleEditForm.querySelectorAll('input[name="permissions"]:checked');
      listElementPermission.forEach(input => {
        permissions.push(input.value);
      });
      // End permissions

      console.log(name);
      console.log(description);
      console.log(permissions);
      const dataFinal={
        name:name,
        description:description,
        permissions:permissions
      }
      fetch(`/${pathAdmin}/setting/role/edit/${id}`,{
        method:"PATCH",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify(dataFinal)
      }).then(res=>res.json())
      .then(data=>{
        if(data.code=="error"){
          alert(data.message);
        }
        if(data.code=="success"){
          window.location.href=`/${pathAdmin}/setting/role/list`;
        }
      })
    })
  ;
}
//End Setting Role Edit Form
// Profile Edit Form
const profileEditForm = document.querySelector("#profile-edit-form");
if(profileEditForm) {
  const validation = new JustValidate('#profile-edit-form');

  validation
    .addField('#fullName', [
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
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập email!'
      },
      {
        rule: 'email',
        errorMessage: 'Email không đúng định dạng!',
      },
    ])
    .addField('#phone', [
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
    .onSuccess((event) => {
      const fullName = event.target.fullName.value;
      const email = event.target.email.value;
      const phone = event.target.phone.value;
      const avatars = filePond.avatar.getFiles();
      let avatar = null;
      if(avatars.length > 0) {
        avatar = avatars[0].file;
      }
      const formData=new FormData();
      formData.append("fullName",fullName);
      formData.append("email",email);
      formData.append("phone",phone);
      if(avatar) {
        formData.append("avatar",avatar);
      }
      fetch(`/${pathAdmin}/profile/edit`,{
        method:"PATCH",
        body:formData
      }).then(res=>res.json())
      .then(data=>{
        if(data.code=="error")        {
          alert(data.message);
        }
        if(data.code=="success")        {
          window.location.reload();
        }
      })
      console.log(fullName);
      console.log(email);
      console.log(phone);
      console.log(avatar);
    })
  ;
}
// End Profile Edit Form

// Profile Change Password Form
const profileChangePasswordForm = document.querySelector("#profile-change-password-form");
if(profileChangePasswordForm) {
  const validation = new JustValidate('#profile-change-password-form');

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
    .addField('#confirmPassword', [
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
      const password = event.target.password.value;
      console.log(password);
      fetch(`/${pathAdmin}/profile/change-password`,{
        method:"PATCH",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          password: password
        })
      }).then(res=>res.json())
      .then(data=>{
        if(data.code=="error")        {
          alert(data.message);
        }
        if(data.code=="success")        {
          window.location.reload();
        }
      })
    })
  ;
}
// End Profile Change Password Form
// Sider
const sider = document.querySelector(".sider");
if(sider) {
  const pathNameCurrent = window.location.pathname;
  const splitPathNameCurrent = pathNameCurrent.split("/");
  const menuList = sider.querySelectorAll("a");
  menuList.forEach(item => {
    const href = item.href;
    const pathName = new URL(href).pathname;
    const splitPathName = pathName.split("/");
    if(splitPathNameCurrent[1] == splitPathName[1] && splitPathNameCurrent[2] == splitPathName[2]) {
      item.classList.add("active");
    }
  })
}
// End Sider
//Logout
const buttonLogout=document.querySelector(".sider .inner-logout");
if(buttonLogout){
  buttonLogout.addEventListener("click",()=>{
    fetch(`/${pathAdmin}/account/logout`,{
      method:"POST",

    })
    .then(res=>res.json())
    .then(data=>{
      if(data.code=="success")
      {
        window.location.href=`/${pathAdmin}/account/login`
      }
    })

  })
}
//End Logout
// Alert
const alertTime = document.querySelector("[alert-time]");
if(alertTime) {
  let time = alertTime.getAttribute("alert-time");
  time = time ? parseInt(time) : 4000;
  setTimeout(() => {
    alertTime.remove(); // Xóa phần tử khỏi giao diện
  }, time);
}
// End Alert
// Category Edit Form
const categoryEditForm = document.querySelector("#category-edit-form");
if(categoryEditForm) {
  const validation = new JustValidate('#category-edit-form');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Vui lòng nhập tên danh mục!'
      }
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const parent = event.target.parent.value;
      const position = event.target.position.value;
      const status = event.target.status.value;
      const avatars = filePond.avatar.getFiles();
      let avatar = null;
      if(avatars.length > 0) {
        avatar = avatars[0].file;
        const elementImageDefault = event.target.avatar.closest("[image-default]");
        const imageDefault = elementImageDefault.getAttribute("image-default");
        if(imageDefault.includes(avatar.name)) {
          avatar = null;
        }
      }
      const description = tinymce.get("description").getContent();

      // Tạo FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("parent", parent);
      formData.append("position", position);
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("description", description);
        fetch(`/${pathAdmin}/category/edit/${id}`,{
          method:"PATCH",
          body:formData
        })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            alert(data.message);
          }

          if(data.code == "success") {
            window.location.reload();
          }
        })
    })
  ;
}
// End Category Edit Form

// Button Delete
const listButtonDelete = document.querySelectorAll("[button-delete]");
if(listButtonDelete.length > 0) {
  listButtonDelete.forEach(button => {
    button.addEventListener("click", () => {
      const dataApi = button.getAttribute("data-api");
      
      fetch(dataApi, {
        method: "PATCH"
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            alert(data.message);
          }

          if(data.code == "success") {
            window.location.reload();
          }
        })
    })
  })
}
// End Button Delete
//Filter Status
const filterStatus=document.querySelector("[filter-status]");
if(filterStatus){
  const url=new URL(window.location.href);

  filterStatus.addEventListener("change",()=>{
    const value=filterStatus.value;
    if(value){
      url.searchParams.set("status",value);
    }else{
      url.searchParams.delete("status");
    }
    window.location.href=url.href;

  })
  // Hiển thị lựa chọn mặc định 
  const valueCurrent=url.searchParams.get("status");
  if(valueCurrent){
    filterStatus.value=valueCurrent;
  }
}
//End Filter Status
//Filter Creator
const filterCreator=document.querySelector("[filter-creator]");
if(filterCreator){
  const url=new URL(window.location.href);

  filterCreator.addEventListener("change",()=>{
    const value=filterCreator.value;
    if(value){
      url.searchParams.set("creator",value);
    }else{
      url.searchParams.delete("creator");
    }
    window.location.href=url.href;

  })
  // Hiển thị lựa chọn mặc định 
  const valueCurrent=url.searchParams.get("creator");
  if(valueCurrent){
    filterCreator.value=valueCurrent;
  }
}


//End Filter Creator
//Filter StartDate
const filterStartDate=document.querySelector("[filter-start-date]");
if(filterStartDate){
  const url=new URL(window.location.href);

  filterStartDate.addEventListener("change",()=>{
    const value=filterStartDate.value;
    if(value){
      url.searchParams.set("startDate",value);
    }else{
      url.searchParams.delete("startDate");
    }
    window.location.href=url.href;

  })
  // Hiển thị lựa chọn mặc định 
  const valueCurrent=url.searchParams.get("startDate");
  if(valueCurrent){
    filterStartDate.value=valueCurrent;
  }
}
//End Filter StartDate

//Filter EndDate
const filterEndDate=document.querySelector("[filter-end-date]");
if(filterEndDate){
  const url=new URL(window.location.href);

  filterEndDate.addEventListener("change",()=>{
    const value=filterEndDate.value;
    if(value){
      url.searchParams.set("endDate",value);
    }else{
      url.searchParams.delete("endDate");
    }
    window.location.href=url.href;

  })
  // Hiển thị lựa chọn mặc định 
  const valueCurrent=url.searchParams.get("endDate");
  if(valueCurrent){
    filterEndDate.value=valueCurrent;
  }
}
//End Filter EndDate
//Xoá bộ lọc
const buttonClearFilter=document.querySelector("[delete-filter]");
if(buttonClearFilter){
  const url=new URL(window.location.href);
  buttonClearFilter.addEventListener("click",()=>{
    url.search="";
    window.location.href=url.href;
  })
}
//Hết xoá bộ lọc
//Check All
const checkAllCheckbox=document.querySelector("[checkall-checkbox]");
if(checkAllCheckbox){
  checkAllCheckbox.addEventListener("click",()=>{
    const innerCheckBox=document.querySelectorAll("[inner-checkbox]");
    innerCheckBox.forEach(checkbox=>{
      checkbox.checked=checkAllCheckbox.checked;
    })
  })
}
//End Check All
//Áp dụng với checkbox
const applyCheckbox=document.querySelector("[apply-checkbox]");
if(applyCheckbox){
  applyCheckbox.addEventListener("click",()=>{
    const selectChangeStatus=document.querySelector("[change-status]");
    const arraycheckbox=document.querySelectorAll("[inner-checkbox]:checked");
    fetch(`/${pathAdmin}/category/change-status`,{
      method:"PATCH",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        status:selectChangeStatus.value,
        updateList:[...arraycheckbox].map(checkbox => checkbox.getAttribute("inner-checkbox"))
      })
    })
    .then(res=>res.json())
    .then(data=>{
      if(data.code=="error"){
        alert(data.message);
      }
      if(data.code=="success"){
        window.location.reload();
      }
    })
  })
}
//Hết áp dụng checkbox
//Search
const search=document.querySelector("[search]");
if(search){
  const url=new URL(window.location.href);
  search.addEventListener("keyup",(event)=>{
    
    if(event.key=="Enter"){
      const value=search.value;
      if(value){
        url.searchParams.set("search",value);
      }
      else{
        url.searchParams.delete("search");
      }
      window.location.href=url.href;
    }
  })
    // Hiển thị giá trị tìm kiếm mặc định
    const valueCurrent=url.searchParams.get("search");
    if(valueCurrent){
      search.value=valueCurrent;
    }
}
//End Search
//Phân trang
const pagination=document.querySelector("[pagination]");
if(pagination){
  const pageCurrent=pagination.getAttribute("pagination");
  const url=new URL(window.location.href);
  pagination.addEventListener("change",()=>{
    const value=pagination.value;
    if(value){
      url.searchParams.set("page",value);
    }else{
      url.searchParams.delete("page");
    }
    window.location.href=url.href;
  })
  // Hiển thị lựa chọn phân trang mặc định
  const pageCurrentUrl=url.searchParams.get("page");
  if(pageCurrentUrl){
    pagination.value=pageCurrentUrl;
  }
}





//End Phân trang

//Delete Tour
const buttonDeleteTour=document.querySelectorAll("[delete-tour]");
if(buttonDeleteTour){
  buttonDeleteTour.forEach(button=>{
    button.addEventListener("click",()=>{
      const id=button.getAttribute("delete-tour");
      fetch(`/${pathAdmin}/tour/trash/${id}`,{
        method:"PATCH"
      })
      .then(res=>res.json())
      .then(data=>{
        if(data.code=="success"){
          window.location.href=`/${pathAdmin}/tour/list`;
        }
        if(data.code=="error"){
          alert(data.message);
        }
      })
    })
  })
}
//End Delete Tour
//Undo Delete Tour
const undoTour=document.querySelectorAll("[undo-tour]");
if(undoTour){
  undoTour.forEach(button=>{
    button.addEventListener("click",()=>{
      const id=button.getAttribute("undo-tour");
      fetch(`/${pathAdmin}/tour/trash/undo/${id}`,{
        method:"PATCH",
      })
      .then(res=>res.json())
      .then(data=>{
        if(data.code=="success"){
          window.location.reload();
        }
        if(data.code=="error"){
          alert(data.message);
        }
      })
    })
  })
}
//End Undo Delete Tour
//Filter Tour
//Filter status tour
const FilterStatusTour=document.querySelector("[filter-status-tour]");
if(FilterStatusTour){
  const url=new URL(window.location.href);
  FilterStatusTour.addEventListener("change",()=>{
    const value=FilterStatusTour.value;
    if(value){
      url.searchParams.set("status",value);
    }
    else{
      url.searchParams.delete("status");
    }
    window.location.href=url.href;
  })
  // Hiển thị lựa chọn mặc định
  const valueCurrent=url.searchParams.get("status");
  if(valueCurrent){
    FilterStatusTour.value=valueCurrent;
  }
}
//End FIlter Status Tour
//Filter creator tour
const creatorTour=document.querySelector("[filter-creator-tour]");
if(creatorTour){
  const url=new URL(window.location.href);
  creatorTour.addEventListener("change",()=>{
    const value=creatorTour.value;
    if(value){
      url.searchParams.set("creator",value);
    }
    else{
      url.searchParams.delete("creator");
    }
    window.location.href=url.href;
  })
  // Hiển thị lựa chọn mặc định
  const valueCurrent=url.searchParams.get("creator");
  if(valueCurrent){
    creatorTour.value=valueCurrent;
  }
}
//End Filter creator tour
//FilterStartDate
const startDateTour=document.querySelector("[startDate-tour]");
if(startDateTour){
  const url=new URL(window.location.href);
  startDateTour.addEventListener("change",()=>{
    const value=startDateTour.value;
    if(value){
      url.searchParams.set("startDate",value);
    }else{
      url.searchParams.delete("startDate");
    }
    window.location.href=url.href;
  })
  // Hiển thị lựa chọn mặc định
  const valueCurrent=url.searchParams.get("startDate");
  if(valueCurrent){
    startDateTour.value=valueCurrent;
  }
}
//End Filter StartDate Tour
//Filter EndDate
const endDateTour=document.querySelector("[endDate-tour]");
if(endDateTour){
  const url=new URL(window.location.href);
  endDateTour.addEventListener("change",()=>{
    const value=endDateTour.value;
    if(value){
      url.searchParams.set("endDate",value);
    }else{
      url.searchParams.delete("endDate");
    }
    window.location.href=url.href;
  })
  // Hiển thị lựa chọn mặc định
  const valueCurrent=url.searchParams.get("endDate");
  if(valueCurrent){
    endDateTour.value=valueCurrent;
  }
}


//End Filter EndDate Tour
//Filter category tour
const categoryTour=document.querySelector("[filter-category-tour]");
if(categoryTour){
  const url=new URL(window.location.href);
  categoryTour.addEventListener("change",()=>{
    const value=categoryTour.value;
    if(value){
      url.searchParams.set("category",value);
    }else{
      url.searchParams.delete("category");
    }
    window.location.href=url.href;
  })
  // Hiển thị lựa chọn mặc định
  const valueCurrent=url.searchParams.get("category");
  if(valueCurrent){
    categoryTour.value=valueCurrent;
  }
}
//End Filter category tour
//Filter price tour
const priceTour=document.querySelector("[filter-price-tour]");
if(priceTour){
  const url=new URL(window.location.href);
  priceTour.addEventListener("change",()=>{
    const value=priceTour.value;
    if(value){
      url.searchParams.set("price",value);
    }else{
      url.searchParams.delete("price");
    }
    window.location.href=url.href;
  })
  // Hiển thị lựa chọn mặc định
  const valueCurrent=url.searchParams.get("price");
  if(valueCurrent){
    priceTour.value=valueCurrent;
  }
}
//Filter price tour
//End Filter Tour
//CHeck all tour
const checkAllTour=document.querySelector("[check-all-tour]");
if(checkAllTour){
  checkAllTour.addEventListener("click",()=>{
    const innerCheckBoxTour=document.querySelectorAll("[check-tour]");
    innerCheckBoxTour.forEach((item)=>{
      item.checked=checkAllTour.checked;
    })
  })
}
//Change status tour
const applyStatusTour=document.querySelector("[apply-change-status-tour]");
if(applyStatusTour){
  applyStatusTour.addEventListener("click",()=>{
    const changeStatusTour=document.querySelector("[change-status-tour]");
    const checkTour=document.querySelectorAll("[check-tour]:checked");
    fetch(`/${pathAdmin}/tour/change-status`,{
      method:"PATCH",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        status:changeStatusTour.value,
        idList: Array.from(checkTour).map(item => item.getAttribute("check-tour"))
      })
    }).then(res=>res.json()).then(data=>{
      if(data.code=="success"){
        window.location.reload();
      }
      if(data.code=="error"){
        alert(data.message);
      }
    })

  })
}
//End Change status tour
//Pagination tour
const paginationTour=document.querySelector("[pagination-tour]");
if(paginationTour){
  const url=new URL(window.location.href);
  paginationTour.addEventListener("change",()=>{
    const value=paginationTour.value;
    if(value){
      url.searchParams.set("page",value);
    }
    else{
      url.searchParams.delete("page");
    }
    window.location.href=url.href;
  })
  // Hiển thị lựa chọn phân trang mặc định
  const valueCurrent=url.searchParams.get("page");
  if(valueCurrent){
    paginationTour.value=valueCurrent;
  }

}





//End pagination tour
//Find tour
const findTour=document.querySelector("[find-tour]");
if(findTour){
  const url=new URL(window.location.href);
  findTour.addEventListener("keyup",(event)=>{
    if(event.key=="Enter"){
      const value=findTour.value;
      if(value){
        url.searchParams.set("search",value);
      }
      else{
        url.searchParams.delete("search");
      }
      window.location.href=url.href;
    }
  })
  // Hiển thị giá trị tìm kiếm mặc định
  const valueCurrent=url.searchParams.get("search");
  if(valueCurrent){
    findTour.value=valueCurrent;
  }
}
//End find tour
//Find tour trash
const findTourTrash=document.querySelector("[find-tour-trash]");
if(findTourTrash){
  const url=new URL(window.location.href);
  findTourTrash.addEventListener("keyup",(event)=>{
    if(event.key=="Enter"){
      const value=findTourTrash.value;
      if(value){
        url.searchParams.set("search",value);
      }
      else{
        url.searchParams.delete("search");
      }
      window.location.href=url.href;
    }

  })
  // Hiển thị giá trị tìm kiếm mặc định
  const valueCurrent=url.searchParams.get("search");
  if(valueCurrent){
    findTourTrash.value=valueCurrent;
  }
}
//End find tour trash
//Pagination tour trash
const paginationTourTrash=document.querySelector("[pagination-tour-trash]");
if(paginationTourTrash){
  const url=new URL(window.location.href);
  paginationTourTrash.addEventListener("change",()=>{
    const value=paginationTourTrash.value;
    if(value){
      url.searchParams.set("page",value);
    }
    else{
      url.searchParams.delete("page");
    }
    window.location.href=url.href;
  })
  // Hiển thị lựa chọn phân trang mặc định
  const valueCurrent=url.searchParams.get("page");
  if(valueCurrent){
    paginationTourTrash.value=valueCurrent;
  }

}
//End pagination tour trash
//Check all tour trash
const checkAllTourTrash=document.querySelector("[check-all-tour-trash]");
if(checkAllTourTrash){
  checkAllTourTrash.addEventListener("click",()=>{
    const innerCheckBoxTourTrash=document.querySelectorAll("[check-tour-trash]");
    innerCheckBoxTourTrash.forEach((item)=>{
      item.checked=checkAllTourTrash.checked;
    })
  })}
//End Check all tour trash
//Change status tour trash
const applyStatusTourTrash=document.querySelector("[apply-change-status-tour-trash]");
if(applyStatusTourTrash){
  applyStatusTourTrash.addEventListener("click",()=>{
    const changeStatusTourTrash=document.querySelector("[change-status-tour-trash]");
    const checkTourTrash=document.querySelectorAll("[check-tour-trash]:checked");
    fetch(`/${pathAdmin}/tour/trash/change-status`,{
      method:"PATCH",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        status:changeStatusTourTrash.value,
        idList: Array.from(checkTourTrash).map(item => item.getAttribute("check-tour-trash"))
      })
    }).then(res=>res.json()).then(data=>{
      if(data.code=="success"){
        window.location.reload();
      }
      if(data.code=="error"){
        alert(data.message);
      }
    })
 
  })
}
//End Change status tour trash
//delete role list
const buttonDeleteRole=document.querySelectorAll("[btn-delete-role-list]");
if(buttonDeleteRole){
  buttonDeleteRole.forEach(button=>{
    button.addEventListener("click",()=>{
      const id=button.getAttribute("btn-delete-role-list");
      fetch(`/${pathAdmin}/setting/role/delete/${id}`,{
        method:"PATCH",
      }).then(res=>res.json())
      .then(data=>{
        if(data.code=="success"){
          window.location.reload();
        }
        if(data.code=="error"){
          alert(data.message);
        }
    })
  })
})
}
//end delete role list
//Role list filter
const settinglistcheckall=document.querySelector("[setting-role-list-checkall]");
const settinglistcheckbox=document.querySelectorAll("[setting-role-list-check]");
const settinglistapply=document.querySelector("[setting-role-list-apply]");
if(settinglistcheckall){
  settinglistcheckall.addEventListener("click",()=>{
    settinglistcheckbox.forEach(checkbox=>{
    checkbox.checked=settinglistcheckall.checked;
    })
  })
}
if(settinglistapply){
  settinglistapply.addEventListener("click",()=>{
    const changeStatus=document.querySelector("[setting-role-list-change-status]").value;
    const arraycheckbox=document.querySelectorAll("[setting-role-list-check]:checked");
    const arraySettingList=Array.from(arraycheckbox).map(checkbox=>checkbox.getAttribute("setting-role-list-check"));
    fetch(`/${pathAdmin}/setting/role/change-status`,{
      method:"PATCH",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        changeStatus:changeStatus,
        idList:arraySettingList
      })
    }).then(res=>res.json())
    .then(data=>{
      if(data.code=="success"){
        window.location.reload();
      }
      if(data.code=="error"){
        alert(data.message);
      }
    })
  
  
  
  })
}

//Role list filter
//Search Role List
const searchRoleList=document.querySelector("[setting-role-list-search]");
if(searchRoleList){
  const url=new URL(window.location.href);
  searchRoleList.addEventListener("keyup",(event)=>{
    if(event.key=="Enter"){
      const value=searchRoleList.value;
      if(value){
        url.searchParams.set("search",value);
      }
      else{
        url.searchParams.delete("search");
      }
      window.location.href=url.href;
    }
    
  })
  
  // Hiển thị giá trị tìm kiếm mặc định
  const valueCurrent=url.searchParams.get("search");
  if(valueCurrent){
    searchRoleList.value=valueCurrent;
  }
}
//End Search Role List

// User list filters
const filterUserStatus=document.querySelector("[filter-user-status]");
const filterUserStartDate=document.querySelector("[filter-user-start-date]");
const filterUserEndDate=document.querySelector("[filter-user-end-date]");
const filterUserSearch=document.querySelector("[filter-user-search]");
const paginationUser=document.querySelector("[pagination-user]");

const updateUserListQuery=(key,value)=>{
  const url=new URL(window.location.href);
  if(value){
    url.searchParams.set(key,value);
  }
  else{
    url.searchParams.delete(key);
  }
  url.searchParams.delete("page");
  window.location.href=url.href;
};

if(filterUserStatus){
  filterUserStatus.addEventListener("change",()=>{
    updateUserListQuery("status",filterUserStatus.value);
  });
}

if(filterUserStartDate){
  filterUserStartDate.addEventListener("change",()=>{
    updateUserListQuery("startDate",filterUserStartDate.value);
  });
}

if(filterUserEndDate){
  filterUserEndDate.addEventListener("change",()=>{
    updateUserListQuery("endDate",filterUserEndDate.value);
  });
}

if(filterUserSearch){
  filterUserSearch.addEventListener("keyup",event=>{
    if(event.key==="Enter"){
      updateUserListQuery("search",filterUserSearch.value.trim());
    }
  });
}

if(paginationUser){
  paginationUser.addEventListener("change",()=>{
    const url=new URL(window.location.href);
    url.searchParams.set("page",paginationUser.value);
    window.location.href=url.href;
  });
}

// Change status for selected users
const checkAllUser=document.querySelector("[check-all-user]");
const checkUserList=document.querySelectorAll("[check-user]");
const changeStatusUser=document.querySelector("[change-status-user]");
const applyChangeStatusUser=document.querySelector("[apply-change-status-user]");

if(checkAllUser){
  checkAllUser.addEventListener("change",()=>{
    checkUserList.forEach(checkbox=>{
      checkbox.checked=checkAllUser.checked;
    });
  });

  checkUserList.forEach(checkbox=>{
    checkbox.addEventListener("change",()=>{
      const checkedCount=document.querySelectorAll("[check-user]:checked").length;
      checkAllUser.checked=checkedCount===checkUserList.length;
      checkAllUser.indeterminate=checkedCount>0 && checkedCount<checkUserList.length;
    });
  });
}

if(applyChangeStatusUser){
  applyChangeStatusUser.addEventListener("click",()=>{
    const status=changeStatusUser.value;
    const checkedUsers=document.querySelectorAll("[check-user]:checked");
    const idList=Array.from(checkedUsers).map(checkbox=>checkbox.getAttribute("check-user"));

    if(!status){
      alert("Vui lòng chọn hành động!");
      return;
    }
    if(idList.length===0){
      alert("Vui lòng chọn ít nhất một người dùng!");
      return;
    }
    if(status==="delete" && !confirm("Bạn có chắc muốn xóa các người dùng đã chọn?")){
      return;
    }

    fetch(`/${pathAdmin}/user/change-status`,{
      method:"PATCH",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({status,idList})
    })
      .then(res=>res.json())
      .then(data=>{
        if(data.code==="success"){
          window.location.reload();
          return;
        }
        alert(data.message);
      });
  });
}

// Edit user
const userEditForm=document.querySelector("#user-edit-form");
if(userEditForm){
  userEditForm.addEventListener("submit",event=>{
    event.preventDefault();
    const userId=userEditForm.getAttribute("user-id");
    const data=Object.fromEntries(new FormData(userEditForm));

    fetch(`/${pathAdmin}/user/edit/${userId}`,{
      method:"PATCH",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify(data)
    })
      .then(res=>res.json())
      .then(data=>{
        if(data.code==="success"){
          window.location.href=`/${pathAdmin}/user/list`;
          return;
        }
        alert(data.message);
      });
  });
}

// Delete user
const deleteUserButtons=document.querySelectorAll("[user-delete]");
deleteUserButtons.forEach(button=>{
  button.addEventListener("click",event=>{
    event.preventDefault();
    if(!confirm("Bạn có chắc muốn xóa người dùng này?")){
      return;
    }

    fetch(button.getAttribute("data-api"),{
      method:"PATCH"
    })
      .then(res=>res.json())
      .then(data=>{
        if(data.code==="success"){
          window.location.reload();
          return;
        }
        alert(data.message);
      });
  });
});
