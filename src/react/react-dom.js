// !vnode代表虚拟dom节点
// !node代表真实dom节点

import { TEXT } from './const'

function render(vnode, container) {
  const node = createNode(vnode, container)
  container.appendChild(node)
}

// 返回真实的dom节点，vnode->node 这个过程还要处理属性
function createNode(vnode, parentNode) {
  const { type, props } = vnode
  let node = null

  if (type === TEXT) {
    node = document.createTextNode('')
  } else if (typeof type === 'string') {
    node = document.createElement(type)
  } else if (typeof type === 'function') {
    node = type.isReactComponent ? updateClassComponent(vnode, parentNode) : updateFunctionComponent(vnode, parentNode)
  }

  reconcileChildren(props.children, node)

  updateNode(node, props)

  return node
}

function updateClassComponent(vnode, parentNode) {
  const { type, props } = vnode
  const cmp = new type(props)
  const vvnode = cmp.render()
  const node = createNode(vvnode, parentNode)
  return node
}

function updateFunctionComponent(vnode, parentNode) {
  const { type, props } = vnode
  const vvnode = type(props)
  const node = createNode(vvnode, parentNode)
  return node
}

function reconcileChildren(children, node) {
  children.forEach(child => render(child, node))
}

function updateNode(node, props) {
  const excludes = ['children']
  Object.keys(props)
    .filter(key => !excludes.includes(key))
    .forEach(key => {
      // 处理事件
      if (key.slice(0, 2) === 'on') {
        const eventName = key.slice(2).toLowerCase()
        node.addEventListener(eventName, props[key])

        return
      }

      node[key] = props[key]
    })
}

export default {
  render
}
