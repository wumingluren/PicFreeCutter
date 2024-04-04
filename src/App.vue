<template>
  <div class="container">
    <div class="header">
      <el-upload
        ref="upload"
        class="upload-button"
        :auto-upload="false"
        :show-file-list="false"
        :accept="'.jpg,.jpeg,.png'"
        :on-change="handleUploadChange"
      >
        <el-button type="primary">点击选择图片</el-button>
      </el-upload>
      <el-button plain @click="OpenUsageInstructions">使用方法</el-button>
      <el-button type="primary" class="mark-button" @click="addMark"
        >标记</el-button
      >
      <el-button type="danger" class="undo-button" @click="undoMark"
        >撤销</el-button
      >
      <el-button type="primary" class="cut-button" @click="handleCut"
        >分割</el-button
      >
      <el-button type="primary" @click="handleDownload"
        >下载切图压缩包</el-button
      >
    </div>
    <!-- @click="handleLineClick" -->
    <div class="content-box">
      <div
        ref="imageBox"
        class="image-box"
        :style="{ height: imageHeight + 'px' }"
      >
        <template v-if="!imageUrl">
          <el-empty description="请选择图片" />
        </template>
        <canvas
          ref="canvas"
          class="image-canvas"
          :style="{ height: imageHeight + 'px' }"
        ></canvas>
        <!-- @mouseleave="endDrag" -->
        <div
          class="cut-line"
          :style="{ top: cutLinePosition + 'px' }"
          @mousedown.stop="startDrag"
          @mousemove.stop="dragging"
          @mouseup.stop="endDrag"
        >
          <div class="cut-line-marker"></div>
        </div>
        <!-- <div class="mark-box">
        <span class="mark-text">分割线</span>
        <div class="mark-line"></div>
        <span class="mark-text">分割线</span>
      </div> -->
      </div>
      <div class="img-preview">
        <template v-if="cutImages.length === 0">
          <el-empty description="请先切图" />
        </template>
        <template v-else>
          <div v-for="(slice, index) in cutImages" :key="index" class="img-box">
            <img :src="slice" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox, ElUpload, ElButton } from "element-plus";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const OpenUsageInstructions = () => {
  ElMessageBox.alert(
    `${
      "1. 点击 '选择图片' 按钮选择图片，即可在左侧预览区预览图片<br>" +
      "2. 在左侧预览区任意位置点击，或者鼠标在黑色线条处按下拖动，黑色线条即会移动到目标位置，点击 '标记' 按钮就会在当前黑色线条停留位置生成一条红色的线来标记需要分割的位置<br>" +
      "3. 点击 '分割' 按钮开始分割，并在右侧将预览图展示出来<br>" +
      "4. 点击 '下载切图压缩包' 按钮即可下载分割好的图片压缩包<br>" +
      "5. 点击 '撤销' 按钮可撤销最近一次标记<br>" +
      "6. 点击 '重置' 按钮可重置（暂时没做，手动 F5 刷新）<br>" +
      "Tisp：点击右上角图标即可查看源码"
    }`,
    "使用方法",
    {
      confirmButtonText: "OK",
      dangerouslyUseHTMLString: true,
    }
  );
};

// 图片和canvas元素引用
const imageUrl = ref(null);
const canvas = ref(null);
const imageBox = ref(null);

// 图片和canvas尺寸
const imageHeight = ref(300);

// 标记点位置和标记线数组
const cutLinePosition = ref(100);
const cutLines = ref([]);
const marks = ref([]);

// 标记位置
const addMark = () => {
  if (marks.value.includes(cutLinePosition.value)) {
    ElMessage.warning("该位置已有标记！");
    return;
  }
  marks.value.push(cutLinePosition.value);

  cutLines.value = marks.value;
  redrawMarks();
  ElMessage({
    message: "标记成功",
    type: "success",
  });

  console.log(
    "添加标记：",
    marks.value,
    "当前悬浮位置：",
    cutLinePosition.value,
    cutLines.value
  );
};

// 撤销标记
const undoMark = () => {
  if (marks.value.length > 0) {
    marks.value.pop(); // 移除数组中的最后一个元素，即最近一次的标记
    redrawMarks(); // 重新绘制标记线
  }
};

// 重新绘制标记线
const redrawMarks = () => {
  // 清除旧的标记盒
  const markBoxes = document.querySelectorAll(".mark-box");
  markBoxes.forEach((box) => box.remove());

  // 绘制新的标记盒
  marks.value.forEach((mark) => {
    const markBox = document.createElement("div");
    markBox.classList.add("mark-box");

    // 创建并设置mark-text元素
    const markTextBefore = document.createElement("span");
    markTextBefore.classList.add("mark-text");
    markTextBefore.textContent = "分割线";

    // 创建mark-line元素
    const markLine = document.createElement("div");
    markLine.classList.add("mark-line");

    // 创建并设置第二个mark-text元素
    const markTextAfter = document.createElement("span");
    markTextAfter.classList.add("mark-text");
    markTextAfter.textContent = "分割线";

    // 将mark-text和mark-line元素添加到markBox中
    markBox.appendChild(markTextBefore);
    markBox.appendChild(markLine);
    markBox.appendChild(markTextAfter);

    // 将markBox临时添加到body中以计算其高度
    document.body.appendChild(markBox);

    // 现在可以获取markBox的实际高度
    const markBoxHeight = markBox.offsetHeight;
    const halfMarkBoxHeight = markBoxHeight / 2;

    // 移除markBox，之后将其添加到目标位置imageBox中
    document.body.removeChild(markBox);

    // 设置markBox的top样式，确保垂直居中
    markBox.style.top = `${mark - halfMarkBoxHeight}px`;

    // 将新的mark-box添加到imageBox中
    imageBox.value.appendChild(markBox);
  });
};

// 点击标点
const handleLineClick = (e) => {
  const rect = imageBox.value.getBoundingClientRect();
  // 取整并更新cutLinePosition
  cutLinePosition.value = Math.round(e.clientY - rect.top);
};

// 选择图片
const handleUploadChange = ({ raw }) => {
  const image = new Image();
  image.src = URL.createObjectURL(raw);
  image.onload = () => {
    drawImageOnCanvas(image);
  };
  imageUrl.value = URL.createObjectURL(raw);
};

// 渲染图片
const aspectRatio = ref(); //高宽比
const drawImageOnCanvas = (image) => {
  const context = canvas.value.getContext("2d");
  const width = 600; // 固定图片宽度
  let aspectRatioTmp = image.height / image.width;
  aspectRatio.value = aspectRatioTmp;
  const height = Math.round(width * aspectRatioTmp); // 根据宽高比计算图片高度
  context.canvas.width = width;
  context.canvas.height = height;
  imageHeight.value = height; // 更新imageHeight的值
  context.drawImage(image, 0, 0, width, height);
};

// 分割图片
const cutImages = ref([]);
const handleCut = () => {
  // 获取原始图片和canvas元素
  const originalImage = new Image();
  originalImage.src = imageUrl.value;
  originalImage.onload = () => {
    console.log(originalImage.width, "图片宽高", originalImage.height);

    // 创建一个新的canvas元素用于切割
    const cutCanvas = document.createElement("canvas");
    cutCanvas.width = originalImage.width;
    cutCanvas.height = originalImage.height;
    const cutContext = cutCanvas.getContext("2d");

    // 绘制原始图片到新canvas上
    cutContext.drawImage(originalImage, 0, 0);

    // 排序
    cutLines.value.sort((a, b) => a - b);

    // const adjustedCutLines = cutLines.value.map((cutLineOnCanvas) =>
    //   Math.round(cutLineOnCanvas / aspectRatio.value)
    // );

    // 假设 canvas.value.height 是 canvas 的高度
    // 计算每个切割部分的高度
    const adjustedCutLines = cutLines.value.map((cutLineOnCanvas, index) => {
      // 原始图片的宽度和高度
      const originalWidth = originalImage.width;
      const originalHeight = originalImage.height;
      // 根据canvas的宽度和原始图片的宽高比计算canvas的高度
      const canvasHeight = aspectRatio.value * canvas.value.width;
      // 计算标记点在原始图片上的位置
      let adjustedY = (cutLineOnCanvas / canvasHeight) * originalHeight;
      return adjustedY;
    });
    console.log("计算高度", adjustedCutLines);

    // 根据标记点生成切割部分
    let cutParts = [];
    for (let i = 0; i < adjustedCutLines.length + 1; i++) {
      let cutY = 0;
      let height = 0;

      // 计算当前切割部分的起始位置和高度
      if (i === 0) {
        // 第一张图，从图片顶部到第一个标记点
        cutY = 0;
        height = adjustedCutLines[0] || originalImage.height; // 如果没有标记点，则使用图片的完整高度
      } else if (i === adjustedCutLines.length) {
        // 最后一张图，从最后一个标记点到图片底部
        cutY = adjustedCutLines[i - 1] || 0; // 如果没有前一个标记点，则从图片顶部开始
        height = originalImage.height - cutY; // 计算从最后一个标记点到图片底部的高度
      } else {
        // 中间的图，从当前标记点到下一个标记点
        cutY = adjustedCutLines[i - 1] || 0; // 如果没有前一个标记点，则从图片顶部开始
        height = adjustedCutLines[i] - cutY;
      }

      // 创建一个新的临时canvas元素来保存切割的部分
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = originalImage.width; // 使用原始图片的宽度
      tempCanvas.height = height; // 设置高度为当前切割部分的高度
      const tempContext = tempCanvas.getContext("2d");

      // 绘制原始图片的切割部分到临时canvas上
      tempContext.drawImage(
        cutCanvas,
        0, // 源x坐标
        cutY, // 源y坐标
        originalImage.width, // 源宽度
        height, // 源高度
        0, // 目标x坐标
        0, // 目标y坐标
        originalImage.width, // 目标宽度
        height // 目标高度
      );

      // 将临时canvas的dataURL添加到cutParts数组中
      cutParts.push(tempCanvas.toDataURL());
    }

    cutImages.value = cutParts;
    console.log(cutParts, "切完了", cutImages.value);
    // 清空cutLines数组，以便重新开始切割
    cutLines.value = [];
    marks.value = [];

    ElMessage({
      message: "切图成功！",
      type: "success",
    });
  };
};

// 下载压缩包
const handleDownload = () => {
  // 检查是否已进行切图，如果没有则提示用户进行切图
  if (cutImages.value.length === 0) {
    ElMessage.error("请先进行切图！");
    return;
  }

  // 创建一个JSZip实例
  const zip = new JSZip();

  // 遍历切图后的图片列表，将每个图片添加到压缩包中
  for (let i = 0; i < cutImages.value.length; i++) {
    const imageUrl = cutImages.value[i];
    const imageName = `image_${i + 1}.png`; // 根据需要设置图片的文件名
    const imageBlob = fetch(imageUrl).then((res) => res.blob());
    zip.file(imageName, imageBlob);
  }

  // 生成压缩包
  zip.generateAsync({ type: "blob" }).then(function (content) {
    // 使用FileSaver.js保存压缩包
    saveAs(content, "长切图压缩包包.zip");
  });
};

const isDragging = ref(false); // 拖拽状态标志
const lastMouseY = ref(0); // 上一次鼠标的Y坐标

const startDrag = (event) => {
  console.log("====================================");
  console.log("拖动开始了", event);
  console.log("====================================");
  isDragging.value = true;
  lastMouseY.value = event.clientY;
  document.addEventListener("mousemove", dragging);
  document.addEventListener("mouseup", endDrag);
  document.addEventListener("mouseleave", endDrag);
};

const dragging = (event) => {
  if (!isDragging.value) return;

  console.log("====================================");
  console.log(isDragging.value, "拖动中", event);
  console.log(event.clientY, "拖动中", lastMouseY.value);
  console.log("====================================");

  const deltaY = event.clientY - lastMouseY.value;

  const maxHeight = imageBox.value.clientHeight; // 获取父元素高度

  cutLinePosition.value = Math.max(
    0,
    Math.min(cutLinePosition.value + deltaY, maxHeight)
  );
  lastMouseY.value = event.clientY;

  // 阻止页面滚动
  event.preventDefault();
};

const endDrag = (event) => {
  console.log("====================================");
  console.log("拖动结束了", event);
  // 获取cut-line元素的引用
  const cutLineElement = document.querySelector(".cut-line");
  // 获取image-box元素的引用
  const imageBoxElement = document.querySelector(".image-box");
  console.log(
    "距离",
    getOffsetTopRelativeToParent(cutLineElement, imageBoxElement)
  );
  console.log("====================================");
  isDragging.value = false;
  document.removeEventListener("mousemove", dragging);
  document.removeEventListener("mouseup", endDrag);
  document.removeEventListener("mouseleave", endDrag);
};

const getOffsetTopRelativeToParent = (childElement, parentElement) => {
  // 首先获取子元素相对于文档的偏移量
  const childRect = childElement.getBoundingClientRect();
  const childOffsetTop = childRect.top + window.scrollY;

  // 然后获取父元素的边距和边框
  const parentStyle = getComputedStyle(parentElement);
  const parentBorderTop = parseInt(parentStyle.borderTopWidth, 10);
  const parentPaddingTop = parseInt(parentStyle.paddingTop, 10);

  // 计算父元素的顶部偏移量，包括边距和边框
  const parentOffsetTop =
    parentElement.offsetTop + parentBorderTop + parentPaddingTop;

  // 最后，从子元素相对于文档的偏移量中减去父元素的偏移量，得到相对于父元素的偏移量
  return childOffsetTop - parentOffsetTop;
};

onMounted(() => {
  // 获取cut-line元素的引用
  const cutLineElement = document.querySelector(".cut-line");
  // 获取image-box元素的引用
  const imageBoxElement = document.querySelector(".image-box");

  console.log("====================================");
  console.log(
    "距离",
    getOffsetTopRelativeToParent(cutLineElement, imageBoxElement)
  );
  console.log("====================================");
});
</script>

<style lang="less" scoped>
.container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  flex-direction: column;
  text-align: center;
  box-sizing: border-box;
}

.header {
  position: sticky;
  top: 0px;
  z-index: 999;
  box-sizing: border-box;
  padding: 20px;
}

.upload-button {
  margin-bottom: 20px;
}

.content-box {
  display: flex;
  justify-content: center;
  align-items: center;
}

.image-box {
  width: 800px; /* 图片盒子宽度 */
  height: auto; /* 图片盒子高度根据图片高度 */
  border: 1px solid #e4e7ed;
  position: relative;
  margin: 20px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0px 0px 12px rgba(0, 0, 0, 0.12);
}

.image-canvas {
  width: 600px; /* 图片宽度 */
  height: auto; /* 图片高度根据宽高比调整 */
  /* border: 1px solid #000;*/
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%); /* 居中显示 */
}

.cut-line {
  position: absolute;
  left: 0;
  width: 800px; /* 与image-box宽度一致 */
  height: 1px;
  background-color: black;
  top: 300px; /* 默认悬浮位置 */
  z-index: 9;
  cursor: ns-resize;
  transform: translateY(-50%);
  display: flex; /* 使用flex布局 */
  align-items: center; /* 垂直居中对齐 */
  justify-content: flex-end; /* 水平方向上靠右对齐 */
}

.cut-line-marker {
  width: 16px; /* 小元素的宽度 */
  height: 10px; /* 小元素的高度 */
  background-color: black; /* 小元素的背景颜色 */
  // border-radius: 50%; /* 圆形效果 */
  margin-left: 5px; /* 与横线的间距 */
  position: relative;
}

.cut-line-marker::after {
  content: ""; /* 伪元素需要content属性 */
  width: 0;
  height: 0;
  border-top: 5px solid transparent; /* 上边框 */
  border-bottom: 5px solid transparent; /* 下边框 */
  border-right: 5px solid black; /* 右边框，形成三角形 */
  position: absolute; /* 绝对定位 */
  top: 50%; /* 垂直居中 */
  left: -5px; /* 位于矩形的左侧外侧 */
  transform: translateY(-50%); /* 垂直居中 */
}

:global(.mark-box) {
  width: 800px;
  height: 30px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99;
  user-select: none;
  pointer-events: none;
}

:global(.mark-line) {
  width: 650px;
  height: 2px;
  background-color: red;
  margin: 0 10px;
}

:global(.mark-text) {
  font-size: 14px;
  color: red;
}

.img-preview {
  width: 800px; /* 图片盒子宽度 */
  height: auto; /* 图片盒子高度根据图片高度 */
  min-height: 300px;
  border: 1px solid #e4e7ed;
  position: relative;
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;

  box-shadow: 0px 0px 12px rgba(0, 0, 0, 0.12);
  margin-left: 50px;
  .img-box {
    width: 600px;
    img {
      width: 100%;
      height: 100%;
    }
  }
}
</style>
