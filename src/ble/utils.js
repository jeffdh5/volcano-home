const MIN_CELSIUS_TEMP = 40
const TEMPERATURE_OVERFLOW_THRESHOLD = 6536

export function convertToUInt16BLE(val) {
  const buffer = new ArrayBuffer(2)
  const dataView = new DataView(buffer)
  dataView.setUint8(0, val % 256)
  dataView.setUint8(1, Math.floor(val / 256))
  return buffer
}

export function convertToUInt8BLE(val) {
  const buffer = new ArrayBuffer(1)
  new DataView(buffer).setUint8(0, val % 256)
  return buffer
}

export function convertToUInt32BLE(val) {
  const buffer = new ArrayBuffer(4)
  const dataView = new DataView(buffer)
  dataView.setUint8(0, val & 255)
  let tempVal = val >> 8
  dataView.setUint8(1, tempVal & 255)
  tempVal = tempVal >> 8
  dataView.setUint8(2, tempVal & 255)
  tempVal = tempVal >> 8
  dataView.setUint8(3, tempVal & 255)
  return buffer
}

export function convertBLEtoUint16(bleBuf) {
  return bleBuf.getUint8(0) + bleBuf.getUint8(1) * 256
}

export function convertCurrentTemperatureCharacteristicToCelcius(value) {
  const result = Math.round(convertBLEtoUint16(value) / 10)
  return result < TEMPERATURE_OVERFLOW_THRESHOLD ? result : MIN_CELSIUS_TEMP
}

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
