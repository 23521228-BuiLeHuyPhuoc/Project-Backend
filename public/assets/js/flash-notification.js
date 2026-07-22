const flashMessageElements = document.querySelectorAll("[flash-message]");

if (flashMessageElements.length && typeof Notyf !== "undefined") {
  const notyf = new Notyf({
    duration: 3800,
    dismissible: true,
    ripple: true,
    position: {
      x: "right",
      y: "top"
    },
    types: [
      {
        type: "success",
        background: "#16805B",
        icon: {
          className: "fa-solid fa-check",
          tagName: "i",
          color: "#FFFFFF"
        }
      },
      {
        type: "error",
        background: "#D64545",
        duration: 4800,
        icon: {
          className: "fa-solid fa-xmark",
          tagName: "i",
          color: "#FFFFFF"
        }
      },
      {
        type: "warning",
        background: "#D98512",
        duration: 4400,
        icon: {
          className: "fa-solid fa-triangle-exclamation",
          tagName: "i",
          color: "#FFFFFF"
        }
      },
      {
        type: "info",
        background: "#2563A9",
        icon: {
          className: "fa-solid fa-info",
          tagName: "i",
          color: "#FFFFFF"
        }
      }
    ]
  });

  const normalizeFlashType = type => {
    const value = type.toLowerCase().trim();

    if (["success", "thanh cong", "thành công"].includes(value)) {
      return "success";
    }
    if (["error", "danger", "failed", "thất bại"].includes(value)) {
      return "error";
    }
    if (["warning", "warn", "cảnh báo"].includes(value)) {
      return "warning";
    }
    return "info";
  };

  flashMessageElements.forEach(element => {
    notyf.open({
      type: normalizeFlashType(element.dataset.type || "info"),
      message: element.dataset.message
    });
  });
}
