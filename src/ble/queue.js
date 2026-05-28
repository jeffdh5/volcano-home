const queue = []
let isProcessing = false

export async function enqueue(task) {
  return new Promise((resolve, reject) => {
    queue.push(async () => {
      try {
        resolve(await task())
      } catch (error) {
        reject(error)
      }
    })

    if (!isProcessing) {
      processQueue()
    }
  })
}

async function processQueue() {
  isProcessing = true

  while (queue.length > 0) {
    const task = queue.shift()
    await task()
  }

  isProcessing = false
}
