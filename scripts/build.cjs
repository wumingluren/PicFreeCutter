// scripts/build.cjs

const fs = require("fs");
const path = require("path");

const srcDir = path.resolve(__dirname, "../dist");

function main() {
  const url = path.join(srcDir, "index.html");
  // 读取dist/index.html
  let htmlStr = fs.readFileSync(url, { encoding: "utf-8" });

  // 匹配script或link标签
  const tagReg = /(?:<script.*?>)|(?:<link.*?>)/g;

  htmlStr = htmlStr.replace(tagReg, (str) => {
    // 替换关键字
    return str.replace(/\snomodule|\scrossorigin|\stype="module"/g, "");
  });

  // 输出文件
  fs.writeFileSync(url, htmlStr);
}

main();
