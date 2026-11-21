<script setup>
defineProps({
  name: { type: String, default: 'Vueforge' },
})
</script>

<template>
  <h1>Hello {{ name }}</h1>
</template>
