<template>
  <aside class="remote-profiles-sidebar">
    <div class="profiles-header">
      <span class="sidebar-title">Збережені профілі</span>
      <button
        class="btn-icon-sm"
        title="Додати новий профіль"
        @click="$emit('create')"
      >
        <Plus :size="13" />
      </button>
    </div>

    <div class="profiles-list">
      <div
        v-for="profile in profiles"
        :key="profile.id"
        class="profile-item"
        :class="{ 'is-selected': selectedProfileId === profile.id }"
        @click="$emit('select', profile)"
        @contextmenu.prevent.stop="$emit('contextmenu', $event, profile)"
      >
        <div class="profile-main">
          <span class="profile-name">{{ profile.name }}</span>
          <span class="profile-subtitle">
            {{ profile.username }}@{{ profile.host }}:{{ profile.port }}
          </span>
        </div>
        <div class="profile-badges">
          <span class="protocol-badge" :class="profile.protocol">
            {{ profile.protocol.toUpperCase() }}
          </span>
          <button
            class="btn-delete-profile"
            title="Видалити профіль"
            @click.stop="$emit('delete', profile.id)"
          >
            <Trash2 :size="12" />
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { Plus, Trash2 } from "lucide-vue-next";
import type { RemoteProfile } from "@/types";

defineProps<{
  profiles: RemoteProfile[];
  selectedProfileId: string | null;
}>();

defineEmits<{
  (e: "select", profile: RemoteProfile): void;
  (e: "create"): void;
  (e: "delete", id: string): void;
  (e: "contextmenu", event: MouseEvent, profile: RemoteProfile): void;
}>();
</script>
