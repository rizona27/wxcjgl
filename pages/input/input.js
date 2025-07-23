// input.js
const app = getApp();

Page({
  data: {
    allCourses: [], // 所有可用课程列表（用于录入选择）
    filterableCourses: [], // 仅包含有记录的课程列表（用于筛选）
    students: [], // 学生列表（用于筛选）
    courseIndex: -1, // 当前选择的课程索引
    student: '', // 学生姓名输入框内容
    score: '', // 成绩输入框内容
    fullScore: 100, // 满分值
    date: '', // 日期选择器内容
    remarks: '', // 备注输入框内容
    records: [], // 所有成绩记录
    editingId: null, // 当前正在编辑的记录ID，null 表示新增
    filterStudentIndex: -1, // 筛选学生索引，-1 表示未筛选
    filterCourseIndex: -1, // 筛选课程索引，-1 表示未筛选
    filteredRecords: [], // 筛选后的成绩记录
    scorePlaceholder: '请输入成绩' // 成绩输入框的动态提示文字
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    // 注册当前页面实例到全局 app
    app.registerPage(this);

    const today = this.getTodayDate(); // 获取今日日期
    this.setData({
      date: today, // 设置默认日期为今天
      student: app.globalData.lastStudent || '' // 设置默认学生为上次录入的学生
    }, () => {
      // 确保 loadData 完成后才更新筛选记录和提示
      this.loadData(() => {
        this.updateFilteredRecords(); // 更新筛选后的记录
        this.updateScorePlaceholder(); // 更新成绩输入框提示
      });
    });
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 页面卸载时注销
    app.unregisterPage(this);
  },

  /**
   * 监听用户下拉动作
   */
  onPullDownRefresh() {
    this.resetForm(); // 调用重置表单方法
    wx.stopPullDownRefresh(); // 停止下拉刷新动画
    wx.showToast({
      title: '表单已重置',
      icon: 'none',
      duration: 1000
    });
  },

  /**
   * 全局数据刷新回调
   */
  onGlobalDataRefresh() {
    // 当全局数据变化时，重新加载数据并更新UI
    this.loadData(() => {
      this.updateFilteredRecords();
      this.updateScorePlaceholder();
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 页面显示时重新加载数据并更新筛选记录，确保数据最新
    this.loadData(() => {
      this.updateFilteredRecords();
      this.updateScorePlaceholder();
    });
  },

  /**
   * 获取今天的日期，格式为 YYYY-MM-DD
   */
  getTodayDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * 从全局数据加载课程、学生、满分和所有记录
   * @param {function} callback - 数据加载完成后执行的回调函数
   */
  loadData(callback) {
    // 强制刷新全局数据
    app.loadCourses(); // 加载所有可用课程 (master list)
    app.loadRecords(); // 加载所有成绩记录
    app.loadFullScore(); // 加载最新满分值
    app.loadLastStudent(); // 加载上次录入学生

    const appData = app.globalData;

    let { courseIndex } = this.data;
    const currentAllCourses = appData.courses; 
    const currentFilterableCourses = app.getAllCoursesFromRecords(appData.records);

    // 优化课程索引：
    // 如果当前 courseIndex 无效（例如，原先选中的课程被删除了）
    // 或者如果当前没有选中课程（courseIndex === -1），但 allCourses 中有课程，则默认选择第一个
    if (currentAllCourses.length > 0) {
        if (courseIndex === -1 || !currentAllCourses.includes(this.data.allCourses[courseIndex])) {
            courseIndex = 0; // 默认选择第一个课程
        }
    } else {
        courseIndex = -1; // 如果没有课程，则重置索引
    }


    this.setData({
      allCourses: currentAllCourses, // 用于录入课程选择
      filterableCourses: currentFilterableCourses, // 用于筛选课程选择
      students: app.getAllStudents(appData.records), // 学生列表基于当前记录
      fullScore: appData.fullScore,
      records: appData.records,
      courseIndex // 更新课程索引
    }, () => {
      if (typeof callback === 'function') {
        callback();
      }
    });
  },

  /**
   * 根据当前筛选条件更新显示的成绩记录
   */
  updateFilteredRecords() {
    let records = [...this.data.records]; // 复制一份原始记录，避免直接修改

    // 应用学生筛选
    if (this.data.filterStudentIndex !== -1 && this.data.students.length > 0) {
      const studentToFilter = this.data.students[this.data.filterStudentIndex];
      records = records.filter(r => r.student === studentToFilter);
    }

    // 应用课程筛选
    // 注意：这里的筛选课程是基于 filterableCourses，而不是 allCourses
    if (this.data.filterCourseIndex !== -1 && this.data.filterableCourses.length > 0) {
      const courseToFilter = this.data.filterableCourses[this.data.filterCourseIndex];
      records = records.filter(r => r.course === courseToFilter);
    }

    // 按日期降序排序
    records.sort((a, b) => new Date(b.date) - new Date(a.date));

    this.setData({
      filteredRecords: records
    }); // 更新筛选后的记录
  },

  /**
   * 更新成绩输入框的提示文字
   */
  updateScorePlaceholder() {
    const {
      courseIndex,
      allCourses, // 使用 allCourses 来获取当前选择的课程名称
      fullScore
    } = this.data;
    let placeholder = '请输入成绩';
    // 如果选择了课程，则显示课程名和满分值提示
    if (courseIndex !== -1 && allCourses.length > 0 && allCourses[courseIndex]) { // 确保 allCourses[courseIndex] 存在
      const selectedCourseName = allCourses[courseIndex];
      placeholder = `请输入成绩，${selectedCourseName}满分值：${fullScore}`;
    }
    this.setData({
      scorePlaceholder: placeholder
    });
  },

  /**
   * 课程选择器改变事件 (用于录入课程)
   */
  courseChange(e) {
    this.setData({
      courseIndex: e.detail.value
    }, () => {
      this.updateScorePlaceholder(); // 课程改变后更新成绩提示
    });
  },

  /**
   * 学生姓名输入框输入事件，并进行中英文校验
   */
  onStudentInput(e) {
    let inputValue = e.detail.value;
    const originalValue = this.data.student; // 获取当前 data 中存储的学生姓名

    // 只允许中文字符和英文字母
    const validCharsRegex = /^[a-zA-Z\u4e00-\u9fa5]*$/;
    let filteredValue = inputValue.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '');

    // 只有当过滤后的值与当前 data.student 不同时才更新
    if (filteredValue !== originalValue) {
      this.setData({
        student: filteredValue
      });
      // 实时保存过滤后的学生姓名到全局
      app.saveLastStudent(filteredValue);
    }

    // 如果过滤后的值长度小于原始输入值长度，且原始输入值不为空，说明有非法字符被移除
    // 此时才显示 Toast 提示，避免频繁提示
    if (filteredValue.length < inputValue.length && inputValue.length > 0) {
      wx.showToast({
        title: '姓名只能包含中英文',
        icon: 'none',
        duration: 1500
      });
    }
  },

  /**
   * 成绩输入框输入事件
   * 限制：只允许数字，小数点后只允许一位，不允许负值，且不能超过满分值
   */
  onScoreInput(e) {
    let value = e.detail.value;
    const fullScore = this.data.fullScore; // 获取满分值

    // 1. 移除所有非数字和小数点的字符
    let processedValue = value.replace(/[^\d.]/g, '');

    // 2. 确保第一个字符不是小数点，除非是 "0." 或 "."
    if (processedValue.startsWith('.') && processedValue.length > 1) {
      processedValue = '0' + processedValue;
    } else if (processedValue === '.') {
      // 允许单个 '.' 为初始输入
    } else if (processedValue.startsWith('0') && processedValue.length > 1 && !processedValue.startsWith('0.')) {
      // 如果以0开头，且后面不是小数点，则移除前导零 (例如 "05" -> "5")
      processedValue = String(parseFloat(processedValue)); 
      if (processedValue === 'NaN') processedValue = ''; // 处理parseFloat('0.') -> 0
    }

    // 3. 只保留第一个小数点
    const parts = processedValue.split('.');
    if (parts.length > 2) {
      processedValue = parts[0] + '.' + parts.slice(1).join('');
    }

    // 4. 限制小数点后只有一位
    if (processedValue.includes('.')) {
      if (parts[1] && parts[1].length > 1) {
        processedValue = parts[0] + '.' + parts[1].substring(0, 1);
      }
    }

    // 5. 确保不为负值 (虽然type="digit"已限制，但以防粘贴等)
    if (parseFloat(processedValue) < 0) {
      processedValue = '0';
      wx.showToast({
        title: '成绩不能为负数',
        icon: 'none',
        duration: 1500
      });
    }

    // 6. 即时校验是否超过满分 (修改为保留合法前缀)
    // 只有当 processedValue 不为空时才进行数值校验
    if (processedValue !== '') {
      const numericValue = parseFloat(processedValue);
      // 如果当前输入的数字已经超过满分
      if (numericValue > fullScore) {
        // 尝试回退到上一个合法状态
        let tempValue = processedValue;
        // 循环移除最后一个字符直到合法或者为空
        while (tempValue.length > 0 && parseFloat(tempValue) > fullScore) {
          tempValue = tempValue.slice(0, -1);
          // 如果移除后变成空字符串或只剩小数点，且无法转换为数字，则重置为0或空
          if (tempValue === '' || tempValue === '.' || isNaN(parseFloat(tempValue))) {
            tempValue = '';
            break;
          }
        }
        processedValue = tempValue; // 使用回退后的合法值
        wx.showToast({
          title: `成绩不得超过满分值 ${fullScore}`,
          icon: 'none',
          duration: 1500
        });
      }
    }

    this.setData({
      score: processedValue
    });
  },

  /**
   * 日期选择器改变事件
   */
  onDateChange(e) {
    this.setData({
      date: e.detail.value
    });
  },

  /**
   * 备注输入框输入事件
   */
  onRemarksInput(e) {
    this.setData({
      remarks: e.detail.value
    });
  },

  /**
   * 学生筛选器改变事件
   */
  filterStudentChange(e) {
    this.setData({
      filterStudentIndex: e.detail.value
    }, () => {
      this.updateFilteredRecords(); // 筛选条件改变后更新记录
    });
  },

  /**
   * 课程筛选器改变事件 (用于筛选课程)
   */
  filterCourseChange(e) {
    this.setData({
      filterCourseIndex: e.detail.value
    }, () => {
      this.updateFilteredRecords(); // 筛选条件改变后更新记录
    });
  },

  /**
   * 重置所有筛选条件
   */
  resetFilters() {
    this.setData({
      filterStudentIndex: -1,
      filterCourseIndex: -1
    }, () => {
      this.updateFilteredRecords(); // 重置后更新记录
    });
  },

  /**
   * 重置表单所有输入内容
   */
  resetForm() {
    this.setData({
      courseIndex: -1,
      student: '', // 清空学生姓名
      score: '',
      date: this.getTodayDate(), // 还原为今天日期
      remarks: '',
      editingId: null // 清除编辑状态
    }, () => {
      this.updateScorePlaceholder(); // 重置后更新成绩提示
      // 移除这里的 Toast 提示，因为下拉刷新时会单独提示
      // wx.showToast({
      //   title: '表单已重置',
      //   icon: 'none',
      //   duration: 1000
      // });
    });
  },

  /**
   * 提交成绩或更新成绩
   */
  submitGrade() {
    const {
      courseIndex,
      student,
      score,
      date,
      remarks,
      editingId,
      allCourses // 从 allCourses 获取当前选择的课程名称
    } = this.data;

    // 表单验证
    if (courseIndex < 0 || !allCourses[courseIndex]) { // 确保课程被选中且有效
      wx.showToast({
        title: '请选择课程',
        icon: 'none'
      });
      return;
    }
    if (!student.trim()) {
      wx.showToast({
        title: '请输入学生姓名',
        icon: 'none'
      });
      return;
    }
    if (!score) {
      wx.showToast({
        title: '请输入成绩',
        icon: 'none'
      });
      return;
    }

    const parsedScore = parseFloat(score);
    if (isNaN(parsedScore)) {
      wx.showToast({
        title: '成绩必须是数字',
        icon: 'none'
      });
      return;
    }

    // **最终提交校验**: 检查成绩是否超过满分值
    if (parsedScore > this.data.fullScore) {
      wx.showToast({
        title: `成绩不能提交，因为它超过了满分值${this.data.fullScore}`,
        icon: 'none',
        duration: 3000
      });
      return; // 阻止提交
    }

    // 校验小数点位数 (再次校验，确保最终数据正确，尽管onScoreInput已限制)
    const scoreStr = String(score); 
    const decimalIndex = scoreStr.indexOf('.');
    if (decimalIndex !== -1 && scoreStr.length - 1 - decimalIndex > 1) {
      wx.showToast({
        title: '成绩小数点后只允许一位',
        icon: 'none'
      });
      return;
    }
    
    // 检查成绩是否在合法范围内（不允许负值）
    if (parsedScore < 0) {
      wx.showToast({
        title: '成绩不能为负数',
        icon: 'none'
      });
      return;
    }


    // 构建成绩记录对象
    const record = {
      id: editingId || Date.now(),
      course: allCourses[courseIndex], // 使用 allCourses 中的课程名称
      student: student.trim(),
      score: parsedScore, // 使用解析后的数值
      fullScore: this.data.fullScore,
      date,
      remarks: remarks.trim() // 确保备注也是trim过的
    };

    let records = [...this.data.records];

    // --- 修改后的重复成绩录入校验逻辑 ---
    const isDuplicate = records.some(existingRecord => {
      // 如果是正在编辑的记录，则不与自身进行重复校验
      if (editingId && existingRecord.id === editingId) {
        return false;
      }
      // 检查日期、学生、课程、成绩、备注是否都相同
      return existingRecord.date === record.date &&
             existingRecord.student === record.student &&
             existingRecord.course === record.course &&
             existingRecord.score === record.score &&
             (existingRecord.remarks || '').trim() === (record.remarks || '').trim(); // 备注也需要trim后比较
    });

    if (isDuplicate) {
      wx.showToast({
        title: '检测到完全相同的记录，请勿重复提交',
        icon: 'none',
        duration: 3000
      });
      return;
    }
    // --- 结束重复成绩录入校验逻辑 ---

    if (editingId) {
      const index = records.findIndex(r => r.id === editingId);
      if (index !== -1) {
        records[index] = record;
      }
    } else {
      records.push(record);
    }

    // 将全局数据更新和保存操作放入 setData 的回调中
    this.setData({
      records,
      editingId: null
    }, () => {
      app.globalData.records = records;
      app.saveRecords(); // 确保数据保存到本地缓存

      // 确保 app.globalData.courses 包含所有新录入的课程
      // 这里不再从 records 重新生成 app.globalData.courses，
      // 而是确保新录入的课程（如果不在 master list 中）被添加到 master list
      if (!app.globalData.courses.includes(record.course)) {
          app.globalData.courses = [...app.globalData.courses, record.course].sort();
          app.saveCourses(); // 保存更新后的 master courses
      }

      app.saveLastStudent(student.trim());

      this.setData({
        score: '',
        remarks: ''
      });

      // 提交或更新后，需要重新获取学生列表，因为可能新增了学生
      this.setData({
        students: app.getAllStudents(app.globalData.records) // 确保学生列表也是最新的
      });

      app.refreshAllPages(); // 通知所有页面刷新，包括 config 页面
      this.loadData(() => { // 重新加载当前页数据以更新 allCourses 和 filterableCourses
        this.updateFilteredRecords();
        this.updateScorePlaceholder();
      });

      wx.showToast({
        title: editingId ? '更新成功' : '提交成功'
      });
    });
  },

  /**
   * 编辑记录
   */
  editRecord(e) {
    const id = e.currentTarget.dataset.id;
    const recordToEdit = this.data.records.find(r => r.id === id);

    if (recordToEdit) {
      // 查找 recordToEdit.course 在 allCourses 中的索引
      const courseIndex = this.data.allCourses.findIndex(c => c === recordToEdit.course);
      this.setData({
        courseIndex: courseIndex !== -1 ? courseIndex : 0, // 确保有默认值
        student: recordToEdit.student,
        score: String(recordToEdit.score), // 转换为字符串以便在input中显示
        date: recordToEdit.date,
        remarks: recordToEdit.remarks,
        editingId: recordToEdit.id
      }, () => {
        this.updateScorePlaceholder(); // 更新成绩提示
      });
      wx.showToast({
        title: '已载入编辑模式',
        icon: 'none',
        duration: 1500
      });
    }
  },

  /**
   * 确认删除记录
   */
  confirmDeleteRecord(e) {
    const idToDelete = e.currentTarget.dataset.id;
    const recordToDelete = this.data.records.find(r => r.id === idToDelete);

    if (!recordToDelete) {
      wx.showToast({
        title: '记录不存在',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    wx.showModal({
      title: '删除确认',
      content: `确定要删除这条记录吗？\n姓名: ${recordToDelete.student}, 课程: ${recordToDelete.course}, 成绩: ${recordToDelete.score}`,
      confirmText: '确认删除',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          const updatedRecords = this.data.records.filter(r => r.id !== idToDelete);
          app.globalData.records = updatedRecords;
          app.saveRecords(); // 保存更新后的记录

          // 重新生成并保存 students (课程 master list 不在此处修改)
          app.globalData.students = app.getAllStudents(updatedRecords);
          // app.saveStudents(); // If app.js has saveStudents

          app.refreshAllPages(); // 通知所有页面刷新
          this.loadData(() => { // 重新加载当前页数据
            this.updateFilteredRecords();
            this.updateScorePlaceholder();
          });
          wx.showToast({
            title: '删除成功',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  }
});