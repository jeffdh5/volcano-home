import {
  primaryServiceUuidVolcano1,
  primaryServiceUuidVolcano2,
  primaryServiceUuidVolcano3,
  primaryServiceUuidVolcano4,
  primaryServiceUuidVolcano5,
} from './uuids.js'
import { buildCacheFromBleDevice, clearCache } from './cache.js'

const VOLCANO_SERVICES = [
  primaryServiceUuidVolcano1,
  primaryServiceUuidVolcano2,
  primaryServiceUuidVolcano3,
  primaryServiceUuidVolcano4,
  primaryServiceUuidVolcano5,
]

let activeDevice = null
let disconnectHandler = null

export function getActiveDevice() {
  return activeDevice
}

export function onDisconnect(callback) {
  disconnectHandler = callback
}

function handleDisconnect() {
  activeDevice = null
  clearCache()
  disconnectHandler?.()
}

function isVolcanoDevice(device) {
  const name = device.name?.toUpperCase() ?? ''
  return name.includes('VOLCANO') || name.includes('S&B')
}

function formatBleError(error) {
  const parts = [error?.message || String(error)]
  if (error?.name) {
    parts.unshift(error.name)
  }
  return parts.filter(Boolean).join(': ')
}

export async function connectToVolcano() {
  const isIOS =
    window.navigator.userAgent.includes('iPhone') ||
    window.navigator.userAgent.includes('WebBLE') ||
    window.navigator.userAgent.includes('iPad')

  if (!window.isSecureContext) {
    throw new Error(
      'Bluetooth requires a secure connection. Open https:// on this device, or use localhost on your computer.',
    )
  }

  if (!navigator.bluetooth) {
    throw new Error(
      isIOS
        ? 'Web Bluetooth is not available here. Open this app in WebBLE or Bluefy.'
        : 'Web Bluetooth is not available in this browser. Use Chrome or Edge.',
    )
  }

  const filters = [{ namePrefix: 'S&B' }]

  if (!isIOS) {
    filters.push({ services: VOLCANO_SERVICES })
  }

  let device

  try {
    device = await navigator.bluetooth.requestDevice({
      filters,
      optionalServices: VOLCANO_SERVICES,
      acceptAllDevices: false,
    })
  } catch (error) {
    const message = formatBleError(error)
    if (message.includes('User cancelled') || message.includes('user gesture')) {
      throw new Error('Pairing cancelled.')
    }
    throw new Error(message)
  }

  if (device.name && !isVolcanoDevice(device)) {
    throw new Error(`Unexpected device selected: ${device.name}`)
  }

  device.addEventListener('gattserverdisconnected', handleDisconnect)

  try {
    await buildCacheFromBleDevice(device)
  } catch (error) {
    device.removeEventListener('gattserverdisconnected', handleDisconnect)
    if (activeDevice === device) {
      activeDevice = null
    }
    clearCache()
    throw new Error(`Could not connect to the Volcano: ${formatBleError(error)}`)
  }

  activeDevice = device
  return device
}

export async function disconnectVolcano() {
  if (activeDevice?.gatt?.connected) {
    await activeDevice.gatt.disconnect()
  }
  handleDisconnect()
}
