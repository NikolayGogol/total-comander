<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card unlocker-modal-card">
      <div class="modal-header">
        <div class="modal-title">
          <Unlock :size="16" class="modal-icon text-amber" />
          <span>Unlocker — Розблокування об'єкта</span>
        </div>
        <button
          class="modal-close-btn"
          title="Закрити (Esc)"
          @click="$emit('close')"
        >
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
            <span>Статус блокування macOS</span>
          </div>

          <div v-if="loading" class="unlocker-status-box is-loading">
            <Loader2 :size="18" class="spin-icon" />
            <span
              >Сканування відкритих дескрипторів та блокуючих процесів...</span
            >
          </div>

          <div
            v-else-if="processes.length > 0"
            class="unlocker-status-box is-warning"
          >
            <div class="status-warning-header">
              <AlertTriangle :size="16" class="warning-icon" />
              <span>
                Виявлено <strong>{{ processes.length }}</strong> процес(ів), що
                блокують доступ:
              </span>
            </div>

            <div class="process-table-wrap">
              <table class="process-table">
                <thead>
                  <tr>
                    <th class="th-chk">
                      <input
                        type="checkbox"
                        :checked="isAllSelected"
                        title="Виділити всі"
                        @change="toggleSelectAll"
                      />
                    </th>
                    <th class="th-pid">PID</th>
                    <th class="th-name">Процес</th>
                    <th class="th-app">Додаток / Команда</th>
                    <th class="th-act">Дія</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="proc in processes" :key="proc.pid">
                    <td class="td-chk">
                      <input
                        type="checkbox"
                        :checked="selectedPids.has(proc.pid)"
                        @change="togglePid(proc.pid)"
                      />
                    </td>
                    <td class="td-pid">
                      <code>{{ proc.pid }}</code>
                    </td>
                    <td class="td-name">
                      <strong>{{ proc.name || "process" }}</strong>
                    </td>
                    <td class="td-app">{{ proc.appName || "--" }}</td>
                    <td class="td-act">
                      <button
                        type="button"
                        class="btn-kill-proc"
                        title="Примусово завершити процес (kill -9)"
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
            <span
              >Жоден активний процес не блокує цей об'єкт. Ви можете виконати
              операцію безпосередньо.</span
            >
          </div>
        </div>

        <!-- Action Selection -->
        <div class="unlocker-section">
          <div class="section-title">
            <SlidersHorizontal :size="14" class="section-title-icon" />
            <span>Оберіть бажану дію:</span>
          </div>

          <div class="action-options-grid">
            <!-- Delete (Default) -->
            <label
              class="action-option-card"
              :class="{ 'is-selected': selectedAction === 'delete' }"
            >
              <input
                v-model="selectedAction"
                type="radio"
                value="delete"
                name="unlocker-action"
              />
              <div class="action-card-content">
                <div class="action-card-title">
                  <Trash2 :size="14" class="icon-danger" />
                  <span>Видалити об'єкт</span>
                </div>
                <div class="action-card-desc">
                  Примусово закрити дескриптори та видалити
                </div>
              </div>
            </label>

            <!-- Move -->
            <label
              class="action-option-card"
              :class="{ 'is-selected': selectedAction === 'move' }"
            >
              <input
                v-model="selectedAction"
                type="radio"
                value="move"
                name="unlocker-action"
              />
              <div class="action-card-content">
                <div class="action-card-title">
                  <Move :size="14" class="icon-blue" />
                  <span>Перемістити</span>
                </div>
                <div class="action-card-desc">
                  Розблокувати і перемістити в іншу папку
                </div>
              </div>
            </label>

            <!-- Copy -->
            <label
              class="action-option-card"
              :class="{ 'is-selected': selectedAction === 'copy' }"
            >
              <input
                v-model="selectedAction"
                type="radio"
                value="copy"
                name="unlocker-action"
              />
              <div class="action-card-content">
                <div class="action-card-title">
                  <Copy :size="14" class="icon-amber" />
                  <span>Скопіювати</span>
                </div>
                <div class="action-card-desc">
                  Скопіювати об'єкт у цільову директорію
                </div>
              </div>
            </label>

            <!-- Unlock only -->
            <label
              class="action-option-card"
              :class="{ 'is-selected': selectedAction === 'unlock' }"
            >
              <input
                v-model="selectedAction"
                type="radio"
                value="unlock"
                name="unlocker-action"
              />
              <div class="action-card-content">
                <div class="action-card-title">
                  <Unlock :size="14" class="icon-green" />
                  <span>Тільки розблокувати</span>
                </div>
                <div class="action-card-desc">
                  Завершити блокуючі процеси та зняти прапорці
                </div>
              </div>
            </label>
          </div>

          <!-- Destination directory for move/copy -->
          <div
            v-if="selectedAction === 'move' || selectedAction === 'copy'"
            class="destination-field-wrap"
          >
            <label class="field-label">Цільова папка:</label>
            <input
              v-model="destinationDir"
              type="text"
              class="form-input destination-input"
              placeholder="/шлях/до/папки"
            />
          </div>

          <!-- Trash vs Permanent for delete -->
          <div v-if="selectedAction === 'delete'" class="delete-mode-wrap">
            <label class="checkbox-label">
              <input v-model="moveToRecycleBin" type="checkbox" />
              <span
                >Перемістити у Смітник macOS (Trash) замість безповоротного
                видалення</span
              >
            </label>
          </div>
        </div>

        <!-- Error Message Banner -->
        <div v-if="errorMessage" class="unlocker-error-banner">
          <AlertCircle :size="14" class="error-icon" />
          <span>{{ errorMessage }}</span>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="modal-footer">
        <button
          type="button"
          class="btn-secondary"
          :disabled="executing"
          title="Сканувати знову"
          @click="scanProcesses"
        >
          <RotateCw :size="13" :class="{ 'spin-icon': loading }" />
          <span>Перевірити знову</span>
        </button>

        <div class="footer-actions">
          <button
            type="button"
            class="btn-secondary"
            :disabled="executing"
            @click="$emit('close')"
          >
            Скасувати (Esc)
          </button>
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
import { computed, onMounted, ref } from "vue";
import type { LockingProcess } from "@/types";
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
} from "lucide-vue-next";

const props = defineProps<{
  targetPath: string;
  targetName: string;
  isDirectory: boolean;
  oppositePath: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (
    e: "action-completed",
    payload: { action: string; targetPath: string },
  ): void;
  (e: "toast", message: string, type: "info" | "success" | "error"): void;
}>();

const loading = ref(true);
const executing = ref(false);
const processes = ref<LockingProcess[]>([]);
const selectedPids = ref<Set<number>>(new Set());
const selectedAction = ref<"delete" | "move" | "copy" | "unlock">("delete");
const destinationDir = ref(props.oppositePath || "");
const moveToRecycleBin = ref(true);
const errorMessage = ref<string | null>(null);

const isAllSelected = computed(() => {
  return (
    processes.value.length > 0 &&
    selectedPids.value.size === processes.value.length
  );
});

function togglePid(pid: number) {
  if (selectedPids.value.has(pid)) {
    selectedPids.value.delete(pid);
  } else {
    selectedPids.value.add(pid);
  }
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedPids.value.clear();
  } else {
    selectedPids.value = new Set(processes.value.map((p) => p.pid));
  }
}

async function scanProcesses() {
  loading.value = true;
  errorMessage.value = null;

  try {
    const res = await window.electronAPI.findLockingProcesses(props.targetPath);
    if (res.success && Array.isArray(res.processes)) {
      processes.value = res.processes;
      selectedPids.value = new Set(res.processes.map((p) => p.pid));
    } else {
      processes.value = [];
      selectedPids.value.clear();
      if (res.error) {
        errorMessage.value = res.error;
      }
    }
  } catch (err: any) {
    errorMessage.value = err.message || "Не вдалося перевірити процеси";
    processes.value = [];
    selectedPids.value.clear();
  } finally {
    loading.value = false;
  }
}

async function killDirectly(pid: number) {
  executing.value = true;
  errorMessage.value = null;
  try {
    const res = await window.electronAPI.killProcesses([pid]);
    if (res.success) {
      emit("toast", `Процес PID ${pid} успішно завершено`, "success");
      await scanProcesses();
    } else if (res.errors && res.errors.length > 0) {
      errorMessage.value = res.errors.join("; ");
    }
  } catch (err: any) {
    errorMessage.value = err.message;
  } finally {
    executing.value = false;
  }
}

const submitButtonIcon = computed(() => {
  switch (selectedAction.value) {
    case "delete":
      return Trash2;
    case "move":
      return Move;
    case "copy":
      return Copy;
    case "unlock":
      return Unlock;
    default:
      return Unlock;
  }
});

const submitButtonText = computed(() => {
  const hasLockers = selectedPids.value.size > 0;
  switch (selectedAction.value) {
    case "delete":
      return hasLockers ? "Розблокувати і видалити" : "Видалити об'єкт";
    case "move":
      return hasLockers ? "Розблокувати і перемістити" : "Перемістити";
    case "copy":
      return hasLockers ? "Розблокувати і скопіювати" : "Скопіювати";
    case "unlock":
      return "Завершити процеси та розблокувати";
    default:
      return "Виконати";
  }
});

async function handleSubmit() {
  executing.value = true;
  errorMessage.value = null;

  const pids = Array.from(selectedPids.value);

  try {
    const res = await window.electronAPI.unlockAndExecute({
      targetPath: props.targetPath,
      action: selectedAction.value,
      pidsToKill: pids,
      destinationDir: destinationDir.value,
      permanentDelete: !moveToRecycleBin.value,
    });

    if (res.success) {
      emit("action-completed", {
        action: selectedAction.value,
        targetPath: props.targetPath,
      });
      emit("close");
    } else {
      errorMessage.value = res.error || "Не вдалося виконати операцію";
    }
  } catch (err: any) {
    errorMessage.value = err.message || "Помилка виконання операції";
  } finally {
    executing.value = false;
  }
}

onMounted(() => {
  scanProcesses();
});
</script>
