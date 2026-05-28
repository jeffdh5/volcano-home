import * as uuids from './uuids.js'

let cache = {}

export function clearCache() {
  cache = {}
}

export function getCharacteristic(characteristicId) {
  const characteristic = cache[characteristicId]
  if (!characteristic) {
    throw new Error('Characteristic not found in cache')
  }
  return characteristic
}

export function isConnected() {
  return Boolean(cache[uuids.heatOnUuid])
}

function writeCharacteristicToCache(characteristic, characteristicId) {
  cache[characteristicId] = characteristic
}

export async function buildCacheFromBleDevice(bleDevice, gattRetryCount = 0) {
  try {
    clearCache()
    writeCharacteristicToCache(bleDevice, uuids.bleDeviceUuid)

    const bleServer = await bleDevice.gatt.connect()

    await bleServer.getPrimaryService(uuids.primaryServiceUuidVolcano1)
    await bleServer.getPrimaryService(uuids.primaryServiceUuidVolcano2)

    const primaryServiceUuidVolcano3 = await bleServer.getPrimaryService(
      uuids.primaryServiceUuidVolcano3,
    )
    const primaryServiceUuidVolcano4 = await bleServer.getPrimaryService(
      uuids.primaryServiceUuidVolcano4,
    )

    writeCharacteristicToCache(
      await primaryServiceUuidVolcano4.getCharacteristic(uuids.heatOffUuid),
      uuids.heatOffUuid,
    )
    writeCharacteristicToCache(
      await primaryServiceUuidVolcano4.getCharacteristic(uuids.heatOnUuid),
      uuids.heatOnUuid,
    )
    writeCharacteristicToCache(
      await primaryServiceUuidVolcano4.getCharacteristic(uuids.fanOffUuid),
      uuids.fanOffUuid,
    )
    writeCharacteristicToCache(
      await primaryServiceUuidVolcano4.getCharacteristic(uuids.fanOnUuid),
      uuids.fanOnUuid,
    )
    writeCharacteristicToCache(
      await primaryServiceUuidVolcano4.getCharacteristic(uuids.currentTemperatureUuid),
      uuids.currentTemperatureUuid,
    )
    writeCharacteristicToCache(
      await primaryServiceUuidVolcano4.getCharacteristic(uuids.writeTemperatureUuid),
      uuids.writeTemperatureUuid,
    )
    writeCharacteristicToCache(
      await primaryServiceUuidVolcano4.getCharacteristic(uuids.LEDbrightnessUuid),
      uuids.LEDbrightnessUuid,
    )

    await bleServer.getPrimaryService(uuids.primaryServiceUuidVolcano5)
    await primaryServiceUuidVolcano3.getCharacteristic('1010000c-5354-4f52-5a26-4249434b454c')

    return bleDevice
  } catch (error) {
    if (gattRetryCount < 3) {
      try {
        if (bleDevice.gatt.connected) {
          await bleDevice.gatt.disconnect()
        }
      } catch {
        // ignore disconnect errors between retries
      }
      await new Promise((resolve) => setTimeout(resolve, 400))
      return buildCacheFromBleDevice(bleDevice, gattRetryCount + 1)
    }

    throw error
  }
}
