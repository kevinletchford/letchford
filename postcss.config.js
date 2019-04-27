module.exports = {
  plugins: [
    require("postcss-nesting"),
    require("autoprefixer")({
      grid: true,
      browsers: [">1%"]
    })
  ]
};
