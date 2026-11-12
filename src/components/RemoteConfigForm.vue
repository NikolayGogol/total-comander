<template>
  <div class="remote-config-container">
    <div class="config-section">
      <div class="form-row">
        <div class="form-col col-8">
          <label class="form-label">Назва профілю</label>
          <input
            v-model="form.name"
            type="text"
            class="form-input"
            placeholder="Наприклад: Продакшн сервер"
            @input="syncToParent"
          />
        </div>
        <div class="form-col col-4">
          <label class="form-label">Протокол</label>
          <div class="protocol-selector">
            <button
              type="button"
              class="protocol-btn"
              :class="{ 'is-active': form.protocol === 'sftp' }"
              @click="onSelectProtocol('sftp')"
            >
              SFTP
            </button>
            <button
              type="button"
              class="protocol-btn"
              :class="{ 'is-active': form.protocol === 'ssh' }"
              @click="onSelectProtocol('ssh')"
            >
              SSH
            </button>
            <button
              type="button"
              class="protocol-btn"
              :class="{ 'is-active': form.protocol === 'ftp' }"
              @click="onSelectProtocol('ftp')"
            >
              FTP
            </button>
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-col col-8">
          <label class="form-label">Сервер (Host / IP)</label>
          <input
            v-model="form.host"
            type="text"
            class="form-input"
            placeholder="192.168.1.1 або domain.com"
            @input="syncToParent"
          />
        </div>
        <div class="form-col col-4">
          <label class="form-label">Порт</label>
          <input v-model.number="form.port" type="number" class="form-input" placeholder="22" @input="syncToParent" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-col col-6">
          <label class="form-label">Ім'я користувача (Username)</label>
          <input
            v-model="form.username"
            type="text"
            class="form-input"
            placeholder="root або ubuntu"
            @input="syncToParent"
          />
        </div>
        <div class="form-col col-6">
          <label class="form-label">Автентифікація</label>
          <div class="auth-type-pills">
            <button
              type="button"
              class="auth-pill"
              :class="{ 'is-active': form.authType === 'password' }"
              @click="setAuthType('password')"
            >
              Пароль
            </button>
            <button
              type="button"
              class="auth-pill"
              :class="{ 'is-active': form.authType === 'key' }"
              :disabled="form.protocol === 'ftp' || form.protocol === 'ftps'"
              @click="setAuthType('key')"
            >
              SSH Ключ
            </button>
          </div>
        </div>
      </div>

      <!-- Password Input -->
      <div v-if="form.authType === 'password'" class="form-row">
        <div class="form-col col-12">
          <label class="form-label">Пароль</label>
          <div class="input-with-action">
            <input
              v-model="form.password"
              :type="passwordVisible ? 'text' : 'password'"
              class="form-input"
              placeholder="Введіть пароль облікового запису..."
              @input="syncToParent"
              @keydown.enter="$emit('connect')"
            />
            <button
              type="button"
              class="input-action-btn"
              title="Показати/приховати пароль"
              @click="passwordVisible = !passwordVisible"
            >
              <EyeOff v-if="passwordVisible" :size="14" />
              <Eye v-else :size="14" />
            </button>
          </div>
        </div>
      </div>

      <!-- Key File Input -->
      <div v-else class="form-row">
        <div class="form-col col-8">
          <label class="form-label">Шлях до приватного SSH ключа</label>
          <div class="input-with-action">
            <input
              v-model="form.privateKeyPath"
              type="text"
              class="form-input"
              placeholder="~/.ssh/id_rsa або id_ed25519"
              @input="syncToParent"
            />
            <button
              type="button"
              class="input-action-btn"
              title="Вибрати файл ключа на диску"
              @click="$emit('pick-key')"
            >
              Огляд...
            </button>
          </div>
        </div>
        <div class="form-col col-4">
          <label class="form-label">Passphrase ключа</label>
          <input
            v-model="form.passphrase"
            type="password"
            class="form-input"
            placeholder="Якщо зашифровано"
            @input="syncToParent"
          />
        </div>
      </div>

      <div class="form-row">
        <div class="form-col col-12">
          <label class="form-label">Початкова віддалена папка</label>
          <input
            v-model="form.remotePath"
            type="text"
            class="form-input"
            placeholder="/var/www або /home/user"
            @input="syncToParent"
          />
        </div>
      </div>
    </div>

    <!-- Footer Action Buttons for Config View -->
    <div class="config-footer-actions">
      <div class="left-actions">
        <button type="button" class="btn-secondary" title="Зберегти профіль у список" @click="$emit('save')">
          <Save :size="13" />
          <span>Зберегти</span>
        </button>
        <button
          type="button"
          class="btn-secondary"
          :disabled="isTesting"
          title="Перевірити доступність сервера"
          @click="$emit('test')"
        >
          <CheckCircle2 :size="13" />
          <span>{{ isTesting ? 'Перевірка...' : "Тест зв'язку" }}</span>
        </button>
        <button
          v-if="form.protocol === 'ssh' || form.protocol === 'sftp'"
          type="button"
          class="btn-secondary"
          title="Відкрити інтерактивну SSH сесію в нативному macOS Terminal"
          @click="$emit('terminal')"
        >
          <Terminal :size="13" />
          <span>Термінал</span>
        </button>
      </div>

      <button type="button" class="btn-primary btn-connect" :disabled="isLoading" @click="$emit('connect')">
        <ArrowRight :size="14" />
        <span>{{ isLoading ? 'Підключення...' : 'Підключитися' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, ref } from 'vue'
import { Save, CheckCircle2, Terminal, ArrowRight, Eye, EyeOff } from 'lucide-vue-next'
import type { RemoteConfig, RemoteAuthType } from '@/types'

const props = defineProps<{
  config: RemoteConfig
  isLoading: boolean
  isTesting: boolean
}>()

const emit = defineEmits<{
  (e: 'update:config', val: RemoteConfig): void
  (e: 'connect'): void
  (e: 'save'): void
  (e: 'test'): void
  (e: 'terminal'): void
  (e: 'pick-key'): void
}>()

const passwordVisible = ref(false)
const form = reactive({ ...props.config })

watch(
  () => props.config,
  (newVal) => {
    Object.assign(form, newVal)
  },
  { deep: true }
)

function syncToParent() {
  emit('update:config', { ...form })
}

function setAuthType(type: RemoteAuthType) {
  form.authType = type
  syncToParent()
}

function onSelectProtocol(protocol: 'sftp' | 'ssh' | 'ftp') {
  const oldProto = form.protocol
  form.protocol = protocol
  if (protocol === 'ftp') {
    form.port = 21
    form.authType = 'password'
  } else {
    form.port = 22
  }
  const defaultNames = ['SFTP Сервер', 'SSH Сервер', 'SSH Термінал', 'FTP Сервер', 'Нове підключення', '']
  if (defaultNames.includes(form.name) || form.name === `${oldProto.toUpperCase()} Сервер`) {
    form.name = protocol === 'ftp' ? 'FTP Сервер' : protocol === 'ssh' ? 'SSH Сервер' : 'SFTP Сервер'
  }
  syncToParent()
}
</script>
