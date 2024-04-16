import JSZip from "jszip";
import { saveAs } from "file-saver";

/**
 * 从画布中截取指定区域的图像，并将其转换为DataURL格式。
 * @param {HTMLCanvasElement} canvas - 需要截取图像的画布元素。
 * @param {number} xStart - 截取区域的起始x坐标。
 * @param {number} yStart - 截取区域的起始y坐标。
 * @param {number} xEnd - 截取区域的结束x坐标。
 * @param {number} yEnd - 截取区域的结束y坐标。
 * @returns {string|null} 返回截取图像的DataURL，如果截取失败则返回null。
 */
export function realCutImage(canvas, xStart, yStart, xEnd, yEnd) {
  const cutImage = document.createElement("canvas");
  cutImage.width = xEnd - xStart;
  cutImage.height = yEnd - yStart;

  const cutImageContext = cutImage.getContext("2d");

  try {
    // 使用drawImage方法将原画布的指定区域图像绘制到新画布上
    cutImageContext.drawImage(
      canvas,
      xStart,
      yStart,
      xEnd - xStart,
      yEnd - yStart,
      0,
      0,
      cutImage.width,
      cutImage.height
    );
    // 返回绘制后图像的DataURL

    // 以下为另一种截取图像数据的方法，未使用drawImage
    // 方法二开始
    // const context = canvas.getContext("2d");

    // // 获取指定区域的图像数据
    // const imageData = context.getImageData(
    //   xStart,
    //   yStart,
    //   xEnd - xStart,
    //   yEnd - yStart
    // );

    // // 将剪切出的图像数据绘制到新canvas元素上
    // cutImageContext.putImageData(imageData, 0, 0);

    // 方法二结束

    return cutImage.toDataURL();
  } catch (error) {
    console.error("Error cutting image:", error);
    return null; // 截取失败时返回null
  }
}

/**
 * 根据标记切割图像。
 *
 * @param {Object} image - 图像对象，确保是Image对象且已加载完毕。
 * @param {Array} xMarksList - X轴切割标记的数组，确保元素为有效数字。
 * @param {Array} yMarksList - Y轴切割标记的数组，确保元素为有效数字。
 * @returns {Array} - 返回一个包含切割后图像对象的数组。
 */
export const gridsCutImage = (image, xMarksList, yMarksList) => {
  if (!image || !(image instanceof Image) || !image.complete) {
    throw new Error("无效的图像对象。请提供已加载的Image对象。");
  }

  if (!Array.isArray(xMarksList) || !Array.isArray(yMarksList)) {
    throw new Error("xMarksList和yMarksList必须为数组。");
  }

  if (xMarksList.length === 0 || yMarksList.length === 0) {
    throw new Error("xMarksList和yMarksList不能为空数组。");
  }

  // 添加开始与结尾标记
  const { width, height } = image;
  const xMarks = [0, ...xMarksList, width].sort((a, b) => a - b);
  const yMarks = [0, ...yMarksList, height].sort((a, b) => a - b);

  // 验证标记是否有效
  xMarks.forEach((mark) => {
    if (typeof mark !== "number" || mark < 0 || mark > width) {
      throw new Error("无效的xMark。它必须为0到图像宽度之间的数字。");
    }
  });

  yMarks.forEach((mark) => {
    if (typeof mark !== "number" || mark < 0 || mark > height) {
      throw new Error("无效的yMark。它必须为0到图像高度之间的数字。");
    }
  });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;

  // 绘制原始图片到新canvas上
  context.drawImage(image, 0, 0);

  const cutImages = [];
  for (let i = 0; i < yMarks.length - 1; i++) {
    // 遍历yMarks以定义每个垂直切割区域的起始和结束点
    const yStart = yMarks[i];
    const yEnd = yMarks[i + 1];

    for (let j = 0; j < xMarks.length - 1; j++) {
      // 遍历xMarks以定义每个水平切割区域的起始和结束点
      const xStart = xMarks[j];
      const xEnd = xMarks[j + 1];

      const dataURL = realCutImage(canvas, xStart, yStart, xEnd, yEnd);
      if (dataURL) {
        cutImages.push(dataURL);
      }
    }
  }

  return cutImages;
};

/**
 * 根据标记数组和方向将图片切割成多个部分。
 * @param {Object} image - 图像对象，必须具有width和height属性以及drawImage可用。
 * @param {Array} marksArray - 包含切割位置的数组。数组元素按切割线的位置从左到右（水平方向）或从上到下（垂直方向）排序。
 * @param {string} orientation - 切割方向，可取值为'horizontal'（水平切割）或'vertical'（垂直切割）。
 * @returns {Array} cutParts - 包含切割后图像部分的数据URL的数组。
 * @throws 会抛出错误如果输入参数无效，图像对象无效，或marks数组不是按升序提供的。
 */
export const cutImage = (image, marksArray, orientation) => {
  // 参数有效性检查
  if (
    !image ||
    !Array.isArray(marksArray) ||
    marksArray.length === 0 ||
    !["horizontal", "vertical"].includes(orientation)
  ) {
    throw new Error(
      "输入参数无效。请确保image有效，marksArray非空且至少包含一个元素，orientation为'horizontal'或'vertical'。"
    );
  }

  let cutParts = [];
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  // 验证image对象是否有效
  if (!image.width || !image.height) {
    throw new Error("无效的图像对象。图像宽度和高度必须已定义。");
  }

  canvas.width = image.width;
  canvas.height = image.height;
  context.drawImage(image, 0, 0);

  // 处理切割逻辑，包括边界条件的检查和修正
  const length = orientation === "horizontal" ? image.width : image.height;
  const marks = [0, ...marksArray, length].sort((a, b) => a - b);

  // 根据marks切割图像
  for (let i = 0; i < marks.length - 1; i++) {
    const startIndex = marks[i];
    const endIndex = marks[i + 1];

    // 确保marks数组是按升序提供的
    if (startIndex >= endIndex) {
      throw new Error("marks数组无效。marks必须按升序提供。");
    }

    let xStart, yStart, xEnd, yEnd;

    // 根据切割方向计算切割参数

    if (orientation === "horizontal") {
      xStart = startIndex;
      yStart = 0;
      xEnd = endIndex;
      yEnd = image.height;
    } else if (orientation === "vertical") {
      xStart = 0;
      yStart = startIndex;
      xEnd = image.width;
      yEnd = endIndex;
    }

    // 实际执行图像切割
    const dataURL = realCutImage(canvas, xStart, yStart, xEnd, yEnd);
    if (dataURL) {
      cutParts.push(dataURL);
    }
  }

  return cutParts;
};

/**
 * 将图片Base64数组打包成压缩包并下载
 * @param {Array} base64ImageArray Base64编码的图片数组
 * @returns {Promise<void>} 不返回任何内容，但在出错时会抛出错误
 */
export const imagesToZip = async (base64ImageArray) => {
  // 检查图片数组是否为空
  if (base64ImageArray.length === 0) {
    console.error("请先提供图片数组！");
    return;
  }

  // 创建一个JSZip实例
  const zip = new JSZip();

  try {
    // 使用Promise.all并行处理Base64转换，提高性能
    const blobs = await Promise.all(
      base64ImageArray.map(async (imageUrl, index) => {
        const imageName = `image_${index + 1}.png`; // 根据需要设置图片的文件名

        const response = await fetch(imageUrl);
        const blob = await response.blob();

        zip.file(imageName, blob);

        return blob;
      })
    );
  } catch (error) {
    console.error("处理图片时发生错误：", error);
    return;
  }

  // 生成压缩包
  const content = await zip.generateAsync({ type: "blob" });

  // 使用FileSaver.js保存压缩包
  saveAs(content, `无名-分割图片压缩包(${base64ImageArray.length}张图).zip`);
};

/**
 * 检查元素B是否在元素A内部，并计算差值
 */
export const isElementBInsideA = (elementA, elementB) => {
  // 解构元素A和元素B的属性
  const { x: aX, y: aY, width: aWidth, height: aHeight } = elementA;
  const { x: bX, y: bY } = elementB;

  // 计算元素A的边界
  const aRight = aX + aWidth;
  const aBottom = aY + aHeight;

  // 判断元素B的左上角是否在元素A内部
  const isInsideX = bX >= aX && bX < aRight;
  const isInsideY = bY >= aY && bY < aBottom;

  // 如果元素B不在元素A内部，则返回false
  if (!isInsideX || !isInsideY) {
    return {
      isInside: false,
    };
  }

  // 计算x轴和y轴的差值
  const xDifference = bX - aX;
  const yDifference = bY - aY;

  // 返回差值信息
  return {
    isInside: true,
    xDifference,
    yDifference,
  };
};

const GROUP_NAMES = {
  VERTICAL_GROUP: "竖线分组",
  HORIZONTAL_GROUP: "横线分组",
  VERTICAL: "竖线",
  HORIZONTAL: "横线",
};

/**
 * 处理分割线条分组，计算标点位置。
 * @param {Array} lineList - 分割线条数组，包含所有分割线条元素。
 * @param {Object} imageInfo - 图像矩形对象，包含宽度和高度信息。
 * @param {boolean} isVertical - 是否处理竖线，true 表示竖线，false 表示横线。
 * @returns {Array} - 计算出的标点位置数组。
 */
export const processLines = (lineList, imageInfo, isVertical) => {
  let resultList = [];

  lineList.children.forEach((element) => {
    if (
      element.name ===
      (isVertical ? GROUP_NAMES.VERTICAL : GROUP_NAMES.HORIZONTAL)
    ) {
      let result = isElementBInsideA(
        {
          x: 0,
          y: 0,
          width: imageInfo.width,
          height: imageInfo.height,
        },
        {
          x: element.x,
          y: element.y,
        }
      );

      if (result.isInside) {
        // 如果是竖线添加x轴，如果是横线添加y轴标点
        resultList.push(isVertical ? result.xDifference : result.yDifference);
      }
    }
  });

  return resultList;
};
