import { reactive } from 'vue'

export const globalState = reactive({
  collectibles: {},   // 收集品计数，如 { candy: 2, star: 5 }
  flags: {},          // 任意标记，如 { doorOpened: true }
  ui: {               // 全局UI面板显隐
    collectionPanel: false,
    settingsPanel: false,
    bottomDialog: false
  },
  stageWidth: 0,
  stageHeight: 0,
  ttsEnabled: true,        // 全局朗读开关，默认开启
})