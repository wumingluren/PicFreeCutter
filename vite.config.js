// vite.config.js
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import legacy from "@vitejs/plugin-legacy";
import compression from "vite-plugin-compression2";
import { visualizer } from "rollup-plugin-visualizer";
import { analyzer } from "vite-bundle-analyzer";

export default defineConfig(({ command, mode }) => {
  //获取各种环境下的对应的变量
  const env = loadEnv(mode, process.cwd());
  const { VITE_APP_BASE, VITE_APP_TYPE } = env;

  // 定义 legacy 插件的条件逻辑
  const legacyPlugin =
    VITE_APP_TYPE !== "github"
      ? legacy({
          targets: ["defaults", "not IE 11"],
        })
      : undefined;

  return {
    base: VITE_APP_BASE || "./",
    plugins: [
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
      //开启gzip
      compression({
        threshold: 10240, // 设置只有超过 10k 的文件才执行压缩
        deleteOriginalAssets: false, // 设置是否删除原文件
        skipIfLargerOrEqual: true, // 如果压缩后的文件大小与原文件大小一致或者更大时，不进行压缩
        // 其他的属性暂不需要配置，使用默认即可
      }),
      // 条件性添加 legacy 插件
      legacyPlugin,
      visualizer({
        open: false, //在默认用户代理中打开生成的文件
        gzipSize: true, // 收集 gzip 大小并将其显示
        brotliSize: true, // 收集 brotli 大小并将其显示
        filename: "stats.html", // 分析图生成的文件名
      }),
      // 插件报错暂不启用
      // analyzer({
      //   openAnalyzer: false, // 是否打开静态网站
      // }),
    ].filter(Boolean), // 确保只有真值被包含
    build: {
      //rollup打包后的静态资源名称格式
      rollupOptions: {
        output: {
          dir: "dist/",
          manualChunks(id) {
            if (id.includes("node_modules")) {
              return "vendor";
            }
            // npm 正常 pnpm 会报错
            // if (id.includes("node_modules")) {
            //   return id
            //     .toString()
            //     .split("node_modules/")[1]
            //     .split("/")[0]
            //     .toString();
            // }
          },
          // 会导致报错
          // manualChunks: {
          //   // elementplus: ["element-plus"],
          //   vue: ["vue"],
          //   // leafer: ["leafer-ui", "leafer-in"],
          // },
          // 最小化拆分包 会导致报错
          // manualChunks(id) {
          //   // 创建一个对象映射，用于存储库名及其对应的chunk名称
          //   const libraryChunkMap = {
          //     "element-plus": "element-plus",
          //     "leafer-in": "leafer",
          //     "leafer-ui": "leafer",
          //     vue: "vue",
          //   };

          //   // 检查模块ID是否包含'node_modules'，即是否为第三方依赖
          //   if (id.includes("node_modules")) {
          //     // 遍历libraryChunkMap的键（即库名），查找与模块ID存在包含关系的库名
          //     const matchedLibrary = Object.keys(libraryChunkMap).find(
          //       (library) => id.includes(library)
          //     );

          //     // 如果找到了匹配的库名，返回对应的chunk名称（从libraryChunkMap中获取）
          //     if (matchedLibrary) {
          //       return libraryChunkMap[matchedLibrary];
          //     } else {
          //       // 如果未找到匹配的库名，将该第三方依赖归入默认的'vendor' chunk
          //       return "vendor";
          //     }
          //   } else {
          //     // 如果模块ID不包含'node_modules'，即不是第三方依赖，则将其归入'index' chunk
          //     return "index";
          //   }
          // },
          // 设置chunk的文件名格式
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId
              ? chunkInfo.facadeModuleId.split("/")
              : [];
            const fileName =
              facadeModuleId[facadeModuleId.length - 2] || "[name]";
            // 根据chunk的facadeModuleId（入口模块的相对路径）生成chunk的文件名
            return `js/${fileName}/[name].[hash].js`;
          },
          // 设置入口文件的文件名格式
          entryFileNames: "js/[name].[hash].js",
          // 设置静态资源文件的文件名格式
          assetFileNames: "[ext]/[name].[hash:4].[ext]",
        },
      },
    },
    esbuild: {
      pure: ["console.log"], // 删除 console.log
      drop: ["debugger"], // 删除 debugger
    },
  };
});
