import { ref, reactive, computed, watch } from 'vue'
import type { RemoteProfile, RemoteConnectionConfig, RemoteFileEntry } from '@/types'

const PROFILES_STORAGE_KEY = 'tc-remote-connections-profiles'

export function useRemoteConnections() {
  const profiles = ref<RemoteProfile[]>([])
  const selectedProfileId = ref<string>('')

  const currentConfig = reactive<RemoteConnectionConfig>({
    protocol: 'sftp',
    host: '127.0.0.1',
    port: 22,
    username: 'root',
    authType: 'password',
    password: '',
    privateKeyPath: '',
    passphrase: '',
    remotePath: '/',
    name: 'Нове підключення',
  })

  const isConnected = ref(false)
  const isLoading = ref(false)
  const isTesting = ref(false)
  const isTransferring = ref(false)
  const passwordVisible = ref(false)

  const currentRemotePath = ref('/')
  const remoteEntries = ref<RemoteFileEntry[]>([])
  const selectedItem = ref<RemoteFileEntry | null>(null)
  const filterQuery = ref('')

  const statusMessage = ref<{
    type: 'success' | 'error' | 'info'
    text: string
  } | null>(null)

  function setStatus(type: 'success' | 'error' | 'info', text: string, timeout = 5000) {
    statusMessage.value = { type, text }
    if (timeout > 0) {
      setTimeout(() => {
        if (statusMessage.value?.text === text) {
          statusMessage.value = null
        }
      }, timeout)
    }
  }

  function loadProfiles() {
    try {
      const raw = localStorage.getItem(PROFILES_STORAGE_KEY)
      if (raw) {
        profiles.value = JSON.parse(raw)
      } else {
        const defaultProfile: RemoteProfile = {
          id: 'default-local-sftp',
          name: 'Локальний SFTP / SSH',
          protocol: 'sftp',
          host: '127.0.0.1',
          port: 22,
          username: 'root',
          authType: 'password',
          password: '',
          remotePath: '/',
          createdAt: Date.now(),
        }
        profiles.value = [defaultProfile]
        saveProfilesToStorage()
      }

      if (profiles.value.length > 0) {
        selectProfile(profiles.value[0])
      }
    } catch (err) {
      console.warn('Failed to load remote profiles:', err)
    }
  }

  function saveProfilesToStorage() {
    try {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles.value))
    } catch (err) {
      console.error('Failed to persist remote profiles:', err)
    }
  }

  function selectProfile(profile: RemoteProfile) {
    selectedProfileId.value = profile.id
    currentConfig.id = profile.id
    currentConfig.name = profile.name
    currentConfig.protocol = profile.protocol
    currentConfig.host = profile.host
    currentConfig.port = profile.port || (profile.protocol === 'ftp' || profile.protocol === 'ftps' ? 21 : 22)
    currentConfig.username = profile.username
    currentConfig.authType = profile.authType || 'password'
    currentConfig.password = profile.password || ''
    currentConfig.privateKeyPath = profile.privateKeyPath || ''
    currentConfig.passphrase = profile.passphrase || ''
    currentConfig.remotePath = profile.remotePath || '/'
    statusMessage.value = null
  }

  function createNewProfile(protocol: 'sftp' | 'ssh' | 'ftp' = 'sftp') {
    const newId = 'profile-' + Date.now()
    const newProfile: RemoteProfile = {
      id: newId,
      name: protocol === 'ftp' ? 'FTP Сервер' : protocol === 'ssh' ? 'SSH Сервер' : 'SFTP Сервер',
      protocol,
      host: 'example.com',
      port: protocol === 'ftp' ? 21 : 22,
      username: 'user',
      authType: 'password',
      password: '',
      remotePath: '/',
      createdAt: Date.now(),
    }
    profiles.value.unshift(newProfile)
    selectProfile(newProfile)
    saveProfilesToStorage()
    setStatus('info', 'Створено новий профіль. Заповніть реквізити та збережіть.')
  }

  function updateActiveProfileFromConfig() {
    if (!selectedProfileId.value) return
    const index = profiles.value.findIndex((p) => p.id === selectedProfileId.value)
    if (index >= 0) {
      profiles.value[index] = {
        ...profiles.value[index],
        name: currentConfig.name || `${currentConfig.protocol.toUpperCase()} Сервер`,
        protocol: currentConfig.protocol,
        host: currentConfig.host,
        port: Number(currentConfig.port) || (currentConfig.protocol === 'ftp' ? 21 : 22),
        username: currentConfig.username,
        authType: currentConfig.authType,
        password: currentConfig.password,
        privateKeyPath: currentConfig.privateKeyPath,
        passphrase: currentConfig.passphrase,
        remotePath: currentConfig.remotePath || '/',
      }
      saveProfilesToStorage()
    }
  }

  watch(
    [
      () => currentConfig.name,
      () => currentConfig.protocol,
      () => currentConfig.host,
      () => currentConfig.port,
      () => currentConfig.username,
      () => currentConfig.authType,
      () => currentConfig.password,
      () => currentConfig.privateKeyPath,
      () => currentConfig.passphrase,
      () => currentConfig.remotePath,
    ],
    () => {
      updateActiveProfileFromConfig()
    }
  )

  function saveCurrentProfile() {
    updateActiveProfileFromConfig()
    setStatus('success', 'Профіль успішно збережено')
  }

  function deleteProfile(id: string) {
    profiles.value = profiles.value.filter((p) => p.id !== id)
    saveProfilesToStorage()
    if (selectedProfileId.value === id) {
      if (profiles.value.length > 0) {
        selectProfile(profiles.value[0])
      } else {
        createNewProfile()
      }
    }
    setStatus('info', 'Профіль видалено')
  }

  async function testConnection(): Promise<boolean> {
    if (!window.electronAPI?.remoteTestConnection) return false
    isTesting.value = true
    statusMessage.value = null

    try {
      const res = await window.electronAPI.remoteTestConnection({
        ...currentConfig,
        port: Number(currentConfig.port),
      })

      if (res.success) {
        setStatus('success', res.message || "З'єднання успішне!")
        return true
      } else {
        setStatus('error', res.error || "Помилка зв'язку з сервером")
        return false
      }
    } catch (err: any) {
      setStatus('error', err.message || 'Помилка тесту підключення')
      return false
    } finally {
      isTesting.value = false
    }
  }

  async function openSshTerminal(): Promise<void> {
    if (!window.electronAPI?.remoteOpenSshTerminal) return
    try {
      const res = await window.electronAPI.remoteOpenSshTerminal({
        ...currentConfig,
        port: Number(currentConfig.port),
      })
      if (res.success) {
        setStatus('success', 'Відкрито SSH сесію в нативному macOS Terminal')
      } else {
        setStatus('error', res.error || 'Не вдалося відкрити термінал')
      }
    } catch (err: any) {
      setStatus('error', err.message || 'Помилка запуску SSH терміналу')
    }
  }

  async function pickPrivateKey(): Promise<void> {
    if (!window.electronAPI?.remoteSelectPrivateKeyDialog) return
    try {
      const res = await window.electronAPI.remoteSelectPrivateKeyDialog()
      if (!res.canceled && res.filePath) {
        currentConfig.privateKeyPath = res.filePath
        currentConfig.authType = 'key'
      }
    } catch (err: any) {
      console.warn('Error selecting private key:', err)
    }
  }

  async function connect(): Promise<boolean> {
    if (!window.electronAPI?.remoteListDir) return false

    isLoading.value = true
    statusMessage.value = null

    try {
      const startPath = currentConfig.remotePath?.trim() || '/'
      const res = await window.electronAPI.remoteListDir(
        {
          ...currentConfig,
          port: Number(currentConfig.port),
        },
        startPath
      )

      if (res.success && res.entries) {
        isConnected.value = true
        currentRemotePath.value = res.currentPath
        remoteEntries.value = res.entries
        selectedItem.value = null

        const p = profiles.value.find((x) => x.id === selectedProfileId.value)
        if (p) {
          p.lastConnected = Date.now()
          saveProfilesToStorage()
        }

        setStatus('success', `Підключено: ${res.currentPath} (${res.entries.length} об'єктів)`)
        return true
      } else {
        setStatus('error', res.error || 'Не вдалося отримати вміст папки')
        return false
      }
    } catch (err: any) {
      setStatus('error', err.message || 'Помилка підключення')
      return false
    } finally {
      isLoading.value = false
    }
  }

  function disconnect() {
    isConnected.value = false
    remoteEntries.value = []
    selectedItem.value = null
    filterQuery.value = ''
    setStatus('info', 'Відключено від сервера')
  }

  async function navigateTo(targetPath: string) {
    if (!window.electronAPI?.remoteListDir || !isConnected.value) return
    isLoading.value = true
    try {
      const res = await window.electronAPI.remoteListDir(
        {
          ...currentConfig,
          port: Number(currentConfig.port),
        },
        targetPath
      )

      if (res.success && res.entries) {
        currentRemotePath.value = res.currentPath
        remoteEntries.value = res.entries
        selectedItem.value = null
        filterQuery.value = ''
      } else {
        setStatus('error', res.error || 'Не вдалося відкрити папку')
      }
    } catch (err: any) {
      setStatus('error', err.message || 'Помилка переходу по папці')
    } finally {
      isLoading.value = false
    }
  }

  async function navigateUp() {
    if (currentRemotePath.value === '/' || !currentRemotePath.value) return
    const parts = currentRemotePath.value.replace(/\/+$/, '').split('/')
    parts.pop()
    const parentPath = parts.join('/') || '/'
    await navigateTo(parentPath)
  }

  async function refreshRemoteDir() {
    await navigateTo(currentRemotePath.value)
  }

  async function downloadItem(item: RemoteFileEntry, localDestDir: string): Promise<boolean> {
    if (!window.electronAPI?.remoteDownload) return false
    isTransferring.value = true
    setStatus('info', `Завантаження "${item.name}"...`, 0)

    try {
      const res = await window.electronAPI.remoteDownload(
        {
          ...currentConfig,
          port: Number(currentConfig.port),
        },
        item.path,
        localDestDir
      )

      if (res.success) {
        setStatus('success', `Завантажено: ${item.name} у ${localDestDir}`)
        return true
      } else {
        setStatus('error', res.error || 'Помилка завантаження')
        return false
      }
    } catch (err: any) {
      setStatus('error', err.message || 'Помилка завантаження файлу')
      return false
    } finally {
      isTransferring.value = false
    }
  }

  async function uploadFile(localFilePath: string): Promise<boolean> {
    if (!window.electronAPI?.remoteUpload) return false
    isTransferring.value = true
    setStatus('info', `Надсилання файлу на сервер...`, 0)

    try {
      const res = await window.electronAPI.remoteUpload(
        {
          ...currentConfig,
          port: Number(currentConfig.port),
        },
        localFilePath,
        currentRemotePath.value
      )

      if (res.success) {
        setStatus('success', 'Файл успішно завантажено на сервер')
        await refreshRemoteDir()
        return true
      } else {
        setStatus('error', res.error || 'Помилка відправки')
        return false
      }
    } catch (err: any) {
      setStatus('error', err.message || 'Помилка передачі файлу')
      return false
    } finally {
      isTransferring.value = false
    }
  }

  async function createRemoteFolder(folderName: string): Promise<boolean> {
    if (!window.electronAPI?.remoteMkdir || !folderName.trim()) return false
    const target =
      currentRemotePath.value === '/' ? '/' + folderName.trim() : currentRemotePath.value + '/' + folderName.trim()

    try {
      const res = await window.electronAPI.remoteMkdir(
        {
          ...currentConfig,
          port: Number(currentConfig.port),
        },
        target
      )

      if (res.success) {
        setStatus('success', `Папку "${folderName}" створено`)
        await refreshRemoteDir()
        return true
      } else {
        setStatus('error', res.error || 'Не вдалося створити папку')
        return false
      }
    } catch (err: any) {
      setStatus('error', err.message || 'Помилка створення папки')
      return false
    }
  }

  async function deleteRemoteItem(item: RemoteFileEntry): Promise<boolean> {
    if (!window.electronAPI?.remoteDelete) return false

    try {
      const res = await window.electronAPI.remoteDelete(
        {
          ...currentConfig,
          port: Number(currentConfig.port),
        },
        item.path,
        item.isDirectory
      )

      if (res.success) {
        setStatus('success', `Видалено: ${item.name}`)
        await refreshRemoteDir()
        return true
      } else {
        setStatus('error', res.error || "Не вдалося видалити об'єкт")
        return false
      }
    } catch (err: any) {
      setStatus('error', err.message || 'Помилка видалення')
      return false
    }
  }

  async function createRemoteFile(fileName: string, content = ''): Promise<boolean> {
    if (!window.electronAPI?.remoteCreateFile || !fileName.trim()) return false
    const target =
      currentRemotePath.value === '/' ? '/' + fileName.trim() : currentRemotePath.value + '/' + fileName.trim()

    try {
      const res = await window.electronAPI.remoteCreateFile(
        {
          ...currentConfig,
          port: Number(currentConfig.port),
        },
        target,
        content
      )

      if (res.success) {
        setStatus('success', `Файл "${fileName}" створено`)
        await refreshRemoteDir()
        return true
      } else {
        setStatus('error', res.error || 'Не вдалося створити файл')
        return false
      }
    } catch (err: any) {
      setStatus('error', err.message || 'Помилка створення файлу')
      return false
    }
  }

  async function renameRemoteItem(item: RemoteFileEntry, newName: string): Promise<boolean> {
    if (!window.electronAPI?.remoteRename || !newName.trim() || newName.trim() === item.name) return false
    const parentDir = currentRemotePath.value
    const newPath = parentDir === '/' ? '/' + newName.trim() : parentDir + '/' + newName.trim()

    try {
      const res = await window.electronAPI.remoteRename(
        {
          ...currentConfig,
          port: Number(currentConfig.port),
        },
        item.path,
        newPath
      )

      if (res.success) {
        setStatus('success', `Перейменовано: ${item.name} -> ${newName.trim()}`)
        await refreshRemoteDir()
        return true
      } else {
        setStatus('error', res.error || 'Не вдалося перейменувати')
        return false
      }
    } catch (err: any) {
      setStatus('error', err.message || 'Помилка перейменування')
      return false
    }
  }

  async function readRemoteFileText(filePath: string): Promise<string | null> {
    if (!window.electronAPI?.remoteReadText) return null
    try {
      const res = await window.electronAPI.remoteReadText(
        {
          ...currentConfig,
          port: Number(currentConfig.port),
        },
        filePath
      )

      if (res.success && res.content !== undefined) {
        return res.content
      } else {
        setStatus('error', res.error || 'Не вдалося прочитати файл')
        return null
      }
    } catch (err: any) {
      setStatus('error', err.message || 'Помилка читання файлу')
      return null
    }
  }

  async function writeRemoteFileText(filePath: string, content: string): Promise<boolean> {
    if (!window.electronAPI?.remoteWriteText) return false
    try {
      const res = await window.electronAPI.remoteWriteText(
        {
          ...currentConfig,
          port: Number(currentConfig.port),
        },
        filePath,
        content
      )

      if (res.success) {
        setStatus('success', 'Зміни успішно збережено на сервері')
        await refreshRemoteDir()
        return true
      } else {
        setStatus('error', res.error || 'Не вдалося зберегти зміни')
        return false
      }
    } catch (err: any) {
      setStatus('error', err.message || 'Помилка збереження файлу')
      return false
    }
  }

  function duplicateProfile(id: string) {
    const orig = profiles.value.find((p) => p.id === id)
    if (!orig) return
    const copy: RemoteProfile = {
      ...orig,
      id: 'profile-' + Date.now(),
      name: `${orig.name} (Копія)`,
      createdAt: Date.now(),
    }
    profiles.value.push(copy)
    saveProfilesToStorage()
    selectProfile(copy)
    setStatus('success', 'Профіль продубльовано')
  }

  const filteredEntries = computed(() => {
    if (!filterQuery.value.trim()) return remoteEntries.value
    const q = filterQuery.value.toLowerCase().trim()
    return remoteEntries.value.filter((e) => e.name.toLowerCase().includes(q))
  })

  const breadcrumbs = computed(() => {
    const raw = currentRemotePath.value
    if (!raw || raw === '/') return [{ name: '/', path: '/' }]
    const parts = raw.split('/').filter(Boolean)
    const result = [{ name: '/', path: '/' }]
    let accum = ''
    for (const part of parts) {
      accum += '/' + part
      result.push({ name: part, path: accum })
    }
    return result
  })

  return {
    profiles,
    selectedProfileId,
    currentConfig,
    isConnected,
    isLoading,
    isTesting,
    isTransferring,
    passwordVisible,
    currentRemotePath,
    remoteEntries,
    selectedItem,
    filterQuery,
    filteredEntries,
    breadcrumbs,
    statusMessage,
    loadProfiles,
    selectProfile,
    createNewProfile,
    saveCurrentProfile,
    deleteProfile,
    testConnection,
    openSshTerminal,
    pickPrivateKey,
    connect,
    disconnect,
    navigateTo,
    navigateUp,
    refreshRemoteDir,
    downloadItem,
    uploadFile,
    createRemoteFolder,
    createRemoteFile,
    renameRemoteItem,
    readRemoteFileText,
    writeRemoteFileText,
    deleteRemoteItem,
    duplicateProfile,
  }
}
