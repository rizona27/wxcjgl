// utils/storage.js
const storage = {
  set(key, data) {
    wx.setStorageSync(key, data)
  },
  
  get(key) {
    return wx.getStorageSync(key) || null
  },
  
  init() {
    if (!this.get('config')) {
      this.set('config', {
        fullScore: 100,
        courses: ['语文', '数学', '英语']
      })
    }
    
    if (!this.get('records')) {
      this.set('records', [])
    }
  },
  
  // 添加成绩记录（修改为更通用的方法）
  addRecord(record) {
    const records = this.get('records') || []
    records.push(record)
    this.set('records', records)
  },
  
  // 删除成绩记录
  removeRecord(id) {
    const records = this.get('records') || []
    const newRecords = records.filter(r => r.id !== id)
    this.set('records', newRecords)
  },
  
  // 获取所有学生
  getAllStudents() {
    const records = this.get('records') || []
    return [...new Set(records.map(r => r.student))]
  },
  
  // 更新课程
  updateCourses(courses) {
    const config = this.get('config')
    config.courses = courses
    this.set('config', config)
  },
  
  // 更新满分值
  updateFullScore(fullScore) {
    const config = this.get('config')
    config.fullScore = fullScore
    this.set('config', config)
  },

  // 清除所有本地数据
  clearAllData() {
    wx.removeStorageSync('config');
    wx.removeStorageSync('records');
    // 可选：清除后重新初始化为默认值
    this.init(); 
  }
}

export default storage;