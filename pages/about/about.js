Page({
  data: {
    colors: [] // 用于存储随机生成的颜色
  },

  onLoad() {
    this.generateRandomColors();
  },

  /**
   * 生成活泼的莫兰蒂色系颜色（不与背景色混淆）
   * 可以根据需要调整颜色数组
   */
  generateRandomColors() {
    const morandiColors = [
      '#6d8494', // 蓝灰色
      '#8f7d98', // 紫灰色
      '#99a79a', // 绿灰色
      '#b99b8d', // 棕灰色
      '#c2b09c', // 米灰色
      '#7f8e9c', // 较深的蓝灰
      '#a0a8b4', // 浅蓝灰
      '#b2a6ad', // 玫瑰灰
      '#c2c7c5', // 浅绿灰
      '#d3b5b5'  // 浅粉灰
    ];

    const randomColors = [];
    // 确保每次打开页面时颜色都随机且不同
    const shuffledColors = morandiColors.sort(() => 0.5 - Math.random());
    for (let i = 0; i < 5; i++) {
      randomColors.push(shuffledColors[i % shuffledColors.length]);
    }
    this.setData({
      colors: randomColors
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  }
});