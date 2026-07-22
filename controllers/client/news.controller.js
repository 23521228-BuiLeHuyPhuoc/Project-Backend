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

module.exports.detail = (req, res) => {
  const article = newsList.find(item => item.slug === req.params.slug);

  if (!article) {
    return res.redirect('/tin-tuc');
  }

  const breadcrumb = {
    image: "/assets/images/banner-7.jpg",
    title: article.title,
    list: [
      {
        link: "/",
        title: "Trang Chủ"
      },
      {
        link: "/tin-tuc",
        title: "Tin tức"
      },
      {
        link: `/tin-tuc/${article.slug}`,
        title: article.title
      }
    ]
  };

  const relatedArticles = newsList
    .filter(item => item.slug !== article.slug)
    .slice(0, 3);

  res.render('client/pages/news-detail', {
    pageTitle: article.title,
    breadcrumb,
    article,
    relatedArticles
  });
};
