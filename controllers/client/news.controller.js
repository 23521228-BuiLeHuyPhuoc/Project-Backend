const newsList = require('../../data/news.data');

module.exports.index = (req, res) => {
  const breadcrumb = {
    image: "/assets/images/banner-7.jpg",
    title: "Tin tức du lịch",
    list: [
      {
        link: "/",
        title: "Trang Chủ"
      },
      {
        link: "/tin-tuc",
        title: "Tin tức"
      }
    ]
  };

  res.render('client/pages/news', {
    pageTitle: "Tin tức du lịch",
    breadcrumb,
    newsList
  });
};
