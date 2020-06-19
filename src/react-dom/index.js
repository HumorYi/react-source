// !vnode代表虚拟dom节点
// !node代表真实dom节点

import { TEXT, PLACEMENT, UPDATE, DELETION } from '../const'

// work in progress
let wipRoot = null

// 当前根节点
let currentRoot = null

// 下一个任务 fiber
let nextUnitOfWork = null

let wipFiber = null
let wipFiberHookIndex = null

let deletions = null

function render(vnode, container) {
  wipRoot = {
    node: container,
    props: {
      children: [vnode]
    },
    base: currentRoot
  }

  nextUnitOfWork = wipRoot

  deletions = []
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

  updateNode(node, {}, props)

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
  wipFiber = fiber
  // 实现为数组，源码中是链表
  wipFiber.hooks = []
  wipFiberHookIndex = 0

  const { type, props } = fiber
  const children = [type(props)]
  reconcileChildren(fiber, children)
}

/**
 * 给returnFiber添加child，再给child构建sibling，形成一个链表
 * @param {fiber} returnFiber 父fiber
 * @param {Array} newChildren
 */
function reconcileChildren(returnFiber, newChildren) {
  let previousNewFiber = null
  let oldFiber = returnFiber.base && returnFiber.base.child
  let lastPlaceIndex = 0
  let newIdx = 0
  let nextOldFiber = null
  // 判断初次渲染还是更新
  let shouldTrackSideEffects = true
  let newChildrenLen = newChildren.length

  if (!oldFiber) {
    shouldTrackSideEffects = false
  }

  // 更新
  for (; oldFiber && newIdx < newChildrenLen; newIdx++) {
    const newChild = newChildren[newIdx]

    if (oldFiber.index > newIdx) {
      nextOldFiber = oldFiber
      oldFiber = null
    } else {
      nextOldFiber = oldFiber.sibling
    }

    // 判断是否可以复用
    // TODO: 当 oldFiber = null 时 下面 判断 有问题，源码是通过 newFiber 来判断的
    if (!(newChild.type === oldFiber.type && newChild.key === oldFiber.key)) {
      if (!oldFiber) {
        oldFiber = nextOldFiber
      }

      break
    }

    // TODO: 研究源码 生成 newFiber =》 updateSlot
    const newFiber = {
      key: newChild.key,
      type: newChild.type,
      props: newChild.props,
      node: oldFiber ? oldFiber.node : null,
      base: oldFiber,
      sibling: null,
      return: returnFiber,
      effectTag: UPDATE
    }

    if (shouldTrackSideEffects) {
      // TODO: 研究源码，这里永远都不会执行，因为 newFiber.base => oldFiber
      if (oldFiber && !newFiber.base) {
        // 删除
        deletions.push({
          ...oldFiber,
          effectTag: DELETION
        })
      }
    }

    lastPlaceIndex = placeChild(newFiber, lastPlaceIndex, newIdx, shouldTrackSideEffects)

    if (previousNewFiber === null) {
      returnFiber.child = newFiber
    } else {
      previousNewFiber.sibling = newFiber
    }

    previousNewFiber = newFiber
    oldFiber = nextOldFiber
  }

  // newChildren 对应的 fiber 已经更新完毕，删除 oldFiber 上的节点
  if (newIdx === newChildrenLen) {
    while (oldFiber) {
      deletions.push({
        ...oldFiber,
        effectTag: DELETION
      })

      oldFiber = oldFiber.sibling
    }

    return
  }

  // 初次渲染及后续更新
  if (!oldFiber) {
    for (; newIdx < newChildrenLen; newIdx++) {
      const newChild = newChildren[newIdx]
      const newFiber = {
        key: newChild.key,
        type: newChild.type,
        props: newChild.props,
        node: null,
        base: null,
        sibling: null,
        return: returnFiber,
        effectTag: PLACEMENT
      }

      lastPlaceIndex = placeChild(newFiber, lastPlaceIndex, newIdx, shouldTrackSideEffects)

      if (previousNewFiber === null) {
        returnFiber.child = newFiber
      } else {
        previousNewFiber.sibling = newFiber
      }

      previousNewFiber = newFiber
    }

    return
  }

  const existingChildren = mapRemainingChildren(returnFiber, oldFiber)

  for (; newIdx < newChildrenLen; newIdx++) {
    const newChild = newChildren[newIdx]
    const newFiber = {
      key: newChild.key,
      type: newChild.type,
      props: newChild.props,
      return: returnFiber
    }

    const matchedFiber = existingChildren.get(newChild.key || newIdx)

    // 复用 fiber
    if (matchedFiber) {
      newFiber.node = matchedFiber.node
      newFiber.base = matchedFiber
      newFiber.effectTag = UPDATE

      // 更新情况下删除已匹配的 fiber，避免 key 或 index 重复 情况下 匹配到的是上一个 fiber
      shouldTrackSideEffects && existingChildren.delete(newChild.key || newIdx)
    } else {
      newFiber.node = null
      newFiber.base = null
      newFiber.effectTag = PLACEMENT
    }

    lastPlaceIndex = placeChild(newFiber, lastPlaceIndex, newIdx)

    if (previousNewFiber === null) {
      returnFiber.child = newFiber
    } else {
      previousNewFiber.sibling = newFiber
    }

    previousNewFiber = newFiber
  }

  if (shouldTrackSideEffects) {
    // 删除老元素
    existingChildren.forEach(child => deletions.push({ ...child, effectTag: DELETION }))
  }
}

// 给当前 fiber 记录位置
function placeChild(newFiber, lastPlaceIndex, newIdx, shouldTrackSideEffects) {
  // 初次渲染
  newFiber.index = newIdx
  if (!shouldTrackSideEffects) {
    return lastPlaceIndex
  }

  const base = newFiber.base

  if (!base) {
    return lastPlaceIndex
  }

  const oldIndex = base.index

  if (oldIndex < lastPlaceIndex) {
    return lastPlaceIndex
  }

  return oldIndex
}

function mapRemainingChildren(returnFiber, currentFirstChild) {
  // Add the remaining children to a temporary map so that we can find them by
  // keys quickly. Implicit (null) keys get added to this set with their index
  // instead.
  const existingChildren = new Map()

  let existingChild = currentFirstChild

  while (existingChild) {
    existingChildren.set(existingChild.key || existingChild.index, existingChild)
    existingChild = existingChild.sibling
  }

  return existingChildren
}

function updateNode(node, prevProps, nextProps) {
  if (!nextProps) {
    return
  }

  const excludes = ['children']

  // 如果上一次属性和事件监听不在下一次属性中，则删除
  Object.keys(prevProps)
    .filter(key => !excludes.includes(key))
    .forEach(key => {
      if (!nextProps.hasOwnProperty(key)) {
        // 处理事件
        if (key.slice(0, 2) === 'on') {
          const eventName = key.slice(2).toLowerCase()
          node.removeEventListener(eventName, prevProps[key])

          return
        } else {
          node[key] = ''
        }
      }
    })

  Object.keys(nextProps)
    .filter(key => !excludes.includes(key))
    .forEach(key => {
      // 处理事件
      if (key.slice(0, 2) === 'on') {
        const eventName = key.slice(2).toLowerCase()
        node.addEventListener(eventName, nextProps[key])

        return
      }

      node[key] = nextProps[key]
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
    console.log('fiber', fiber)
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
  deletions.forEach(commitWorker)

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
    console.log('fiber0----', parentNode, fiber)
    insertOrAppend(fiber, parentNode)
  } else if (fiber.effectTag === UPDATE && fiber.node !== null) {
    updateNode(fiber.node, fiber.base.props, fiber.props)
  } else if (fiber.effectTag === DELETION && fiber.node !== null) {
    commitDeletions(fiber, parentNode)
  }

  // TODO: 删除、更新
  commitWorker(fiber.child)
  commitWorker(fiber.sibling)
}

function insertOrAppend(fiber, parentNode) {
  const before = getHostSibling(fiber)
  const node = fiber.node

  if (before) {
    parentNode.insertBefore(node, before)
  } else {
    parentNode.appendChild(node)
  }
}

function getHostSibling(fiber) {
  let sibling = fiber.return.child

  while (sibling) {
    if (fiber.index + 1 === sibling.index && sibling.effectTag === UPDATE) {
      return sibling.node
    }

    sibling = sibling.sibling
  }

  return null
}

function commitDeletions(fiber, parentNode) {
  if (fiber.node) {
    parentNode.removeChild(fiber.node)
  } else {
    commitDeletions(fiber.child, parentNode)
  }
}

window.requestIdleCallback(workLoop)

export const useState = init => {
  const lastHook = wipFiber.base && wipFiber.base.hooks[wipFiberHookIndex]

  const hook = {
    state: lastHook ? lastHook.state : init,
    queue: []
  }

  // 模拟批量执行
  const actions = lastHook ? lastHook.queue : []
  actions.forEach(action => {
    hook.state = action
  })

  const setState = action => {
    hook.queue.push(action)

    wipRoot = {
      node: currentRoot.node,
      props: currentRoot.props,
      base: currentRoot
    }

    nextUnitOfWork = wipRoot

    deletions = []
  }

  wipFiber.hooks.push(hook)
  wipFiberHookIndex++

  return [hook.state, setState]
}

export default {
  render
}
