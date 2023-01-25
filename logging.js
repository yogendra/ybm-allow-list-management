import { inspect } from 'node:util'

export function debug (obj) {
  if (process.env.NODE_ENV !== 'development') {
    return
  }
  console.debug(inspect(obj, false, 3, true))
}

export function trace (obj) {
  if (process.env.NODE_ENV !== 'development') {
    return
  }
  console.debug(inspect(obj, false, 10, true))
}
