// !vnode代表虚拟dom节点
// !node代表真实dom节点

import { TEXT, PLACEMENT } from './const'

// work in progress
let wipRoot = null

// 当前根节点
let currentRoot = null

// 下一个任务 fiber
let nextUnitOfWork = null

// 上一个兄弟 fiber
let prevSibling = null

function render(vnode, container) {
  wipRoot = {
    node: container,
    props: {
      children: [vnode]
    },
    base: currentRoot
  }

  nextUnitOfWork = wipRoot
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
  } else {
    node = document.createDocumentFragment()
  }

  updateNode(node, props)

  return node
}

function updateHostComponent(fiber) {
  // 1.构建当前fiber结构，添加节点属性
  if (!fiber.node) {
    fiber.node = createNode(fiber)
  }

  // 2.协调子元素，构建子元素的fiber结构
  let children = []

  if (fiber.props) {
    children = fiber.props.children
  }

  reconcileChildren(fiber, children)
}

function updateClassComponent(fiber) {
  const { type, props } = fiber
  const children = [new type(props).render()]
  reconcileChildren(fiber, children)
}

function updateFunctionComponent(fiber) {
  const { type, props } = fiber
  const children = [type(props)]
  reconcileChildren(fiber, children)
}

/**
 * 给workInProgressFiber添加child，再给child构建sibling，形成一个链表
 * @param {fiber} workInProgressFiber 父fiber
 * @param {Array} children
 */
function reconcileChildren(workInProgressFiber, children) {
  children.forEach((child, index) => {
    const newFiber = {
      type: child.type,
      props: child.props,
      node: null,
      base: null,
      return: workInProgressFiber,
      effectTag: PLACEMENT
    }

    // 如果是第一个子元素，则设置当前 fiber 为 workInProgressFiber 的 子元素
    if (index === 0) {
      workInProgressFiber.child = newFiber
    } else {
      // 否则设置当前 fiber 为 上一个 fiber 的 sibling 元素
      prevSibling.sibling = newFiber
    }

    // 将当前 fiber 设置为上一个 fiber，便于后面fiber 续上 关系，形成完整的链表结构
    prevSibling = newFiber
  })
}

function updateNode(node, props) {
  if (!props) {
    return
  }

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

/**
 * window.requestIdleCallback()方法将在浏览器的空闲时段内调用的函数排队。
 *  这使开发者能够在主事件循环上执行后台和低优先级工作，而不会影响延迟关键事件，如动画和输入响应。
 *  函数一般会按先进先调用的顺序执行，然而，如果回调函数指定了执行超时时间timeout，则有可能为了在超时前执行函数而打乱执行顺序。
 *
 *  你可以在空闲回调函数中调用requestIdleCallback()，以便在下一次通过事件循环之前调度另一个回调。
 *
 *
 * IdleDeadline.timeRemaining()
 *  返回一个时间DOMHighResTimeStamp, 并且是浮点类型的数值，它用来表示当前闲置周期的预估剩余毫秒数。
 *  如果idle period已经结束，则它的值是0。
 *  你的回调函数(传给requestIdleCallback的函数)可以重复的访问这个属性用来判断当前线程的闲置时间是否可以在结束前执行更多的任务。
 */
function workLoop(IdleDeadline) {
  // 如果有下一个任务 并且 当前闲置周期的预估剩余毫秒数 > 1
  while (nextUnitOfWork && IdleDeadline.timeRemaining() > 1) {
    // 执行下一个任务
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }

  window.requestIdleCallback(workLoop)
}

function performUnitOfWork(fiber) {
  // 1.执行当前任务
  const { type } = fiber
  if (typeof type === 'function') {
    // 判断是类组件还是函数组件
    type.isReactComponent ? updateClassComponent(fiber) : updateFunctionComponent(fiber)
  } else {
    // h5标签
    updateHostComponent(fiber)
  }

  // 2.返回下一个任务: 子级优先、同级次之、父级最后
  if (fiber.child) {
    return fiber.child
  }

  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }

    nextFiber = nextFiber.return
  }
}

function commitRoot() {
  commitWorker(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
}

function commitWorker(fiber) {
  if (!fiber) {
    return
  }

  let parentNodeFiber = fiber.return
  while (parentNodeFiber && !parentNodeFiber.node) {
    parentNodeFiber = parentNodeFiber.return
  }

  let parentNode = parentNodeFiber.node
  if (fiber.effectTag === PLACEMENT && fiber.node !== null) {
    parentNode.appendChild(fiber.node)
  }

  // TODO: 删除、更新
  commitWorker(fiber.child)
  commitWorker(fiber.sibling)
}

window.requestIdleCallback(workLoop)

export default {
  render
}
