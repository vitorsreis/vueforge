<script setup>
defineProps({ title: String })
</script>

<template>
  <Teleport to="head">
    <title>{{ title }}</title>
  </Teleport>
</template>
