<template>
  <div class="container">
    <div class="header">
      <el-upload
        v-if="!imageUrl"
        ref="upload"
        class="upload-box"
        drag
        :auto-upload="false"
        :show-file-list="false"
        :accept="'.jpg,.jpeg,.png'"
        :on-change="handleUploadChange"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">拖动文件到此或者<em>点击选择</em></div>
      </el-upload>
      <div class="btn-box" v-if="imageUrl">
        <el-button type="danger" @click="refreshPage">重置页面</el-button>
        <el-button type="primary" @click="handleCut">分割图片</el-button>
        <el-button
          type="primary"
          :disabled="cutImages.length === 0"
          @click="centerDialogVisible = true"
          >预览切图</el-button
        >
        <el-button
          type="primary"
          :disabled="cutImages.length === 0"
          @click="handleDownload"
          >下载切图压缩包</el-button
        >
        <el-button type="primary" @click="open">关于</el-button>
        <!-- <el-button type="primary" @click="getMarks">检测</el-button> -->
      </div>
    </div>
    <div ref="contentRef" class="content-box" v-show="imageUrl">
      <div ref="leaferRef" class="leafer-box" id="leafer-box"></div>
      <div class="right-box">
        <div class="mode-box">
          <el-radio-group v-model="modeType" size="large">
            <el-radio-button label="纵向" :value="1" />
            <el-radio-button label="横向" :value="2" />
            <el-radio-button label="宫格" :value="3" />
          </el-radio-group>
        </div>

        <el-form size="large" label-position="right" class="form-style">
          <el-form-item label="条数" v-if="modeType === 1 || modeType === 2">
            <el-input-number v-model="lineNum" size="large" />
          </el-form-item>

          <el-form-item label="列数" v-if="modeType === 3">
            <el-input-number v-model="gridCols" size="large" />
          </el-form-item>

          <el-form-item label="行数" v-if="modeType === 3">
            <el-input-number v-model="gridRows" size="large" />
          </el-form-item>
        </el-form>

        <el-button type="primary" @click="addSeparators">添加分割线</el-button>
      </div>
    </div>
  </div>

  <el-dialog
    v-model="centerDialogVisible"
    title="预览"
    width="900"
    align-center
  >
    <div
      v-if="modeType !== 3"
      class="img-preview"
      :class="{ 'img-preview-h': xMarksList.length > 0 }"
    >
      <div v-for="(slice, index) in cutImages" :key="index" class="img-box">
        <img :src="slice" />
      </div>
    </div>

    <div
      v-if="modeType === 3"
      class="grid-container"
      :style="cutImages.length !== 0 ? gridContainerStyle : ''"
    >
      <div class="img-box" v-for="(slice, index) in cutImages" :key="index">
        <img :src="slice" />
      </div>
    </div>
  </el-dialog>

  <TemplatePromise v-slot="{ resolve, args, isResolving }">
    <el-dialog :modelValue="true" :title="args[0]">
      <h2>无名图片自由分割/切割在线工具-无名路人</h2>
      <h3>简介：</h3>
      <p>支持图片自由纵向分割，横向分割，宫格分割，低仿 wps 看图图片分割。</p>
      <h3>项目地址（求Star）：</h3>
      <p>https://github.com/wumingluren/PicFreeCutter</p>
      <div class="flex gap-2 justify-end">
        <el-button @click="resolve('cancel')"> 取消 </el-button>
        <el-button
          type="primary"
          :disabled="isResolving"
          @click="resolve(asyncFn())"
        >
          {{ isResolving ? "loading..." : "确认" }}
        </el-button>
      </div>
    </el-dialog>
  </TemplatePromise>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from "vue";
import { ElMessage, ElMessageBox, ElUpload, ElButton } from "element-plus";
import { UploadFilled } from "@element-plus/icons-vue";
import {
  Leafer,
  App,
  Group,
  Frame,
  Rect,
  Text,
  Canvas,
  Line,
  PointerEvent,
  ZoomEvent,
  DragEvent,
  Bounds,
  PropertyEvent,
  LeaferEvent,
  MoveEvent,
} from "leafer-ui";
import { Ruler } from "leafer-x-ruler";
import { EditorEvent, EditorMoveEvent } from "@leafer-in/editor";
import "@leafer-in/editor";
import "@leafer-in/view";
import "@leafer-in/editor";
import { ScrollBar } from "@leafer-in/scroll";
import { useResizeObserver, createTemplatePromise } from "@vueuse/core";
import debounce from "lodash.debounce";
import {
  gridsCutImage,
  cutImage,
  imagesToZip,
  isElementBInsideA,
  processLines,
} from "./utils.js";

// 图片和canvas元素引用
const imageUrl = ref(null);
const imageInfo = ref({
  width: 0,
  height: 0,
});

// 选择图片
const handleUploadChange = ({ raw }) => {
  const image = new Image();
  image.src = URL.createObjectURL(raw);
  image.onload = () => {
    imageInfo.value = {
      width: image.width,
      height: image.height,
    };

    setTimeout(() => {
      createLeaferApp();
      addImg();
      leaferRefResize();
    }, 200);
  };
  imageUrl.value = URL.createObjectURL(raw);
  // console.log(raw, "选择图片", image);
};

const leaferApp = ref(null);
const leaferScale = ref(null); // 画布缩放比例

/**
 * 创建画布
 */
const createLeaferApp = () => {
  // draw 不添加视窗交互功能

  // design 自动添加视窗交互功能，可以无限滚动、缩放页面。

  // document 自动添加视窗交互功能，限制在有内容的区域滚动页面，页面最小缩放比例为 1。
  const leaferAppTmp = new App({
    view: "leafer-box",

    ground: { type: "draw" },
    tree: {
      // type: "draw",
      wheel: { zoomMode: "true" }, // 是否开启鼠标滚动直接缩放视图
      zoom: { min: 0.3, max: 4 },
      move: {
        scroll: "limit",
      },
      // top: 100,
      // left: 100,
      editor: {
        moveable: false, // 移动
        resizeable: false, // 缩放
        rotateable: false, // 旋转
        skewable: false, // 倾斜
        boxSelect: false, // 是否启用框选功能
      },
    },
    editor: {},
    sky: { type: "draw", usePartRender: false },
  });

  const ruler = new Ruler(leaferAppTmp);

  new ScrollBar(leaferAppTmp);

  leaferAppTmp.tree.zoomLayer.x = 200;
  leaferAppTmp.tree.zoomLayer.y = 200;

  // const rect = new Rect({
  //   x: 200,
  //   y: 100,
  //   fill: "#32cd79",
  //   draggable: false,
  //   editable: false,
  // });

  // leaferAppTmp.tree.add(rect);

  leaferAppTmp.on(ZoomEvent.ZOOM, (e) => {
    console.log("====================================");
    console.log(e.scale, "缩放事件", e);
    console.log(leaferAppTmp.tree, "缩放比例", leaferAppTmp.tree.scale);
    console.log("====================================");
    // const center = { x: e.x, y: e.y };
    // LeafHelper.zoomOfWorld(leaferAppTmp, center, e.scale)
  });

  leaferAppTmp.on(MoveEvent.END, (e) => {
    console.log("====================================");
    console.log(e.target.x, e.target.y, "MoveEvent.END移动结束事件", e);
    // console.log(leaferAppTmp.tree, "所有元素", leaferAppTmp.tree.children);
    // e.target?.remove();
    // leafer.moveWorld(e.moveX, e.moveY)

    console.log(e.target.constructor.name);
    console.log(e.target.toJSON());
    console.log("====================================");
  });

  leaferAppTmp.on(PointerEvent.TAP, (e) => {
    console.log("点击事件触发", e);
    console.log("====================================");
    console.log(e.current.width, "current宽高", e.current.height);
    console.log(e.target.width, "target宽高", e.target.height);
    console.log("====================================");
  });

  console.log("====================================");
  console.log(leaferAppTmp, "初始化结束", leaferAppTmp.tree);
  console.log("====================================");

  leaferApp.value = leaferAppTmp;
};

// 增加图片
const imgRect = ref(null);
const frameAPP = ref(null);
/**
 * 添加图片到画布
 */
const addImg = () => {
  const frame = new Frame({
    width: imageInfo.value.width,
    height: imageInfo.value.height,
    editable: false,
    overflow: "hide",
  });

  const rect = new Rect({
    x: 0,
    y: 0,
    width: imageInfo.value.width,
    height: imageInfo.value.height,
    fill: {
      type: "image",
      url: imageUrl.value,
    },
    editable: false,
  });

  leaferApp.value.tree.add(frame);

  frame.add(rect);

  imgRect.value = rect;
  frameAPP.value = frame;

  // 缩放到最佳比例
  leaferApp.value.tree.zoom("fit");
  console.log(leaferApp.value.tree, "缩放比例", leaferApp.value.tree.scale);
  let scale = leaferApp.value.tree.scale;
  leaferScale.value = (scale * 100).toFixed(2);

  addSeparators();
};

// 增加分割线
// vertical 垂直 horizontal 水平
const DIRECTION_NAMES = {
  vertical: "竖",
  horizontal: "横",
};

/**
 * 添加一条分割线到指定的位置。
 * @param {Object} config - 包含分割线方向、尺寸和位置的配置对象。
 * @param {string} [config.direction='vertical'] - 分割线的方向，可以是 'vertical' 或 'horizontal'。
 * @param {number} [config.imageInfo] - 宽高信息
 * @param {Array<number>} [config.positions] - 分割线应该放置的位置数组，用于指定多个位置。
 */
const addLine = ({ direction = "vertical", imageInfo, positions }) => {
  let lineList = [];

  for (let i = 0; i < positions.length; i++) {
    const x = direction === "vertical" ? positions[i] : 0;
    const y = direction === "vertical" ? 0 : positions[i];
    const width = direction === "vertical" ? imageInfo.height : imageInfo.width;

    const line = new Line({
      x,
      y,
      width,
      strokeWidth: 6,
      stroke: "#ff0000",
      draggable: false,
      editable: false,
      rotation: direction === "vertical" ? 90 : 0, // 旋转角度
      cursor: direction === "vertical" ? "ew-resize" : "ns-resize", // 鼠标样式
      name: `${DIRECTION_NAMES[direction]}线`,
    });

    lineList.push(line);

    console.log(lineList, "循环添加分割线");
  }

  const group = new Group({
    x: 0,
    y: 0,
    children: lineList,
    name: `${DIRECTION_NAMES[direction]}线分组`,
  });

  frameAPP.value.add(group);

  group.on(DragEvent.DRAG, (e) => {
    // console.log("====================================");
    // console.log(e.target.x, e.target.y, "拖动中事件", e);
    // console.log(
    //   e.moveX,
    //   `${direction === "vertical" ? "竖" : "横"}线`,
    //   "拖动中事件",
    //   e.moveY
    // );

    if (direction === "vertical") {
      e.target.moveWorld(e.moveX, 0);
    } else {
      e.target.moveWorld(0, e.moveY);
    }

    // console.log(e.target.constructor.name);
    // console.log(e.target.toJSON());
    // console.log("====================================");
  });

  group.on(DragEvent.END, (e) => {
    console.log("====================================");
    console.log(e.target.x, e.target.y, "拖动结束事件", e);
    console.log(imgRect.value, "底图");
    let result = isElementBInsideA(
      { x: 0, y: 0, width: imgRect.value.width, height: imgRect.value.height },
      {
        x: e.target.x,
        y: e.target.y,
      }
    );
    console.log("result", result, "是否包含结果");
    console.log("====================================");
  });
};

const GROUP_NAMES = {
  VERTICAL_GROUP: "竖线分组",
  HORIZONTAL_GROUP: "横线分组",
  VERTICAL: "竖线",
  HORIZONTAL: "横线",
};

const xMarksList = ref([]); // 竖线-横向标点
const yMarksList = ref([]); // 横线-竖向标点
/**
 * 获取并处理竖线和横线的标点。
 */
const getMarks = () => {
  // 打印 frameAPP 和 imgRect 的当前值
  console.log(frameAPP.value, "执行检测");
  console.log(imgRect.value, "底图");

  // 初始化竖线和横线的列表变量
  let verticalList = undefined;
  let horizontalList = undefined;

  // 遍历 frameAPP 中的所有子元素
  frameAPP.value.children.forEach((element) => {
    // 检查当前元素是否为分组，并根据名称判断是竖线分组还是横线分组
    if (element.tag === "Group") {
      // 如果找到竖线分组或横线分组，更新相应的列表变量
      verticalList =
        element.name === GROUP_NAMES.VERTICAL_GROUP ? element : verticalList;
      horizontalList =
        element.name === GROUP_NAMES.HORIZONTAL_GROUP
          ? element
          : horizontalList;
    }
  });

  // 只有在找到竖线分组时，才处理竖线标点
  if (verticalList) {
    let verticalResultList = processLines(
      verticalList,
      imgRect.value,
      true // 传递 true 表示处理竖线
    );
    xMarksList.value = verticalResultList;
    console.log("竖线标点:", verticalResultList);
  }

  // 只有在找到横线分组时，才处理横线标点
  if (horizontalList) {
    let horizontalResultList = processLines(
      horizontalList,
      imgRect.value,
      false // 传递 false 表示处理横线
    );
    yMarksList.value = horizontalResultList;
    console.log("横线标点:", horizontalResultList);
  }
};

/**
 * 用于添加水平或垂直分割线
 */

const addSeparator = (direction, imageInfo, count) => {
  if (count > 0) {
    // 计算分割线之间的间距
    const spacing = (total, count) => total / (count + 1);

    const positions = [];

    // 循环计算每个标点的位置，并添加到 positions 数组中
    for (let i = 1; i <= count; i++) {
      // 计算当前标点的位置，并推入数组
      if (direction == "horizontal") {
        positions.push(i * spacing(imageInfo.height, count));
      } else {
        positions.push(i * spacing(imageInfo.width, count));
      }
    }

    addLine({
      direction: direction,
      imageInfo,
      positions,
    });
  }
};

// 添加分割线
const addSeparators = () => {
  deleteLineGroup();
  switch (modeType.value) {
    case 1:
      addSeparator("vertical", imageInfo.value, lineNum.value);
      break;
    case 2:
      addSeparator("horizontal", imageInfo.value, lineNum.value);
      break;
    case 3:
      addSeparator("vertical", imageInfo.value, gridCols.value);
      addSeparator("horizontal", imageInfo.value, gridRows.value);
      break;
    default:
      break;
  }
};

// 分割线类型
const modeType = ref(1);
const lineNum = ref(1);
const gridRows = ref(1); // 行数
const gridCols = ref(1); // 列数

// 重置数据
watch(modeType, (newValue) => {
  lineNum.value = 1;
  gridRows.value = 1;
  gridCols.value = 1;
  addSeparators();
});

/**
 * 删除分割线组
 */
const deleteLineGroup = () => {
  console.log(leaferApp.value, "点击删除", leaferApp.value.tree);
  console.log(
    leaferApp.value.tree.children[0],
    "点击删除",
    leaferApp.value.tree.children[0].children
  );
  let list = leaferApp.value.tree.children[0].children;

  // 使用 slice() 方法创建原始数组的副本，然后使用 reverse() 方法逆序
  for (const item of list.slice().reverse()) {
    if (item.tag === "Group") {
      console.log(item, "删除", item.name);
      item.remove();
      // item.clear();
    }
  }

  console.log(list, "删除完成", leaferApp.value.tree.children[0].children);
};

// 分割图片
const cutImages = ref([]);
const handleCut = () => {
  // 获取原始图片和canvas元素
  const originalImage = new Image();
  originalImage.src = imageUrl.value;
  originalImage.onload = () => {
    getMarks();
    console.log(xMarksList.value, "查看标点", yMarksList.value);
    // 根据提供的标点进行分割
    if (xMarksList.value.length && !yMarksList.value.length) {
      // 只有横线标点
      cutImages.value = cutImage(originalImage, xMarksList.value, "horizontal");
    } else if (!xMarksList.value.length && yMarksList.value.length) {
      // 只有竖线标点
      cutImages.value = cutImage(originalImage, yMarksList.value, "vertical");
    } else if (xMarksList.value.length && yMarksList.value.length) {
      // 同时有横线和竖线标点的情况
      cutImages.value = gridsCutImage(
        originalImage,
        xMarksList.value,
        yMarksList.value
      );
    }
    ElMessage({
      message: "切图成功！",
      type: "success",
    });

    return;
  };
};

// 下载压缩包
const handleDownload = () => {
  imagesToZip(cutImages.value);
};

const centerDialogVisible = ref(false);

const TemplatePromise = createTemplatePromise();

async function open() {
  console.log(gridContainerStyle);
  console.log("Before");
  const result = await TemplatePromise.start("关于", `Hello `);
  console.log("After", result);
}

function asyncFn() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("ok");
    }, 1000);
  });
}

// 宫格展示图片样式
const gridContainerStyle = computed(() => {
  return {
    gridTemplateColumns: `repeat(${xMarksList.value.length + 1}, 1fr)`,
    gridTemplateRows: `repeat(${yMarksList.value.length + 1}, 1fr)`,
  };
});

const refreshPage = () => {
  window.location.reload();
};

const contentRef = ref();
const leaferRef = ref();

const leaferRefResize = () => {
  useResizeObserver(leaferRef, (entries) => {
    const [entry] = entries;
    const { width, height } = entry.contentRect;
    console.log(leaferApp.value, "leaferRef大小变化", width, height);
    // 这步是为了触发leafer-ui的resize事件，标尺在监听到resize事件后会重新渲染
    if (!leaferApp.value || !imageUrl.value) return;
    leaferApp.value.app.resize({ width, height });
  });
};
onMounted(() => {
  // createLeaferApp();
});
</script>

<style lang="less" scoped>
.container {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  flex-direction: column;
  text-align: center;
  box-sizing: border-box;
}

.header {
  width: 100%;
  // position: sticky;
  top: 0px;
  z-index: 99;
  box-sizing: border-box;
  padding: 10px;
}

.upload-box {
  width: 300px;
  width: 100%;
  // margin-bottom: 20px;
}

::deep(.el-upload-dragger) {
  padding: 20px;
}

.content-box {
  width: 100%;
  flex: 1;
  display: flex;
  justify-content: center;
  // align-items: center;
  padding: 10px;
  box-sizing: border-box;
}

.leafer-box {
  // width: 1000px;
  // width: 100%;
  height: 100%;
  flex: 1;
  overflow: hidden;
}

.right-box {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  align-content: center;
  justify-content: center;
  align-items: center;
}

.mode-box {
  margin-bottom: 20px;
}

.form-style {
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
}

.el-form-item {
  margin: 10px; /* 根据需要调整间距 */
  width: fit-content; /* 根据内容自适应宽度 */
}

.mb20 {
  margin-bottom: 20px;
}

.img-preview {
  width: 100%;
  height: auto;
  min-height: 300px;
  border: 1px solid #e4e7ed;
  position: relative;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0px 0px 12px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  .img-box {
    margin: 5px;
    img {
      width: 100%;
      max-height: calc(100vh - 200px);
    }
  }
}

.img-preview-h {
  flex-direction: row;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  grid-template-rows: repeat(1, 1fr);
  width: 100%;
  max-width: 100%;
  max-height: calc(100vh - 200px);
  grid-gap: 1px;
  align-content: center;
  justify-content: center;
  align-items: center;
  justify-items: center;
}
.img-box {
  width: auto;
  max-width: 100%;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}
.img-box img {
  object-fit: contain;
  width: 100%;
  max-width: 100%;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  /* border: 1px solid white; */
}
</style>
