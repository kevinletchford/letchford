const fs = require("fs");
const path = require("path");
const HTMLWebpackPlugin = require("html-webpack-plugin");
const HtmlBeautifyPlugin = require("html-beautify-webpack-plugin");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const nodeExternals = require("webpack-node-externals");
const TerserPlugin = require("terser-webpack-plugin");
const HtmlWebpackInlineSVGPlugin = require('html-webpack-inline-svg-plugin');

// We need Nodes fs module to read directory contents

const env = process.env.NODE_ENV;
const config = {
  mode: env || "development"
};

const extractSass = new ExtractTextPlugin({
  filename: "styles.css"
});

// Our function that generates our html plugins
function generateHtmlPlugins(templateDir) {
  // Read files in template directory
  const templateFiles = fs.readdirSync(path.resolve(__dirname, templateDir));
  return templateFiles.map(item => {
    // Split names and extension
    const parts = item.split(".");
    const name = parts[0];
    const extension = parts[1];
    // Create new HTMLWebpackPlugin with options
    return new HTMLWebpackPlugin({
      filename: `${name}.html`,
      template: path.resolve(__dirname, `${templateDir}/${name}.${extension}`)
    });
  });
}

// Call our function on our views directory.
const htmlPlugins = generateHtmlPlugins("./src/pages/");

module.exports = {
  entry: "./src/scripts/scripts.js",
  output: {
    path: path.resolve(__dirname, "dist"), // Output folder
    filename: "js/app.js" // JS output path
  },

  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          output: {
            comments: false
          }
        }
      })
    ]
  },
  module: {
    rules: [
      // Include pug-loader to process the pug files
      {
        test: /\.pug$/,
        use: "pug-loader"
      },
      {
        test: /\.js$/,
        use: {
          loader: "babel-loader"
        }
      },
      {
        test: /\.scss$/,
        use: [
          "style-loader",
          MiniCssExtractPlugin.loader,
          "css-loader",
          "postcss-loader",
          "sass-loader"
        ]
      },
      {
        // Match woff2 and patterns like .woff?v=1.1.1.
        test: /\.(|woff|woff2|eot|ttf|)(\?.*$|$)/,
        use: {
          loader: "url-loader",
          options: {
            limit: 50,
            mimetype: "application/font-woff",
            name: "./fonts/[name].[ext]", // Output below ./fonts
            publicPath: "../" // Take the directory into account
          }
        }
      },

      {
        //IMAGE LOADER
        test: /\.(jpe?g|png|gif)$/i,
        loader: "file-loader",
        options: {
          name: "./images/[name].[ext]" // Output below ./fonts
        }
      },
      {
        test: /\.svg$/,
        loader: 'svg-inline-loader'
      },
      {
        test: /\.html$/,
        use: [
          {
            loader: "html-loader",
            options: {
              attrs: ["img:src", "source:srcset"]
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "css/styles.css"
    })
  ]
    // We join our htmlPlugin array to the end
    // of our webpack plugins array.
    .concat(htmlPlugins)
    .concat(new HtmlWebpackInlineSVGPlugin({

    }))
    .concat(
      new HtmlBeautifyPlugin({
        config: {
          html: {
            end_with_newline: false,
            indent_size: 2,
            indent_with_tabs: true,
            indent_inner_html: false,
            preserve_newlines: false
          }
        },
        replace: [' type="text/javascript"']
      })
    )
};
