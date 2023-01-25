import { inspect } from 'node:util'
export async function sleep (seconds) {
  return await new Promise((resolve, reject) => {
    setTimeout(resolve, seconds * 1000)
  })
}

export function debug (obj) {
  if (process.env.NODE_ENV !== 'development') {
    return
  }
  console.debug(inspect(obj, false, 5, true))
}
