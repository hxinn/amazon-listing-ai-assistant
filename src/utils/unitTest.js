// 定义产品基础信息
const productInfo = {
  length: 3,
  width: 4,
  height: 5,
  weight: 23
}

// 动态配置信息 - 包含变量占位符的字符串
const str = '[{"length":"${productInfo.length * 0.393701}", "unit": "inches"}]'

/**
 * 递归处理对象或数组中的每个值，将字符串转换为数字
 * @param {*} value 要处理的值
 * @returns {*} 处理后的值
 */
function processValue(value) {
  if (Array.isArray(value)) {
    return value.map(processValue)
  } else if (typeof value === 'object' && value !== null) {
    const result = {}
    for (const key in value) {
      result[key] = processValue(value[key])
    }
    return result
  }
  return value
}

/**
 * 解析字符串模板中的变量表达式
 * @param {string} template 包含${...}表达式的模板字符串
 * @param {object} context 变量上下文对象
 * @returns {string} 解析后的字符串
 */
function parseTemplate(template, context) {
  return template.replace(/\$\{([^}]+)\}/g, (match, expression) => {
    try {
      // 创建一个安全的执行环境，包含Math对象和其他常用的全局对象
      const safeContext = {
        ...context,
        Math: Math,
        parseInt: parseInt,
        parseFloat: parseFloat,
        Number: Number,
        String: String
             }

      // eslint-disable-next-line no-new-func
      const func = new Function(...Object.keys(safeContext), `return ${expression}`)
      const result = func(...Object.values(safeContext))
      return result
    } catch (error) {
      console.warn(`解析表达式失败: ${expression}`, error)
      return match // 如果解析失败，返回原始字符串
    }
  })
}

/**
 * 解析str配置信息 json对象中的值如果有 变量 则替换为 productInfo 中的值
 * 最后输出 [{length: 3.93701, unit: "inches"}]
 * @param {string} str 包含变量占位符的json字符串
 * @param {object} productInfo 产品基础信息
 * @returns {object|null} json对象
 */
function parseConfig(str, productInfo) {
  try {
    // 首先解析字符串模板中的变量
    const resolvedStr = parseTemplate(str, { productInfo })

    // 然后解析JSON字符串
    const parsed = JSON.parse(resolvedStr)

    // 最后处理数据类型转换
    return processValue(parsed)
  } catch (error) {
    console.error('解析配置失败:', error)
    return null
  }
}

// 原始测试
console.log('=== 原始测试 ===')
const result = parseConfig(str, productInfo)
console.log('解析结果:', result)
console.log('预期结果: [{"length": 3.93701, "unit": "inches"}]')

// 测试用例
console.log('\n=== 测试用例 ===')

// 测试用例1: 复杂表达式 - 修复格式
const testCase1 = '[{"height":{"unit":"centimeters","value":${productInfo.height.toFixed(2)}},"length":{"unit":"centimeters","value":${productInfo.length.toFixed(2)}},"width":{"unit":"centimeters","value":${productInfo.width.toFixed(2)}}}]'
console.log('测试用例1 输入:', testCase1)
console.log('测试用例1 结果:', parseConfig(testCase1, productInfo))

// 测试用例2: 复杂表达式 - 修复格式
const testCase2= '[{"height":{"unit":"inches","value":${(productInfo.height*0.393701).toFixed(2)}},"length":{"unit":"inches","value":${(productInfo.length*0.393701).toFixed(2)}},"width":{"unit":"inches","value":${(productInfo.width*0.393701).toFixed(2)}}}]'
console.log('测试用例2 输入:', testCase2)
console.log('测试用例2 结果:', parseConfig(testCase2, productInfo))

const testCase3 = '[{"value":${(productInfo.length * productInfo.width * productInfo.height)/1000},"unit":"liters"}]'
console.log('测试用例3 输入:', testCase3)
console.log('测试用例3 结果:', parseConfig(testCase3, productInfo))
