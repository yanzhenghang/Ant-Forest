/*
 * @Author: TonyJiangWJ
 * @Last Modified by: TonyJiangWJ
 * @Last Modified time: 2019-07-04 00:14:22
 * @Description: UI操作工具
 */
let config = storages.create("ant_forest_config")
if (!commonFunctions) {
  let { commonFunctions } = require('./CommonFunctions.js')
}
/**
 * 查找没有更多了控件是否存在
 * 
 * @param {number} sleepTime 超时时间
 */
const foundNoMoreWidget = function (sleepTime) {
  let sleep = sleepTime || config.get("timeout_findOne")
  let noMoreWidgetHeight = 0

  let noMoreWidget = widgetGetOne(config.get('no_more_ui_content'), sleep)
  if (noMoreWidget) {
    let bounds = noMoreWidget.bounds()
    debugInfo("找到控件: [" + bounds.left + ", " + bounds.top + ", " + bounds.right + ", " + bounds.bottom + "]")
    noMoreWidgetHeight = bounds.bottom - bounds.top
  }
  // todo 该校验并不完美，当列表已经加载过之后，明明没有在视野中的控件，位置centerY还是能够获取到，而且非0
  if (noMoreWidgetHeight > 50) {
    debugInfo('"没有更多了" 当前控件高度:' + noMoreWidgetHeight)
    return true
  } else {
    if (noMoreWidgetHeight > 0) {
      debugInfo('"没有更多了" 控件高度不符合要求' + noMoreWidgetHeight)
    }
    return false
  }
}

/**
 * 校验控件是否存在，并打印相应日志
 * @param {String} contentVal 控件文本
 * @param {String} position 日志内容 当前所在位置是否成功进入
 * @param {Number} timeoutSetting 超时时间 默认6000 即6秒钟
 */
const widgetWaiting = function (contentVal, position, timeoutSetting) {
  let waitingSuccess = widgetCheck(contentVal, timeoutSetting)

  if (waitingSuccess) {
    debugInfo('成功进入' + position)
    return true
  } else {
    errorInfo('进入' + position + '失败')
    return false
  }
}

/**
 * 校验控件是否存在
 * @param {String} contentVal 控件文本
 * @param {Number} timeoutSetting 超时时间 不设置则为6秒
 * 超时返回false
 */
const widgetCheck = function (contentVal, timeoutSetting) {
  let timeout = timeoutSetting || 6000
  let countDown = new java.util.concurrent.CountDownLatch(1)
  let descThread = threads.start(function () {
    descMatches(contentVal).waitFor()
    let res = descMatches(contentVal).findOne().desc()
    debugInfo('find desc ' + contentVal + " " + res)
    countDown.countDown()
  })

  let textThread = threads.start(function () {
    textMatches(contentVal).waitFor()
    let res = textMatches(contentVal).findOne().text()
    debugInfo('find text ' + contentVal + "  " + res)
    countDown.countDown()
  })
  let timeoutFlag = false
  let timeoutThread = threads.start(function () {
    sleep(timeout)
    timeoutFlag = true
    countDown.countDown()
  })
  countDown.await()
  descThread.interrupt()
  textThread.interrupt()
  timeoutThread.interrupt()
  return !timeoutFlag
}

/**
 * 校验是否成功进入自己的首页
 */
const homePageWaiting = function (timeout) {
  if (widgetCheck(config.get('friend_home_ui_content'), 200)) {
    errorInfo('错误位置：当前所在位置为好友首页')
    return false
  }
  if (widgetCheck(config.get('friend_list_ui_content'), 200)) {
    errorInfo('错误位置：当前所在位置为好友排行榜')
    return false
  }
  return widgetWaiting(config.get('home_ui_content'), '个人首页', timeout)
}

/**
 * 校验是否成功进入好友首页
 */
const friendHomeWaiting = function (timeout) {
  return widgetWaiting(config.get('friend_home_ui_content'), '好友首页', timeout)
}

/**
 * 校验是否成功进入好友排行榜
 */
const friendListWaiting = function (timeout) {
  return widgetWaiting(config.get('friend_list_ui_content'), '好友排行榜', timeout)
}

/**
 * 根据内容获取一个对象
 * 
 * @param {string} contentVal 
 * @param {number} timeout 
 * @param {boolean} containType 是否带回类型
 */
const widgetGetOne = function (contentVal, timeout, containType) {
  let target = null
  let isDesc = false
  let waitTime = timeout || config.get("timeout_findOne")
  if (textMatches(contentVal).exists()) {
    debugInfo('text ' + contentVal + ' found')
    target = textMatches(contentVal).findOne(waitTime)
  } else if (descMatches(contentVal).exists()) {
    isDesc = true
    debugInfo('desc ' + contentVal + ' found')
    target = descMatches(contentVal).findOne(waitTime)
  } else {
    debugInfo('none of text or desc found for ' + contentVal)
  }
  // 当需要带回类型时返回对象 传递target以及是否是desc
  if (target && containType) {
    let result = {
      target: target,
      isDesc: isDesc
    }
    return result
  }
  return target
}

/**
 * 根据内容获取所有对象的列表
 * 
 * @param {string} contentVal 
 * @param {number} timeout 
 * @param {boolean} containType 是否传递类型
 */
const widgetGetAll = function (contentVal, timeout, containType) {
  let target = null
  let isDesc = false
  let countDown = new java.util.concurrent.CountDownLatch(1)
  let waitTime = timeout || config.get("timeout_findOne")
  let findThread = threads.start(function () {
    if (textMatches(contentVal).exists()) {
      debugInfo('text ' + contentVal + ' found')
      target = textMatches(contentVal).untilFind()
    } else if (descMatches(contentVal).exists()) {
      isDesc = true
      debugInfo('desc ' + contentVal + ' found')
      target = descMatches(contentVal).untilFind()
    } else {
      debugInfo('none of text or desc found for ' + contentVal)
    }
    countDown.countDown()
  })
  let timeoutFlag = false
  let timeoutThread = threads.start(function () {
    sleep(waitTime)
    timeoutFlag = true
    countDown.countDown()
    warnInfo('timeout for finding ' + contentVal)
  })
  countDown.await()
  findThread.interrupt()
  timeoutThread.interrupt()
  if (timeoutFlag) {
    return null
  } else if (target && containType) {
    let result = {
      target: target,
      isDesc: isDesc
    }
    return result
  }
  return target
}

/**
 * 加载好友排行榜列表
 */
const loadFriendList = function () {
  logInfo('正在展开好友列表请稍等。。。', true)
  let start = new Date()
  let countDown = new java.util.concurrent.CountDownLatch(1)
  let loadThread = threads.start(function () {
    while ((more = idMatches(".*J_rank_list_more.*").findOne(200)) != null) {
      more.click()
    }
  })
  let foundNoMoreThread = threads.start(function () {
    widgetCheck(config.get('no_more_ui_content'), config.get("timeoutLoadFriendList") || 6000)
    countDown.countDown()
  })
  let timeoutThread = threads.start(function () {
    sleep(config.get("timeoutLoadFriendList") || 6000)
    errorInfo("预加载好友列表超时")
    countDown.countDown()
  })
  countDown.await()
  let end = new Date()
  logInfo('好友列表展开完成, cost ' + (end - start) + ' ms', true)
  loadThread.interrupt()
  foundNoMoreThread.interrupt()
  timeoutThread.interrupt()
}

/**
 * 获取排行榜好友列表
 */
const getFriendList = function () {
  let friends_list = null
  if (idMatches('J_rank_list_append').exists()) {
    debugInfo('newAppendList')
    friends_list = idMatches('J_rank_list_append').findOne(
      config.get("timeout_findOne")
    )
  } else if (idMatches('J_rank_list').exists()) {
    debugInfo('oldList')
    friends_list = idMatches('J_rank_list').findOne(
      config.get("timeout_findOne")
    )
  }
  return friends_list
}
/**
   * 获取好友昵称
   * 
   * @param {Object} fri 
   */
const getFriendsName = function (fri) {
  let name = null
  if (commonFunctions.isEmpty(fri.child(1).desc())) {
    name = fri.child(2).desc()
  } else {
    name = fri.child(1).desc()
  }
  if (commonFunctions.isEmpty(name)) {
    if (commonFunctions.isEmpty(fri.child(1).text())) {
      name = fri.child(2).text()
    } else {
      name = fri.child(1).text()
    }
  }
  return name
}

/**
 * 等待排行榜稳定
 * 即不在滑动过程
 */
const waitRankListStable = function () {
  let startPoint = new Date()
  debugInfo('等待列表稳定')
  let compareBottomVal = getJRankSelfBottom()
  let size = config.get("friendListStableCount") || 3
  let bottomValQueue = createQueue(size)
  while (getQueueDistinctSize(bottomValQueue) > 1) {
    compareBottomVal = getJRankSelfBottom()
    if (compareBottomVal === undefined && ++invalidCount > 10) {
      warnInfo('获取坐标失败次数超过十次')
      break
    } else {
      pushQueue(bottomValQueue, size, compareBottomVal)
      debugInfo(
        '添加参考值：' + compareBottomVal +
        '队列重复值数量：' + getQueueDistinctSize(bottomValQueue)
      )
    }
  }
  debugInfo('列表已经稳定 等待列表稳定耗时[' + (new Date() - startPoint) + ']ms，不可接受可以调小config.js中的friendListStableCount')
}

const createQueue = function (size) {
  let queue = []
  for (let i = 0; i < size; i++) {
    queue.push(i)
  }
  return queue
}

const getQueueDistinctSize = function (queue) {
  return queue.reduce((a, b) => {
    if (a.indexOf(b) < 0) {
      a.push(b)
    }
    return a
  }, []).length
}

const pushQueue = function (queue, size, val) {
  if (queue.length >= size) {
    queue.shift()
  }
  queue.push(val)
}


/**
 * 获取列表中自己的底部高度
 */
const getJRankSelfBottom = function () {
  let maxTry = 50
  while (maxTry-- > 0) {
    try {
      return idMatches(/.*J_rank_list_self/).findOnce().bounds().bottom;
    } catch (e) {
      // nothing to do here
    }
  }
  return null
}

module.exports = {
  WidgetUtils: {
    foundNoMoreWidget: foundNoMoreWidget,
    widgetWaiting: widgetWaiting,
    widgetCheck: widgetCheck,
    homePageWaiting: homePageWaiting,
    friendHomeWaiting: friendHomeWaiting,
    friendListWaiting: friendListWaiting,
    widgetGetOne: widgetGetOne,
    widgetGetAll: widgetGetAll,
    loadFriendList: loadFriendList,
    getFriendList: getFriendList,
    getFriendsName: getFriendsName,
    waitRankListStable: waitRankListStable,
    getJRankSelfBottom: getJRankSelfBottom
  }
}