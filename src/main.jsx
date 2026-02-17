import { render } from 'preact'
import './index.css'
import { App } from './app.jsx'

const getStartupDelay = () => {
  const params = new URLSearchParams(window.location.search)
  const value = Number.parseInt(params.get('splashDelay') ?? '0', 10)

  if (Number.isNaN(value) || value < 0) {
    return 0
  }

  return Math.min(value, 15000)
}

const bootstrap = async () => {
  const startupDelay = getStartupDelay()

  if (startupDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, startupDelay))
  }

  render(<App />, document.getElementById('app'))
}

bootstrap()
