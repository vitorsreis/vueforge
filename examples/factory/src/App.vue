<script setup>
defineProps({ name: { type: String, default: 'vueforge' } })
</script>

<template>
  <h1>Hello {{ name }}</h1>
</template>
