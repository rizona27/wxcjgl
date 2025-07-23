// config.js (重构后 - 修复剪贴板导入与删除问题，按钮名称和提示时间调整，CSV文件名含日期和序号)
// 页面交互逻辑已更新，以匹配新的下拉菜单布局
const app = getApp();

// 定义本地存储的键名
const LAST_EXPORT_DATE_KEY = 'lastExportDate';
const DAILY_EXPORT_SEQUENCE_KEY = 'dailyExportSequence';

Page({
  data: {
    // 页面原有数据
    courses: [], // 课程管理页面显示的所有可用课程列表 (master list)
    fullScore: 100,
    editingScore: false,
    records: [], // 原始的完整成绩记录
    students: [], // 学生列表（用于筛选）

    isExporting: false, // 导出操作进行中
    isImportingClipboard: false, // 从剪贴板导入操作进行中
    isImportingFile: false, // 从文件导入操作进行中
    selectedCourseIndex: -1, // 课程管理选择的课程索引

    // 筛选相关 (在 config 页面中，筛选课程也应该基于 master courses)
    filterStudentIndex: -1,
    filterCourseIndex: -1,

    // 新布局所需数据
    filteredRecords: [], // 根据学生和课程筛选后的记录数组
    formattedFilteredRecords: [], // 用于picker显示的格式化字符串数组
    selectedRecordIndex: -1, // 成绩记录picker的选择索引

    // 批量删除功能所需数据 (不再直接绑定到picker，而是用于临时存储)
    // 这些变量用于在弹出的选择框中临时存储用户选择的值
    // 它们不再直接与页面上的picker组件绑定，而是通过方法参数传递
    // 因此，这里不再需要selectedStudentToDeleteIndex, selectedCourseToDeleteIndex, selectedDateToDelete
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    app.registerPage(this);
    this.loadData();
  },

    /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 页面卸载时注销
    app.unregisterPage(this);
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadData();
  },

  /**
   * 全局数据刷新回调
   */
  onGlobalDataRefresh() {
    this.loadData();
  },

  /**
   * 从全局加载数据并初始化页面
   */
  loadData() {
    const globalData = app.globalData;
    // 强制刷新全局数据，确保获取到最新的 records 和 courses
    app.loadRecords(); 
    app.loadCourses(); // 确保加载最新的课程 (master list)

    this.setData({
      courses: globalData.courses || [], // config页面的课程列表直接使用 master list
      fullScore: globalData.fullScore || 100,
      records: globalData.records || [],
      students: app.getAllStudents(globalData.records) || [], // 学生列表也基于当前记录
      editingScore: false,
    }, () => {
      // 数据加载后，立即更新一次筛选结果和picker内容
      this.updateFilteredRecords();
      // 检查当前选中的课程索引是否仍然有效，无效则重置
      if (this.data.selectedCourseIndex >= this.data.courses.length) {
        this.setData({ selectedCourseIndex: -1 });
      }
    });
  },

  addCourse() {
    wx.showModal({
      title: '添加新课程',
      placeholderText: '请输入课程名称',
      editable: true,
      success: (res) => {
        if (res.confirm && res.content) {
          const newCourse = res.content.trim();
          if (newCourse) {
            // 检查是否重复
            if (this.data.courses.includes(newCourse)) { // 使用 this.data.courses 检查当前页面的课程列表
              wx.showToast({
                title: '课程已存在',
                icon: 'none',
                duration: 2000
              });
              return;
            }
            // 将新课程添加到全局的 master list 并排序
            const updatedCourses = [...app.globalData.courses, newCourse].sort();
            app.globalData.courses = updatedCourses;
            app.saveCourses(); // 保存更新后的全局课程列表到本地存储

            // 更新当前页面的 data，使其显示最新的课程列表
            this.setData({
              courses: updatedCourses
            }, () => {
              // 通知所有页面刷新数据，包括 input 页面
              app.refreshAllPages(); 
              wx.showToast({
                title: '课程添加成功',
                icon: 'success',
                duration: 1500
              });
            });
          }
        }
      }
    });
  },
  /**
   * 核心函数：根据筛选条件更新记录，并格式化用于Picker显示
   */
  updateFilteredRecords() {
    let records = [...this.data.records];
    console.log('updateFilteredRecords: 原始记录数量 =', records.length); // 调试日志

    // 应用学生筛选
    if (this.data.filterStudentIndex > -1 && this.data.students.length > 0) {
      const student = this.data.students[this.data.filterStudentIndex];
      records = records.filter(r => r.student === student);
      console.log('updateFilteredRecords: 学生筛选后记录数量 =', records.length); // 调试日志
    }

    // 应用课程筛选
    // 在 config 页面，筛选课程也应该基于 master courses
    if (this.data.filterCourseIndex > -1 && this.data.courses.length > 0) {
      const course = this.data.courses[this.data.filterCourseIndex];
      records = records.filter(r => r.course === course);
      console.log('updateFilteredRecords: 课程筛选后记录数量 =', records.length); // 调试日志
    }

    // 按日期降序排序
    records.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 格式化记录用于Picker显示
    const formattedRecords = records.map(item => {
      // 格式: 姓名 | 课程 | 成绩/满分 | 日期 | 备注
      return `${item.student} | ${item.course} | ${item.score}/${item.fullScore} | ${item.date} ${item.remarks ? '| ' + item.remarks : ''}`;
    });

    this.setData({
      filteredRecords: records, // 保存筛选后的原始记录
      formattedFilteredRecords: formattedRecords, // 保存格式化后的字符串数组
      selectedRecordIndex: -1, // 每当筛选条件变化，重置选择
    });
    console.log('updateFilteredRecords: 最终 filteredRecords 数量 =', this.data.filteredRecords.length); // 调试日志
  },

  /**
   * 新增：当用户在成绩记录下拉菜单中选择一项时触发
   */
  onRecordSelectChange(e) {
    this.setData({
      selectedRecordIndex: e.detail.value,
    });
  },

  /**
   * 新增：删除在下拉菜单中选中的那条记录
   */
  deleteSelectedRecord() {
    const { selectedRecordIndex, filteredRecords } = this.data;

    if (selectedRecordIndex < 0) {
      wx.showToast({ title: '请先选择一条记录', icon: 'none', duration: 3000 }); // 持续时间调整
      return;
    }

    console.log('deleteSelectedRecord: selectedRecordIndex =', selectedRecordIndex);
    console.log('deleteSelectedRecord: filteredRecords.length =', filteredRecords.length);

    const recordToDeleteFromFiltered = filteredRecords[selectedRecordIndex];

    if (recordToDeleteFromFiltered === undefined || recordToDeleteFromFiltered === null) {
        console.error("deleteSelectedRecord: filteredRecords中记录不存在，索引:", selectedRecordIndex, "filteredRecords:", filteredRecords);
        wx.showToast({ title: '删除失败：记录不存在', icon: 'error', duration: 3000 }); // 持续时间调整
        return;
    }

    if (recordToDeleteFromFiltered.id === undefined || recordToDeleteFromFiltered.id === null) {
        console.error("deleteSelectedRecord: 选定记录缺少ID:", recordToDeleteFromFiltered);
        wx.showToast({ title: '删除失败：记录ID缺失', icon: 'error', duration: 3000 }); // 持续时间调整
        return;
    }

    const idToDelete = recordToDeleteFromFiltered.id;
    console.log('deleteSelectedRecord: 尝试删除ID为', idToDelete, '的记录');
    console.log('deleteSelectedRecord: 选定记录完整对象:', recordToDeleteFromFiltered);
    console.log('deleteSelectedRecord: app.globalData.records (删除前):', app.globalData.records);

    wx.showModal({
      title: '删除确认',
      content: `确定要删除这条记录吗？\n${this.data.formattedFilteredRecords[selectedRecordIndex]}`,
      confirmText: '确认删除',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          // 查找并删除全局记录中匹配的项
          const currentRecords = app.globalData.records || [];
          let recordFoundAndRemoved = false;
          const updatedRecords = [];

          // 遍历查找并只移除第一个匹配ID的记录
          for (let i = 0; i < currentRecords.length; i++) {
            if (String(currentRecords[i].id) === String(idToDelete) && !recordFoundAndRemoved) {
              console.log('deleteSelectedRecord: 找到并移除匹配ID的记录:', currentRecords[i]);
              recordFoundAndRemoved = true; // 标记已找到并移除
            } else {
              updatedRecords.push(currentRecords[i]); // 保留不匹配的记录
            }
          }

          if (!recordFoundAndRemoved) {
            console.warn('deleteSelectedRecord: 未能在全局记录中找到匹配ID的记录，ID:', idToDelete);
            wx.showToast({ title: '删除失败：记录未找到', icon: 'error', duration: 3000 }); // 持续时间调整
            return; // 未找到则不继续操作
          }

          // 2. 更新全局数据并保存 records
          app.globalData.records = updatedRecords;
          app.saveRecords();

          // 3. 重新生成并保存 students (courses 保持 master list，不从 records 重新生成)
          app.globalData.students = app.getAllStudents(updatedRecords);
          // app.saveStudents(); // 如果 app.js 中有 saveStudents，这里也调用

          // 4. 通知所有页面刷新
          app.refreshAllPages();

          // 5. 重新加载当前页数据（会自动更新筛选和下拉菜单）
          this.loadData();

          // 6. 提示成功
          wx.showToast({ title: '已删除', icon: 'success', duration: 3000 }); // 持续时间调整
          console.log('deleteSelectedRecord: 删除成功后 app.globalData.records:', app.globalData.records);
        }
      }
    });
  },

  /**
   * 学生筛选器改变事件
   */
  studentFilterChange(e) {
    this.setData({
      filterStudentIndex: e.detail.value
    }, this.updateFilteredRecords); // 回调中直接更新
  },

  /**
   * 课程筛选器改变事件
   */
  courseFilterChange(e) {
    this.setData({
      filterCourseIndex: e.detail.value
    }, this.updateFilteredRecords); // 回调中直接更新
  },

  /**
   * 清除所有筛选条件
   */
  clearFilters() {
    this.setData({
      filterStudentIndex: -1,
      filterCourseIndex: -1
    }, this.updateFilteredRecords); // 回调中直接更新
  },

  // ======================================================
  //     以下是课程管理、满分设置、导入导出、清除缓存等功能
  // ======================================================

  onCourseSelectChange(e) {
    this.setData({ selectedCourseIndex: e.detail.value });
  },

  addNewCoursePrompt() {
    wx.showModal({
      title: '添加新课程',
      editable: true,
      placeholderText: '请输入新课程名称 (中文)',
      confirmText: '添加',
      // 注意：wx.showModal 的 editable 输入框在用户按回车时通常会触发 confirm。
      // 如果需要输入多行，需要设置 inputType: 'textarea'，但通常课程名是单行的。
      success: (res) => {
        if (res.confirm) {
          let newCourse = res.content ? res.content.trim() : '';
          const chineseRegex = /^[\u4e00-\u9fa5]+$/;
          if (!newCourse || !chineseRegex.test(newCourse)) {
            wx.showToast({ title: '课程名只能是中文且不为空', icon: 'none', duration: 3000 }); // 持续时间调整
            return;
          }
          // 检查是否已存在于 master courses 列表中
          if (app.globalData.courses.includes(newCourse)) {
            wx.showToast({ title: '该课程已存在', icon: 'none', duration: 3000 }); // 持续时间调整
            return;
          }
          // 添加到全局 master courses 列表并保存
          app.globalData.courses = [...app.globalData.courses, newCourse].sort(); // 确保排序
          app.saveCourses();
          
          app.refreshAllPages(); // 通知所有页面刷新，包括 input 页面
          this.loadData(); // 重新加载当前页数据
          wx.showToast({ title: '课程添加成功', icon: 'success', duration: 3000 }); // 持续时间调整
        }
      }
    });
  },

  deleteSelectedCourse() {
    const { selectedCourseIndex, courses } = this.data; //这里的 courses 是 master list
    if (selectedCourseIndex === -1) {
      wx.showToast({ title: '请选择要删除的课程', icon: 'none', duration: 3000 });
      return;
    }
    const courseToDelete = courses[selectedCourseIndex];

    wx.showModal({
      title: '删除确认',
      content: `确定要删除课程 "${courseToDelete}" 吗？\n这将同时删除该课程的所有成绩记录，此操作不可撤销！`,
      confirmText: '确认删除',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          // 1. 从全局 master courses 列表中删除课程并保存
          app.globalData.courses = app.globalData.courses.filter(c => c !== courseToDelete);
          app.saveCourses();

          // 2. 从全局数据中过滤 records (删除该课程的所有成绩记录)
          const currentRecords = app.globalData.records || [];
          const updatedRecords = currentRecords.filter(r => r.course !== courseToDelete);
          app.globalData.records = updatedRecords;
          app.saveRecords();

          // 3. 重新生成并保存 students (因为记录可能减少，学生列表也可能变化)
          app.globalData.students = app.getAllStudents(updatedRecords);
          // app.saveStudents(); // 如果 app.js 中有 saveStudents，这里也调用

          // 4. 通知所有页面刷新
          app.refreshAllPages();
          this.loadData(); // 重新加载当前页数据
          wx.showToast({ title: '课程已删除', icon: 'success', duration: 3000 }); // 持续时间调整
        }
      }
    });
  },

  enableScoreEdit() {
    this.setData({ editingScore: true });
  },

  onFullScoreInput(e) {
    this.setData({ fullScore: e.detail.value });
  },

  saveFullScore() {
    const fullScore = parseInt(this.data.fullScore);
    if (isNaN(fullScore) || fullScore <= 0 || fullScore > 300) {
      wx.showToast({ title: '满分值应在1-300之间', icon: 'none', duration: 3000 }); // 持续时间调整
      return;
    }
    this.setData({ editingScore: false, fullScore });
    app.globalData.fullScore = fullScore;
    app.saveFullScore();
    wx.showToast({ title: '满分值已更新', icon: 'success', duration: 3000 }); // 持续时间调整
  },

  /**
   * 获取或初始化导出序号数据
   */
  _getExportSequenceData() {
    const lastExportDate = wx.getStorageSync(LAST_EXPORT_DATE_KEY);
    let dailySequence = wx.getStorageSync(DAILY_EXPORT_SEQUENCE_KEY) || 0;

    const today = new Date();
    const todayStr = `${today.getMonth() + 1}-${today.getDate()}`; // MM-DD 格式

    if (lastExportDate !== todayStr) {
      // 如果日期不同，重置序号
      dailySequence = 1;
      wx.setStorageSync(LAST_EXPORT_DATE_KEY, todayStr);
    } else {
      // 如果日期相同，序号递增
      dailySequence++;
    }
    wx.setStorageSync(DAILY_EXPORT_SEQUENCE_KEY, dailySequence);

    return {
      date: todayStr,
      sequence: dailySequence
    };
  },


  // 导出为CSV文件
  exportRecords() {
    if (this.data.isExporting) return;
    this.setData({ isExporting: true });
    wx.showLoading({ title: '正在生成文件...' });
    const fs = wx.getFileSystemManager();
    const dirPath = `${wx.env.USER_DATA_PATH}/scores`;
    try { fs.accessSync(dirPath); } catch (e) { fs.mkdirSync(dirPath, true); }

    // 获取并更新导出序号和日期
    const { date, sequence } = this._getExportSequenceData();
    // 文件命名格式： 成绩记录-MM-DD-序号.csv
    // 假设使用通用前缀“成绩记录”，如果需要用户名，需要在此处引入用户昵称的逻辑
    const fileName = `成绩记录-${date}-${sequence}.csv`;
    const filePath = `${dirPath}/${fileName}`;


    // CSV Header
    let content = `姓名,课程,成绩,满分,日期,备注\n`;
    // CSV Content - Ensure values with commas or newlines are quoted
    this.data.filteredRecords.forEach(r => {
      // Escape double quotes by doubling them, then wrap in double quotes
      const escapeAndQuote = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

      const student = escapeAndQuote(r.student);
      const course = escapeAndQuote(r.course);
      const score = r.score; // Numbers don't need quoting unless they contain commas
      const fullScore = r.fullScore;
      const date = escapeAndQuote(r.date);
      const remarks = escapeAndQuote(r.remarks);
      content += `${student},${course},${score},${fullScore},${date},${remarks}\n`;
    });

    fs.writeFile({
      filePath, data: content, encoding: 'utf8',
      success: () => {
        wx.hideLoading();
        // 修正：只保留分享按钮，移除保存到手机的选项
        wx.showModal({
          title: '文件已生成',
          content: '文件已生成，可分享给好友。',
          confirmText: '分享',
          showCancel: false, // 移除取消按钮
          success: (res) => {
            if (res.confirm) {
              wx.shareFileMessage({ filePath, fileName });
            }
          },
          complete: () => this.setData({ isExporting: false })
        });
      },
      fail: (err) => {
        console.error('导出失败', err);
        wx.hideLoading();
        wx.showToast({ title: '导出失败', icon: 'error', duration: 3000 }); // 持续时间调整
        this.setData({ isExporting: false });
      }
    });
  },

  /**
   * 辅助函数：不再需要根据索引获取课程名称，因为直接使用中文名
   * getCourseIndexByName 和 getCourseNameByIndex 将不再被剪贴板导出导入使用
   */

  /**
   * 重构：复制成绩记录到剪贴板 (直接使用课程中文名，制表符分隔)
   */
  copyRecordsToClipboard() {
    console.log('copyRecordsToClipboard: 开始执行'); // 调试日志
    console.log('copyRecordsToClipboard: filteredRecords.length =', this.data.filteredRecords.length); // 调试日志
    console.log('copyRecordsToClipboard: filteredRecords 内容 =', JSON.stringify(this.data.filteredRecords)); // 调试日志

    if (this.data.isExporting) return; // 防止重复点击
    if (this.data.filteredRecords.length === 0) {
      wx.showToast({ title: '没有可复制的数据', icon: 'none', duration: 3000 }); // 持续时间调整
      console.log('copyRecordsToClipboard: filteredRecords 为空，停止导出。'); // 调试日志
      return;
    }

    this.setData({ isExporting: true }); // 使用 isExporting 状态
    wx.showLoading({ title: '正在复制数据...' });

    let clipboardContent = '';
    const recordsToCopy = []; // 收集实际要复制的记录

    this.data.filteredRecords.forEach(r => {
      // 字段顺序：姓名,课程中文名,成绩,满分,日期,备注
      // 使用制表符 \t 分隔
      // 确保所有字段都是字符串，以防万一
      recordsToCopy.push(`${String(r.student)}\t${String(r.course)}\t${String(r.score)}\t${String(r.fullScore)}\t${String(r.date)}\t${String(r.remarks || '')}`);
    });

    clipboardContent = recordsToCopy.join('\n'); // 将所有有效记录用换行符连接

    if (!clipboardContent) { // 如果所有记录都被跳过，则 clipboardContent 仍为空
        wx.hideLoading();
        wx.showToast({ title: '无可复制的有效数据', icon: 'none', duration: 3000 }); // 持续时间调整
        console.log('copyRecordsToClipboard: 生成的剪贴板内容为空，停止导出。'); // 调试日志
        return;
    }

    wx.setClipboardData({
      data: clipboardContent,
      success: () => {
        wx.hideLoading();
        // 延迟显示 Toast，给微信自带的剪贴板提示留出时间
        setTimeout(() => {
            wx.showToast({ title: '数据已复制到剪贴板', icon: 'success', duration: 3000 }); // 持续时间调整
        }, 500); // 延迟 0.5 秒
        console.log('copyRecordsToClipboard: 数据复制成功。'); // 调试日志
      },
      fail: (err) => {
        console.error('复制到剪贴板失败', err);
        wx.hideLoading();
        wx.showToast({ title: '复制失败', icon: 'error', duration: 3000 }); // 持续时间调整
        console.log('copyRecordsToClipboard: 数据复制失败。'); // 调试日志
      },
      complete: () => {
        this.setData({ isExporting: false });
        console.log('copyRecordsToClipboard: 导出操作完成，isExporting 设置为 false。'); // 调试日志
      }
    });
  },

  /**
   * 辅助函数：解析剪贴板内容 (新的制表符分隔格式，直接解析课程中文名)
   */
  parseClipboardContent(contentString) {
    const lines = contentString.trim().split(/\r?\n/);
    const records = [];
    console.log('parseClipboardContent: 开始解析剪贴板内容。总行数:', lines.length); // 调试日志

    lines.forEach((line, index) => {
      if (!line) {
        console.warn(`parseClipboardContent: 跳过空行 (行号 ${index + 1})`);
        return;
      }
      // 使用 split，不带 limit 参数，让其自然分割
      const rawValues = line.split('\t');
      console.log(`parseClipboardContent: 解析行 ${index + 1}:`, line); // 调试：打印正在解析的行
      console.log(`parseClipboardContent: 原始分割后的值:`, rawValues); // 调试：打印分割后的值

      // 显式地从 rawValues 中取出前6个字段，并为任何缺失的字段提供默认的空字符串
      const values = [
          rawValues[0] || '', // 姓名
          rawValues[1] || '', // 课程
          rawValues[2] || '', // 成绩
          rawValues[3] || '', // 满分
          rawValues[4] || '', // 日期
          rawValues[5] || ''  // 备注
      ];
      console.log(`parseClipboardContent: 强制获取6个字段后的值:`, values);
      
      const record = {};
      // 生成一个更可靠的唯一ID，虽然 Date.now() + index + Math.random() 冲突概率低，
      // 但为了删除的精确性，可以考虑更强的ID（例如 UUID，但小程序环境可能不直接支持）
      // 对于小程序，如果ID是数字，确保它在全局唯一，避免删除冲突。
      // 暂时保持现有ID生成方式，因为问题可能不在ID本身，而在其匹配或状态同步。
      record.id = Date.now() + index + Math.random();

      // 直接赋值，并确保 trim 和空值处理
      record.student = values[0].trim();
      record.course = values[1].trim();
      record.score = parseFloat(values[2]); // 使用 parseFloat 确保能解析小数
      record.fullScore = parseInt(values[3]);
      record.date = values[4].trim();
      record.remarks = values[5].trim(); // 备注字段现在是可选的，即使为空也赋值

      // 详细验证数据有效性 (前5个字段为必填)
      let isValid = true;
      if (!record.student) {
        console.warn(`parseClipboardContent: 行 ${index + 1} 无效 (姓名为空):`, line, record);
        isValid = false;
      }
      if (!record.course) {
        console.warn(`parseClipboardContent: 行 ${index + 1} 无效 (课程为空):`, line, record);
        isValid = false;
      }
      if (isNaN(record.score)) { // 检查成绩是否为有效数字
        console.warn(`parseClipboardContent: 行 ${index + 1} 无效 (成绩无效):`, line, record);
        isValid = false;
      }
      if (isNaN(record.fullScore)) { // 检查满分是否为有效数字
        console.warn(`parseClipboardContent: 行 ${index + 1} 无效 (满分无效):`, line, record);
        isValid = false;
      }
      if (!record.date) {
        console.warn(`parseClipboardContent: 行 ${index + 1} 无效 (日期为空):`, line, record);
        isValid = false;
      }

      // 新增：导入时也校验成绩范围和一位小数
      if (isValid) {
        if (record.score < 0 || record.score > record.fullScore) {
          console.warn(`parseClipboardContent: 行 ${index + 1} 无效 (成绩超出范围):`, record);
          isValid = false;
        }
        const scoreStr = String(record.score);
        const decimalIndex = scoreStr.indexOf('.');
        if (decimalIndex !== -1 && scoreStr.length - 1 - decimalIndex > 1) {
          console.warn(`parseClipboardContent: 行 ${index + 1} 无效 (成绩小数点位数不符):`, record);
          isValid = false;
        }
      }

      if (isValid) {
        records.push(record);
      } else {
        console.warn('parseClipboardContent: 跳过无效记录 (数据不完整或格式错误):', record, '原始行:', line);
      }
    });
    console.log('parseClipboardContent: 解析完成。有效记录数量:', records.length); // 调试日志
    return records;
  },

  /**
   * 从剪贴板导入成绩记录 (只支持新的制表符分隔格式)
   */
  importRecordsFromClipboard() {
    if (this.data.isImportingClipboard) return; // 防止重复点击
    this.setData({ isImportingClipboard: true });
    wx.showLoading({ title: '正在从剪贴板导入...' });
    console.log('importRecordsFromClipboard: 开始获取剪贴板数据。'); // 调试日志

    wx.getClipboardData({
      success: (res) => {
        const clipboardData = res.data;
        console.log('importRecordsFromClipboard: 获取到剪贴板数据:', clipboardData); // 调试日志
        if (!clipboardData || clipboardData.trim() === '') { // 明确判断剪贴板是否真的为空
          wx.showToast({ title: '剪贴板无数据', icon: 'none', duration: 3000 }); // 持续时间调整
          this.setData({ isImportingClipboard: false });
          wx.hideLoading();
          console.log('importRecordsFromClipboard: 剪贴板无数据，停止导入。'); // 调试日志
          return;
        }

        let parsedImportedRecords = []; // 原始解析结果，包含课程中文名
        let duplicateCount = 0;

        try {
            parsedImportedRecords = this.parseClipboardContent(clipboardData);
        } catch (e) {
            console.error('importRecordsFromClipboard: 解析剪贴板数据失败 (异常捕获):', e);
            wx.showToast({ title: '解析剪贴板数据失败，请检查格式', icon: 'error', duration: 3000 }); // 持续时间调整
            this.setData({ isImportingClipboard: false });
            wx.hideLoading();
            return;
        }

        if (parsedImportedRecords.length === 0) {
          // 如果剪贴板有内容但解析结果为空，说明格式不正确
          wx.showToast({ title: '剪贴板内容格式不正确，无有效记录', icon: 'none', duration: 3000 }); // 持续时间调整
          this.setData({ isImportingClipboard: false });
          wx.hideLoading();
          console.log('importRecordsFromClipboard: 解析后无有效记录，停止导入。'); // 调试日志
          return;
        }
        console.log('importRecordsFromClipboard: 解析到有效记录数量:', parsedImportedRecords.length); // 调试日志

        // === 核心逻辑：合并所有记录，更新课程/学生列表，然后去重 ===

        // 1. 创建一个包含所有现有和新导入记录的临时集合
        const allRecordsTemp = [...app.globalData.records, ...parsedImportedRecords];
        console.log('importRecordsFromClipboard: 临时合并记录数量 (现有+解析):', allRecordsTemp.length); // 调试日志

        // 2. 根据所有记录（包括新导入的），更新全局课程列表和学生列表
        // 注意：这里更新的是 app.globalData.courses，它应该是一个 master list
        // 所以这里应该将新导入的课程添加到 master list 中，而不是完全替换
        const coursesFromImportedRecords = app.getAllCoursesFromRecords(parsedImportedRecords);
        const newCoursesToAdd = coursesFromImportedRecords.filter(c => !app.globalData.courses.includes(c));
        if (newCoursesToAdd.length > 0) {
            app.globalData.courses = [...app.globalData.courses, ...newCoursesToAdd].sort();
            app.saveCourses(); // 保存更新后的 master courses
        }
        
        app.globalData.students = app.getAllStudents(allRecordsTemp);
        // app.saveStudents(); // 如果 app.js 中有 saveStudents，这里也调用
        console.log('importRecordsFromClipboard: 更新全局课程数量:', app.globalData.courses.length); // 调试日志
        console.log('importRecordsFromClipboard: 更新全局学生数量:', app.globalData.students.length); // 调试日志


        // 3. 准备最终要导入的记录，进行去重
        let finalRecordsToAdd = [];
        const existingRecordKeys = new Set();
        // 这里的 app.globalData.records 应该已经是最新的（因为上面已经更新了 courses/students）
        const currentGlobalRecordsForDedupe = app.globalData.records || [];
        currentGlobalRecordsForDedupe.forEach(rec => {
          existingRecordKeys.add(this.getRecordUniqueKey(rec));
        });
        console.log('importRecordsFromClipboard: 现有记录的唯一键数量:', existingRecordKeys.size); // 调试日志


        parsedImportedRecords.forEach(newRec => { // 直接使用 newRec，因为它已经包含课程中文名
            if (existingRecordKeys.has(this.getRecordUniqueKey(newRec))) {
                duplicateCount++;
            } else {
                finalRecordsToAdd.push(newRec);
            }
        });
        console.log('importRecordsFromClipboard: 待添加的唯一新记录数量:', finalRecordsToAdd.length); // 调试日志


        // 4. 将去重后的新记录添加到全局数据中
        app.globalData.records = [...app.globalData.records, ...finalRecordsToAdd];
        app.saveRecords();
        app.refreshAllPages(); // 刷新所有页面以显示新数据
        this.loadData(); // 刷新当前页面的数据
        console.log('importRecordsFromClipboard: 最终全局记录数量:', app.globalData.records.length); // 调试日志


        let toastTitle = `成功导入 ${finalRecordsToAdd.length} 条数据`;
        if (duplicateCount > 0) {
          toastTitle += `, ${duplicateCount} 条数据重复`;
        }
        wx.showToast({ title: toastTitle, icon: 'success', duration: 3000 }); // 持续时间调整
        console.log('importRecordsFromClipboard: 导入完成，显示Toast:', toastTitle); // 调试日志

      },
      fail: (err) => {
        console.error('复制到剪贴板失败', err);
        wx.showToast({ title: '复制失败', icon: 'error', duration: 3000 }); // 持续时间调整
      },
      complete: () => {
        wx.hideLoading();
        this.setData({ isImportingClipboard: false });
        console.log('importRecordsFromClipboard: 导入操作完成，isImportingClipboard 设置为 false。'); // 调试日志
      }
    });
  },

  /**
   * 从CSV文件导入成绩记录
   */
  importRecords() {
    if (this.data.isImportingFile) return; // 防止重复点击
    this.setData({ isImportingFile: true });
    wx.showLoading({ title: '正在导入文件...' });
    console.log('importRecords: 开始选择文件。'); // 调试日志


    wx.chooseMessageFile({
      count: 1, // 只允许选择一个文件
      type: 'file', // 只能选择文件
      extension: ['csv'], // 只允许选择csv文件
      success: (res) => {
        const filePath = res.tempFiles[0].path;
        const fs = wx.getFileSystemManager();
        console.log('importRecords: 选择了文件:', filePath); // 调试日志


        fs.readFile({
          filePath: filePath,
          encoding: 'utf-8', // 假设CSV文件是UTF-8编码
          success: (data) => {
            let duplicateCount = 0;
            try {
              const importedRecordsRaw = this.parseCsv(data.data); // 原始解析结果
              console.log('importRecords: CSV解析到记录数量:', importedRecordsRaw.length); // 调试日志

              if (importedRecordsRaw.length === 0) {
                wx.showToast({ title: '文件内容无效或为空', icon: 'none', duration: 3000 }); // 持续时间调整
                console.log('importRecords: CSV文件内容无效或为空，停止导入。'); // 调试日志
                return;
              }

              // === 核心逻辑：合并所有记录，更新课程/学生列表，然后去重 ===

              // 1. 创建一个包含所有现有和新导入记录的临时集合
              const allRecordsTemp = [...app.globalData.records, ...importedRecordsRaw];
              console.log('importRecords: 临时合并记录数量 (现有+解析):', allRecordsTemp.length); // 调试日志


              // 2. 根据所有记录（包括新导入的），更新全局课程列表和学生列表
              // 注意：这里更新的是 app.globalData.courses，它应该是一个 master list
              // 所以这里应该将新导入的课程添加到 master list 中，而不是完全替换
              const coursesFromImportedRecords = app.getAllCoursesFromRecords(importedRecordsRaw);
              const newCoursesToAdd = coursesFromImportedRecords.filter(c => !app.globalData.courses.includes(c));
              if (newCoursesToAdd.length > 0) {
                  app.globalData.courses = [...app.globalData.courses, ...newCoursesToAdd].sort();
                  app.saveCourses(); // 保存更新后的 master courses
              }

              app.globalData.students = app.getAllStudents(allRecordsTemp);
              // app.saveStudents(); // 如果 app.js 中有 saveStudents，这里也调用
              console.log('importRecords: 更新全局课程数量:', app.globalData.courses.length); // 调试日志
              console.log('importRecords: 更新全局学生数量:', app.globalData.students.length); // 调试日志


              // 3. 准备最终要导入的记录，进行去重
              let finalRecordsToAdd = [];
              const existingRecordKeys = new Set();
              // 这里的 app.globalData.records 应该已经是最新的（因为上面已经更新了 courses/students）
              const currentGlobalRecordsForDedupe = app.globalData.records || [];
              currentGlobalRecordsForDedupe.forEach(rec => {
                existingRecordKeys.add(this.getRecordUniqueKey(rec));
              });
              console.log('importRecords: 现有记录的唯一键数量:', existingRecordKeys.size); // 调试日志


              importedRecordsRaw.forEach(newRec => {
                if (existingRecordKeys.has(this.getRecordUniqueKey(newRec))) {
                  duplicateCount++;
                } else {
                  finalRecordsToAdd.push(newRec);
                }
              });
              console.log('importRecords: 待添加的唯一新记录数量:', finalRecordsToAdd.length); // 调试日志


              // 4. 将去重后的新记录添加到全局数据中
              app.globalData.records = [...app.globalData.records, ...finalRecordsToAdd];
              app.saveRecords();
              app.refreshAllPages(); // 刷新所有页面以显示新数据
              this.loadData(); // 刷新当前页面的数据
              console.log('importRecords: 最终全局记录数量:', app.globalData.records.length); // 调试日志


              let toastTitle = `成功导入 ${finalRecordsToAdd.length} 条数据`;
              if (duplicateCount > 0) {
                toastTitle += `, ${duplicateCount} 条数据重复`;
              }
              wx.showToast({ title: toastTitle, icon: 'success', duration: 3000 }); // 持续时间调整
              console.log('importRecords: 导入完成，显示Toast:', toastTitle); // 调试日志

            } catch (e) {
              console.error('importRecords: 解析CSV文件失败 (异常捕获):', e);
              wx.showToast({ title: '解析文件内容失败', icon: 'error', duration: 3000 }); // 持续时间调整
            }
          },
          fail: (err) => {
            console.error('importRecords: 读取文件失败:', err);
            wx.showToast({ title: '读取文件失败', icon: 'error', duration: 3000 }); // 持续时间调整
          },
          complete: () => {
            wx.hideLoading();
            this.setData({ isImportingFile: false });
            console.log('importRecords: 导入操作完成，isImportingFile 设置为 false。'); // 调试日志
          }
        });
      },
      fail: (err) => {
        console.log('importRecords: 用户取消选择文件或选择文件失败:', err);
        wx.hideLoading();
        this.setData({ isImportingFile: false });
      }
    });
  },

  /**
   * 辅助函数：生成记录的唯一键，用于去重
   */
  getRecordUniqueKey(record) {
    // 关键修正：重新包含 remarks 字段，所有字段都参与唯一键的生成
    return `${record.student}|${record.course}|${record.score}|${record.fullScore}|${record.date}|${record.remarks}`;
  },

  /**
   * 辅助函数：解析CSV字符串为成绩记录数组
   * 假设CSV格式为: 姓名,课程,成绩,满分,日期,备注
   * 并且第一行为表头
   * 改进了对带引号字段和转义双引号的处理
   */
  parseCsv(csvString) {
    const lines = csvString.trim().split(/\r?\n/); // 兼容不同换行符
    if (lines.length <= 1) {
      console.warn('parseCsv: CSV内容少于2行 (无表头或无数据)。'); // 调试日志
      return []; // 至少需要一行数据（不含表头）
    }

    const records = [];
    // 使用更健壮的CSV行解析（处理逗号和引号）
    const parseLine = (line) => {
        const values = [];
        let inQuote = false;
        let currentField = '';
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuote && line[i + 1] === '"') { // Escaped double quote ""
                    currentField += '"';
                    i++; // Skip the next quote
                } else {
                    inQuote = !inQuote;
                }
            } else if (char === ',' && !inQuote) {
                values.push(currentField);
                currentField = '';
            } else {
                currentField += char;
            }
        }
        values.push(currentField); // Add the last field
        return values;
    };

    const headers = parseLine(lines[0]).map(h => h.trim()); // 解析表头
    console.log('parseCsv: CSV Headers:', headers); // 调试日志

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        console.warn(`parseCsv: 跳过空数据行 (行号 ${i + 1})`); // 调试日志
        continue; // Skip empty lines
      }

      const values = parseLine(line);
      console.log(`parseCsv: 解析数据行 ${i + 1}:`, line); // 调试日志
      console.log(`parseCsv: 分割后的值:`, values); // 调试日志


      // 确保有足够的列
      if (values.length !== headers.length) {
          console.warn(`parseCsv: 跳过无效行 (列数不匹配 ${values.length} != ${headers.length}): ${line}`);
          continue;
      }

      const record = {};
      record.id = Date.now() + i + Math.random(); // 为导入的记录生成一个更唯一的ID

      // 映射CSV列到记录属性，并处理类型转换
      record.student = values[headers.indexOf('姓名')] ? values[headers.indexOf('姓名')].trim() : '';
      record.course = values[headers.indexOf('课程')] ? values[headers.indexOf('课程')].trim() : '';
      record.score = parseFloat(values[headers.indexOf('成绩')]) || 0; // 使用 parseFloat
      record.fullScore = parseInt(values[headers.indexOf('满分')]) || 100;
      record.date = values[headers.indexOf('日期')] ? values[headers.indexOf('日期')].trim() : '';
      record.remarks = values[headers.indexOf('备注')] ? values[headers.indexOf('备注')].trim() : '';

      // 详细验证数据有效性
      let isValid = true;
      if (!record.student) {
        console.warn(`parseCsv: 行 ${i + 1} 无效 (姓名为空):`, record);
        isValid = false;
      }
      if (!record.course) {
        console.warn(`parseCsv: 行 ${i + 1} 无效 (课程为空):`, record);
        isValid = false;
      }
      if (isNaN(record.score)) {
        console.warn(`parseCsv: 行 ${i + 1} 无效 (成绩无效):`, record);
        isValid = false;
      }
      if (isNaN(record.fullScore)) {
        console.warn(`parseCsv: 行 ${i + 1} 无效 (满分无效):`, record);
        isValid = false;
      }
      if (!record.date) {
        console.warn(`parseCsv: 行 ${i + 1} 无效 (日期为空):`, record);
        isValid = false;
      }

      // 新增：导入时也校验成绩范围和一位小数
      if (isValid) {
        if (record.score < 0 || record.score > record.fullScore) {
          console.warn(`parseCsv: 行 ${i + 1} 无效 (成绩超出范围):`, record);
          isValid = false;
        }
        const scoreStr = String(record.score);
        const decimalIndex = scoreStr.indexOf('.');
        if (decimalIndex !== -1 && scoreStr.length - 1 - decimalIndex > 1) {
          console.warn(`parseCsv: 行 ${i + 1} 无效 (成绩小数点位数不符):`, record);
          isValid = false;
        }
      }

      if (isValid) {
        records.push(record);
      } else {
        console.warn('parseCsv: 跳过无效记录 (数据不完整或格式错误):', record, '原始行:', line);
      }
    }
    console.log('parseCsv: 解析完成。有效记录数量:', records.length); // 调试日志
    return records;
  },

  /**
   * 批量删除功能的核心逻辑 (通用版本，会更新学生和课程列表)
   * @param {function} filterFn - 用于过滤要删除记录的函数
   * @param {string} confirmMessage - 确认删除的提示信息
   * @param {string} successMessage - 删除成功的提示信息
   */
  _batchDeleteRecords(filterFn, confirmMessage, successMessage) {
    const currentRecords = app.globalData.records || [];
    const recordsToDelete = currentRecords.filter(filterFn);

    if (recordsToDelete.length === 0) {
      wx.showToast({ title: '没有匹配的记录可删除', icon: 'none', duration: 3000 });
      return;
    }

    wx.showModal({
      title: '批量删除确认',
      content: `${confirmMessage}\n共${recordsToDelete.length}条记录。此操作不可撤销！`,
      confirmText: '确认删除',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          const updatedRecords = currentRecords.filter(rec => !filterFn(rec));
          app.globalData.records = updatedRecords;
          app.saveRecords();

          // 重新生成并保存 students (courses 保持 master list，不从 records 重新生成)
          app.globalData.students = app.getAllStudents(updatedRecords);
          // app.saveStudents(); // 如果 app.js 中有 saveStudents，这里也调用

          app.refreshAllPages();
          this.loadData();
          wx.showToast({ title: successMessage, icon: 'success', duration: 3000 });
        }
      }
    });
  },

  /**
   * 批量删除功能的核心逻辑 (仅删除记录和更新学生，不触碰课程列表)
   * @param {function} filterFn - 用于过滤要删除记录的函数
   * @param {string} confirmMessage - 确认删除的提示信息
   * @param {string} successMessage - 删除成功的提示信息
   */
  _batchDeleteRecordsOnly(filterFn, confirmMessage, successMessage) {
    const currentRecords = app.globalData.records || [];
    const recordsToDelete = currentRecords.filter(filterFn);

    if (recordsToDelete.length === 0) {
      wx.showToast({ title: '没有匹配的记录可删除', icon: 'none', duration: 3000 });
      return;
    }

    wx.showModal({
      title: '批量删除确认',
      content: `${confirmMessage}\n共${recordsToDelete.length}条记录。此操作不可撤销！`,
      confirmText: '确认删除',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          const updatedRecords = currentRecords.filter(rec => !filterFn(rec));
          app.globalData.records = updatedRecords;
          app.saveRecords();

          // 仅更新学生列表，课程列表保持不变
          app.globalData.students = app.getAllStudents(updatedRecords);
          // app.saveStudents(); // 如果 app.js 中有 saveStudents，这里也调用

          app.refreshAllPages();
          this.loadData();
          wx.showToast({ title: successMessage, icon: 'success', duration: 3000 });
        }
      }
    });
  },

  /**
   * 批量删除：按姓名删除成绩 - 弹出学生选择或输入框
   */
  promptDeleteByStudent() {
    const students = this.data.students;
    if (students.length === 0) {
      wx.showToast({ title: '暂无学生数据可供选择', icon: 'none', duration: 3000 });
      return;
    }

    if (students.length <= 6) { // 如果学生数量不多，使用 ActionSheet 方便选择
      wx.showActionSheet({
        itemList: students,
        alertText: '请选择要删除成绩的学生姓名',
        success: (res) => {
          const studentName = students[res.tapIndex];
          this._batchDeleteRecords( // 使用通用删除函数，会更新学生和课程列表
            (record) => record.student === studentName,
            `确定要删除学生 "${studentName}" 的所有成绩记录吗？`,
            `已删除`
          );
        },
        fail: (res) => {
          console.log('用户取消选择学生:', res.errMsg);
        }
      });
    } else { // 如果学生数量较多，使用输入框让用户手动输入
      wx.showModal({
        title: '按姓名删除成绩',
        editable: true,
        placeholderText: '请输入要删除成绩的学生姓名',
        confirmText: '确定删除',
        confirmColor: '#ff4d4f',
        success: (res) => {
          if (res.confirm) {
            const studentName = res.content ? res.content.trim() : '';
            if (!studentName) {
              wx.showToast({ title: '学生姓名不能为空', icon: 'none', duration: 3000 });
              return;
            }
            if (!students.includes(studentName)) {
              wx.showToast({ title: '输入的学生姓名不存在，请检查', icon: 'none', duration: 3000 });
              return;
            }
            this._batchDeleteRecords( // 使用通用删除函数，会更新学生和课程列表
              (record) => record.student === studentName,
              `确定要删除学生 "${studentName}" 的所有成绩记录吗？`,
              `已删除`
            );
          } else {
            console.log('用户取消按姓名删除操作');
          }
        }
      });
    }
  },

  /**
   * 批量删除：按日期删除成绩 - 弹出日期输入框
   */
  promptDeleteByDate() {
    wx.showModal({
      title: '按日期删除成绩',
      editable: true,
      placeholderText: 'YYYY-MM-DD', // 更新提示文本
      confirmText: '确定删除',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          const dateToDelete = res.content ? res.content.trim() : '';
          // 严格的日期格式校验 (YYYY-MM-DD)
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateToDelete || !dateRegex.test(dateToDelete)) {
            wx.showToast({ title: '请输入有效的日期格式 (YYYY-MM-DD)', icon: 'none', duration: 3000 }); // 更新提示文本
            return;
          }
          this._batchDeleteRecords( // 使用通用删除函数，会更新学生和课程列表
            (record) => record.date === dateToDelete,
            `确定要删除日期 "${dateToDelete}" 的所有成绩记录吗？`,
            `已删除`
          );
        } else {
          console.log('用户取消按日期删除操作');
        }
      }
    });
  },

  /**
   * 批量删除：按课程删除成绩 - 弹出课程选择或输入框
   */
  promptDeleteByCourse() {
    // 这里的 courses 应该是 config 页面 data 中的 courses (master list)
    const courses = this.data.courses; 
    if (courses.length === 0) {
      wx.showToast({ title: '暂无课程数据可供选择', icon: 'none', duration: 3000 });
      return;
    }

    if (courses.length <= 6) { // 如果课程数量不多，使用 ActionSheet 方便选择
      wx.showActionSheet({
        itemList: courses,
        alertText: '请选择要删除成绩的课程名称',
        success: (res) => {
          const courseName = courses[res.tapIndex];
          this._batchDeleteRecordsOnly( // 使用新的辅助函数，只删除记录，不触碰课程列表
            (record) => record.course === courseName,
            `确定要删除课程 "${courseName}" 的所有成绩记录吗？`,
            `已删除`
          );
        },
        fail: (res) => {
          console.log('用户取消选择课程:', res.errMsg);
        }
      });
    } else { // 如果课程数量较多，使用输入框让用户手动输入
      wx.showModal({
        title: '按课程删除成绩',
        editable: true,
        placeholderText: '请输入要删除成绩的课程名称',
        confirmText: '确定删除',
        confirmColor: '#ff4d4f',
        success: (res) => {
          if (res.confirm) {
            const courseName = res.content ? res.content.trim() : '';
            if (!courseName) {
              wx.showToast({ title: '课程名称不能为空', icon: 'none', duration: 3000 });
              return;
            }
            if (!courses.includes(courseName)) {
              wx.showToast({ title: '输入的课程名称不存在，请检查', icon: 'none', duration: 3000 });
              return;
            }
            this._batchDeleteRecordsOnly( // 使用新的辅助函数，只删除记录，不触碰课程列表
              (record) => record.course === courseName,
              `确定要删除课程 "${courseName}" 的所有成绩记录吗？`,
              `已删除`
            );
          } else {
            console.log('用户取消按课程删除操作');
          }
        }
      });
    }
  },

  /**
   * 重构：确认清除缓存并重启
   */
  confirmClearAndRestart: function() {
    wx.showModal({
      title: '警告：将永久清除数据并重启',
      content: '确定要继续吗？', // 添加提示小字
      confirmColor: '#ff4d4f', // 危险操作使用红色确认按钮
      success: (res) => {
        if (res.confirm) {
          this.clearLocalCacheAndRestart();
        } else if (res.cancel) {
          console.log('用户取消了清除缓存操作');
        }
      }
    });
  },

  /**
   * 重构：清除本地缓存并重启小程序
   */
  clearLocalCacheAndRestart: function() {
    try {
      wx.clearStorageSync(); // 同步清除所有本地缓存
      console.log('所有本地缓存已清除。');
      wx.showToast({
        title: '缓存已清除，正在重启',
        icon: 'none',
        duration: 3000 // 统一为3秒
      });

      // 延迟一段时间后重启，给用户看到Toast的时间
      setTimeout(() => {
        // 重启到小程序首页（根据你提供的WXML，假设首页路径是 'pages/input/input'）
        wx.reLaunch({
          url: '/pages/input/input',
          success: () => {
            console.log('小程序已重启。');
            // 确保 app.js 的 onLaunch 逻辑能够重新加载数据
          },
          fail: (err) => {
            console.error('重启失败', err);
            wx.showToast({
              title: '重启失败，请手动关闭',
              icon: 'error',
              duration: 3000 // 统一为3秒
            });
          }
        });
      }, 3000); // 等待Toast显示完毕，这里保持1.5秒，因为重启需要一点时间

    } catch (e) {
      console.error('清除本地缓存失败', e);
      wx.showToast({
        title: '清除失败',
        icon: 'error',
        duration: 3000 // 统一为3秒
      });
    }
  },
});
