<script setup lang="ts">
defineProps<{
  count: number
}>()
</script>

<template>
  <p>Render count: {{ count }}</p>
</template>
