// analysis.js
const app = getApp();
let WxCharts = require('../../libs/wxcharts.js'); 

// 定义变量来存储不同类型的 WxCharts 实例
let trendChartInstance = null;
let subjectChartInstance = null;
let studentCourseChartInstance = null;

Page({
  data: {
    // 选择框体数据
    courses: [], // 所有可用课程
    students: [], // 所有可用学生
    courseIndex: 0, // 当前选中的课程索引
    studentIndex: 0, // 当前选中的学生索引

    chartType: '', // 当前显示的图表类型: 'trend', 'subject', 'studentCourse', 'selectDateForCourse'

    studentName: '', // 选中的学生姓名
    courseName: '', // 选中的课程姓名

    maxScore: 0, // 图表统计: 最高分
    minScore: 0, // 图表统计: 最低分
    avgScore: 0, // 图表统计: 平均分
    
    subjectData: [], // 饼图/列表数据
    studentCourseData: [], // 柱状图/学生列表数据

    availableDates: [], // 课程日期选择器数据
    selectedDateIndex: 0, // 课程日期选择器当前选中索引

    // Canvas 尺寸，用于 WxCharts 初始化
    canvasWidth: 300,
    canvasHeight: 250,
    isCanvasReady: false, // 标记 Canvas 是否已准备好

    highlightedSubjectIndex: -1, // -1 表示没有高亮项，用于饼图点击高亮
  },

  onLoad() {
    app.registerPage(this);
    this.loadData();
  },

  onUnload() {
    app.unregisterPage(this);
    // 页面卸载时销毁所有图表实例
    this.destroyCharts();
  },

  /**
   * 监听用户下拉动作
   */
  onPullDownRefresh() {
    this.resetChart(); // 调用重置所有状态和图表的方法
    wx.stopPullDownRefresh(); // 停止下拉刷新动画
    wx.showToast({
      title: '页面已重置',
      icon: 'none',
      duration: 1000
    });
  },

  onShow() {
    // 每次页面显示时都尝试加载数据，并保留之前的选择
    this.loadData(() => {
      // 根据当前 chartType 决定是否重新绘制图表
      if (this.data.chartType === 'trend' && this.data.studentIndex > 0 && this.data.courseIndex > 0) {
        this.generateTrendChart(this.data.studentName, this.data.courseName);
      } else if (this.data.chartType === 'subject' && this.data.studentIndex > 0) {
        this.generateSubjectChart(this.data.studentName);
      } else if (this.data.chartType === 'studentCourse' && this.data.courseIndex > 0 && this.data.selectedDateIndex > 0) {
        this.generateStudentCourseChart(this.data.courseName, this.data.availableDates[this.data.selectedDateIndex]);
      } else {
        // 如果没有选中的图表类型，则清空所有图表
        this.destroyCharts();
      }
    });
  },

  /**
   * 加载数据并更新页面状态
   * @param {function} callback - 数据加载和处理完毕后的回调函数
   */
  loadData(callback) {
    app.loadRecords();
    app.loadCourses();

    const rawCourses = app.globalData.courses || [];
    const rawStudents = app.getAllStudents(app.globalData.records) || [];

    // 在数组前面添加一个空字符串作为“请选择”选项
    const coursesWithOptions = ['', ...rawCourses];
    const studentsWithOptions = ['', ...rawStudents];

    // 尝试保留当前选中项
    const currentCourseName = this.data.courseIndex > 0 ? this.data.courses[this.data.courseIndex] : '';
    const currentStudentName = this.data.studentIndex > 0 ? this.data.students[this.data.studentIndex] : '';

    let newCourseIndex = coursesWithOptions.indexOf(currentCourseName);
    if (newCourseIndex === -1) newCourseIndex = 0;

    let newStudentIndex = studentsWithOptions.indexOf(currentStudentName);
    if (newStudentIndex === -1) newStudentIndex = 0;

    this.setData({
      courses: coursesWithOptions,
      students: studentsWithOptions,
      courseIndex: newCourseIndex, // 修正：这里应该是 newCourseIndex
      studentIndex: newStudentIndex,
      // 确保 studentName 和 courseName 总是反映当前选择
      studentName: newStudentIndex > 0 ? studentsWithOptions[newStudentIndex] : '', // 修正：从 studentsWithOptions 获取
      courseName: newCourseIndex > 0 ? coursesWithOptions[newCourseIndex] : '', // 修正：从 coursesWithOptions 获取
    }, () => {
      // 如果当前是“选择日期”模式，需要重新加载可用日期
      if (this.data.chartType === 'selectDateForCourse' || this.data.chartType === 'studentCourse') {
        if (this.data.courseIndex > 0) {
          const courseName = this.data.courses[this.data.courseIndex];
          const recordsForCourse = app.globalData.records.filter(r => r.course === courseName);
          const uniqueDates = [...new Set(recordsForCourse.map(r => r.date))].sort((a, b) => new Date(a) - new Date(b));
          const availableDatesWithOptions = ['', ...uniqueDates];
          const currentDate = this.data.availableDates[this.data.selectedDateIndex];
          const newDateIndex = availableDatesWithOptions.indexOf(currentDate);

          this.setData({
              availableDates: availableDatesWithOptions,
              selectedDateIndex: newDateIndex > -1 ? newDateIndex : 0
          });
        }
      }
      if (typeof callback === 'function') {
        callback();
      }
    });
  },

  // === 选择器事件 ===
  studentChange(e) {
    const newStudentIndex = parseInt(e.detail.value);
    // 确保从最新的 students 数组中获取名称，避免 undefined
    const newStudentName = this.data.students[newStudentIndex]; 
    this.setData({
      studentIndex: newStudentIndex,
      studentName: newStudentIndex > 0 ? newStudentName : '' // 确保 studentName 不为 undefined
    });
    this.resetChartState(); // 选择变化时重置图表状态
  },

  courseChange(e) {
    const newCourseIndex = parseInt(e.detail.value);
    // 确保从最新的 courses 数组中获取名称，避免 undefined
    const newCourseName = this.data.courses[newCourseIndex]; 
    this.setData({
      courseIndex: newCourseIndex,
      courseName: newCourseIndex > 0 ? newCourseName : '' // 确保 courseName 不为 undefined
    });
    this.resetChartState(); // 选择变化时重置图表状态
  },

  dateChange(e) {
    const selectedDateIndex = parseInt(e.detail.value);
    this.setData({
      selectedDateIndex: selectedDateIndex
    });

    if (selectedDateIndex > 0) {
      const selectedDate = this.data.availableDates[selectedDateIndex];
      const courseName = this.data.courses[this.data.courseIndex];
      this.generateStudentCourseChart(courseName, selectedDate);
    } else {
      this.destroyCharts(); // 如果选择“请选择日期”，则销毁图表
      this.setData({ studentCourseData: [], chartType: 'selectDateForCourse' });
    }
  },

  /**
   * 重置图表相关的状态，但不重置学生和课程选择
   */
  resetChartState() {
    this.destroyCharts();
    this.setData({
      chartType: '',
      availableDates: [],
      selectedDateIndex: 0,
      subjectData: [],
      studentCourseData: [],
      maxScore: 0,
      minScore: 0,
      avgScore: 0,
      highlightedSubjectIndex: -1 // 重置高亮状态
    });
  },

  /**
   * 销毁所有图表实例
   */
  destroyCharts() {
    // WxCharts 没有 destroy 方法，直接置空即可
    if (trendChartInstance) {
      trendChartInstance = null;
    }
    if (subjectChartInstance) {
      subjectChartInstance = null;
    }
    if (studentCourseChartInstance) {
      studentCourseChartInstance = null;
    }
  },

  /**
   * 生成图表的主入口
   */
  generateChart() {
    const { studentIndex, courseIndex, students, courses } = this.data;
    const studentSelected = studentIndex > 0;
    const courseSelected = courseIndex > 0;

    if (!studentSelected && !courseSelected) {
      wx.showToast({ title: '请至少选择一个学生或课程', icon: 'none' });
      return;
    }

    this.destroyCharts(); // 每次生成新图表前先销毁旧图表

    // 重置高亮状态
    this.setData({
      highlightedSubjectIndex: -1
    });

    if (studentSelected && courseSelected) {
      const studentName = students[studentIndex];
      const courseName = courses[courseIndex];
      this.setData({ studentName, courseName, chartType: 'trend' }, () => {
        this.generateTrendChart(studentName, courseName);
      });
    } else if (studentSelected) {
      const studentName = students[studentIndex];
      this.setData({ studentName, courseName: '', chartType: 'subject' }, () => {
        this.generateSubjectChart(studentName);
      });
    } else if (courseSelected) {
      const courseName = courses[courseIndex];
      const recordsForCourse = app.globalData.records.filter(r => r.course === courseName);

      if (recordsForCourse.length === 0) {
        wx.showToast({ title: '该课程没有成绩记录', icon: 'none' });
        this.setData({ chartType: '' });
        return;
      }

      // 获取该课程所有记录的唯一日期，并按时间顺序排序
      const uniqueDates = [...new Set(recordsForCourse.map(r => r.date))].sort((a, b) => new Date(a) - new Date(b));
      const availableDatesWithOptions = ['', ...uniqueDates];

      this.setData({
        courseName,
        studentName: '',
        availableDates: availableDatesWithOptions,
        selectedDateIndex: 0, // 重置日期选择为“请选择日期”
        chartType: 'selectDateForCourse' // 切换到日期选择模式
      });
      wx.showToast({ title: '请选择一个日期进行分析', icon: 'none' });
    }
  },

  /**
   * 重置所有表单输入内容和图表
   */
  resetChart() {
    this.setData({
      courseIndex: 0,
      studentIndex: 0,
      studentName: '',
      courseName: '',
      chartType: '', // 清空当前图表类型，隐藏所有图表
      maxScore: 0,
      minScore: 0,
      avgScore: 0,
      subjectData: [],
      studentCourseData: [],
      availableDates: [],
      selectedDateIndex: 0,
      highlightedSubjectIndex: -1 // 重置高亮状态
    }, () => {
      this.destroyCharts(); // 确保所有图表实例被清除
    });
  },

  /**
   * 生成学生单科成绩趋势图 (折线图)
   */
  generateTrendChart(studentName, courseName) {
    const records = app.globalData.records
      .filter(r => r.student === studentName && r.course === courseName)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (records.length === 0) {
      wx.showToast({ title: '没有找到该学生该课程的成绩记录', icon: 'none' });
      this.setData({ chartType: '' });
      return;
    }

    const dates = records.map(r => r.date); // X轴将直接显示日期字符串
    const scores = records.map(r => r.score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const avgScore = (scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(1);

    // 动态设定Y轴上下限，确保在0到满分之间，并有一定缓冲
    const yAxisMin = Math.max(0, Math.floor(minScore * 0.9)); // 最低成绩-10%，但不低于0
    const yAxisMax = Math.min(app.globalData.fullScore, Math.ceil(maxScore * 1.1)); // 最高成绩+10%，但不超过总分

    this.setData({ maxScore, minScore, avgScore });

    // 使用新的API获取系统信息以替代 wx.getSystemInfoSync
    const windowInfo = wx.getWindowInfo();
    const deviceInfo = wx.getDeviceInfo();
    const pixelRatio = deviceInfo.pixelRatio;
    const width = windowInfo.windowWidth - 40; // 留出左右边距
    const height = 300;

    // 销毁旧实例
    if (trendChartInstance) {
      trendChartInstance = null;
    }

    trendChartInstance = new WxCharts({
      canvasId: 'trendCanvas',
      type: 'line',
      categories: dates, // X轴显示时间
      series: [{ name: '成绩', data: scores, format: val => val.toFixed(1) }],
      yAxis: {
        min: yAxisMin,
        max: yAxisMax,
        format: val => val.toFixed(0)
      },
      width: width,
      height: height,
      dataLabel: true,
      dataPointShape: true,
      enableScroll: true, // 允许滚动
      extra: { lineStyle: 'curve' },
      animation: true, // 恢复动画
      pixelRatio: pixelRatio // 使用设备像素比
    });
  },

  /**
   * 生成学生各科成绩饼图
   */
  generateSubjectChart(studentName) {
    const records = app.globalData.records
      .filter(r => r.student === studentName)
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // 按日期降序排序，确保取到最新成绩

    if (records.length === 0) {
      wx.showToast({ title: '没有找到该学生的成绩记录', icon: 'none' });
      this.setData({ chartType: '' });
      return;
    }

    const courseMap = {}; // 用于存储每个课程的最新成绩记录
    records.forEach(record => {
      // 如果该课程还没有记录，或者当前记录比已有的更“新”（因为已按日期降序），则更新
      if (!courseMap[record.course] || new Date(record.date) > new Date(courseMap[record.course].date)) {
        courseMap[record.course] = record;
      }
    });

    // 关键修改：为 subjectData 中的每个课程添加 color 属性
    const subjectData = Object.values(courseMap).map((record, index) => { // 添加 index 参数
      const score = parseFloat(record.score);
      const fullScore = parseFloat(record.fullScore);
      const lossScoreValue = fullScore - score;
      const lossScore = parseFloat(lossScoreValue.toFixed(1)); // 确保失分也是一位小数

      return {
        course: record.course,
        score: score,
        fullScore: fullScore,
        lossScore: lossScore, // 保存失分
        color: this.getMorandiColor(index) // 根据索引分配颜色
      }
    });

    this.setData({ subjectData });

    // 使用新的API获取系统信息以替代 wx.getSystemInfoSync
    const windowInfo = wx.getWindowInfo();
    const deviceInfo = wx.getDeviceInfo();
    const pixelRatio = deviceInfo.pixelRatio;
    const width = windowInfo.windowWidth - 40;
    const height = 300; // 饼图高度可以稍微大一点

    // 销毁旧实例
    if (subjectChartInstance) {
      subjectChartInstance = null;
    }

    subjectChartInstance = new WxCharts({
      canvasId: 'subjectCanvas',
      type: 'pie',
      series: subjectData.map((item) => { // item 现在已经包含了 color
        const totalLossScore = subjectData.reduce((sum, s) => sum + s.lossScore, 0); // 重新计算总失分，确保百分比正确
        const lossPercentage = totalLossScore > 0 ? ((item.lossScore / totalLossScore) * 100).toFixed(1) : 0;
        return {
          name: item.course,
          data: item.lossScore, // 饼图数据改为失分
          color: item.color, // 使用 item 中已有的 color 属性
          // 标注文字表述内容改为：课程名 (失分占比)
          format: val => `${item.course} (${lossPercentage}%)` // 简化标签，只显示课程名和百分比
        };
      }),
      width: width,
      height: height,
      dataLabel: true, // 显示数据标签
      legend: false, // 不显示图例
      extra: { pie: { offsetAngle: -90 } },
      animation: true, // 恢复动画
      pixelRatio: pixelRatio, // 使用设备像素比
      ontouch: (e) => {
        if (e.target && e.target.index !== undefined) {
          const clickedIndex = e.target.index;
          // 直接使用 data 中已有的 subjectData，更新其 data 值
          const currentSubjectData = this.data.subjectData;

          // 创建一个新的 series 数组，将点击项的data值稍微放大
          const newSeries = currentSubjectData.map((item, index) => {
            const totalLossScore = currentSubjectData.reduce((sum, s) => sum + s.lossScore, 0);
            const lossPercentage = totalLossScore > 0 ? ((item.lossScore / totalLossScore) * 100).toFixed(1) : 0;
            let dataValue = item.lossScore;
            if (index === clickedIndex) {
              // 再次点击已高亮项时，取消高亮，恢复原始大小
              if (this.data.highlightedSubjectIndex === clickedIndex) {
                this.setData({ highlightedSubjectIndex: -1 }); // 取消高亮
                return {
                  name: item.course,
                  data: item.lossScore, // 恢复原始大小
                  color: item.color,
                  format: val => `${item.course} (${lossPercentage}%)`
                };
              }
              dataValue = item.lossScore * 1.05; // 放大5%作为高亮效果
            }
            return {
              name: item.course,
              data: dataValue,
              color: item.color,
              format: val => `${item.course} (${lossPercentage}%)`
            };
          });

          // 更新图表
          subjectChartInstance.updateData({
            series: newSeries
          });

          // 更新下方列表的选中状态，如果已经高亮则取消
          this.setData({
            highlightedSubjectIndex: this.data.highlightedSubjectIndex === clickedIndex ? -1 : clickedIndex
          });
        } else {
          // 如果点击空白区域，取消高亮
          this.setData({
            highlightedSubjectIndex: -1
          });
          // 恢复原始图表数据 (通过重新生成，会恢复所有大小)
          this.generateSubjectChart(studentName);
        }
      }
    });
  },

  getMorandiColor(index) {
    const colors = [
      '#4CAF50', // Green
      '#2196F3', // Blue
      '#FFC107', // Amber
      '#FF5722', // Deep Orange
      '#9C27B0', // Purple
      '#00BCD4', // Cyan
      '#FFEB3B', // Yellow
      '#E91E63', // Pink
      '#673AB7', // Deep Purple
      '#795548', // Brown
      '#607D8B', // Blue Grey
      '#8BC34A', // Light Green
      '#CDDC39'  // Lime
    ];
    return colors[index % colors.length];
  },

  /**
   * 生成课程所有学生在指定日期的成绩柱状图
   */
  generateStudentCourseChart(courseName, selectedDate) {
    const records = app.globalData.records.filter(r => r.course === courseName && r.date === selectedDate);

    if (records.length === 0) {
      wx.showToast({ title: `在 ${selectedDate} 没有找到 ${courseName} 的成绩记录`, icon: 'none' });
      this.setData({ chartType: 'selectDateForCourse', studentCourseData: [] });
      this.destroyCharts();
      return;
    }

    const studentMap = {};
    records.forEach(record => {
      // 确保每个学生只取一条记录（最新的，如果同一天有多条）
      if (!studentMap[record.student] || new Date(record.date) > new Date(studentMap[record.student].date)) {
        studentMap[record.student] = record;
      }
    });

    // 关键修改：为 studentCourseData 中的每个学生添加 color 属性
    const studentCourseData = Object.values(studentMap)
      .map((record, index) => ({ // 加入 index 参数
        student: record.student,
        score: parseFloat(record.score),
        color: this.getMorandiColor(index) // 根据索引分配颜色
      }))
      .sort((a, b) => b.score - a.score); // 按分数降序排序

    const studentNames = studentCourseData.map(item => item.student);
    const scores = studentCourseData.map(item => item.score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const avgScore = (scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(1);

    // 将带有 color 属性的 studentCourseData 存入 data
    this.setData({ studentCourseData, maxScore, minScore, avgScore, chartType: 'studentCourse' });

    // 使用新的API获取系统信息以替代 wx.getSystemInfoSync
    const windowInfo = wx.getWindowInfo();
    const deviceInfo = wx.getDeviceInfo();
    const pixelRatio = deviceInfo.pixelRatio;
    const width = windowInfo.windowWidth - 40;
    const height = Math.max(300, studentNames.length * 50 + 50); // 根据学生数量动态调整高度

    // 销毁旧实例
    if (studentCourseChartInstance) {
      studentCourseChartInstance = null;
    }

    // 柱状图实现每人颜色不同的方式：为每个学生创建一个独立的 series
    // 这样 WxCharts 会为每个 series (即每个学生) 应用其独立的颜色
    const seriesData = studentCourseData.map((item) => { // item 现在已经包含了 color
      return {
        name: item.student, // 每个 series 的 name 就是学生姓名
        data: [item.score], // 每个 series 只有1个数据点
        color: item.color, // 使用 item 中已有的 color 属性
        format: val => val.toFixed(0)
      };
    });

    studentCourseChartInstance = new WxCharts({
      canvasId: 'studentCourseCanvas',
      type: 'column', // 确保类型是柱状图 'column'
      categories: studentNames, // 类别依然是学生姓名，WxCharts会根据系列自动调整
      series: seriesData, // 使用新的 seriesData
      yAxis: {
        min: 0,
        max: app.globalData.fullScore, // Y轴最大值设置为满分
        format: val => val.toFixed(0),
        title: '成绩 (分)' // 确保Y轴有标题
      },
      xAxis: {
        disableGrid: false, // 柱状图X轴通常需要网格线或刻度
      },
      width: width,
      height: height,
      dataLabel: true,
      animation: true, // 恢复动画
      extra: {
        column: {
          width: 15 // 柱状图宽度
        },
      },
      pixelRatio: pixelRatio
    });
  }
})