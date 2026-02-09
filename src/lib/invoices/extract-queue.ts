import 'server-only'

const MAX_CONCURRENT_EXTRACTS = 5

let running = 0
const waitQueue: Array<() => void> = []

function release(): void {
  running -= 1
  if (waitQueue.length > 0 && running < MAX_CONCURRENT_EXTRACTS) {
    running += 1
    const next = waitQueue.shift()
    if (next) next()
  }
}

/**
 * Espera a tener un hueco en la cola (máx 5 extracts en paralelo) y ejecuta la función.
 * La cola es global por proceso; el backend limita la concurrencia.
 */
export async function withExtractSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running < MAX_CONCURRENT_EXTRACTS) {
    running += 1
  } else {
    await new Promise<void>((resolve) => {
      waitQueue.push(resolve)
    })
  }

  try {
    return await fn()
  } finally {
    release()
  }
}
