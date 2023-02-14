const inspect = require('util').inspect

async function sleep (seconds) {
  return await new Promise((resolve, reject) => {
    setTimeout(resolve, seconds * 1000)
  })
}

function debug (obj) {
  if (process.env.NODE_ENV !== 'development') {
    return
  }
  console.debug(inspect(obj, false, 5, true))
}

module.exports = { sleep, debug }
