<template>
  <article>
    <h1>Invoice {{ number }}</h1>
    <p>Total: {{ total }}</p>
  </article>
</template>

<script setup lang="ts">
defineProps<{ number?: string; total?: string }>()
</script>
