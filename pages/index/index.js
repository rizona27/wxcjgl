// 简化版农历计算函数 (注意：此函数为简化版，无法精确计算农历)
function getLunarDate(date) {
  const lunarMonths = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  const lunarDays = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
                       '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
                       '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

  // 简单映射，非真实农历计算
  const month = date.getMonth();
  const day = date.getDate() - 1;

  // 检查索引是否越界，避免报错
  if (lunarMonths[month] && lunarDays[day]) {
    return `农历${lunarMonths[month]}月${lunarDays[day]}`;
  } else {
    return '农历日期未知';
  }
}

// 辅助函数：格式化和风天气的日期字符串为“X月Y日”
function formatHefengDate(dateString) {
  if (!dateString) return '';
  const parts = dateString.split('-'); // 示例: "2025-07-21" -> ["2025", "07", "21"]
  if (parts.length === 3) {
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    return `${month}月${day}日`;
  }
  return dateString; // 如果格式不符，返回原字符串
}


Page({
  data: {
    time: '00:00:00',
    date: '2025年07月20日', // 使用当前日期作为初始值
    weekday: '星期日',     // 使用当前星期作为初始值
    lunar: '农历六月十七', // 使用当前农历作为初始值
    weather: {
      now: { text: '获取中...', temp: '--' },
      daily: []
    },
    refreshStatus: '下拉刷新', // 初始状态，让用户知道可以下拉
    pullUpStatus: '',
    locationAuth: false, // 对于模糊位置，这个状态可能不再严格表示授权，更多是是否尝试获取
    city: '未知城市',
    timeAnimation: false
  },

  onLoad() {
    this.updateDateTime();

    this.timer = setInterval(() => {
      this.updateDateTime();
    }, 1000);

    // 直接尝试获取天气，因为 wx.getFuzzyLocation 不再需要显式授权
    this.getWeather();
  },

  onUnload() {
    clearInterval(this.timer);
    clearTimeout(this.pullUpTimer);
  },

  // 监听用户下拉刷新动作
  onPullDownRefresh() {
    this.setData({ refreshStatus: '天气刷新中' });
    this.getWeather(true); // 直接获取天气，不需要再次检查权限
  },

  // 监听下拉过程
  onPulling(e) {
    // 根据实际测试调整阈值，例如50rpx，避免太早触发“释放刷新”
    const pullDistanceThreshold = 80;
    if (e.detail.dy > pullDistanceThreshold) {
      this.setData({ refreshStatus: '释放刷新' });
    } else {
      this.setData({ refreshStatus: '下拉刷新' });
    }
  },

  // 监听用户上拉触底事件
  onReachBottom() {
    this.setData({ pullUpStatus: '你还想看什么呢？' });

    clearTimeout(this.pullUpTimer);
    this.pullUpTimer = setTimeout(() => {
      this.setData({ pullUpStatus: '' });
    }, 2000);
  },

  // 检查位置权限 (此函数将不再检查 wx.getLocation 的权限，而是直接尝试获取模糊位置)
  checkLocationAuth() {
    // 对于 wx.getFuzzyLocation，不需要 'scope.userLocation' 权限
    // 我们可以直接尝试调用 getFuzzyLocation。如果失败，会在其 fail 回调中处理。
    // 这里可以设置 locationAuth 为 true，表示我们尝试了获取位置。
    this.setData({ locationAuth: true });
    this.getWeather();
  },

  // 请求位置权限 (此函数对于 wx.getFuzzyLocation 来说通常不再需要)
  requestLocationAuth() {
    // 如果只需要模糊位置，此函数通常可以被移除或留空。
    // 如果你的小程序有其他功能需要精确位置，则保留并引导用户授权。
    // 这里我们直接尝试获取天气，因为模糊位置不需要单独授权。
    this.getWeather();
  },

  // 更新日期时间
  updateDateTime() {
    const now = new Date();

    this.setData({ timeAnimation: true });
    setTimeout(() => this.setData({ timeAnimation: false }), 500);

    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const time = `${hours}:${minutes}:${seconds}`;

    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const date = `${year}年${month}月${day}日`;

    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = `星期${weekdays[now.getDay()]}`;

    const lunar = getLunarDate(now);

    this.setData({ time, date, weekday, lunar });
  },

  // 获取天气和位置信息
  getWeather(isPullDown = false) {
    if (!isPullDown) {
        this.setData({ 'weather.now.text': '获取中...' });
    }

    // *** 核心修改：将 wx.getLocation 替换为 wx.getFuzzyLocation ***
    wx.getFuzzyLocation({
      type: 'wgs84', // 参数保持不变，仍返回经纬度
      success: (res) => {
        const { latitude, longitude } = res;

        // 获取城市信息
        wx.request({
          url: 'https://geoapi.qweather.com/v2/city/lookup',
          data: {
            location: `${longitude},${latitude}`,
            key: '65ed29b09f324ac4ab357719e9365e9d',
            number: 1
          },
          success: (cityRes) => {
            if (cityRes.data && cityRes.data.code === '200' && cityRes.data.location.length > 0) {
              const city = cityRes.data.location[0].name;
              this.setData({ city });

              // 获取实时天气
              wx.request({
                url: 'https://devapi.qweather.com/v7/weather/now',
                data: {
                  location: `${longitude},${latitude}`,
                  key: '65ed29b09f324ac4ab357719e9365e9d'
                },
                success: (nowRes) => {
                  if (nowRes.data && nowRes.data.code === '200') {
                    this.setData({
                      'weather.now': nowRes.data.now
                    });
                  } else {
                    console.error('获取实时天气失败', nowRes);
                    this.setData({ 'weather.now.text': '实时天气获取失败' });
                  }
                },
                fail: (err) => {
                    console.error('实时天气请求失败', err);
                    this.setData({ 'weather.now.text': '实时天气请求失败' });
                },
                complete: () => {
                  if (isPullDown) {
                    wx.stopPullDownRefresh();
                    this.setData({ refreshStatus: '' }); // 刷新完成隐藏提示
                  }
                }
              });

              // 获取3天天气预报
              wx.request({
                url: 'https://devapi.qweather.com/v7/weather/3d',
                data: {
                  location: `${longitude},${latitude}`,
                  key: '65ed29b09f324ac4ab357719e9365e9d'
                },
                success: (dailyRes) => {
                  if (dailyRes.data && dailyRes.data.code === '200') {
                    // 使用 map 处理 daily 数据，格式化日期
                    const dailyWeather = dailyRes.data.daily.slice(0, 3).map(item => ({
                        ...item,
                        formattedDate: formatHefengDate(item.fxDate) // 添加格式化后的日期
                    }));
                    this.setData({
                      'weather.daily': dailyWeather
                    });
                  } else {
                    console.error('获取天气预报失败', dailyRes);
                  }
                },
                fail: (err) => {
                    console.error('天气预报请求失败', err);
                },
                complete: () => {
                    if (isPullDown && this.data.refreshStatus !== '') {
                        wx.stopPullDownRefresh();
                        this.setData({ refreshStatus: '' });
                    }
                }
              });
            } else {
              console.error('获取城市信息失败或无结果', cityRes);
              this.setData({
                city: '获取城市失败',
                'weather.now.text': '城市信息获取失败',
                'weather.now.temp': ''
              });
              wx.showToast({ title: '获取城市信息失败', icon: 'none', duration: 2000 });
              if (isPullDown) {
                wx.stopPullDownRefresh();
                this.setData({ refreshStatus: '' });
              }
            }
          },
          fail: (err) => {
            console.error('请求城市信息失败', err);
            this.setData({
              city: '请求城市失败',
              'weather.now.text': '城市信息请求失败',
              'weather.now.temp': ''
            });
            wx.showToast({ title: '请求城市信息失败', icon: 'none', duration: 2000 });
            if (isPullDown) {
              wx.stopPullDownRefresh();
              this.setData({ refreshStatus: '' });
            }
          }
        });
      },
      fail: (err) => {
        console.error('模糊位置获取失败', err);
        if (isPullDown) {
          wx.stopPullDownRefresh();
          this.setData({ refreshStatus: '' });
        }
        this.setData({
          weather: {
            now: { text: '位置获取失败', temp: '' }, // 更改为更通用的提示
            daily: []
          },
          locationAuth: false, // 模糊位置不完全依赖 locationAuth
          city: '未知城市'
        });
        wx.showToast({ title: '位置获取失败', icon: 'none', duration: 2000 });
      }
    });
  },

  // 新增：点击邮件地址跳转到 about 页面
  goToAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    });
  }
});