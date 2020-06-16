import { TEXT } from '../const'
/**
 * createElement被调用时会传入标签类型type，标签属性props及若干子元素children
 * JSX编译后实际调用React.createElement方法，所以只要出现JSX的文件中都需要导入React
 */
function createElement(type, config, ...children) {
  if (config) {
    delete config.__self
    delete config.__source
  }

  const outputConfig = config ? filterConfig(config) : {}

  const props = {
    ...outputConfig,
    children: children.map(child => (typeof child === 'object' ? child : createTextNode(child)))
  }

  type && type.defaultProps && filterConfig(type.defaultProps, props)

  return {
    type,
    props
  }
}

function createTextNode(text) {
  return {
    type: TEXT,
    props: {
      children: [],
      nodeValue: text
    }
  }
}

// 过滤掉 key、ref等
function filterConfig(config, outputConfig = {}, excludes = ['key', 'ref', 'children']) {
  Object.keys(config)
    .filter(key => !excludes.includes(key))
    .forEach(key => {
      if (outputConfig[key] === undefined) {
        outputConfig[key] = config[key]
      }
    })

  return outputConfig
}

export default createElement
