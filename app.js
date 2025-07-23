// app.js
App({
  globalData: {
    courses: [], // 全局课程列表 (master list)
    fullScore: 100, // 全局满分值
    records: [], // 全局成绩记录
    lastStudent: '', // 上次录入的学生姓名
    // 用于存储所有需要刷新的页面实例，以便在数据更新时通知它们
    pagesToRefresh: {},
  },

  onLaunch: function () {
    // 应用启动时加载数据
    this.loadCourses();
    this.loadFullScore();
    this.loadRecords();
    this.loadLastStudent();

    // 如果没有默认课程，可以初始化一些
    if (this.globalData.courses.length === 0) {
      this.globalData.courses = ['语文', '数学', '英语'];
      this.saveCourses();
    }
  },

  // === 数据加载函数 ===
  loadCourses: function () {
    try {
      const courses = wx.getStorageSync('courses');
      if (courses) {
        this.globalData.courses = courses;
        console.log('Courses loaded:', this.globalData.courses);
      } else {
        console.log('No courses in storage, initializing default.');
        // 如果没有存储的课程，可以设置一个默认值
        this.globalData.courses = ['语文', '数学', '英语'];
        this.saveCourses(); // 保存默认课程
      }
    } catch (e) {
      console.error('Failed to load courses:', e);
    }
  },

  loadFullScore: function () {
    try {
      const fullScore = wx.getStorageSync('fullScore');
      if (fullScore !== '' && fullScore !== null && fullScore !== undefined) { // fullScore could be 0, so check for empty string, null, undefined
        this.globalData.fullScore = fullScore;
        console.log('Full score loaded:', this.globalData.fullScore);
      } else {
        console.log('No full score in storage, using default 100.');
        this.globalData.fullScore = 100; // Ensure a default value is set
        this.saveFullScore(); // Save the default value
      }
    } catch (e) {
      console.error('Failed to load full score:', e);
    }
  },

  loadRecords: function () {
    try {
      const records = wx.getStorageSync('records');
      if (records) {
        this.globalData.records = records;
        console.log('Records loaded:', this.globalData.records.length);
      } else {
        this.globalData.records = [];
        console.log('No records in storage.');
      }
    } catch (e) {
      console.error('Failed to load records:', e);
    }
  },

  loadLastStudent: function () {
    try {
      const lastStudent = wx.getStorageSync('lastStudent');
      if (lastStudent) {
        this.globalData.lastStudent = lastStudent;
        console.log('Last student loaded:', this.globalData.lastStudent);
      } else {
        console.log('No last student in storage.');
      }
    } catch (e) {
      console.error('Failed to load last student:', e);
    }
  },

  // === 数据保存函数 ===
  saveCourses: function () {
    try {
      wx.setStorageSync('courses', this.globalData.courses);
      console.log('Courses saved:', this.globalData.courses);
    } catch (e) {
      console.error('Failed to save courses:', e);
    }
  },

  saveFullScore: function () {
    try {
      wx.setStorageSync('fullScore', this.globalData.fullScore);
      console.log('Full score saved:', this.globalData.fullScore);
    } catch (e) {
      console.error('Failed to save full score:', e);
    }
  },

  saveRecords: function () {
    try {
      wx.setStorageSync('records', this.globalData.records);
      console.log('Records saved:', this.globalData.records.length);
    } catch (e) {
      console.error('Failed to save records:', e);
    }
  },

  saveLastStudent: function (studentName) {
    try {
      this.globalData.lastStudent = studentName;
      wx.setStorageSync('lastStudent', studentName);
      console.log('Last student saved:', studentName);
    } catch (e) {
      console.error('Failed to save last student:', e);
    }
  },

  // === 辅助函数：从记录中获取所有唯一的课程和学生 ===
  // 这个函数用于筛选器，只显示实际有记录的课程
  getAllCoursesFromRecords: function (records) {
    const courses = new Set();
    (records || []).forEach(record => {
      if (record.course) {
        courses.add(record.course);
      }
    });
    return Array.from(courses).sort();
  },

  getAllStudents: function (records) {
    const students = new Set();
    (records || []).forEach(record => {
      if (record.student) {
        students.add(record.student);
      }
    });
    return Array.from(students).sort();
  },

  // === 页面刷新机制 ===
  // 注册页面，以便在全局数据变化时通知它们
  registerPage: function (pageInstance) {
    const route = pageInstance.route;
    if (!this.globalData.pagesToRefresh[route]) {
      this.globalData.pagesToRefresh[route] = [];
    }
    // 避免重复添加
    if (!this.globalData.pagesToRefresh[route].includes(pageInstance)) {
      this.globalData.pagesToRefresh[route].push(pageInstance);
    }
  },

  // 卸载页面时移除注册
  unregisterPage: function (pageInstance) {
    const route = pageInstance.route;
    if (this.globalData.pagesToRefresh[route]) {
      this.globalData.pagesToRefresh[route] = this.globalData.pagesToRefresh[route].filter(
        instance => instance !== pageInstance
      );
    }
  },

  // 刷新所有已注册的页面
  refreshAllPages: function () {
    for (const route in this.globalData.pagesToRefresh) {
      this.globalData.pagesToRefresh[route].forEach(pageInstance => {
        if (typeof pageInstance.onGlobalDataRefresh === 'function') {
          pageInstance.onGlobalDataRefresh();
        }
      });
    }
  }
});
