module.exports.permissionList = [
  {label:"Xem trang Tổng quan",code:"dashboard-view",path:"/dashboard",method:"GET",group:"Tổng quan"},

  {label:"Xem danh mục",code:"category-view",path:"/category/list",method:"GET",group:"Danh mục"},
  {label:"Tạo danh mục",code:"category-create",path:"/category/create",method:"ALL",group:"Danh mục"},
  {label:"Sửa danh mục",code:"category-edit",path:"/category/edit/:id",method:"ALL",group:"Danh mục"},
  {label:"Xóa danh mục",code:"category-delete",path:"/category/delete/:id",method:"PATCH",group:"Danh mục"},
  {label:"Xem thùng rác danh mục",code:"category-trash",path:"/category/trash",method:"GET",group:"Danh mục"},

  {label:"Xem tour",code:"tour-view",path:"/tour/list",method:"GET",group:"Tour"},
  {label:"Tạo tour",code:"tour-create",path:"/tour/create",method:"ALL",group:"Tour"},
  {label:"Sửa tour",code:"tour-edit",path:"/tour/edit/:id",method:"ALL",group:"Tour"},
  {label:"Xóa tour",code:"tour-delete",path:"/tour/delete/:id",method:"PATCH",group:"Tour"},
  {label:"Quản lý thùng rác tour",code:"tour-trash",path:"/tour/trash*",method:"ALL",group:"Tour"},

  {label:"Xem đơn hàng",code:"order-view",path:"/order/list",method:"GET",group:"Đơn hàng"},
  {label:"Sửa đơn hàng",code:"order-edit",path:"/order/edit/:id",method:"ALL",group:"Đơn hàng"},
  {label:"Xem đơn hàng đã hủy",code:"cancelled-order-view",path:"/order/cancelled",method:"GET",group:"Đơn hàng"},

  {label:"Xem voucher",code:"voucher-view",path:"/voucher/list",method:"GET",group:"Voucher"},
  {label:"Tạo voucher",code:"voucher-create",path:"/voucher/create",method:"ALL",group:"Voucher"},
  {label:"Sửa voucher",code:"voucher-edit",path:"/voucher/edit/:id",method:"ALL",group:"Voucher"},
  {label:"Xóa voucher",code:"voucher-delete",path:"/voucher/delete/:id",method:"PATCH",group:"Voucher"},

  {label:"Xem thông báo",code:"notification-view",path:"/notification/list",method:"GET",group:"Thông báo"},
  {label:"Tạo thông báo",code:"notification-create",path:"/notification/create",method:"ALL",group:"Thông báo"},
  {label:"Xóa thông báo",code:"notification-delete",path:"/notification/delete/:id",method:"PATCH",group:"Thông báo"},

  {label:"Xem tài khoản người dùng",code:"user-view",path:"/user/list",method:"GET",group:"Tài khoản người dùng"},
  {label:"Sửa tài khoản người dùng",code:"user-edit",path:"/user/edit/:id",method:"ALL",group:"Tài khoản người dùng"},
  {label:"Xóa tài khoản người dùng",code:"user-delete",path:"/user/delete/:id",method:"PATCH",group:"Tài khoản người dùng"},
  {label:"Đổi trạng thái tài khoản người dùng",code:"user-status",path:"/user/change-status",method:"PATCH",group:"Tài khoản người dùng"},

  {label:"Xem bài viết",code:"article-view",path:"/article/list",method:"GET",group:"Bài viết"},
  {label:"Tạo bài viết",code:"article-create",path:"/article/create",method:"ALL",group:"Bài viết"},
  {label:"Sửa bài viết",code:"article-edit",path:"/article/edit/:id",method:"ALL",group:"Bài viết"},
  {label:"Xóa bài viết",code:"article-delete",path:"/article/delete/:id",method:"PATCH",group:"Bài viết"},

  {label:"Xem đánh giá",code:"review-view",path:"/review/list",method:"GET",group:"Đánh giá"},
  {label:"Kiểm duyệt đánh giá",code:"review-edit",path:"/review/status/:id",method:"PATCH",group:"Đánh giá"},
  {label:"Xóa đánh giá",code:"review-delete",path:"/review/delete/:id",method:"PATCH",group:"Đánh giá"},

  {label:"Xem thông tin liên hệ",code:"contact-view",path:"/contact/list",method:"GET",group:"Liên hệ"}
];
