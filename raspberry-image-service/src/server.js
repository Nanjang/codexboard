import { createImageServer } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const server = await createImageServer(config)

server.listen(config.port, config.host, () => {
  console.log(`Image service listening on http://${config.host}:${config.port}`)
})

function shutdown(signal) {
  console.log(`Received ${signal}; shutting down.`)
  server.close((error) => {
    if (error) {
      console.error('Graceful shutdown failed', error)
      process.exitCode = 1
    }
  })
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
