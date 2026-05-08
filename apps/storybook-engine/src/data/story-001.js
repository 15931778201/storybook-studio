// src/data/pages/toothless-tiger.js
// src/data/story-001.js —— 16:9 比例适配，通用组件引擎格式
const storyPages = [
  // ===== 第1页：森林里议论老虎牙齿 =====
  {
    id: 1,
    background: 'image_357077911328216.png',              // 16:9 横屏森林背景图
    narration: ['大森林里，谁都知道老虎的牙齿厉害。', '小猴伸着舌头说,嗬，比柱子还粗的树，大老虎只要用尖牙一啃就断！', '"大老虎嚼起铁杆来，跟吃面条一样……"小兔说着，畏惧得缩起了脑袋。'],
    bgm: 'forest-ambient',
    elements: [
      {
        type: 'character',
        id: 'monkey',
        props: {
          image: 'image_485717799727149.png',
          x: 0.255, y: 0.491,
          width: 0.1757,
          animations: [
            { type: 'float', duration: 1500, loop: true }
          ],
          onClick: [
            { type: 'showBubble', target: 'bubble-monkey', text: '嗬，比柱子还粗的树，大老虎只要用尖牙一啃就断！', duration: 3000 }
          ]
        }
      },
      {
        type: 'bubble',
        id: 'bubble-monkey',
        props: {
          target: 'monkey',
          position: 'top',
          autoShow: false,
          text: '嗬，比柱子还粗的树，大老虎只要用尖牙一啃就断！',
          duration: 3000
        }
      },
      {
        type: 'character',
        id: 'rabbit',
        props: {
          image: 'image_964427483835119.png',
          "x": 0.448,
          "y": 0.488,
          "width": 0.1195,
          onClick: [
            { type: 'showBubble', target: 'bubble-rabbit', text: '大老虎嚼起铁杆来，跟吃面条一样……', duration: 3000 }
          ]
        }
      },
      {
        type: 'bubble',
        id: 'bubble-rabbit',
        props: {
          target: 'rabbit',
          position: 'top',
          text: '大老虎嚼起铁杆来，跟吃面条一样……',
          // 手动显示，由点击触发
        }
      }
    ]
  },
  // ===== 第2页：小狐狸夸口 =====
  {
    id: 2,
    background: 'image_357077911328216.png',
    narration: ['小狐狸听了，哈哈大笑，说：“你们怕大老虎的牙齿，我就不怕！我还要把它的牙齿全部拔掉呢！”', '哈哈哈，哈哈哈，谁相信小狐狸的话呢？', '"吹牛！吹牛！""没羞！没羞！"小猴和小兔一个劲儿地笑小狐狸', '"不信，你们就瞧着吧！"小狐狸拍拍胸脯走了。'],
    elements: [
      {
        type: 'character',
        id: 'fox-bragging',
        props: {
          image: 'image_652232249565383.png',
          "x": 0.4012,
          "y": 0.3916,
          "width": 0.1481,
          onClick: [
            { type: 'showBubble', target: 'bubble-fox', "tts": true, text: '你们怕大老虎的牙齿，我就不怕！我还要把它的牙齿全部拔掉呢！', duration: 3500 }
          ]
        }
      },
      {
        type: 'character',
        id: 'monkey-doubt',
        props: {
          image: 'image_485717799727149.png',
          "x": 0.2768,
          "y": 0.6175,          
          width: 0.1295
        }
      },
      {
        type: 'character',
        id: 'rabbit-doubt',
        props: {
          image: 'image_964427483835119.png',
          "x": 0.5357,
          "y": 0.5590,
          width: 0.0946
        }
      },
      {
        type: 'bubble',
        id: 'bubble-fox',
        props: {
          target: 'fox-bragging',
          position: 'top',
          text: '你们怕大老虎的牙齿，我就不怕！我还要把它的牙齿全部拔掉呢！',
          autoShow: false,
          duration: 3500
        }
      }
    ]
  },

  // ===== 第3页：狐狸送糖（拖拽交互） =====
  {
    id: 3,
    background: 'image_023281317120782.png',
    narration: ['狐狸真的去找老虎了。他带了一大包礼物："啊，尊敬的大王，我给你带来了世界上最好吃的东西――糖。"', '糖是什么？老虎从来没有尝过，他吃了一粒奶油糖，啊哈，好吃极了。', '狐狸就常常送糖来。老虎吃了一粒又一粒，连睡觉的时候，糖也含在嘴里呢。'],
    elements: [
      {
        type: 'character',
        id: 'fox',
        props: {
          image: 'image_180530947925388.png',
          "x": 0.25560421075756096,
          "y": 0.4283725953289326,
          "width": 0.1835538840680074
        }
      },
      {
        type: 'character',
        id: 'tiger',
        props: {
          image: 'image_383256553773376.png',
          "x": 0.5295221547563245,
          "y": 0.31250933607864506,
          "width": 0.29906927778352993
        }
      },
      {
        type: 'draggable',
        id: 'candy',
        props: {
          "image": "image_733273834711277.png",
          "x": 0.38215926493108715,
          "y": 0.5972108843537415,
          "width": 0.051410643789585445,
          dropZones: [
            {
              targetId: 'tiger-mouth',
              onDrop: [
                { type: 'playSound', sound: 'crunch.mp3' },
                { type: 'showBubble', target: 'tiger-bubble', text: '啊哈，好吃极了！', duration: 2500 },
                { type: 'setState', target: 'tiger', state: 'chewing' },
                { type: 'wait', duration: 2000 },
                { type: 'setState', target: 'tiger', state: 'idle' },
                { type: 'hideBubble', target: 'tiger-bubble' }
              ]
            }
          ],
          snapBack: true
        }
      },
      {
        type: 'clickable',
        id: 'tiger-mouth',
        props: {
          hitArea: { x: 0.56, y: 0.5, width: 0.08, height: 0.07 },
          // 透明碰撞区，不显示
          // visual: { image: 'image_383256553773376.png' },
          onClick: []  // 只作为拖拽目标
        }
      },
      {
        type: 'bubble',
        id: 'tiger-bubble',
        props: {
          target: 'tiger',
          position: 'top',
          text: '啊哈，好吃极了' // 动态显示
        }
      }
    ]
  },

  // ===== 第4页：狮子劝老虎刷牙，狐狸劝阻 =====
  {
    id: 4,
    background: 'image_023281317120782.png',
    narration: ['大老虎的好朋友狮子(lion)劝他说，糖吃得太多，又不刷牙，牙齿会蛀掉的。', '大老虎正要刷牙，狐狸来了："啊，你把牙齿上的糖全刷掉了，多可惜呀。"', '馋嘴的老虎听了狐狸的话，不刷牙了。'],
    elements: [
      {
        type: 'character',
        id: 'tiger-sleepy',
        props: {
          image: 'image_383256553773376.png',
          "x": 0.4532159264931087,
          "y": 0.4683673469387756,
          "width": 0.22,
          "state": "sleeping"
        }
      },
      {
        type: 'character',
        id: 'lion',
        props: {
          image: 'image_599843338568549.png',
          "x": 0.2273353751914242,
          "y": 0.5238095238095238,
          "width": 0.1926838415257013
        }
      },
      {
        type: 'character',
        id: 'fox-sneaky',
        props: {
          image: 'image_652232249565383.png',
          "x": 0.6784839203675344,
          "y": 0.5544217687074829,
          "width": 0.12
        }
      },
      {
        type: 'clickable',
        id: 'toothbrush',
        props: {
          hitArea: { 
            x: 0.4, 
            y: 0.8, 
            "width": 0.02699382212896167,
            "height": 0.42
          },
          visual: { image: 'image_447712681982115.png' },
          onClick: [
            { type: 'showBubble', target: 'lion-bubble', text: '糖吃得太多，又不刷牙，牙齿会蛀掉的！', duration: 3000 },
            { type: 'wait', duration: 3000 },
            { type: 'hideBubble', target: 'lion-bubble' }
          ]
        }
      },
      {
        type: 'clickable',
        id: 'fox-stop',
        props: {
          hitArea: { x: 0.6784839203675344, y: 0.5544217687074829, width: 0.12, height: 0.15 },
          // 覆盖狐狸的隐式热区，点击狐狸触发劝阻
          onClick: [
            { type: 'showBubble', target: 'fox-bubble', text: '啊，你把牙齿上的糖全刷掉了，多可惜呀。', duration: 3000 }
          ]
        }
      },
      {
        type: 'bubble',
        id: 'lion-bubble',
        props: { target: 'lion', position: 'top', text: '' }
      },
      {
        type: 'bubble',
        id: 'fox-bubble',
        props: { target: 'fox-sneaky', position: 'top', text: '' }
      }
    ]
  },

  // ===== 第5页：老虎牙痛，找大夫 =====
  {
    id: 5,
    background: 'image_636820660342092.png',
    narration: ['过了些时候，半夜间，老虎牙痛了，痛得他捂住脸哇哇地叫……', '老虎忙去找牙科医生马大夫："快，快把我的牙拔了吧！"', '马大夫一听要给老虎拔牙，吓得门也不敢开了。'],
    elements: [
      {
        type: 'character',
        id: 'tiger-pain',
        props: {
          image: 'image_226462098319269.png',
          "x": 0.20153139356814706,
          "y": 0.4887755102040818,
          "width": 0.22,
          state: 'pain',
          animations: [{ type: 'swing', duration: 800, loop: true }]
        }
      },
      {
        type: 'character',
        id: 'horse-doctor',
        props: {
          image: 'image_554180414246038.png',
          "x": 0.42075099540581934,
          "y": 0.5685204081632652,
          "width": 0.12146112628338608,
          onClick: [
            { type: 'showBubble', target: 'horse-reply', text: '不敢不敢……', duration: 2000 },
          ]
        }
      },      
      {
        type: 'clickable',
        id: 'door-clinic',
        props: {
          hitArea: {       
            "x": 0.5505359877488515,
            "y": 0.42993197278911566,
            width: 0.2, 
            height: 0.4 
          },
          // visual: { image: 'door-clinic.png' },
          onClick: [
            { type: 'showBubble', target: 'horse-bubble', text: '快，快把我的牙拔了吧！', duration: 2500 },
            { type: 'wait', duration: 2500 },
            { type: 'hideBubble', target: 'horse-bubble' },
            { type: 'showBubble', target: 'horse-reply', text: '不敢不敢……', duration: 2000 },
            { type: 'hideBubble', target: 'horse-reply' }
          ]
        }
      },
      {
        type: 'bubble', id: 'horse-bubble',
        props: { target: 'tiger-pain', position: 'top', text: '' }
      },
      {
        type: 'bubble', id: 'horse-reply',
        props: { target: 'horse-doctor', position: 'top', text: '' } // 固定在门上方
      }
    ]
  },

  // ===== 第6页：找其他大夫，均被拒绝 =====
  {
    id: 6,
    background: 'image_636820660342092.png',
    narration: ['老虎又去问其他大夫，牛大夫、驴大夫、猪大夫，都吓得不敢拔牙。', '老虎的脸肿起来了，痛得他直叫喊："谁把我的牙拔掉，我让他做大王。"'],
    elements: [
      {
        type: 'character',
        id: 'tiger-pain2',
        props: {
          image: 'image_226462098319269.png',
          "x": 0.2845329249617152,
          "y": 0.5214285714285715,
          "width": 0.2,
          state: 'pain'
        }
      },
      {
        type: 'character',
        id: 'cow-doctor',
        props: {
          image: 'image_853497190818153.png',
          x: 0.5, y: 0.5,
          width: 0.14,
          onClick: [
            { type: 'showBubble', target: 'cow-bubble', text: '我，我不拔你的牙……', duration: 2000 }
          ]
        }
      },
      {
        type: 'character',
        id: 'donkey-doctor',
        props: {
          image: 'image_853497190818153.png',
          "x": 0.6210566615620213,
          "y": 0.6047619047619047,
          "width": 0.10954778693519072,
          onClick: [
            { type: 'showBubble', target: 'donkey-bubble', text: '我更不敢了！', duration: 2000 }
          ]
        }
      },
      {
        type: 'bubble', id: 'cow-bubble',
        props: { target: 'cow-doctor', position: 'top', text: '' }
      },
      {
        type: 'bubble', id: 'donkey-bubble',
        props: { target: 'donkey-doctor', position: 'top', text: '' }
      }
    ]
  },

  // ===== 第7页：拔牙（核心交互，顺序拔掉4颗牙） =====
  {
    id: 7,
    background: 'image_097674317668268.png',
    narration: ['这时候，狐狸穿了白大衣来了："我来拔吧。"老虎谢了又谢。', '"哎哟哟，你的牙全蛀掉了，得全拔掉！"狐狸说。'],
    elements: [
      {
        type: 'character',
        id: 'fox-doctor',
        props: {
          image: 'image_099279868951773.png',
          "x": 0.37741194486983154,
          "y": 0.603061224489796,
          "width": 0.16
        }
      },
      {
        type: 'character',
        id: 'tiger-mouth-open',
        props: {
          image: 'image_424953016154774.png',
          "x": 0.5016845329249616,
          "y": 0.5846938775510204,
          "width": 0.24,
          state: 'mouth-open'
        }
      },
      // 牙齿使用 clickable 组件，按顺序点击
      {
        type: 'clickable',
        id: 'tooth-1',
        props: {
          hitArea: { x: 0.64, y: 0.38, width: 0.04, height: 0.05 },
          visual: { image: 'image_473311302964677.png' },
          onClick: [
            { type: 'playSound', sound: 'pop.mp3' },
            { type: 'removeElement', target: 'tooth-1' },
            { type: 'addCollectible', item: 'tooth', count: 1 }
          ]
        }
      },
      {
        type: 'clickable',
        id: 'tooth-2',
        props: {
          hitArea: { x: 0.69, y: 0.38, width: 0.04, height: 0.05 },
          visual: { image: 'image_473311302964677.png' },
          onClick: [
            { type: 'playSound', sound: 'pop.mp3' },
            { type: 'removeElement', target: 'tooth-2' },
            { type: 'addCollectible', item: 'tooth', count: 1 }
          ]
        }
      },
      {
        type: 'clickable',
        id: 'tooth-3',
        props: {
          hitArea: { x: 0.74, y: 0.38, width: 0.04, height: 0.05 },
          visual: { image: 'image_473311302964677.png' },
          onClick: [
            { type: 'playSound', sound: 'pop.mp3' },
            { type: 'removeElement', target: 'tooth-3' },
            { type: 'addCollectible', item: 'tooth', count: 1 }
          ]
        }
      },
      {
        type: 'clickable',
        id: 'tooth-4',
        props: {
          hitArea: { x: 0.79, y: 0.38, width: 0.04, height: 0.05 },
          visual: { image: 'image_473311302964677.png' },
          onClick: [
            { type: 'playSound', sound: 'pop.mp3' },
            { type: 'removeElement', target: 'tooth-4' },
            { type: 'addCollectible', item: 'tooth', count: 1 },
            { type: 'if', condition: 'collectibles.tooth >= 4', then: [
              { type: 'showBubble', target: 'fox-finish', text: '哎哟哟，你的牙全蛀掉了，得全拔掉！', duration: 3000 },
              { type: 'wait', duration: 3000 },
              { type: 'nextPage' }
            ]}
          ]
        }
      },
      {
        type: 'bubble', id: 'fox-finish',
        props: { target: 'fox-doctor', position: 'top', text: '' }
      }
    ]
  },

  // ===== 第8页：结局——无牙老虎 =====
  {
    id: 8,
    background: 'image_357077911328216.png',
    narration: ['嗬，狐狸把老虎的牙全拔掉了。', '瞧，这只没有牙齿的老虎成为瘪嘴老虎啦。', '老虎还挺感激狐狸呢，他说："依然狐狸好，又送我糖吃，又替我拔牙。"'],
    elements: [
      {
        type: 'character',
        id: 'tiger-toothless',
        props: {
          image: 'image_487202282513311.png',   // 瘪嘴虎图
          "x": 0.2290964777947932,
          "y": 0.3792517006802721,
          "width": 0.18391369875059974,
          onClick: [
            { type: 'showBubble', target: 'tiger-final', text: '还是狐狸好，又送我糖吃，又替我拔牙。', duration: 4000 }
          ]
        }
      },
      {
        type: 'character',
        id: 'fox-proud',
        props: {
          image: 'image_652232249565383.png',
          "x": 0.471822358346095,
          "y": 0.476530612244898,
          "width": 0.15490165440707726
        }
      },
      {
        type: 'bubble', id: 'tiger-final',
        props: {
          target: 'tiger-toothless',
          position: 'top',
          text: '',
          autoShow: true
        }
      }
      // // 彩蛋：连续点击老虎 3 次嘴巴一张一合（可用 toggle 组件实现）
      // {
      //   type: 'toggle',
      //   id: 'tiger-mouth-toggle',
      //   props: {
      //     states: [
      //       { image: 'image_487202282513311.png' },
      //       { image: 'image_293216770948645.png' }  // 张嘴图（如果设计师提供）
      //     ],
      //     initialState: 0,
      //     onToggle: [
      //       { type: 'playSound', sound: 'pop.mp3' }
      //     ]
      //   }
      // }
    ]
  },
  {
    id: 999,
    background: 'image_357077911328216.png',
    elements: [
      // 各种组件测试
      { type: 'character', id: 'test-char', props: { image: 'image_652232249565383.png', x: 0.1, y: 0.2, width: 0.1,           onClick: [
            { type: 'showBubble', target: 'test-bubble', text: '还是狐狸好，又送我糖吃，又替我拔牙。', duration: 4000 }
          ]} },
      { type: 'clickable', id: 'test-click', props: { hitArea: { x: 0.3, y: 0.2, width: 0.1, height: 0.1 }, visual: { color: '#ff0000', opacity: 0.3 } } },
      { type: 'draggable', id: 'test-drag', props: { image: 'image_733273834711277.png', x: 0.5, y: 0.2, width: 0.05, dropZones: [] } },
      { type: 'collectible', id: 'test-collect', props: { image: 'image_733273834711277.png', x: 0.7, y: 0.2, width: 0.05, "onCollect": [
  { "type": "addCollectible", "item": "candy", "count": 1 },
  { "type": "removeElement", "target": "test-collect" }
] } },
      { type: 'toggle', id: 'test-toggle', props: { states: [{ image: 'image_733273834711277.png' }, { image: 'image_293216770948645.png' }], x: 0.1, y: 0.4, width: 0.08, cycle: true } },
      { type: 'sequence', id: 'test-seq', props: { x: 0.4, y: 0.4, steps: [] } },
      { type: 'timer', id: 'test-timer', props: { x: 0.6, y: 0.4, width: 0.3, height: 0.03, duration: 5000, display: { style: 'bar' } , onTimeout: [{ "type": "removeElement", "target": "test-timer" }]} },
      { type: 'bubble', id: 'test-bubble', props: { x: 0.2, y: 0.6, text: '测试气泡' } }
    ]
  }
];

export default {
  meta: { title: '没有牙齿的大老虎' },
  pages: storyPages
}