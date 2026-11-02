<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card unlocker-modal-card">
      <div class="modal-header">
        <div class="modal-title">
          <Unlock :size="16" class="modal-icon text-amber" />
          <span>Unlocker — Розблокування та операції</span>
        </div>
        <button class="modal-close-btn" title="Закрити (Esc)" @click="$emit('close')">
          <X :size="15" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Target Object Info -->
        <div class="unlocker-target-card">
          <div class="target-icon-wrap">
            <component
              :is="isDirectory ? Folder : FileText"
              :size="24"
              :class="isDirectory ? 'icon-folder' : 'icon-file'"
            />
          </div>
          <div class="target-details">
            <div class="target-name">{{ targetName }}</div>
            <div class="target-path" :title="targetPath">{{ targetPath }}</div>
          </div>
        </div>

        <!-- Scanning / Process List Box -->
        <div class="unlocker-section">
          <div class="section-title">
            <Activity :size="14" class="section-title-icon" />
            <span>Статус блокування</span>
          </div>

          <div v-if="loading" class="unlocker-status-box is-loading">
            <Loader2 :size="18" class="spin-icon" />
            <span>Сканування дескрипторів та пошук блокуючих процесів...</span>
          </div>

          <div v-else-if="processes.length > 0" class="unlocker-status-box is-warning">
            <div class="status-warning-header">
              <AlertTriangle :size="16" class="warning-icon" />
              <span
                >Виявлено <strong>{{ processes.length }}</strong> процес(ів), що блокують доступ:</span
              >
            </div>

            <div class="process-table-wrap">
              <table class="process-table">
                <thead>
                  <tr>
                    <th class="th-chk">
                      <input type="checkbox" :checked="isAllSelected" title="Виділити всі" @change="toggleSelectAll" />
                    </th>
                    <th class="th-pid">PID</th>
                    <th class="th-name">Назва процесу</th>
                    <th class="th-app">Додаток</th>
                    <th class="th-act">Дія</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="proc in processes" :key="proc.pid">
                    <td class="td-chk">
                      <input type="checkbox" :checked="selectedPids.has(proc.pid)" @change="togglePid(proc.pid)" />
                    </td>
                    <td class="td-pid">
                      <code>{{ proc.pid }}</code>
                    </td>
                    <td class="td-name">
                      <strong>{{ proc.name || 'process.exe' }}</strong>
                    </td>
                    <td class="td-app">{{ proc.appName || '--' }}</td>
                    <td class="td-act">
                      <button
                        type="button"
                        class="btn-kill-proc"
                        title="Примусово завершити процес"
                        :disabled="executing"
                        @click="killDirectly(proc.pid)"
                      >
                        <PowerOff :size="12" />
                        <span>Вбити</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-else class="unlocker-status-box is-clean">
            <CheckCircle2 :size="16" class="clean-icon" />
            <span>Жоден процес не блокує цей об'єкт. Ви можете виконати операцію безпосередньо.</span>
          </div>
        </div>

        <!-- Action Selection (Requested by user: Default is Delete) -->
        <div class="unlocker-section">
          <div class="section-title">
            <SlidersHorizontal :size="14" class="section-title-icon" />
            <span>Оберіть бажану дію:</span>
          </div>

          <div class="action-options-grid">
            <!-- Delete (Default) -->
            <label class="action-option-card" :class="{ 'is-selected': selectedAction === 'delete' }">
              <input v-model="selectedAction" type="radio" value="delete" name="unlocker-action" />
              <div class="action-card-content">
                <div class="action-card-header">
                  <Trash2 :size="15" class="action-icon text-red" />
                  <span class="action-name">Видалити (За замовчуванням)</span>
                </div>
                <div class="action-desc">Звільнити об'єкт та видалити його з системи</div>
              </div>
            </label>

            <!-- Move -->
            <label class="action-option-card" :class="{ 'is-selected': selectedAction === 'move' }">
              <input v-model="selectedAction" type="radio" value="move" name="unlocker-action" />
              <div class="action-card-content">
                <div class="action-card-header">
                  <Move :size="15" class="action-icon text-blue" />
                  <span class="action-name">Перемістити</span>
                </div>
                <div class="action-desc">Звільнити об'єкт та перемістити в іншу папку</div>
              </div>
            </label>

            <!-- Copy -->
            <label class="action-option-card" :class="{ 'is-selected': selectedAction === 'copy' }">
              <input v-model="selectedAction" type="radio" value="copy" name="unlocker-action" />
              <div class="action-card-content">
                <div class="action-card-header">
                  <Copy :size="15" class="action-icon text-green" />
                  <span class="action-name">Копіювати</span>
                </div>
                <div class="action-desc">Звільнити об'єкт та скопіювати у вибране місце</div>
              </div>
            </label>

            <!-- Unlock only -->
            <label class="action-option-card" :class="{ 'is-selected': selectedAction === 'unlock' }">
              <input v-model="selectedAction" type="radio" value="unlock" name="unlocker-action" />
              <div class="action-card-content">
                <div class="action-card-header">
                  <Unlock :size="15" class="action-icon text-amber" />
                  <span class="action-name">Лише розблокувати</span>
                </div>
                <div class="action-desc">Завершити процеси без переміщення чи видалення</div>
              </div>
            </label>
          </div>

          <!-- Move / Copy Destination Input -->
          <div v-if="selectedAction === 'move' || selectedAction === 'copy'" class="action-extra-field">
            <label class="extra-label">
              {{ selectedAction === 'move' ? 'Куди перемістити:' : 'Куди скопіювати:' }}
            </label>
            <input
              v-model="destinationDir"
              type="text"
              class="form-input"
              placeholder="Вкажіть шлях до цільової директорії..."
            />
          </div>

          <!-- Delete Options -->
          <div v-if="selectedAction === 'delete'" class="action-extra-field">
            <label class="checkbox-label">
              <input v-model="moveToRecycleBin" type="checkbox" />
              <span>Перемістити у Кошик Windows (зняти позначку для безповоротного видалення)</span>
            </label>
          </div>
        </div>

        <!-- Error Alert -->
        <div v-if="errorMessage" class="unlocker-error-box">
          <AlertCircle :size="15" />
          <span>{{ errorMessage }}</span>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer unlocker-footer">
        <button
          type="button"
          class="btn-secondary btn-refresh-scan"
          :disabled="loading || executing"
          title="Повторно перевірити процеси"
          @click="scanProcesses"
        >
          <RotateCw :size="13" :class="{ 'spin-icon': loading }" />
          <span>Оновити стан</span>
        </button>

        <div class="footer-actions">
          <button type="button" class="btn-secondary" :disabled="executing" @click="$emit('close')">Скасувати</button>
          <button
            type="button"
            class="btn-primary"
            :class="{ 'btn-danger': selectedAction === 'delete' }"
            :disabled="loading || executing"
            @click="handleSubmit"
          >
            <Loader2 v-if="executing" :size="14" class="spin-icon" />
            <component :is="submitButtonIcon" v-else :size="14" />
            <span>{{ submitButtonText }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { LockingProcess } from '@/types'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileText,
  Folder,
  Loader2,
  Move,
  PowerOff,
  RotateCw,
  SlidersHorizontal,
  Trash2,
  Unlock,
  X,
} from 'lucide-vue-next'

const props = defineProps<{
  targetPath: string
  targetName: string
  isDirectory: boolean
  oppositePath: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'action-completed', payload: { action: string; targetPath: string }): void
}>()

const loading = ref(true)
const executing = ref(false)
const processes = ref<LockingProcess[]>([])
const selectedPids = ref<Set<number>>(new Set())
const selectedAction = ref<'delete' | 'move' | 'copy' | 'unlock'>('delete')
const destinationDir = ref(props.oppositePath || '')
const moveToRecycleBin = ref(true)
const errorMessage = ref<string | null>(null)

const isAllSelected = computed(() => {
  return processes.value.length > 0 && selectedPids.value.size === processes.value.length
})

function togglePid(pid: number) {
  if (selectedPids.value.has(pid)) {
    selectedPids.value.delete(pid)
  } else {
    selectedPids.value.add(pid)
  }
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedPids.value.clear()
  } else {
    selectedPids.value = new Set(processes.value.map((p) => p.pid))
  }
}

async function scanProcesses() {
  loading.value = true
  errorMessage.value = null

  try {
    const res = await window.electronAPI.findLockingProcesses(props.targetPath)
    if (res.success && Array.isArray(res.processes)) {
      processes.value = res.processes
      selectedPids.value = new Set(res.processes.map((p) => p.pid))
    } else {
      processes.value = []
      selectedPids.value.clear()
      if (res.error) {
        errorMessage.value = res.error
      }
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Не вдалося перевірити процеси'
    processes.value = []
    selectedPids.value.clear()
  } finally {
    loading.value = false
  }
}

async function killDirectly(pid: number) {
  executing.value = true
  errorMessage.value = null
  try {
    const res = await window.electronAPI.killProcesses([pid])
    if (res.success) {
      await scanProcesses()
    } else if (res.errors && res.errors.length > 0) {
      errorMessage.value = res.errors.join('; ')
    }
  } catch (err: any) {
    errorMessage.value = err.message
  } finally {
    executing.value = false
  }
}

const submitButtonIcon = computed(() => {
  switch (selectedAction.value) {
    case 'delete':
      return Trash2
    case 'move':
      return Move
    case 'copy':
      return Copy
    case 'unlock':
      return Unlock
    default:
      return Unlock
  }
})

const submitButtonText = computed(() => {
  const hasLockers = selectedPids.value.size > 0
  switch (selectedAction.value) {
    case 'delete':
      return hasLockers ? 'Розблокувати і видалити' : "Видалити об'єкт"
    case 'move':
      return hasLockers ? 'Розблокувати і перемістити' : 'Перемістити'
    case 'copy':
      return hasLockers ? 'Розблокувати і скопіювати' : 'Скопіювати'
    case 'unlock':
      return 'Завершити процеси'
    default:
      return 'Виконати'
  }
})

async function handleSubmit() {
  executing.value = true
  errorMessage.value = null

  const pids = Array.from(selectedPids.value)

  try {
    const res = await window.electronAPI.unlockAndExecute({
      targetPath: props.targetPath,
      action: selectedAction.value,
      pidsToKill: pids,
      destinationDir: destinationDir.value,
      permanentDelete: !moveToRecycleBin.value,
    })

    if (res.success) {
      emit('action-completed', {
        action: selectedAction.value,
        targetPath: props.targetPath,
      })
      emit('close')
    } else {
      errorMessage.value = res.error || 'Не вдалося виконати операцію'
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Помилка виконання операції'
  } finally {
    executing.value = false
  }
}

onMounted(() => {
  scanProcesses()
})
</script>
