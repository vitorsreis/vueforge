<script setup lang="ts">
defineProps<{ number?: string }>()
</script>

<template>
  <h1>Invoice {{ number }}</h1>
</template>
