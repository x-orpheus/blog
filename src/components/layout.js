import React from "react"
import { Link } from "gatsby"

import { rhythm, scale } from "../utils/typography"

class Layout extends React.Component {
  render() {
    const { title, children } = this.props

    const header = (
      <h1
        style={{
          ...scale(1.2),
          marginTop: 0,
        }}
      >
        <Link
          style={{
            boxShadow: `none`,
            textDecoration: `none`,
            color: `#DD001B`,
          }}
          to={`/`}
        >
          {title}
        </Link>
      </h1>
    )
    return (
      <div
        style={{
          marginLeft: `auto`,
          marginRight: `auto`,
          maxWidth: rhythm(24),
          padding: `${rhythm(1.5)} ${rhythm(3 / 4)}`,
          fontFamily: `"Source Code Pro", "Noto Sans CJK SC"`
        }}
      >
        <header>{header}</header>
        <main>{children}</main>
        <div id="gitalk-container"></div>
      </div>
    )
  }
}

export default Layout
