// import React from 'react'
// import ReactDOM from 'react-dom'
import React from './react'
import ReactDOM from './react/react-dom'
import Component from './react/Component'
import './index.css'

/**
 * 1. webpack+babel编译时，替换JSX为React.createElement(type,props,...children)
 * 2. 所有React.createElement()执行结束后得到一个JS对象即vdom，它能够完整描述dom结构
 * 3. ReactDOM.render(vdom, container)可以将vdom转换为dom并追加到container中
 * 4. 实际上，转换过程需要经过一个diff过程。
 */

function FunctionComponent({ name }) {
  return (
    <div className="border">
      {name}
      <button onClick={() => console.log('omg')}>click</button>
    </div>
  )
}

class ClassComponent extends Component {
  static defaultProps = {
    test: 'defaultProps'
  }

  render() {
    return (
      <div className="border">
        <h1>{this.props.name}</h1>
        <h2 className="border">{this.props.test}</h2>
      </div>
    )
  }
}

const jsx = (
  <div className="border">
    <h1>react source achieve</h1>
    <FunctionComponent name="FunctionComponent" />
    <ClassComponent name="ClassComponent" color="red" />
    <>
      <h1>aa</h1>
      <h1>bb</h1>
    </>
    {/* {[1, 2, 3].map(item => {
      return <div key={item}>{item}</div>
    })} */}
    {[1, 2, 3].map(item => {
      return (
        <React.Fragment key={item}>
          <h1>文本{item}</h1>
          <h2>文本{item}</h2>
        </React.Fragment>
      )
    })}
  </div>
)

ReactDOM.render(jsx, document.getElementById('root'))
